import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { LINKS } from '../../links';
import { BannerComponent } from './banner.component';
import { HudComponent } from './hud.component';
import { PowerDownComponent } from './power-down.component';
import { TitleCardComponent } from './title-card.component';

// A flat-topped hexagon 52px across is this tall
const CELL_HEIGHT = 26 * Math.sqrt(3);

/**
 * A 90s mecha anime: the next-episode title card, command centre readouts around it, the links on
 * a console of hexagons, and an emergency banner scrolling along the bottom. When the battery
 * runs out the screen blacks out until external power comes on.
 */
@Component({
  selector: 'app-mecha-theme',
  templateUrl: './mecha-theme.component.html',
  styleUrls: ['./mecha-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerComponent, FaIconComponent, HudComponent, PowerDownComponent, TitleCardComponent],
})
export class MechaThemeComponent {
  protected readonly links = LINKS;
  // Cells of the background honeycomb that light up, each at its own place and pace. Its columns
  // are 39px apart, every other one half a cell lower, as in the pattern in the template.
  protected readonly flashes = Array.from({ length: 12 }, () => {
    const col = Math.floor(Math.random() * (window.innerWidth / 39 + 1));
    const row = Math.floor(Math.random() * (window.innerHeight / CELL_HEIGHT + 1)) - (col % 2) / 2;
    return {
      left: `${col * 39}px`,
      top: `${row * CELL_HEIGHT}px`,
      delay: `${-Math.random() * 6}s`,
      duration: `${3 + Math.random() * 4}s`,
    };
  });
}
