import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../themes/theme.service';
import { ThemeSwitcherComponent } from './theme-switcher.component';

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
    const mecha = Array.from(el.querySelectorAll<HTMLButtonElement>('#theme-menu button')).find(b => b.textContent?.includes('Mecha'))!;
    mecha.click();
    await fixture.whenStable();
    expect(TestBed.inject(ThemeService).theme()).toBe('mecha');
    expect(menu.hidePopover).toHaveBeenCalled();
    expect(mecha.getAttribute('aria-pressed')).toBe('true');
  });
});
