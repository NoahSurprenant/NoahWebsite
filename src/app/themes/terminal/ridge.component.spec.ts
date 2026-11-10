import { TestBed } from '@angular/core/testing';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { SAMPLE } from '../../testing/github';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { RidgeComponent } from './ridge.component';

describe('RidgeComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create(days = SAMPLE.days) {
    const frames = manualFrames();
    const fixture = TestBed.createComponent(RidgeComponent);
    fixture.componentRef.setInput('days', days);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const canvas = el.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 640, height: 480 } as DOMRect);
    return { fixture, el, canvas, frames };
  }

  it('draws a ridge per week, labelled with the months and weekdays', async () => {
    stubMatchMedia(REDUCED_MOTION);
    const calls = fakeCanvas();
    const { canvas } = await create();
    expect(canvas.getAttribute('aria-label')).toBe('28 contributions over 3 weeks, one ridge per week');
    // 85 points on each of the 3 ridges, plus the two corners of each one's fill
    expect(calls.lines).toBe(3 * (85 + 2));
    expect(calls.texts).toEqual(['Oct', 'Nov', 'S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('raises the ridges back to front, then stops', async () => {
    stubMatchMedia();
    const calls = fakeCanvas();
    const { fixture, frames } = await create();
    expect(calls.lines).toBe(0);
    frames.frame(1000);
    frames.frame(1000 + 1100 / 2);
    // Halfway: the first two of three weeks are up
    expect(calls.lines).toBe(2 * 87);
    frames.frame(1000 + 1100);
    expect(frames.pending).toBe(0);
    frames.resize();
    fixture.destroy();
  });

  it('picks out the week under the pointer, and says how busy it was', async () => {
    stubMatchMedia(REDUCED_MOTION);
    const calls = fakeCanvas();
    const { fixture, el, canvas } = await create();
    const caption = () => el.querySelector('.caption')!.textContent;
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientY: 470 }));
    fixture.detectChanges();
    expect(caption()).toBe('Week of 2026-11-08: 12 contributions');
    // Moving within the same week doesn't draw it again
    const drawn = calls.lines;
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientY: 465 }));
    expect(calls.lines).toBe(drawn);
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientY: -100 }));
    fixture.detectChanges();
    expect(caption()).toBe('Week of 2026-10-31: 2 contributions');
    canvas.dispatchEvent(new MouseEvent('pointerleave'));
    fixture.detectChanges();
    expect(caption()).toBe('');
  });

  it('breaks the week down by day, this week until one is picked, over the busiest week and the average', async () => {
    stubMatchMedia(REDUCED_MOTION);
    fakeCanvas();
    const { fixture, el, canvas } = await create();
    const details = () => el.querySelector('.details')!.textContent;
    expect(details()).toBe([
      'Sun  ████████████ 12',
      'Mon  ░░░░░░░░░░░░  0',
      'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
      '',
      'Busiest week  2026-11-01, 14',
      'Average       9 a week',
    ].join('\n'));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientY: -100 }));
    fixture.detectChanges();
    expect(details()).toContain('Fri\nSat  ████████████ 2\n');
  });

  it('picks out the tapped week, and keeps it once the finger lifts', async () => {
    stubMatchMedia(REDUCED_MOTION);
    fakeCanvas();
    const { fixture, el, canvas } = await create();
    const touch = (type: string, clientY = 0) =>
      canvas.dispatchEvent(Object.defineProperty(new MouseEvent(type, { clientY }), 'pointerType', { value: 'touch' }));
    touch('pointerdown', 470);
    touch('pointerleave');
    fixture.detectChanges();
    expect(el.querySelector('.caption')!.textContent).toBe('Week of 2026-11-08: 12 contributions');
  });

  it('steps through the weeks with the arrow keys', async () => {
    stubMatchMedia(REDUCED_MOTION);
    fakeCanvas();
    const { fixture, el, canvas } = await create([{ date: '2026-11-01', count: 1 }, { date: '2026-11-08', count: 0 }]);
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      canvas.dispatchEvent(event);
      fixture.detectChanges();
      return event.defaultPrevented;
    };
    const caption = () => el.querySelector('.caption')!.textContent;
    expect(press('ArrowUp')).toBe(true);
    expect(caption()).toBe('Week of 2026-11-01: 1 contribution');
    press('ArrowUp');
    expect(caption()).toBe('Week of 2026-11-01: 1 contribution');
    press('ArrowDown');
    press('ArrowDown');
    expect(caption()).toBe('Week of 2026-11-08: 0 contributions');
    expect(press('x')).toBe(false);
  });

  it('does nothing without a 2D context', async () => {
    stubMatchMedia(REDUCED_MOTION);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { el } = await create();
    expect(el.querySelector('canvas')!.width).toBe(300);
  });

  it('sizes the canvas to its box and the screen', async () => {
    stubMatchMedia(REDUCED_MOTION);
    fakeCanvas();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(375);
    vi.stubGlobal('devicePixelRatio', 2);
    const { canvas } = await create();
    expect([canvas.width, canvas.height]).toEqual([1000, 750]);
  });
});
