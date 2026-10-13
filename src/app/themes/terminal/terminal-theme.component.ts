import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { ThemeService } from '../theme.service';
import { parseTheme, THEMES } from '../themes';

export type Line =
  | { kind: 'command'; text: string }
  | { kind: 'output'; text: string }
  | { kind: 'name' }
  | { kind: 'links' };

export const PROMPT = 'guest@noahsurprenant.com:~$';

// Already run when the page opens, so the links are there without typing anything
const BOOT_COMMANDS = ['whoami', 'ls links/'];

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
export class TerminalThemeComponent {
  protected readonly prompt = PROMPT;
  protected readonly name = NAME;
  protected readonly links = LINKS;
  private readonly themes = inject(ThemeService);

  readonly lines = signal<Line[]>([]);

  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly history: string[] = [];
  private historyIndex = 0;

  constructor() {
    afterRenderEffect(() => {
      this.lines();
      const screen = this.screen().nativeElement;
      screen.scrollTop = screen.scrollHeight;
    });
    // Put the cursor in the prompt. Only where there's a real keyboard: on a phone focusing would
    // pop up the on-screen one.
    afterNextRender(() => {
      if (window.matchMedia('(pointer: fine)').matches) {
        this.input().nativeElement.focus({ preventScroll: true });
      }
    });
    for (const command of BOOT_COMMANDS) this.run(command, false);
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
    this.input().nativeElement.focus({ preventScroll: true });
  }
}
