import { ChangeDetectionStrategy, Component, computed, OnDestroy, signal } from '@angular/core';
import { NAME } from '../../links';

// Next-episode title cards, each a riff on the real episode with that number, in the show's order.
// One cuts to the next every few seconds. 26' is the film's retelling of the last episode.
export const EPISODES = [
  { number: '01', title: 'Bug Attack' },
  { number: '02', title: 'The Beast (Monolith)' },
  { number: '03', title: 'A Merge Request' },
  { number: '04', title: "Hedgehog's Dilemma: Tabs or Spaces" },
  { number: '05', title: 'Release I' },
  { number: '06', title: 'Release II' },
  { number: '07', title: 'A Human Review' },
  { number: '08', title: 'Prod Strikes!' },
  { number: '09', title: 'Both of You, Pair Program Like You Want to Ship!' },
  { number: '10', title: 'Logdiver' },
  { number: '11', title: 'The Day the Cluster Stood Still' },
  { number: '12', title: 'She said, "Don\'t make others suffer for your personal tech debt."' },
  { number: '14', title: 'Weaving a Git History' },
  { number: '16', title: 'Splitting of the Monolith' },
  { number: '17', title: 'Fourth Replica' },
  { number: '18', title: 'Ambivalence (Works on My Machine)' },
  { number: '19', title: 'Dependency Injection' },
  { number: '20', title: 'Weaving a Git History 2: rebase stage' },
  { number: '21', title: 'He was aware that he was still a junior' },
  { number: '22', title: "Don't Deploy on Friday." },
  { number: '23', title: 'Release III' },
  { number: '24', title: 'The Beginning and the End, or "Knockin\' on Port 22"' },
  { number: '25', title: 'Do you LGTM?' },
  { number: '26', title: 'Take Care of Your Server' },
  { number: "26'", title: 'The End of Legacy Code' },
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
  protected readonly card = computed(() => [EPISODES[this.episode()]]);

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
