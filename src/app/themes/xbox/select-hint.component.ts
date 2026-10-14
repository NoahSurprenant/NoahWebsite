import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The dashboard's "Ⓐ Select" in the corner, its pod's wire sweeping off the bottom of the screen. */
@Component({
  selector: 'app-select-hint',
  template: '<span class="a">A</span> SELECT',
  styleUrls: ['./select-hint.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class SelectHintComponent {}
