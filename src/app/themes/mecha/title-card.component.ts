import { ChangeDetectionStrategy, Component, computed, OnDestroy, signal } from '@angular/core';
import { NAME } from '../../links';

// Next-episode title cards: one cuts to the next every few seconds
export const EPISODES = [
  'Bug Attack',
  'The Beast (Monolith)',
  "Hedgehog's Dilemma: Tabs or Spaces",
  'The Day the Cluster Stood Still',
  'Prod Strikes!',
  'Dependency Injection',
  "Don't Deploy on Friday.",
  'The End of Legacy Code',
];
const CARD_MS = 8000;

/**
 * A big white serif title card on black. Each card builds up line by line with hard cuts, no
 * fades, and clicking skips to the next one.
 */
@Component({
  selector: 'app-title-card',
  templateUrl: './title-card.component.html',
  styleUrls: ['./title-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'skip()' },
})
export class TitleCardComponent implements OnDestroy {
  protected readonly nameLines = NAME.toUpperCase().split(' ');

  readonly episode = signal(Math.floor(Math.random() * EPISODES.length));
  // In a list of one so the card is rebuilt, and its cut-in animations replay, on every change
  protected readonly card = computed(() => [{
    number: String(this.episode() + 1).padStart(2, '0'),
    title: EPISODES[this.episode()],
  }]);

  private interval = window.setInterval(() => this.next(), CARD_MS);

  ngOnDestroy() {
    window.clearInterval(this.interval);
  }

  next() {
    this.episode.update(e => (e + 1) % EPISODES.length);
  }

  /** Cuts to the next card, and restarts the wait. */
  protected skip() {
    window.clearInterval(this.interval);
    this.interval = window.setInterval(() => this.next(), CARD_MS);
    this.next();
  }
}
