import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Power } from './hud.component';

/**
 * What the screen does when the battery runs out: it flickers and goes dark under an "activity
 * limit" warning, then external power comes on and it lights up again. Clicks pass straight
 * through, so the links still work in the dark.
 */
@Component({
  selector: 'app-power-down',
  template: `
    @switch (power()) {
      @case ('down') { <p class="limit">ACTIVITY LIMIT REACHED<small>INTERNAL POWER DEPLETED</small></p> }
      @case ('external') { <p class="restored">EXTERNAL POWER CONNECTED</p> }
    }`,
  styleUrls: ['./power-down.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.down]': "power() === 'down'",
    '[class.external]': "power() === 'external'",
  },
})
export class PowerDownComponent {
  readonly power = input.required<Power>();
}
