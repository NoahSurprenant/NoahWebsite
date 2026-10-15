import { TestBed } from '@angular/core/testing';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture, TextureLoader, Vector3 } from 'three';
import { manualFrames } from '../testing/canvas';
import { REDUCED_MOTION, stubMatchMedia } from '../testing/match-media';
import { pointer } from '../testing/pointer';
import type { SkyrimLoadingComponent as Component } from './skyrim-loading.component';

// jsdom has no WebGL, so three.js's renderer, the model loader and the GPU check are stand-ins the
// tests drive by hand
const mocks = vi.hoisted(() => {
  const state = {
    renderers: [] as FakeRenderer[],
    noWebGL: false,
    parallelCompile: true,
    loads: [] as { path: string; onLoad: (gltf: { scene: unknown }) => void }[],
    gpu: undefined as unknown as { promise: Promise<{ tier: number }>; resolve: (tier: { tier: number }) => void },
  };

  class FakeRenderer {
    domElement = document.createElement('canvas');
    extensions = { has: () => state.parallelCompile };
    width = 0;
    height = 0;
    ratio = 1;
    renders = 0;
    resizes = 0;
    disposed = false;
    compile = vi.fn();
    compileAsync = vi.fn(async () => {});
    constructor() {
      if (state.noWebGL) throw new Error('WebGL is unavailable');
      state.renderers.push(this);
    }
    getSize(target: { set(x: number, y: number): unknown }) {
      target.set(this.width, this.height);
      return target;
    }
    getPixelRatio() { return this.ratio; }
    setDrawingBufferSize(width: number, height: number, ratio: number) {
      Object.assign(this, { width, height, ratio });
      this.resizes++;
    }
    getDrawingBufferSize(target: { set(x: number, y: number): unknown }) {
      target.set(this.width * this.ratio, this.height * this.ratio);
      return target;
    }
    render() { this.renders++; }
    dispose() { this.disposed = true; }
  }

  class FakeGLTFLoader {
    setMeshoptDecoder() {}
    load(path: string, onLoad: (gltf: { scene: unknown }) => void) {
      state.loads.push({ path, onLoad });
    }
  }

  return { state, FakeRenderer, FakeGLTFLoader };
});

vi.mock('three', async (original) => ({ ...(await original<typeof import('three')>()), WebGLRenderer: mocks.FakeRenderer }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: mocks.FakeGLTFLoader }));
vi.mock('detect-gpu', () => ({ getGPUTier: () => mocks.state.gpu.promise }));

// Imported once the mocks are in place: a static import loads three.js before they are
let SkyrimLoadingComponent: typeof Component;
beforeAll(async () => {
  ({ SkyrimLoadingComponent } = await import('./skyrim-loading.component'));
});

const PERLIN = 5;

/** Lets every pending setTimeout (the scene's yields to the browser) and promise run. */
async function flush() {
  for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve));
}

/** A loaded model, with an array of materials and a texture, which is how disposal sees them. */
function model() {
  const scene = new Group();
  const map = new Texture();
  scene.add(new Mesh(new BoxGeometry(), [new MeshBasicMaterial({ map }), new MeshBasicMaterial()]));
  return { scene, map };
}

