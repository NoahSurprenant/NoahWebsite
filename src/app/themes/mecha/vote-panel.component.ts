import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The three computers' vote, drawn like the show's command-centre display: a cluster of numbered
 * boxes, orange-outlined on black, lit up when that computer approves, under an orange tag wired
 * to it in green, with the resolution in another tag below.
 */
@Component({
  selector: 'app-vote-panel',
  templateUrl: './vote-panel.component.html',
  styleUrls: ['./vote-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VotePanelComponent {
  /** Each computer's vote, in order: true approves */
  readonly votes = input.required<boolean[]>();
  protected readonly approved = computed(() => this.votes().filter(Boolean).length >= 2);
  // 1 and 3 side by side with the cluster's name between them, 2 underneath, as on the display
  protected readonly boxes = [
    { n: 1, area: 'one' },
    { n: 2, area: 'two' },
    { n: 3, area: 'three' },
  ];
}
