import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { ThemeService } from '../theme.service';
import { parseTheme, THEMES } from '../themes';
import { Cat } from './cat';
import { Day, findRepo, GithubData, GithubLoader } from './github';
import { KeyboardComponent } from './keyboard.component';
import { RidgeComponent } from './ridge.component';
import { complete, contribSummary, HELP, neofetch, repoCard, SHAREABLE } from './shell';
import { loadVisitors, short, sparkline } from './visitors';

export type Line =
  | { kind: 'command'; text: string }
  | { kind: 'output'; text: string }
  | { kind: 'name' }
  | { kind: 'links' }
  | { kind: 'repos'; names: string[] }
  | { kind: 'link'; href: string; text: string }
  | { kind: 'ridge'; days: readonly Day[] };

export type Mode = 'insert' | 'normal' | 'command';

export const PROMPT = 'guest@noahsurprenant.com:~$';

// Typed out when the page opens, so the links are there without typing anything
const BOOT_COMMANDS = ['whoami', 'ls links/'];
/** Milliseconds per typed character, at random between these */
const TYPING = [45, 110];
/** The pause after a typed command, before Enter */
const ENTER_MS = 260;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A shell prompt. The links are `ls` output, and a few commands work. Esc drops to a Vim-style
 * normal mode (j/k scroll, : runs a command), shown in the status line along with the cat on the
 * keyboard and the visitors over the last two days.
 */
