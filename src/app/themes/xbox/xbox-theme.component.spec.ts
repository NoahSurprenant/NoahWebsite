import { TestBed } from '@angular/core/testing';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
import { pointer } from '../../testing/pointer';
import { XboxThemeComponent } from './xbox-theme.component';

/** Gives an element the layout jsdom can't compute. */
function place(el: HTMLElement, box: { left?: number; top?: number; width?: number; height?: number }) {
  const { left = 0, top = 0, width = 0, height = 0 } = box;
  Object.defineProperties(el, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
    offsetTop: { configurable: true, value: top },
    offsetHeight: { configurable: true, value: height },
  });
  el.getBoundingClientRect = () => new DOMRect(left, top, width, height);
}

describe('XboxThemeComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create({ webgl = true } = {}) {
    const calls = fakeCanvas({ webgl });
    const frames = manualFrames();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fixture = TestBed.createComponent(XboxThemeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, calls, frames, orb: el.querySelector<HTMLElement>('.orb')! };
  }

  /** Lays the page out at the given size, with the name, menu and hints where the CSS puts them. */
  function layOut(el: HTMLElement, width: number, height: number) {
    place(el.querySelector('.dashboard')!, { width, height });
    place(el.querySelector('.name')!, { left: 80, top: 80, width: 500, height: 60 });
    if (width > height) {
      place(el.querySelector('.menu')!, { left: width - 500, top: height / 2 - 150, width: 320, height: 300 });
      place(el.querySelector('app-select-hint') as HTMLElement, { left: width - 500, top: height - 80, width: 300, height: 30 });
    } else {
      place(el.querySelector('.menu')!, { left: 40, top: height - 400, width: width - 80, height: 300 });
      place(el.querySelector('app-select-hint') as HTMLElement, { left: 0, top: height - 50, width, height: 30 });
    }
  }

  it('centres the orb below the name and left of the menu, at most about half the height, and tells the shader', async () => {
    stubMatchMedia(REDUCED_MOTION);
    const { fixture, el, calls, frames, orb } = await create();
    layOut(el, 1440, 900);
    fixture.componentInstance.layout();
    // Room: x 0-940, y 140-820, more than the cap of 0.48 of the height (with a 15% margin)
    expect(parseFloat(orb.style.width)).toBeCloseTo(900 * 0.48 * 0.85);
    expect(parseFloat(orb.style.left) + parseFloat(orb.style.width) / 2).toBeCloseTo(470);
    expect(parseFloat(orb.style.top) + parseFloat(orb.style.height) / 2).toBeCloseTo(480);

    frames.frame(0);
    const [x, y] = calls.uniforms.get('u_orb') as number[];
    expect(x).toBeCloseTo(470 / 900);
    expect(y).toBeCloseTo((900 - 480) / 900);
    expect(calls.uniforms.get('u_radius')).toBeCloseTo(0.48 * 0.85 / 2);
    // Reduced motion: no intro, the orb is there at once
    expect(calls.uniforms.get('u_intro')).toBe(1);
  });

  it('shrinks the orb to the room on short screens', async () => {
    stubMatchMedia();
    const { fixture, el, orb } = await create();
    layOut(el, 844, 390);
    fixture.componentInstance.layout();
    // Room: y 140-310
    expect(parseFloat(orb.style.width)).toBeCloseTo(170 * 0.85);
  });

  it('skips the layout while the page has no size yet', async () => {
    stubMatchMedia();
    const { fixture, orb } = await create();
    fixture.componentInstance.layout();
    expect(orb.style.width).toBe('');
  });

  it('puts the orb between the name and the menu on portrait screens, and refits on resize', async () => {
    stubMatchMedia();
    const { el, orb } = await create();
    layOut(el, 390, 844);
    window.dispatchEvent(new Event('resize'));
    // Room: y 140-444, the full width less room for the petals either side
    expect(parseFloat(orb.style.top) + parseFloat(orb.style.height) / 2).toBe(292);
    expect(parseFloat(orb.style.width)).toBeCloseTo(390 / 1.6 * 0.85);
  });

  it('swells the orb in over the first moments', async () => {
    stubMatchMedia();
    const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
    const { calls, frames } = await create();
    frames.frame(0);
    expect(calls.uniforms.get('u_intro')).toBe(0);
    now.mockReturnValue(10_800);
    frames.frame(16);
    expect(calls.uniforms.get('u_intro')).toBeCloseTo(0.5);
    now.mockReturnValue(20_000);
    frames.frame(32);
    expect(calls.uniforms.get('u_intro')).toBe(1);
  });

  it('paints the orb in CSS without WebGL', async () => {
    stubMatchMedia();
    const { orb } = await create({ webgl: false });
    expect(orb.classList.contains('fallback')).toBe(true);
  });

  it('starts with the first item selected (focused) where there is a mouse', async () => {
    stubMatchMedia('(pointer: fine)');
    fakeCanvas();
    manualFrames();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fixture = TestBed.createComponent(XboxThemeComponent);
    const el = fixture.nativeElement as HTMLElement;
    // On the page before its first render, so it can take the focus
    document.body.appendChild(el);
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('.menu a'));
    fixture.destroy();
    el.remove();
  });

  it('selects nothing on a phone until something is tapped', async () => {
    stubMatchMedia();
    const { el } = await create();
    document.body.appendChild(el);
    expect(el.contains(document.activeElement)).toBe(false);
    el.remove();
  });

  it('moves the selection (the focus) to whatever the pointer is over, so only one is ever lit', async () => {
    stubMatchMedia();
    const { el } = await create();
    document.body.appendChild(el);
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.menu a'));
    links[0].focus();
    links[2].dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.activeElement).toBe(links[2]);
    expect(el.querySelectorAll('.menu a:focus').length).toBe(1);
    el.remove();
  });

  it('moves between the buttons with the arrow keys, wrapping around', async () => {
    stubMatchMedia();
    const { el } = await create();
    const menu = el.querySelector('.menu')!;
    const links = Array.from(menu.querySelectorAll('a'));
    document.body.appendChild(el);
    const press = (key: string) => menu.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));

    links[0].focus();
    press('ArrowDown');
    expect(document.activeElement).toBe(links[1]);
    press('ArrowUp');
    press('ArrowUp');
    expect(document.activeElement).toBe(links[3]);
    // Other keys are left alone
    expect(press('Enter')).toBe(true);
    el.remove();
  });

  it('stops drawing and listening when destroyed', async () => {
    stubMatchMedia();
    const { fixture, frames, calls } = await create();
    const remove = vi.spyOn(window, 'removeEventListener');
    fixture.destroy();
    expect(frames.pending).toBe(0);
    expect(calls.lost).toBe(true);
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  describe('playing with the orb', () => {
    /** The orb 200px across, centred on 200, 200, and the clock at 0. */
    async function play({ webgl = true } = {}) {
      const now = vi.spyOn(performance, 'now').mockReturnValue(0);
      const created = await create({ webgl });
      place(created.orb, { left: 100, top: 100, width: 200, height: 200 });
      const send = (type: string, options: Parameters<typeof pointer>[1] = {}) => created.orb.dispatchEvent(pointer(type, options));
      /** Runs a frame at the given time in milliseconds, and returns what the shader was told. */
      const at = (ms: number) => {
        now.mockReturnValue(ms);
        created.frames.frame(ms);
        const uniform = (name: string) => created.calls.uniforms.get(name) as number;
        return { spin: uniform('u_spin'), energy: uniform('u_energy'), pulse: uniform('u_pulse') };
      };
      at(0);
      return { ...created, now, send, at };
    }

    it('turns the shells with a drag round the orb, like a dial', async () => {
      stubMatchMedia();
      const { orb, send, at } = await play();
      expect(orb.style.cursor).toBe('grab');
      expect(at(0)).toEqual({ spin: 0, energy: 0, pulse: 100 });
      // A quarter turn anticlockwise, from 3 o'clock to 12
      send('pointerdown', { x: 300, y: 200 });
      send('pointermove', { x: 200, y: 100, time: 100 });
      expect(at(100).spin).toBeCloseTo(Math.PI / 2);
      // Across 9 o'clock, where the angle jumps from pi to -pi: still a small turn
      send('pointermove', { x: 100, y: 199, time: 200 });
      send('pointermove', { x: 100, y: 201, time: 300 });
      expect(at(300).spin).toBeCloseTo(Math.PI + Math.atan(1 / 100));
    });

    it('keeps the shells spinning after a flick, glowing brighter, then slowing; a press stops them', async () => {
      stubMatchMedia();
      const { send, at, now } = await play();
      send('pointerdown', { x: 300, y: 200 });
      send('pointermove', { x: 200, y: 100, time: 16 });
      now.mockReturnValue(30);
      send('pointerup', { x: 200, y: 100, time: 30 });
      const flung = at(100);
      expect(flung.energy).toBeGreaterThan(0.9);
      const later = at(1100);
      expect(later.spin).toBeGreaterThan(flung.spin);
      expect(later.energy).toBeLessThan(1);

      send('pointerdown', { x: 300, y: 200, time: 1200 });
      expect(at(2000).spin).toBe(at(3000).spin);
    });

    it("doesn't flick when the pointer was held still before letting go", async () => {
      stubMatchMedia();
      const { send, at, now } = await play();
      send('pointerdown', { x: 300, y: 200 });
      send('pointermove', { x: 200, y: 100, time: 16 });
      now.mockReturnValue(1000);
      send('pointerup', { x: 200, y: 100, time: 1000 });
      expect(at(1100).energy).toBe(0);
    });

    it('wobbles and sends out a ripple when tapped, with a nudge round', async () => {
      stubMatchMedia();
      const { send, at, now } = await play();
      now.mockReturnValue(5000);
      send('pointerdown', { x: 200, y: 200, time: 5000 });
      send('pointerup', { x: 200, y: 200, time: 5100 });
      const tapped = at(5000);
      expect(tapped.pulse).toBe(0);
      expect(tapped.energy).toBeGreaterThan(0);
      expect(at(5500).pulse).toBe(0.5);
    });

    it('keeps still with reduced motion: no ripple and no flick, only what the pointer turns', async () => {
      stubMatchMedia(REDUCED_MOTION);
      const { send, at, now } = await play();
      send('pointerdown', { x: 200, y: 200 });
      send('pointerup', { x: 200, y: 200, time: 50 });
      expect(at(100).pulse).toBe(100);
      send('pointerdown', { x: 300, y: 200 });
      send('pointermove', { x: 200, y: 100, time: 16 });
      now.mockReturnValue(20);
      send('pointerup', { x: 200, y: 100, time: 20 });
      const letGo = at(30);
      expect(letGo.spin).toBeCloseTo(Math.PI / 2);
      expect(letGo.energy).toBe(0);
    });

    it('keeps the selection on the menu when the orb is pressed', async () => {
      stubMatchMedia();
      const { orb } = await play();
      expect(orb.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }))).toBe(false);
    });

    it('leaves the CSS orb alone without WebGL', async () => {
      stubMatchMedia();
      const { orb, send } = await play({ webgl: false });
      send('pointerdown', { x: 200, y: 200 });
      expect(orb.classList.contains('fallback')).toBe(true);
      expect(orb.style.cursor).toBe('');
    });

    it('stops listening to the orb when destroyed', async () => {
      stubMatchMedia();
      const { fixture, orb } = await play();
      const remove = vi.spyOn(orb, 'removeEventListener');
      fixture.destroy();
      expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });
  });
});
