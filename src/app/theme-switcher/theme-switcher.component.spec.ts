import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../themes/theme.service';
import { HINT_MS, ThemeSwitcherComponent } from './theme-switcher.component';

describe('ThemeSwitcherComponent', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
  });

  it('opens its menu from the cog, natively', async () => {
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cog')?.getAttribute('popovertarget')).toBe('theme-menu');
    expect(el.querySelector('#theme-menu')?.hasAttribute('popover')).toBe(true);
  });

  it('switches theme and closes the menu on a pick', async () => {
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const menu = el.querySelector<HTMLElement>('#theme-menu')!;
    // jsdom has no popover API
    menu.hidePopover = vi.fn();
    const mecha = Array.from(el.querySelectorAll<HTMLButtonElement>('#theme-menu button')).find(b => b.textContent?.includes('Neon Genesis'))!;
    mecha.click();
    await fixture.whenStable();
    expect(TestBed.inject(ThemeService).theme()).toBe('mecha');
    expect(menu.hidePopover).toHaveBeenCalled();
    expect(mecha.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('ThemeSwitcherComponent hint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function create() {
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, hint: () => el.querySelector<HTMLButtonElement>('.hint') };
  }

  it('points out the cog on a first visit, then goes after a few seconds', async () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const { fixture, hint } = await create();
    expect(hint()?.textContent?.trim()).toBe('4 themes');
    expect(hint()?.getAttribute('popovertarget')).toBe('theme-menu');
    const [leave] = timeout.mock.calls.find(([, ms]) => ms === HINT_MS)!;
    (leave as () => void)();
    await fixture.whenStable();
    expect(hint()).toBeNull();
  });

  it('goes as soon as the menu opens, and for good', async () => {
    const { fixture, el, hint } = await create();
    el.querySelector('#theme-menu')!.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    expect(hint()).toBeNull();
    fixture.destroy();
    expect((await create()).hint()).toBeNull();
  });

  it('comes back on the next visit until the menu has been opened', async () => {
    const first = await create();
    first.fixture.destroy();
    expect((await create()).hint()).not.toBeNull();
  });

  it('still goes when the menu opens if storage refuses the note', async () => {
    const { fixture, el, hint } = await create();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    el.querySelector('#theme-menu')!.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    expect(hint()).toBeNull();
  });

  it('is not needed by someone who has picked a theme before', async () => {
    localStorage.setItem('theme', 'xbox');
    expect((await create()).hint()).toBeNull();
  });

  it('stays away without storage, rather than showing on every visit', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect((await create()).hint()).toBeNull();
  });
});
