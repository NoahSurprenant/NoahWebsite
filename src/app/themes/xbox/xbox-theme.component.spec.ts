import { TestBed } from '@angular/core/testing';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { REDUCED_MOTION, stubMatchMedia } from '../../testing/match-media';
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
});