describe('SkyrimLoadingComponent', () => {
  let frames: ReturnType<typeof manualFrames>;

  beforeEach(() => {
    Object.assign(mocks.state, { renderers: [], noWebGL: false, parallelCompile: true, loads: [] });
    let resolve!: (tier: { tier: number }) => void;
    mocks.state.gpu = { promise: new Promise(r => (resolve = r)), resolve: tier => resolve(tier) };
    stubMatchMedia();
    frames = manualFrames();
    // The fog's cloud texture arrives at once
    vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new Texture(document.createElement('img'));
      onLoad?.(texture);
      return texture;
    });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Creates the scene showing the given item, and waits for its renderer. */
  async function create(item = 0, { settle = true } = {}) {
    const fixture = TestBed.createComponent(SkyrimLoadingComponent);
    const scene = fixture.componentInstance;
    // Instead of the random first pick, before the first render loads it
    scene.itemIndex.set(item);
    fixture.detectChanges();
    if (settle) await flush();
    return { fixture, scene, el: fixture.nativeElement as HTMLElement, renderer: () => mocks.state.renderers.at(-1)! };
  }

  it('sets up the renderer and draws a frame each animation frame', async () => {
    const { el, renderer } = await create();
    expect(el.querySelector('.canvas-host canvas')).toBe(renderer().domElement);
    frames.frame(16);
    frames.frame(32);
    expect(renderer().renders).toBe(2);
  });

  it('adds the fog on a fast GPU, and renders at a lower pixel ratio for it', async () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const { scene, renderer } = await create();
    expect(renderer().ratio).toBe(2);
    mocks.state.gpu.resolve({ tier: 3 });
    await flush();
    expect(scene['fog']).toBeDefined();
    expect(renderer().ratio).toBe(1.5);
    // The fog drifts with the scene
    frames.frame(16);
    expect(scene['fog']!.smokeData.length).toBeGreaterThan(0);
  });

  it('leaves the fog out on a slow GPU', async () => {
    const { scene } = await create();
    mocks.state.gpu.resolve({ tier: 1 });
    await flush();
    expect(scene['fog']).toBeUndefined();
  });

  describe('on a GPU it can\'t identify (Brave hides the name)', () => {
    /** Runs frames the given number of milliseconds apart, from the given time. */
    function run(count: number, every: number, from: number) {
      for (let i = 0; i < count; i++) frames.frame(from + i * every);
      return from + count * every;
    }

    it('keeps the fog when the frames keep up, even across a pause like a hidden tab', async () => {
      vi.stubGlobal('devicePixelRatio', 3);
      const { scene, renderer } = await create();
      mocks.state.gpu.resolve({ tier: 1, type: 'FALLBACK' } as never);
      await flush();
      expect(scene['fog']).toBeDefined();
      // 20 frames to bring every puff in, then the trial, with the tab hidden for a while in the middle
      let t = run(25, 16, 0);
      t = run(45, 16, t);
      document.dispatchEvent(new Event('visibilitychange'));
      t = run(55, 16, t + 60_000);
      expect(scene['fog']).toBeDefined();
      expect(scene['fogTrial']).toBeUndefined();
      expect(renderer().ratio).toBe(1.5);
    });

    it('takes the fog out at the first stalled frame once every puff is in', async () => {
      const { scene } = await create();
      mocks.state.gpu.resolve({ tier: 1, type: 'FALLBACK' } as never);
      await flush();
      // Smooth while the puffs come in, then one frame of 150ms
      const t = run(25, 16, 0);
      expect(scene['fog']).toBeDefined();
      frames.frame(t + 150);
      expect(scene['fog']).toBeUndefined();
    });

    it('never tries the fog on a software renderer, which has no GPU at all', async () => {
      const { scene } = await create();
      mocks.state.gpu.resolve({ tier: 1, type: 'FALLBACK', gpu: 'google, swiftshader device (subzero) (0x0000c0de), swiftshader driver' } as never);
      await flush();
      expect(scene['fog']).toBeUndefined();
    });

    it('takes the fog out again when it slows the frames down', async () => {
      vi.stubGlobal('devicePixelRatio', 3);
      const { scene, renderer } = await create();
      mocks.state.gpu.resolve({ tier: 1, type: 'FALLBACK' } as never);
      await flush();
      const fog = scene['fog']!;
      run(120, 50, 0);
      expect(scene['fog']).toBeUndefined();
      expect(fog.object.parent).toBeNull();
      // Back to the sharper pixel ratio
      expect(renderer().ratio).toBe(2);
    });
  });

  it("keeps the caption and links, without the scene, when there's no WebGL", async () => {
    mocks.state.noWebGL = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, scene } = await create();
    expect(el.querySelector('canvas')).toBeNull();
    expect(warn).toHaveBeenCalled();
    // Resizing still keeps the camera right
    scene['resize']();
    expect(el.querySelector('.caption')?.textContent).toMatch(/\S{3}/);
  });

  it('stops setting up when it was destroyed before the renderer was made', async () => {
    const { fixture } = await create(0, { settle: false });
    fixture.destroy();
    await flush();
    expect(mocks.state.renderers).toEqual([]);
  });

  it('stops setting up when it was destroyed while the renderer was being made', async () => {
    const { fixture, el } = await create(0, { settle: false });
    await new Promise(resolve => setTimeout(resolve));
    expect(mocks.state.renderers).toHaveLength(1);
    fixture.destroy();
    await flush();
    expect(el.querySelector('canvas')).toBeNull();
    expect(mocks.state.renderers[0].disposed).toBe(true);
  });

  it('skips the fog when destroyed during the GPU check', async () => {
    const { fixture, scene } = await create();
    fixture.destroy();
    mocks.state.gpu.resolve({ tier: 3 });
    await flush();
    expect(scene['fog']).toBeUndefined();
  });

  it('skips the GPU check when destroyed just before it', async () => {
    const { fixture, scene } = await create(0, { settle: false });
    // Two yields: one before the renderer, one before it joins the page and the fog check starts
    await new Promise(resolve => setTimeout(resolve));
    await new Promise(resolve => setTimeout(resolve));
    fixture.destroy();
    mocks.state.gpu.resolve({ tier: 3 });
    await flush();
    expect(scene['fog']).toBeUndefined();
  });

  it('follows the screen: resizes the drawing buffer only when it changes, and the pixel ratio', async () => {
    const { el, scene, renderer } = await create();
    Object.defineProperties(el.querySelector('.canvas-host')!, { clientWidth: { value: 1000 }, clientHeight: { value: 500 } });
    frames.resize();
    expect([renderer().width, renderer().height]).toEqual([1000, 500]);
    const resizes = renderer().resizes;
    scene['resize']();
    expect(renderer().resizes).toBe(resizes);
    vi.stubGlobal('devicePixelRatio', 2);
    scene['watchPixelRatio']();
    expect(renderer().ratio).toBe(2);
    expect(renderer().resizes).toBe(resizes + 1);
  });

  it('stops watching the pixel ratio once destroyed', async () => {
    const { fixture, scene, renderer } = await create();
    fixture.destroy();
    const resizes = renderer().resizes;
    scene['watchPixelRatio']();
    expect(renderer().resizes).toBe(resizes);
  });

  it('shows a loaded model, compiled before it joins the scene, at its scale and rotation', async () => {
    const { fixture, scene, renderer } = await create(1);
    const { scene: loaded } = model();
    mocks.state.loads.at(-1)!.onLoad({ scene: loaded });
    await flush();
    expect(renderer().compileAsync).toHaveBeenCalledWith(loaded, expect.anything(), expect.anything());
    expect(loaded.parent).toBeTruthy();
    // The Raspberry Pi is scaled up and tipped towards the camera
    expect(scene.itemScale).toEqual(new Vector3(2, 2, 2));
    expect(scene.itemRot.x).toBeCloseTo(10 * 3.14 / 180);
    frames.frame(16);
    expect(loaded.scale).toEqual(new Vector3(2, 2, 2));
    fixture.destroy();
  });

  it('skips compiling models when there is no renderer', async () => {
    mocks.state.noWebGL = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await create(0);
    const { scene: loaded } = model();
    mocks.state.loads.at(-1)!.onLoad({ scene: loaded });
    await flush();
    expect(loaded.parent).toBeTruthy();
    expect(mocks.state.renderers).toEqual([]);
  });

  it('compiles in one go where the GPU has no parallel shader compile', async () => {
    mocks.state.parallelCompile = false;
    const { renderer } = await create();
    mocks.state.loads.at(-1)!.onLoad({ scene: model().scene });
    await flush();
    expect(renderer().compile).toHaveBeenCalled();
    expect(renderer().compileAsync).not.toHaveBeenCalled();
  });

  it('throws away a model that arrives after the scene moved on, and replaces the old one', async () => {
    const { fixture, scene } = await create(0);
    const first = model();
    mocks.state.loads[0].onLoad({ scene: first.scene });
    await flush();
    expect(first.scene.parent).toBeTruthy();

    // Two switches before either load finishes: the first of them is stale when it arrives
    scene.itemIndex.set(2);
    TestBed.tick();
    scene.itemIndex.set(3);
    TestBed.tick();
    const [, stale, current] = mocks.state.loads;
    const staleModel = model();
    const dispose = vi.spyOn(staleModel.map, 'dispose');
    stale.onLoad({ scene: staleModel.scene });
    await flush();
    expect(staleModel.scene.parent).toBeNull();
    expect(dispose).toHaveBeenCalled();

    const next = model();
    current.onLoad({ scene: next.scene });
    await flush();
    expect(next.scene.parent).toBeTruthy();
    expect(first.scene.parent).toBeNull();
    fixture.destroy();
  });

  it('builds the Perlin sphere when it comes up, animates it, and hides it for models', async () => {
    const { fixture, scene } = await create(PERLIN, { settle: false });
    // A frame before the sphere is built just skips it
    scene.onBeforeRender();
    expect(scene['mesh']).toBeUndefined();
    await flush();
    const sphere = scene['mesh']!;
    expect(sphere.parent).toBeTruthy();
    frames.frame(16);
    expect(sphere.visible).toBe(true);

    // Back to a model: the sphere stays built but hidden
    scene.itemIndex.set(0);
    TestBed.tick();
    frames.frame(32);
    expect(sphere.visible).toBe(false);

    // And shown again without being rebuilt
    scene.itemIndex.set(PERLIN);
    TestBed.tick();
    await flush();
    expect(scene['mesh']).toBe(sphere);
    fixture.destroy();
  });

  it('drops the sphere if the scene moves on while it is being built or compiled', async () => {
    const { scene } = await create(PERLIN, { settle: false });
    // Superseded before the sphere was built
    scene.itemIndex.set(0);
    TestBed.tick();
    await flush();
    expect(scene['mesh']).toBeUndefined();

    // Superseded while it compiled
    scene.itemIndex.set(PERLIN);
    TestBed.tick();
    await new Promise(resolve => setTimeout(resolve));
    scene.itemIndex.set(0);
    TestBed.tick();
    await flush();
    expect(scene['mesh']?.parent ?? null).toBeNull();
  });

  it('disposes of a sphere still compiling when destroyed', async () => {
    const { fixture, scene } = await create(PERLIN, { settle: false });
    await flush();
    scene['scene'].remove(scene['mesh']!);
    const dispose = vi.spyOn(scene['mesh']!.geometry, 'dispose');
    fixture.destroy();
    expect(dispose).toHaveBeenCalled();
  });

  it('glides a model to a new spot, then switches to another item a few seconds later', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { fixture, scene } = await create(0);
    mocks.state.loads.at(-1)!.onLoad({ scene: model().scene });
    await flush();
    const from = scene.itemPos.clone();
    const target = scene.TargetPos!;
    now.mockReturnValue(1000);
    frames.frame(1000);
    // One second at 0.66 units a second, towards the target
    expect(scene.itemPos.distanceTo(from)).toBeCloseTo(0.66, 1);

    // A long frame never overshoots
    for (let t = 2; t < 60; t++) {
      now.mockReturnValue(t * 1000);
      frames.frame(t * 1000);
    }
    expect(scene.itemPos).toEqual(target);
    const item = scene.itemIndex();
    vi.advanceTimersByTime(15_000);
    expect(scene.itemIndex()).not.toBe(item);
    fixture.destroy();
  });

  it('holds everything still with reduced motion, jumping straight to the target', async () => {
    stubMatchMedia(REDUCED_MOTION);
    const { fixture, scene } = await create(0);
    mocks.state.loads.at(-1)!.onLoad({ scene: model().scene });
    await flush();
    const rotation = scene.itemRot.y;
    frames.frame(16);
    expect(scene.itemPos).toEqual(scene.TargetPos);
    expect(scene.itemRot.y).toBe(rotation);
    fixture.destroy();
  });

  it('picks a new spot and a new item different from the current ones', async () => {
    const { scene } = await create(0);
    scene.OriginalPos = scene['positions'][0];
    // The first tries are the current ones, so it tries again
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9);
    expect(scene['getNewTarget']()).toBe(scene['positions'][2]);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5 / 6).mockReturnValueOnce(1.5 / 6);
    expect(scene['getNewItemIndex']()).toBe(1);
  });

  it('frames the models and the sphere for the screen shape', async () => {
    const { scene } = await create(0);
    const resize = (width: number, height: number) => {
      vi.stubGlobal('innerWidth', width);
      vi.stubGlobal('innerHeight', height);
      window.dispatchEvent(new Event('resize'));
    };
    const origin = new Vector3(0, 0, 0);
    resize(1600, 900);
    // Landscape: looking at the origin, the models off to the left
    expect(scene.lookAtPosition().equals(origin)).toBe(true);
    resize(390, 844);
    // Portrait: panned to the models, and backed off so they fit across
    expect(scene.lookAtPosition().x).toBe(-20);
    expect(scene.camPosition().z).toBeGreaterThan(80);

    scene.itemIndex.set(PERLIN);
    // The sphere is at the origin: no pan, pulled back on portrait...
    expect(scene.lookAtPosition().equals(origin)).toBe(true);
    expect(scene.camPosition().z).toBeGreaterThan(80);
    // ...and at the standard distance on landscape
    resize(1600, 900);
    expect(scene.camPosition().equals(new Vector3(0, 0, 80))).toBe(true);
  });

  describe('turned and zoomed by hand', () => {
    /** A scene showing a loaded model, with the clock stopped at 0 so nothing drifts by itself. */
    async function playWith(item = 0) {
      const now = vi.spyOn(performance, 'now').mockReturnValue(0);
      const created = await create(item);
      if (item !== PERLIN) mocks.state.loads.at(-1)!.onLoad({ scene: model().scene });
      await flush();
      const host = created.el.querySelector<HTMLElement>('.canvas-host')!;
      const send = (type: string, options: Parameters<typeof pointer>[1] = {}) => host.dispatchEvent(pointer(type, options));
      const wheel = (deltaY: number, deltaMode = 0) => host.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true }));
      /** Runs a frame at the given time in milliseconds. */
      const at = (ms: number) => {
        now.mockReturnValue(ms);
        frames.frame(ms);
      };
      return { ...created, now, host, send, wheel, at };
    }

    it('turns the item with a drag, and tips it forwards or back, though never past on its back', async () => {
      const { scene, send, at } = await playWith(1);
      const { x, y } = scene.itemRot;
      send('pointerdown', { x: 0, y: 0 });
      send('pointermove', { x: 100, y: 50, time: 16 });
      at(0);
      const loaded = scene['model']!;
      expect(loaded.rotation.y).toBeCloseTo(y + 1);
      expect(loaded.rotation.x).toBeCloseTo(x + 0.5);
      send('pointermove', { x: 100, y: 1000, time: 32 });
      at(0);
      expect(loaded.rotation.x).toBeCloseTo(x + 1.2);
    });

    it('keeps spinning after a flick, slowing down to a stop, and a press catches it', async () => {
      const { scene, send, at, now } = await playWith();
      send('pointerdown', { x: 0 });
      send('pointermove', { x: 50, time: 16 });
      now.mockReturnValue(40);
      send('pointerup', { x: 50, time: 40 });
      expect(scene['spinSpeed']).toBe(12);
      at(1000);
      const spin = scene['spin'];
      expect(spin).toBeGreaterThan(0.5);
      at(2000);
      expect(scene['spin'] - spin).toBeLessThan(spin - 0.5);
      // Stopped, in the end
      for (let t = 3; t < 10; t++) at(t * 1000);
      expect(scene['spinSpeed']).toBe(0);

      send('pointerdown', { x: 0, time: 20_000 });
      send('pointermove', { x: 50, time: 20_016 });
      send('pointerup', { x: 50, time: 20_040 });
      send('pointerdown', { x: 0, time: 20_100 });
      expect(scene['spinSpeed']).toBe(0);
    });

    it("doesn't flick when the pointer was held still before letting go", async () => {
      const { scene, send, now } = await playWith();
      send('pointerdown', { x: 0 });
      send('pointermove', { x: 50, time: 16 });
      now.mockReturnValue(500);
      send('pointerup', { x: 50, time: 500 });
      expect(scene['spinSpeed']).toBe(0);
    });

    it('moves the camera in with the wheel, along the line to the item, which stays where it is on the screen', async () => {
      const { scene, wheel, at } = await playWith();
      const camera = scene['camera'];
      // jsdom lays nothing out, so the canvas has no shape of its own
      camera.aspect = 16 / 9;
      camera.updateProjectionMatrix();
      // Where the camera would be without the zoom, as the item drifts
      const usual = () => {
        const home = camera.clone();
        home.position.copy(scene.camPosition());
        home.lookAt(scene.lookAtPosition());
        home.updateMatrixWorld();
        return home;
      };

      // Pulled all the way in, and the page doesn't zoom
      expect(wheel(-1000)).toBe(false);
      at(100);
      // Gliding there...
      expect(camera.position.distanceTo(scene.itemPos)).toBeGreaterThan(usual().position.distanceTo(scene.itemPos) * 0.41);
      at(2000);
      expect(camera.position.distanceTo(scene.itemPos)).toBeCloseTo(usual().position.distanceTo(scene.itemPos) * 0.4);
      camera.updateMatrixWorld();
      const zoomed = scene.itemPos.clone().project(camera);
      const unzoomed = scene.itemPos.clone().project(usual());
      expect(zoomed.x).toBeCloseTo(unzoomed.x);
      expect(zoomed.y).toBeCloseTo(unzoomed.y);
    });

    it('moves the camera out with the wheel, in pixels or lines, but only so far', async () => {
      const { scene, wheel } = await playWith();
      wheel(3, WheelEvent.DOM_DELTA_LINE);
      expect(scene['zoomTarget']).toBeCloseTo(Math.exp(120 * 0.0015));
      wheel(5000);
      expect(scene['zoomTarget']).toBe(1.6);
    });

    it('zooms with a pinch', async () => {
      const { scene, send } = await playWith();
      send('pointerdown', { id: 1, x: 100 });
      send('pointerdown', { id: 2, x: 200 });
      send('pointermove', { id: 2, x: 300 });
      expect(scene['zoomTarget']).toBe(0.5);
    });

    it('jumps rather than glides with reduced motion, and a flick stops dead', async () => {
      stubMatchMedia(REDUCED_MOTION);
      const { scene, send, wheel, at, now } = await playWith();
      wheel(-200);
      at(16);
      expect(scene['zoom']).toBe(scene['zoomTarget']);
      send('pointerdown', { x: 0 });
      send('pointermove', { x: 50, time: 16 });
      now.mockReturnValue(20);
      send('pointerup', { x: 50, time: 20 });
      at(32);
      expect(scene['spinSpeed']).toBe(0);
    });

    it('turns and zooms the Perlin sphere too, about its middle', async () => {
      const { scene, send, wheel, at } = await playWith(PERLIN);
      send('pointerdown', { x: 0 });
      send('pointermove', { x: 100, time: 16 });
      wheel(-1000);
      at(5000);
      expect(scene['mesh']!.rotation.y).toBeCloseTo(1);
      expect(scene['camera'].position.z).toBeCloseTo(80 * 0.4);
    });

    it('starts each new item the right way up, with the camera back where it was', async () => {
      const { scene, send, wheel } = await playWith();
      send('pointerdown', { x: 0 });
      send('pointermove', { x: 100, y: 100, time: 16 });
      wheel(-500);
      scene.onLoaded();
      expect([scene['spin'], scene['tilt'], scene['spinSpeed'], scene['zoomTarget']]).toEqual([0, 0, 0, 1]);
    });

    it("doesn't swap the item for the next while someone is playing with it", async () => {
      const { scene, send, at, now } = await playWith();
      // To the target, which starts the countdown to the next item
      for (let t = 1; t < 60; t++) at(t * 1000);
      const item = scene.itemIndex();

      // Still holding it
      send('pointerdown', { x: 0 });
      now.mockReturnValue(500_000);
      vi.advanceTimersByTime(15_000);
      expect(scene.itemIndex()).toBe(item);
      // Let go only just now
      send('pointerup', { x: 0, time: 500_000 });
      vi.advanceTimersByTime(15_000);
      expect(scene.itemIndex()).toBe(item);
      // Left alone long enough
      now.mockReturnValue(520_000);
      vi.advanceTimersByTime(15_000);
      expect(scene.itemIndex()).not.toBe(item);
    });

    it('stops listening when destroyed', async () => {
      const { fixture, host } = await playWith();
      const remove = vi.spyOn(host, 'removeEventListener');
      fixture.destroy();
      expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function));
      expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    });
  });
});
