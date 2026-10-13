import { fakeCanvas, manualFrames } from '../testing/canvas';
import { REDUCED_MOTION, stubMatchMedia } from '../testing/match-media';
import { ShaderCanvas } from './shader-canvas';

describe('ShaderCanvas', () => {
  let host: HTMLElement;

  beforeEach(() => {
    stubMatchMedia();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the shader every frame, with the time, resolution and its own uniforms', () => {
    const calls = fakeCanvas();
    const frames = manualFrames();
    const shader = new ShaderCanvas(host, 'void main() {}', () => ({ u_orb: [1, 2], u_radius: 0.5, u_tint: [1, 2, 3] }));
    expect(shader.running).toBe(true);
    expect(host.querySelector('canvas')).toBe(shader.canvas);

    frames.frame(1000);
    frames.frame(1050);
    expect(calls.draws).toBe(2);
    expect(calls.uniforms.get('u_time')).toBeCloseTo(0.05);
    expect(calls.uniforms.get('u_orb')).toEqual([1, 2]);
    expect(calls.uniforms.get('u_radius')).toBe(0.5);
    expect(calls.uniforms.get('u_tint')).toEqual([1, 2, 3]);
    expect(calls.uniforms.get('u_resolution')).toEqual([shader.canvas.width, shader.canvas.height]);
  });

  it('resizes its drawing buffer with its element', () => {
    fakeCanvas();
    const frames = manualFrames();
    vi.stubGlobal('devicePixelRatio', 1);
    const shader = new ShaderCanvas(host, 'void main() {}');
    Object.defineProperties(host, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    frames.resize();
    expect([shader.canvas.width, shader.canvas.height]).toEqual([800, 600]);
  });

  it("doesn't jump ahead after a long gap, like a hidden tab", () => {
    const calls = fakeCanvas();
    const frames = manualFrames();
    new ShaderCanvas(host, 'void main() {}');
    frames.frame(0);
    frames.frame(60_000);
    expect(calls.uniforms.get('u_time')).toBeCloseTo(0.1);
  });

  it('holds still at the given time with reduced motion', () => {
    stubMatchMedia(REDUCED_MOTION);
    const calls = fakeCanvas();
    const frames = manualFrames();
    new ShaderCanvas(host, 'void main() {}', undefined, 12);
    frames.frame(0);
    frames.frame(500);
    expect(calls.uniforms.get('u_time')).toBe(12);
  });

  it('stops drawing and lets go of the GPU when disposed', () => {
    const calls = fakeCanvas();
    const frames = manualFrames();
    const shader = new ShaderCanvas(host, 'void main() {}');
    shader.dispose();
    expect(frames.pending).toBe(0);
    expect(calls.lost).toBe(true);
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('draws nothing without WebGL', () => {
    fakeCanvas({ webgl: false });
    manualFrames();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shader = new ShaderCanvas(host, 'void main() {}');
    expect(shader.running).toBe(false);
    expect(host.querySelector('canvas')).toBeNull();
    expect(warn).toHaveBeenCalled();
    shader.dispose();
  });

  it('logs why and draws nothing when the shader fails to compile', () => {
    fakeCanvas({ links: false });
    const frames = manualFrames();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shader = new ShaderCanvas(host, 'not glsl');
    expect(shader.running).toBe(false);
    expect(frames.pending).toBe(0);
    expect(error).toHaveBeenCalledWith(expect.any(String), 'shader log', 'program log');
  });
});
