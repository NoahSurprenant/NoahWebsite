import { TestBed } from '@angular/core/testing';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { ThemeService } from '../theme.service';
import { TerminalThemeComponent } from './terminal-theme.component';

describe('TerminalThemeComponent', () => {
  beforeEach(() => {
    stubMatchMedia(REDUCED_MOTION);
    localStorage.clear();
  });
  afterEach(() => window.history.replaceState(null, '', '/'));

  async function create() {
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('boots with the name and the links', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.name')?.textContent).toBe('Noah Surprenant');
    expect(Array.from(el.querySelectorAll('.links a')).map(a => a.getAttribute('aria-label')))
      .toEqual(['LinkedIn', 'GitHub', 'Email', 'Resume (PDF)']);
    expect(el.querySelector('input')).toBeTruthy();
  });

  it('runs commands typed at the prompt', async () => {
    const fixture = await create();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.value = 'frobnicate';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('bash: frobnicate: command not found');
    expect(input.value).toBe('');
  });

  it('opens a link', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const fixture = await create();
    fixture.componentInstance.run('open GitHub');
    expect(open).toHaveBeenCalledWith('https://github.com/NoahSurprenant', '_blank', 'noopener,noreferrer');
    fixture.componentInstance.run('open myspace');
    expect(fixture.componentInstance.lines().at(-1)).toEqual(expect.objectContaining({ text: expect.stringContaining('No such link') }));
    open.mockRestore();
  });

  it('switches theme', async () => {
    const fixture = await create();
    fixture.componentInstance.run('theme xbox');
    expect(TestBed.inject(ThemeService).theme()).toBe('xbox');
  });

  it('clears the screen', async () => {
    const fixture = await create();
    fixture.componentInstance.run('clear');
    expect(fixture.componentInstance.lines()).toEqual([]);
  });
});

describe('TerminalThemeComponent commands', () => {
  beforeEach(() => {
    stubMatchMedia(REDUCED_MOTION);
    localStorage.clear();
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  async function create() {
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    await fixture.whenStable();
    const terminal = fixture.componentInstance;
    /** Runs a command and returns what it printed. */
    const output = (command: string) => {
      const before = terminal.lines().length;
      terminal.run(command);
      return terminal.lines().slice(before + 1).map(line => ('text' in line ? line.text : line.kind)).join('\n');
    };
    return { fixture, terminal, output, el: fixture.nativeElement as HTMLElement };
  }

  it('answers the other commands', async () => {
    const { output } = await create();
    expect(output('help')).toContain('open <link>');
    expect(output('?')).toContain('Commands:');
    expect(output('whoami')).toBe('name');
    expect(output('dir')).toBe('links');
    expect(output('cat links/resume')).toBe('Opening Resume (PDF)...');
    expect(output('open')).toContain('No such link');
    expect(output('sudo rm -rf /')).toContain('not in the sudoers file');
    expect(output('logout')).toContain('There is no escape');
    expect(output('echo hello   world')).toBe('hello world');
    expect(output('')).toBe('');
    expect(output('theme vaporwave')).toBe('theme: vaporwave: unknown theme');
  });

  it('lists the themes, marking this one', async () => {
    const { output } = await create();
    const list = output('theme').split('\n');
    expect(list).toHaveLength(4);
    expect(list.find(line => line.startsWith('*'))).toContain('terminal');
  });

  it('steps through earlier commands with the arrow keys', async () => {
    const { el } = await create();
    const input = el.querySelector('input')!;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    };
    const press = (key: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    type('whoami');
    type('ls');
    // Blank lines aren't kept
    type('');

    press('ArrowUp');
    expect(input.value).toBe('ls');
    press('ArrowUp');
    press('ArrowUp');
    expect(input.value).toBe('whoami');
    press('ArrowDown');
    expect(input.value).toBe('ls');
    press('ArrowDown');
    expect(input.value).toBe('');
  });

  it('clears the screen with Ctrl+L, and ignores other keys', async () => {
    const { el, terminal } = await create();
    const input = el.querySelector('input')!;
    input.value = 'who';
    expect(input.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', cancelable: true }))).toBe(true);
    expect(input.value).toBe('who');
    expect(input.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, cancelable: true }))).toBe(false);
    expect(terminal.lines()).toEqual([]);
  });

  it('puts the cursor on the prompt when the screen is clicked, but not on a link or a selection', async () => {
    const { fixture, el } = await create();
    document.body.appendChild(el);
    const input = el.querySelector('input')!;
    const screen = el.querySelector<HTMLElement>('.screen')!;

    el.querySelector('a')!.click();
    expect(document.activeElement).not.toBe(input);

    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Noah' } as Selection);
    screen.click();
    expect(document.activeElement).not.toBe(input);

    vi.restoreAllMocks();
    screen.click();
    expect(document.activeElement).toBe(input);
    fixture.destroy();
    el.remove();
  });

  it('puts the cursor on the prompt straight away where there is a mouse', async () => {
    stubMatchMedia(REDUCED_MOTION, '(pointer: fine)');
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('input'));
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('keeps the newest output in view', async () => {
    const { fixture, el, terminal } = await create();
    const screen = el.querySelector<HTMLElement>('.screen')!;
    Object.defineProperty(screen, 'scrollHeight', { configurable: true, value: 5000 });
    terminal.run('help');
    await fixture.whenStable();
    expect(screen.scrollTop).toBe(5000);
  });

  it('hides the hint once the screen fills up', async () => {
    const { fixture, el, terminal } = await create();
    expect(el.querySelector('.hint')).toBeTruthy();
    terminal.run('help');
    await fixture.whenStable();
    expect(el.querySelector('.hint')).toBeNull();
  });
});
