import { TestBed } from '@angular/core/testing';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { ThemeService } from '../theme.service';
import { TerminalThemeComponent } from './terminal-theme.component';

describe('TerminalThemeComponent', () => {
  beforeEach(() => {
    // Reduced motion: the boot commands run straight away instead of being typed out
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
