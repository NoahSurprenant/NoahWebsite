import { ChangeDetectionStrategy, Component } from '@angular/core';

const MESSAGE = 'EMERGENCY ◆ UNIDENTIFIED SIGNAL DETECTED ◆ ALL PERSONNEL TO FIRST-STAGE ALERT ◆ ';

/** A red emergency strip, hazard-striped along its edges, its message scrolling past. */
@Component({
  selector: 'app-banner',
  // The message twice, so the scroll can loop at the halfway point without a jump
  template: '<span>{{ text }}{{ text }}</span>',
  styleUrls: ['./banner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class BannerComponent {
  // Enough to cover a wide screen
  protected readonly text = MESSAGE.repeat(4);
}
