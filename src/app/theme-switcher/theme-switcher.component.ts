import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { ThemeService } from '../themes/theme.service';
import { ThemeId, THEMES } from '../themes/themes';

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

  protected select(id: ThemeId) {
    this.service.select(id);
    // The browser closes the popover on Escape and outside clicks; a pick closes it too.
    // Optional because jsdom has no popover API.
    this.menu().nativeElement.hidePopover?.();
  }
}