@Component({
  selector: 'app-terminal-theme',
  templateUrl: './terminal-theme.component.html',
  styleUrls: ['./terminal-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyboardComponent, RidgeComponent],
  providers: [Cat],
  host: { '(document:keydown)': 'normalKey($event)' },
})
export class TerminalThemeComponent {
  protected readonly prompt = PROMPT;
  protected readonly name = NAME;
  protected readonly links = LINKS;
  protected readonly cat = inject(Cat);
  private readonly themes = inject(ThemeService);
  private readonly github = new GithubLoader();
  private readonly data = signal<GithubData | null>(null);

  readonly lines = signal<Line[]>([]);
  readonly mode = signal<Mode>('normal');
  /** The boot command being typed, shown at the prompt; null once the prompt is the visitor's */
  protected readonly typing = signal<string | null>(null);
  protected readonly visitors = signal<number[] | null>(null);
  protected readonly visitorGraph = computed(() => {
    const hours = this.visitors();
    return hours && { line: sparkline(hours), total: short(hours.reduce((a, b) => a + b, 0)) };
  });

  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly exInput = viewChild<ElementRef<HTMLInputElement>>('ex');
  private readonly history: string[] = [];
  private historyIndex = 0;
  /** The line a Tab left ambiguous; a second Tab on it lists the choices */
  private lastTab?: string;
  /** Set by a key during the typed boot, to finish it at once */
  private skipTyping = false;

  constructor() {
    afterRenderEffect(() => {
      this.lines();
      const screen = this.screen().nativeElement;
      screen.scrollTop = screen.scrollHeight;
    });
    afterRenderEffect(() => {
      if (this.mode() === 'command') this.exInput()?.nativeElement.focus({ preventScroll: true });
    });
    // Put the cursor in the prompt. Only where there's a real keyboard: on a phone focusing would
    // pop up the on-screen one.
    afterNextRender(() => {
      if (window.matchMedia('(pointer: fine)').matches) {
        this.input().nativeElement.focus({ preventScroll: true });
      }
    });
    let destroyed = false;
    inject(DestroyRef).onDestroy(() => (destroyed = true));
    this.github.load().then(data => this.data.set(data), () => {});
    loadVisitors().then(hours => this.visitors.set(hours));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const command of BOOT_COMMANDS) this.run(command, false);
      this.runFromLink();
    } else {
      this.typeBoot(() => destroyed);
    }
  }

  /** Types the boot commands out like a person would; any key finishes them at once. */
  private async typeBoot(destroyed: () => boolean) {
    for (const command of BOOT_COMMANDS) {
      for (let i = 1; i <= command.length && !this.skipTyping; i++) {
        this.typing.set(command.slice(0, i));
        await sleep(TYPING[0] + Math.random() * (TYPING[1] - TYPING[0]));
      }
      if (!this.skipTyping) await sleep(ENTER_MS);
      if (destroyed()) return;
      this.run(command, false);
    }
    this.typing.set(null);
    this.runFromLink();
  }

  /** A link like /#fetch%20Headhunter runs that command, if it's one that only prints. */
  private runFromLink() {
    const command = decodeURIComponent(location.hash.slice(1)).trim();
    if (SHAREABLE.has(command.split(/\s+/)[0])) this.run(command, false);
  }

  /** Runs a command line and prints what it outputs. */
  run(commandLine: string, remember = true) {
    const out: Line[] = [{ kind: 'command', text: commandLine }];
    const [command, ...args] = commandLine.trim().split(/\s+/);
    const text = (t: string) => out.push({ kind: 'output', text: t });
    if (remember && command) {
      this.history.push(commandLine);
      this.historyIndex = this.history.length;
      // So the address bar can be copied to show someone the same thing
      if (SHAREABLE.has(command)) history.replaceState(history.state, '', `#${encodeURIComponent(commandLine.trim())}`);
    }

    switch (command) {
      case '':
        break;
      case 'help':
      case '?':
        text(HELP);
        break;
      case 'whoami':
        out.push({ kind: 'name' });
        break;
      case 'ls':
      case 'dir':
        if (args[0]?.startsWith('repos')) {
          this.lines.update(lines => [...lines, ...out]);
          this.withGithub(data => [{ kind: 'repos', names: data.repos.map(r => r.name) }]);
          return;
        }
        out.push({ kind: 'links' });
        break;
      case 'open':
      case 'cat':
      case 'xdg-open': {
        const link = LINKS.find(l => l.id === args[0]?.toLowerCase().replace(/^links\//, ''));
        if (link) {
          window.open(link.href, '_blank', 'noopener,noreferrer');
          text(`Opening ${link.label}...`);
        } else {
          text(`${command}: ${args[0] ?? ''}: No such link. Try: ${LINKS.map(l => l.id).join(', ')}`);
        }
        break;
      }
      case 'neofetch':
      case 'fetch':
      case 'contrib':
        this.lines.update(lines => [...lines, ...out]);
        this.withGithub(data => this.githubCommand(command, args[0], data));
        return;
      case 'theme': {
        if (!args[0]) {
          text(THEMES.map(t => `${t.id === 'terminal' ? '*' : ' '} ${t.id.padEnd(10)} ${t.label}`).join('\n'));
          break;
        }
        const theme = parseTheme(args[0]);
        if (theme) {
          this.themes.select(theme);
        } else {
          text(`theme: ${args[0]}: unknown theme`);
        }
        break;
      }
      case 'pet':
        text(this.cat.pet(args[0]));
        break;
      case 'history':
        text(this.history.map((line, i) => `${String(i + 1).padStart(4)}  ${line}`).join('\n'));
        break;
      case 'clear':
      case 'cls':
        this.lines.set([]);
        return;
      case 'sudo':
        text('guest is not in the sudoers file. This incident will be reported.');
        break;
      case 'exit':
      case 'logout':
        text('There is no escape. Try `theme skyrim`.');
        break;
      case 'vim':
      case 'vi':
      case 'nano':
      case 'emacs':
        text('You are already in it. Press Esc, then : for commands.');
        break;
      case 'echo':
        text(args.join(' '));
        break;
      default:
        text(`bash: ${command}: command not found. Type 'help' for the commands.`);
    }
    this.lines.update(lines => [...lines, ...out]);
  }

  private githubCommand(command: string, arg: string | undefined, data: GithubData): Line[] {
    if (command === 'neofetch') return [{ kind: 'output', text: neofetch(data, PROMPT.slice(0, -3)) }];
    if (command === 'contrib') return [{ kind: 'ridge', days: data.days }, { kind: 'output', text: contribSummary(data.days) }];
    if (!arg) return [{ kind: 'output', text: 'usage: fetch <repo>' }, { kind: 'repos', names: data.repos.map(r => r.name) }];
    const repo = findRepo(data, arg);
    if (!repo) return [{ kind: 'output', text: `fetch: ${arg}: no such repo. Try: ls repos/` }];
    return [{ kind: 'output', text: repoCard(repo) }, { kind: 'link', href: repo.url, text: repo.url.replace(/^https:\/\//, '') }];
  }

  /** Prints what `make` builds from the GitHub snapshot, once it's loaded. */
  private withGithub(make: (data: GithubData) => Line[]) {
    const print = (lines: Line[]) => this.lines.update(all => [...all, ...lines]);
    const data = this.data();
    if (data) {
      print(make(data));
      return;
    }
    this.github.load().then(
      loaded => {
        this.data.set(loaded);
        print(make(loaded));
      },
      () => print([{ kind: 'output', text: 'Could not reach GitHub. Try again in a moment.' }]),
    );
  }

  protected onKeydown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (this.typing() !== null) {
      // A key while the boot is typing finishes it, and that key isn't typed
      event.preventDefault();
      this.skipTyping = true;
      return;
    }
    if (event.key !== 'Tab') this.lastTab = undefined;
    if (event.key === 'Enter') {
      this.run(input.value);
      input.value = '';
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.tab(input);
    } else if (event.key === 'Escape') {
      input.blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = this.history[this.historyIndex] ?? '';
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      this.lines.set([]);
    }
  }

  /** Completes the line; a second Tab on an ambiguous one lists the choices, like bash. */
  private tab(input: HTMLInputElement) {
    const { line, options } = complete(input.value, this.data()?.repos.map(r => r.name) ?? []);
    if (options.length && this.lastTab === line) {
      this.lines.update(lines => [...lines, { kind: 'command', text: line }, { kind: 'output', text: options.join('  ') }]);
    }
    this.lastTab = options.length ? line : undefined;
    input.value = line;
  }

  /** Normal mode, outside the prompt: Vim's keys for scrolling, i to type again, : for a command. */
  protected normalKey(event: KeyboardEvent) {
    if (this.mode() !== 'normal' || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((event.target as HTMLElement).closest('input, a, button, canvas')) return;
    const screen = this.screen().nativeElement;
    const line = parseFloat(getComputedStyle(screen).lineHeight);
    const scroll: Record<string, number> = {
      j: line, ArrowDown: line, k: -line, ArrowUp: -line,
      d: screen.clientHeight / 2, u: -screen.clientHeight / 2,
      g: -screen.scrollHeight, G: screen.scrollHeight,
    };
    if (event.key in scroll) {
      screen.scrollBy({ top: scroll[event.key] });
    } else if (event.key === 'i' || event.key === 'a' || event.key === 'Enter') {
      this.input().nativeElement.focus({ preventScroll: true });
    } else if (event.key === ':') {
      this.mode.set('command');
    } else {
      return;
    }
    event.preventDefault();
  }

  protected exKey(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      this.ex(input.value);
      this.mode.set('normal');
    } else if (event.key === 'Escape' || (event.key === 'Backspace' && !input.value)) {
      this.mode.set('normal');
    }
  }

  /** A : command. A few of Vim's, and the theme switch. */
  ex(text: string) {
    const [command, ...args] = text.trim().split(/\s+/);
    const say = (output: string) =>
      this.lines.update(lines => [...lines, { kind: 'output', text: `:${text.trim()}` }, { kind: 'output', text: output }]);
    switch (command) {
      case '':
        return;
      case 'q':
      case 'q!':
      case 'qa':
      case 'wq':
      case 'x':
        say('There is no escape. Try :theme skyrim');
        return;
      case 'w':
        say("E45: 'readonly' option is set (add ! to override)");
        return;
      case 'w!':
        say('Nice try.');
        return;
      case 'h':
      case 'help':
        say(HELP);
        return;
      case 'theme':
      case 'colorscheme':
        this.run(['theme', ...args].join(' '), false);
        return;
      default:
        say(`E492: Not an editor command: ${text.trim()}`);
    }
  }

  protected focused() {
    this.mode.set('insert');
  }

  protected blurred() {
    this.mode.set('normal');
  }

  /** Clicking a repo name prints its card. */
  protected fetchRepo(name: string) {
    this.run(`fetch ${name}`);
  }

  /** Clicking the screen puts the cursor on the prompt, unless the click was selecting text or a link. */
  protected focusInput(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('a, button, canvas') || window.getSelection()?.toString()) return;
    this.input().nativeElement.focus({ preventScroll: true });
  }
}
