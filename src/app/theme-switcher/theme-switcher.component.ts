import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { STORAGE_KEY, ThemeService } from '../themes/theme.service';
import { ThemeId, THEMES } from '../themes/themes';

/** Set once the menu has been opened, after which the hint isn't needed */
const HINT_KEY = 'theme-hint';
/** How long the hint stays, in step with its fade out in the CSS */
export const HINT_MS = 8000;

/** The cog in the corner, and the list of themes it opens. */
@Component({
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.component.html',
  styleUrls: ['./theme-switcher.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent],
})
export class ThemeSwitcherComponent {
  protected readonly themes = THEMES;
  protected readonly faGear = faGear;
  protected readonly service = inject(ThemeService);
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  /** A pointer to the cog on each visit until the menu is first opened, gone after a few seconds */
  protected readonly hint = signal(this.unseen());

  constructor() {
    if (!this.hint()) return;
    const timer = setTimeout(() => this.hint.set(false), HINT_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected select(id: ThemeId) {
    this.service.select(id);
    // The browser closes the popover on Escape and outside clicks; a pick closes it too.
    // Optional because jsdom has no popover API.
    this.menu().nativeElement.hidePopover?.();
  }

  /** The menu opened: no more hints, now or on later visits */
  protected opened() {
    this.hint.set(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Storage is off (some private modes): the hint is never shown there anyway
    }
  }

  /** Whether the menu has never been opened here: no note of it, and no theme picked. */
  private unseen() {
    try {
      return !localStorage.getItem(HINT_KEY) && !localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage is off (some private modes): better no hint than one on every page load for good
      return false;
    }
  }
}
