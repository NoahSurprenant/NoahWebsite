import { TestBed } from '@angular/core/testing';
import { manualFrames } from '../../testing/canvas';
import { SAMPLE, stubFetch } from '../../testing/github';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { ThemeService } from '../theme.service';
import { GITHUB_API_URL } from './github';
import { TerminalThemeComponent } from './terminal-theme.component';
import { VISITORS_URL } from './visitors';

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
    fixture.componentInstance.run('whoami');
    fixture.componentInstance.run('cls');
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
    expect(output('exit')).toContain('There is no escape');
    expect(output('xdg-open email')).toBe('Opening Email...');
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

describe('TerminalThemeComponent extras', () => {
  beforeEach(() => {
    stubMatchMedia(REDUCED_MOTION);
    localStorage.clear();
    stubFetch({ [GITHUB_API_URL]: SAMPLE, [VISITORS_URL]: { hours: [1, 2, 3] } });
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create() {
    manualFrames();
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    await fixture.whenStable();
    const terminal = fixture.componentInstance;
    const settle = async () => {
      await new Promise(resolve => setTimeout(resolve));
      await fixture.whenStable();
    };
    await settle();
    const printed = () => terminal.lines().map(line => ('text' in line ? line.text : 'info' in line ? line.info : line.kind)).join('\n');
    const input = el.querySelector<HTMLInputElement>('.input-line input')!;
    const key = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...init });
      target.dispatchEvent(event);
      fixture.detectChanges();
      return event.defaultPrevented;
    };
    onTestFinished(() => {
      fixture.destroy();
      el.remove();
    });
    return { fixture, el, terminal, settle, printed, input, key };
  }

  it('types the boot commands out, then hands over the prompt', async () => {
    stubMatchMedia();
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(el.querySelector('.typing')?.textContent).toBe('w');
    expect(el.querySelector('input')!.classList).toContain('hidden');
    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    expect(fixture.componentInstance.lines().map(l => l.kind)).toEqual(['command', 'name', 'command', 'links']);
    expect(el.querySelector('.typing')).toBeNull();
    fixture.destroy();
  });

  it('finishes the typing at once when a key is pressed, without typing that key', async () => {
    stubMatchMedia();
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(fixture.componentInstance.lines()).toHaveLength(4);
    fixture.destroy();
  });

  it('stops typing when the theme is switched away', async () => {
    stubMatchMedia();
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TerminalThemeComponent);
    fixture.detectChanges();
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fixture.componentInstance.lines()).toEqual([]);
  });

  it('runs a command from the link, if it only prints', async () => {
    window.history.replaceState(null, '', '/#fetch%20headhunter');
    const { printed } = await create();
    expect(printed()).toContain('fetch headhunter\nHeadhunter\n==========');
    window.history.replaceState(null, '', '/#open%20github');
    const open = vi.spyOn(window, 'open');
    await create();
    expect(open).not.toHaveBeenCalled();
  });

  it('puts what it printed in the address bar, until the screen is cleared or the theme left', async () => {
    const { terminal, fixture } = await create();
    terminal.run('neofetch');
    expect(location.hash).toBe('#neofetch');
    terminal.run('echo hi');
    expect(location.hash).toBe('#neofetch');
    terminal.run('clear');
    expect(location.hash).toBe('');
    terminal.run('cls');
    expect(location.hash).toBe('');
    terminal.run('neofetch');
    fixture.destroy();
    expect(location.hash).toBe('');
  });

  it('ignores a link with a broken escape', async () => {
    window.history.replaceState(null, '', '/#100%');
    const { terminal } = await create();
    expect(terminal.lines().map(l => l.kind)).toEqual(['command', 'name', 'command', 'links']);
  });

  it('prints the GitHub profile, a repo, the repos and the year', async () => {
    const { el, terminal, printed, fixture } = await create();
    terminal.run('neofetch');
    expect(printed()).toContain('Contribs   28 in the last year');
    terminal.run('fetch HttpContextMapper');
    expect(printed()).toContain('Maps contexts');
    fixture.detectChanges();
    expect(el.querySelector<HTMLAnchorElement>('.url')!.href).toBe('https://github.com/NoahSurprenant/HttpContextMapper');
    terminal.run('fetch nope');
    expect(printed()).toContain('fetch: nope: no such repo');
    terminal.run('fetch');
    expect(printed()).toContain('usage: fetch <repo>');
    terminal.run('ls repos/');
    terminal.run('contrib');
    fixture.detectChanges();
    expect(el.querySelectorAll('.repos')).toHaveLength(2);
    expect(el.querySelector('app-ridge')).toBeTruthy();
    expect(printed()).toContain('3 weeks, 28 contributions');

    el.querySelector<HTMLButtonElement>('.repos button')!.click();
    expect(terminal.lines().at(-3)).toEqual({ kind: 'command', text: 'fetch Headhunter' });
    // With a mouse, nothing to tap and the words say hover
    expect(el.querySelector('.tap')).toBeNull();
    expect(printed()).toContain('hover for a week');
  });

  it('gives a touch screen commands to tap, and says tap', async () => {
    stubMatchMedia(REDUCED_MOTION, '(pointer: coarse)');
    const { el, terminal, printed, fixture } = await create();
    expect(el.querySelector('.hint')!.textContent).not.toContain('Tab');
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.tap button'));
    expect(buttons.map(b => b.textContent)).toEqual(['help', 'neofetch', 'contrib', 'ls repos/', 'clear']);
    buttons[2].click();
    fixture.detectChanges();
    expect(terminal.lines().at(-3)).toEqual({ kind: 'command', text: 'contrib' });
    expect(printed()).toContain('tap for a week');
  });

  it('keeps a slow answer under its command, and drops it once the screen is cleared', async () => {
    let answer!: (value: Response) => void;
    // GitHub's answer waits until the test gives it; there are no visitors
    vi.stubGlobal('fetch', vi.fn((url: string) => url === GITHUB_API_URL
      ? new Promise<Response>(resolve => (answer = resolve))
      : Promise.resolve(new Response('', { status: 503 }))));
    const { terminal, settle, printed } = await create();
    terminal.run('neofetch');
    expect(printed()).toContain('neofetch\nFetching from GitHub...');
    terminal.run('echo after');
    answer(new Response(JSON.stringify(SAMPLE)));
    await settle();
    expect(printed().indexOf('Contribs')).toBeLessThan(printed().indexOf('echo after'));
    expect(printed()).not.toContain('Fetching from GitHub');
  });

  it('prints nothing for an answer that comes after a clear', async () => {
    let answer!: (value: Response) => void;
    // GitHub's answer waits until the test gives it; there are no visitors
    vi.stubGlobal('fetch', vi.fn((url: string) => url === GITHUB_API_URL
      ? new Promise<Response>(resolve => (answer = resolve))
      : Promise.resolve(new Response('', { status: 503 }))));
    const { terminal, settle } = await create();
    terminal.run('neofetch');
    terminal.run('clear');
    answer(new Response(JSON.stringify(SAMPLE)));
    await settle();
    expect(terminal.lines()).toEqual([]);
  });

  it('waits for the snapshot, and says so when GitHub is out of reach', async () => {
    stubFetch({});
    const { terminal, printed, settle } = await create();
    terminal.run('neofetch');
    await settle();
    expect(printed()).toContain('Could not reach GitHub');
    stubFetch({ [GITHUB_API_URL]: SAMPLE });
    terminal.run('ls repos');
    await settle();
    expect(terminal.lines().at(-1)!.kind).toBe('repos');
  });

  it('completes with Tab, listing the choices on a second Tab', async () => {
    const { terminal, input, key, printed } = await create();
    input.value = 'neo';
    expect(key(input, 'Tab')).toBe(true);
    expect(input.value).toBe('neofetch ');
    input.value = 'fetch H';
    key(input, 'Tab');
    expect(input.value).toBe('fetch H');
    const before = terminal.lines().length;
    key(input, 'Tab');
    expect(printed()).toContain('Headhunter  homebrew  HttpContextMapper');
    expect(terminal.lines()).toHaveLength(before + 2);
    // Another key in between starts over
    key(input, 'Shift');
    key(input, 'Tab');
    expect(terminal.lines()).toHaveLength(before + 2);
  });

  it('completes commands before the snapshot is in', async () => {
    stubFetch({});
    const { input, key } = await create();
    input.value = 'fetch H';
    key(input, 'Tab');
    expect(input.value).toBe('fetch H');
  });

  it('shows the mode, with Esc leaving the prompt', async () => {
    const { el, input, key, fixture } = await create();
    const mode = () => el.querySelector('.status .mode')?.textContent;
    input.focus();
    fixture.detectChanges();
    expect(mode()).toBe('INSERT');
    key(input, 'Escape');
    expect(document.activeElement).not.toBe(input);
    expect(mode()).toBe('NORMAL');
  });

  it('scrolls, types and takes : commands in normal mode', async () => {
    const { el, terminal, input, key, fixture, printed } = await create();
    const screen = el.querySelector<HTMLElement>('.screen')!;
    const scrollBy = vi.fn();
    screen.scrollBy = scrollBy as never;
    Object.defineProperty(screen, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(screen, 'scrollHeight', { configurable: true, value: 2000 });

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '30px' } as CSSStyleDeclaration);

    for (const k of ['j', 'ArrowDown', 'k', 'ArrowUp', 'd', 'u', 'g', 'G']) expect(key(document.body, k)).toBe(true);
    expect(scrollBy.mock.calls.map(([options]) => options.top)).toEqual([30, 30, -30, -30, 200, -200, -2000, 2000]);
    expect(key(document.body, 'q')).toBe(false);
    expect(key(document.body, 'j', { ctrlKey: true })).toBe(false);
    expect(key(el.querySelector('a')!, 'j')).toBe(false);

    key(document.body, 'i');
    expect(document.activeElement).toBe(input);
    expect(terminal.mode()).toBe('insert');
    // Keys at the prompt are typing, not normal mode
    expect(key(document.body, 'j')).toBe(false);

    input.blur();
    // The command line has the keyboard as soon as : is down, so a fast :q loses nothing
    key(document.body, ':');
    const ex = el.querySelector<HTMLInputElement>('.ex input')!;
    expect(document.activeElement).toBe(ex);
    await fixture.whenStable();
    expect(el.querySelector('.ex')!.classList).not.toContain('off');
    ex.value = 'w';
    key(ex, 'Enter');
    expect(printed()).toContain(":w\nE45: 'readonly' option is set");
    expect(terminal.mode()).toBe('normal');

    for (const leave of [['Escape', ''], ['Backspace', '']]) {
      key(document.body, ':');
      await fixture.whenStable();
      const field = el.querySelector<HTMLInputElement>('.ex input')!;
      field.value = 'x';
      key(field, 'Backspace');
      expect(terminal.mode()).toBe('command');
      field.value = leave[1];
      key(field, leave[0]);
      expect(terminal.mode()).toBe('normal');
    }

    key(document.body, ':');
    await fixture.whenStable();
    el.querySelector<HTMLInputElement>('.ex input')!.blur();
    expect(terminal.mode()).toBe('normal');
    key(document.body, 'Enter');
    expect(document.activeElement).toBe(input);
    input.blur();
    key(document.body, 'a');
    expect(document.activeElement).toBe(input);
  });

  it('answers : commands like Vim', async () => {
    const { terminal, printed } = await create();
    const ex = (text: string) => {
      terminal.ex(text);
      return printed().split('\n').at(-1);
    };
    expect(ex('q')).toContain('There is no escape');
    for (const quit of ['q!', 'qa', 'wq', 'x']) expect(ex(quit)).toContain('There is no escape');
    expect(ex('w!')).toBe('Nice try.');
    expect(ex('help')).toContain('Esc leaves the prompt');
    expect(ex('h')).toContain('Esc leaves the prompt');
    expect(ex('frob')).toBe('E492: Not an editor command: frob');
    const before = terminal.lines().length;
    ex('  ');
    expect(terminal.lines()).toHaveLength(before);
    ex('colorscheme nope');
    expect(printed()).toContain('theme: nope: unknown theme');
    terminal.ex('theme xbox');
    expect(TestBed.inject(ThemeService).theme()).toBe('xbox');
  });

  it('has a cat, a history and an editor', async () => {
    const { terminal, printed } = await create();
    terminal.run('pet');
    expect(printed()).toContain('prrrrr');
    terminal.run('history');
    expect(printed()).toContain('   1  pet\n   2  history');
    terminal.run('vim');
    expect(printed()).toContain('You are already in it');
  });

  it('shows the cat and the visitors in the status line', async () => {
    const { el, terminal, fixture } = await create();
    expect(el.querySelector('.cat-state')!.textContent).toContain('napping');
    expect(el.querySelector('.visitors')!.getAttribute('aria-label')).toBe('Visitors per hour over the last 48 hours; 3 in the last hour');
    expect(el.querySelector('.visitors')!.textContent).toContain('3/h');
    terminal.run('pet off');
    fixture.detectChanges();
    expect(el.querySelector('.cat-state')).toBeNull();
  });

  it('leaves the visitors out when there are none', async () => {
    stubFetch({ [GITHUB_API_URL]: SAMPLE });
    const { el } = await create();
    expect(el.querySelector('.visitors')).toBeNull();
  });

  it('leaves the cursor alone when a repo or the landscape is clicked', async () => {
    const { el, terminal, fixture, input } = await create();
    terminal.run('contrib');
    fixture.detectChanges();
    el.querySelector('canvas')!.click();
    expect(document.activeElement).not.toBe(input);
  });
});
