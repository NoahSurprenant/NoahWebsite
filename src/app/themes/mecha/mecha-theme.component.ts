import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { LINKS } from '../../links';
import { BannerComponent } from './banner.component';
import { HudComponent } from './hud.component';
import { TitleCardComponent } from './title-card.component';

/**
 * A 90s mecha anime: the next-episode title card, command centre readouts around it, the links on
 * a console of hexagons, and an emergency banner scrolling along the bottom.
 */
@Component({
  selector: 'app-mecha-theme',
  templateUrl: './mecha-theme.component.html',
  styleUrls: ['./mecha-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerComponent, FaIconComponent, HudComponent, TitleCardComponent],
})
export class MechaThemeComponent {
  protected readonly links = LINKS;
  // Hexes on the background grid that flash, each at its own place and pace
  protected readonly flashes = Array.from({ length: 12 }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${-Math.random() * 6}s`,
    duration: `${2 + Math.random() * 4}s`,
  }));
}
