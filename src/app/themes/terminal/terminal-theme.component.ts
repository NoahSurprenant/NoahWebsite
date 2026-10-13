import { afterRenderEffect, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { ThemeService } from '../theme.service';
import { parseTheme, THEMES } from '../themes';

export type Line =
  | { kind: 'command'; text: string }
  | { kind: 'output'; text: string }
  | { kind: 'name' }
  | { kind: 'links' };

export const PROMPT = 'guest@noahsurprenant.com:~$';

// Typed out on load, as if someone had just run them
const BOOT_COMMANDS = ['whoami', 'ls links/'];
const TYPE_MS = 70;
const PAUSE_MS = 400;

const HELP = `Commands:
  whoami          who this site belongs to
  ls              list the links
  open <link>     open one: ${LINKS.map(l => l.id).join(', ')}
  theme [name]    list the themes, or switch: ${THEMES.map(t => t.id).join(', ')}
  clear           clear the screen`;

/** A shell prompt. The links are `ls` output, and a few commands work. */
@Component({
  selector: 'app-terminal-theme',
  templateUrl: './terminal-theme.component.html',
  styleUrls: ['./terminal-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminalThemeComponent implements OnDestroy {
  protected readonly prompt = PROMPT;
  protected readonly name = NAME;
  protected readonly links = LINKS;
  private readonly themes = inject(ThemeService);

  readonly lines = signal<Line[]>([]);
  /** What's been "typed" of the boot command in progress */
  protected readonly typing = signal('');
  /** False until the boot commands have run */
  protected readonly ready = signal(false);

  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly history: string[] = [];
  private historyIndex = 0;
  private timeout?: number;

  constructor() {
    afterRenderEffect(() => {
      this.lines();
      this.typing();
      const screen = this.screen().nativeElement;
      screen.scrollTop = screen.scrollHeight;
    });
    // Once the prompt appears, put the cursor in it. Only where there's a real keyboard: on a phone
    // focusing would pop up the on-screen one.
    afterRenderEffect(() => {
      if (this.ready() && window.matchMedia('(pointer: fine)').matches) {
        this.input()?.nativeElement.focus({ preventScroll: true });
      }
    });
    this.boot();
  }

  ngOnDestroy() {
    window.clearTimeout(this.timeout);
  }

  private async boot() {
    // With reduced motion the commands appear already run
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const command of BOOT_COMMANDS) {
      if (animate) {
        await this.wait(PAUSE_MS);
        for (let i = 1; i <= command.length; i++) {
          this.typing.set(command.slice(0, i));
          await this.wait(TYPE_MS);
        }
        this.typing.set('');
      }
      this.run(command, false);
    }
    this.ready.set(true);
  }

  private wait(ms: number) {
    return new Promise<void>(resolve => this.timeout = window.setTimeout(resolve, ms));
  }

  /** Runs a command line and prints what it outputs. */
  run(commandLine: string, remember = true) {
    const out: Line[] = [{ kind: 'command', text: commandLine }];
    const [command, ...args] = commandLine.trim().split(/\s+/);
    const text = (t: string) => out.push({ kind: 'output', text: t });
    if (remember && command) {
      this.history.push(commandLine);
      this.historyIndex = this.history.length;
    }

    switch (command) {
      case undefined:
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
      case 'echo':
        text(args.join(' '));
        break;
      default:
        text(`bash: ${command}: command not found. Type 'help' for the commands.`);
    }
    this.lines.update(lines => [...lines, ...out]);
  }

  protected onKeydown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      this.run(input.value);
      input.value = '';
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = this.history[this.historyIndex] ?? '';
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      this.lines.set([]);
    }
  }

  /** Clicking the screen puts the cursor on the prompt, unless the click was selecting text or a link. */
  protected focusInput(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('a') || window.getSelection()?.toString()) return;
    this.input()?.nativeElement.focus({ preventScroll: true });
  }
}
