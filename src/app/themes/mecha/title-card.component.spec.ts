import { TestBed } from '@angular/core/testing';
import { EPISODES, TitleCardComponent } from './title-card.component';

describe('TitleCardComponent', () => {
  afterEach(() => vi.useRealTimers());

  async function create() {
    // Only the card interval: faking every timer would stall whenStable()
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const fixture = TestBed.createComponent(TitleCardComponent);
    await fixture.whenStable();
    return { fixture, card: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the name, episode number and title', async () => {
    const { fixture, card, el } = await create();
    card.episode.set(2);
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim())
      .toBe('NOAH SURPRENANT EPISODE:03 A Merge Request');
  });

  it('numbers each card after the real episode it riffs on, in order, ending with the film', () => {
    const numbers = EPISODES.map(e => e.number);
    expect(numbers[0]).toBe('01');
    expect(numbers).toContain('22');
    expect(numbers.at(-1)).toBe("26'");
    // In the show's order, and each only once
    expect(numbers.slice(0, -1).map(Number)).toEqual([...numbers.slice(0, -1).map(Number)].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('cuts to the next card every few seconds, and wraps around', async () => {
    const { card } = await create();
    card.episode.set(EPISODES.length - 1);
    vi.advanceTimersByTime(8000);
    expect(card.episode()).toBe(0);
    vi.advanceTimersByTime(8000);
    expect(card.episode()).toBe(1);
  });

  it('skips ahead on a click, and waits a full card before the next cut', async () => {
    const { card, el } = await create();
    card.episode.set(0);
    vi.advanceTimersByTime(7000);
    el.click();
    expect(card.episode()).toBe(1);
    vi.advanceTimersByTime(7000);
    expect(card.episode()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(card.episode()).toBe(2);
  });

  it('stops cutting when destroyed', async () => {
    const { fixture, card } = await create();
    const episode = card.episode();
    fixture.destroy();
    vi.advanceTimersByTime(60_000);
    expect(card.episode()).toBe(episode);
  });
});
