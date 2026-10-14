import { TestBed } from '@angular/core/testing';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { HudComponent } from './hud.component';

describe('HudComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create() {
    const calls = fakeCanvas();
    const frames = manualFrames();
    // Only the votes' interval: faking every timer would stall whenStable()
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    // The first frame is drawn on creation, and starts the countdown at this time
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const fixture = TestBed.createComponent(HudComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    // jsdom lays nothing out; give the graph the size the CSS would
    const canvas = el.querySelector('canvas')!;
    Object.defineProperties(canvas, { clientWidth: { value: 320 }, clientHeight: { value: 90 } });
    return { fixture, el, frames, calls, timer: el.querySelector('.timer')! };
  }

  it('counts the battery down from five minutes, and goes red in the last one', async () => {
    stubMatchMedia();
    const { el, frames, timer } = await create();
    const start = 1000;
    expect(timer.textContent).toBe('05:00:00');
    frames.frame(start + 61_500);
    expect(timer.textContent).toBe('03:58:50');
    expect(timer.classList.contains('low')).toBe(false);
    frames.frame(start + 4 * 60_000 + 30_000);
    expect(timer.textContent).toBe('00:30:00');
    expect(timer.classList.contains('low')).toBe(true);
    expect(el.querySelector('canvas')).toBeTruthy();
  });

  it('blacks out when the battery runs out, then switches to external power, then starts again', async () => {
    stubMatchMedia();
    const { fixture, el, frames, timer } = await create();
    const hud = fixture.componentInstance;
    const start = 1000;
    const label = () => el.querySelector('.battery .label')?.textContent;
    const lit = () => Array.from(el.querySelectorAll('.modes .on')).map(s => s.textContent);
    expect(hud.power()).toBe('internal');

    frames.frame(start + 5 * 60_000 + 500);
    await fixture.whenStable();
    expect(hud.power()).toBe('down');
    expect(timer.textContent).toBe('00:00:00');
    expect(lit()).toEqual(['INTERNAL']);

    frames.frame(start + 5 * 60_000 + 3500);
    await fixture.whenStable();
    expect(hud.power()).toBe('external');
    expect(label()).toBe('EXTERNAL POWER CONNECTED');
    expect(lit()).toEqual(['EXTERNAL']);

    frames.frame(start + 5 * 60_000 + 4500 + 60_000);
    await fixture.whenStable();
    expect(hud.power()).toBe('internal');
    expect(timer.textContent).toBe('04:00:00');
    expect(label()).toContain('ACTIVE TIME REMAINING');
  });

  it('draws the waveforms and moves the sync ratio', async () => {
    stubMatchMedia();
    const { fixture, el, frames, calls } = await create();
    frames.frame(2000);
    await fixture.whenStable();
    expect(calls.lines).toBeGreaterThan(100);
    expect(el.querySelector('.value')?.textContent).toMatch(/^\d\d\.\d%$/);
  });

  it('holds everything still with reduced motion', async () => {
    stubMatchMedia(REDUCED_MOTION);
    const { fixture, frames, timer } = await create();
    frames.frame(90_000);
    expect(timer.textContent).toBe('05:00:00');
    const votes = fixture.componentInstance.votes();
    vi.advanceTimersByTime(10_000);
    expect(fixture.componentInstance.votes()).toBe(votes);
  });

  it('shows each vote and the majority resolution', async () => {
    stubMatchMedia();
    const { fixture, el } = await create();
    const hud = fixture.componentInstance;

    hud.votes.set([true, false, false]);
    await fixture.whenStable();
    expect(Array.from(el.querySelectorAll('.box')).map(b => b.classList.contains('deny'))).toEqual([false, true, true]);
    expect(el.querySelector('.result')?.textContent).toContain('REJECTED');

    hud.votes.set([true, true, false]);
    await fixture.whenStable();
    expect(el.querySelector('.result')?.textContent).toContain('APPROVED');

    // The computers vote again every few seconds
    const before = hud.votes();
    vi.advanceTimersByTime(3500);
    expect(hud.votes()).not.toBe(before);
    expect(hud.votes()).toHaveLength(3);
  });

  it('stops when destroyed', async () => {
    stubMatchMedia();
    const { fixture, frames } = await create();
    fixture.destroy();
    expect(frames.pending).toBe(0);
  });
});
