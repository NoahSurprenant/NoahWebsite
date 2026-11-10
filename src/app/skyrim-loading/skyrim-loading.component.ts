import { AfterViewInit, Component, computed, effect, ElementRef, inject, input, OnDestroy, OnInit, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { BackSide, Box3, BoxGeometry, DirectionalLight, DoubleSide, Euler, HemisphereLight, IcosahedronGeometry, IUniform, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShaderMaterial, Texture, Timer, Vector2, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSET_PATH } from '../assets';
import { Fog } from '../fog/fog';
import { Item, Model } from '../item';
import { ClearBand, ITEM_TEXTS, SkyrimItem } from '../skyrim-item';
import { getGPUTier } from 'detect-gpu';
import { Gestures } from '../themes/gestures';

// An unrecognised GPU gets the fog on trial: it stays if the frames over this long, once every
// puff is in, average 40fps or better. One frame slower than the last ends the trial at once.
const FOG_TRIAL_MS = 1500;
const SLOW_FRAME_MS = 1000 / 40;
const STALL_MS = 100;
// GPU names that mean there is no GPU, the drawing is done on the CPU: no fog. detect-gpu's own
// blocklist misses how Chromium names SwiftShader now ("Google, SwiftShader Device (Subzero)")
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render|software/i;

// Turning and zooming by hand, as on the game's loading screens. Radians of turn per pixel dragged;
// how far it tips forwards or back at most; and its distance from the camera, as a fraction of the usual.
const TURN_PER_PX = 0.01;
const MAX_TILT = 1.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;
// A flick keeps it spinning, slowing by this much per second, and never faster than MAX_SPIN
const SPIN_FRICTION = 2.5;
const MAX_SPIN = 12;
// The item stays at least this long after it was last touched, before the next can replace it
const IDLE_MS = 10_000;
// On portrait screens a model, as it turns, fills this much of the screen's width
const SIDE_FILL = 0.92;

// Example of smoke with three.js
// https://codepen.io/sbrl/pen/zNdqdd?editors=0110

// Perlin noise
// https://github.com/ashima/webgl-noise/blob/master/src/classicnoise3D.glsl

@Component({
    selector: 'app-skyrim-loading',
    templateUrl: './skyrim-loading.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ['./skyrim-loading.component.css'],
})
export class SkyrimLoadingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly DEFAULT_SCALE: Vector3 = new Vector3(1, 1, 1);
  private readonly DEFAULT_ROTATION: Euler = new Euler(0, 0, 0);

  private intervalHandle?: number;
  private readonly uniform: { [uniform: string]: IUniform } = {
    u_resolution: {value: new Vector2(window.innerWidth, window.innerHeight)},
    u_time: {value: 0.0},
  };
  private mesh?: Mesh;
  // Bumped on every item change, so slow loads can tell they've been superseded
  private loadId = 0;

  // Three.js plumbing
  private canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  private renderer?: WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera();
  private readonly gltfLoader = new GLTFLoader();
  private model?: Object3D;
  // The middle of the model's bounding box, in its own coordinates: what zooming brings closer
  private readonly modelCentre = new Vector3();
  private fog?: Fog;
  // Frame times while the fog is on trial, and the last frame's time to measure them from
  private fogTrial?: number[];
  private lastFrame?: number;
  private destroyed = false;
  // Fires when devicePixelRatio changes, e.g. the window moves to a monitor with different scaling
  private dprQuery?: MediaQueryList;

  // Honour the OS "reduce motion" setting: keep the scene, but hold it still.
  // `matches` is live, so checking it every frame also picks up changes while the page is open.
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Input: drags turn the item (spin about the vertical, tilt about the horizontal) and the wheel or a
  // pinch brings it closer or sends it away. Zoom eases towards zoomTarget.
  private gestures?: Gestures;
  private dragging = false;
  private spin = 0;
  private tilt = 0;
  private spinSpeed = 0;
  private lastDrag = 0;
  private zoom = 1;
  private zoomTarget = 1;
  private lastTouched = -Infinity;

  // Responsive camera positioning
  private aspectRatio = signal<number>(window.innerWidth / window.innerHeight);
  /** The strip between the name and links and the caption, which a model fills on portrait screens. */
  readonly band = input<ClearBand>({ top: 0.12, bottom: 0.7 });
  // How much room the shown model takes, so the camera can frame it
  private readonly fit = signal<Fit>({ radius: 22, minY: 0, maxY: 20 });

  constructor() {
    let initialIndex = this.GetRandomInt(0, this.positions.length - 1);
    this.OriginalPos = this.positions[initialIndex];
    this.itemPos = this.OriginalPos;


    // Lit like an item in the inventory: a soft fill from above, a key light from the front left, and
    // a faint warm rim from behind on the right that picks the item out of the black
    this.scene.add(new HemisphereLight(0xfffaf5, 0x0f0e0d, 0.5));
    const key = new DirectionalLight(0xfffaf3, 1.8);
    key.position.set(-1.2, 1, 1);
    this.scene.add(key);
    const rim = new DirectionalLight(0xffe6cc, 2);
    rim.position.set(1.5, 0.6, -1.5);
    this.scene.add(rim);
    this.scene.add(this.camera);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // The camera stays put whatever is done to the item, so the fog behind it does too
    effect(() => {
      this.camera.position.copy(this.camPosition());
      this.camera.lookAt(this.lookAtPosition());
    });
    effect(() => this.loadItem(this.item()));
  }

  ngOnInit(): void {
    // Set initial aspect ratio
    this.updateAspectRatio();

    // Add resize listener
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.restartFrameClock);
  }

  // The Perlin sphere is only one of the items, so it's built the first time it's shown
  private createPerlinMesh() {
    const mat = new ShaderMaterial({
      uniforms: this.uniform,
      vertexShader: `
uniform float u_time;

vec3 mod289(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise, periodic variant
float pnoise(vec3 P, vec3 rep)
{
  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));

  float n000 = norm0.x * dot(g000, Pf0);
  float n010 = norm0.y * dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n100 = norm0.z * dot(g100, vec3(Pf1.x, Pf0.yz));
  float n110 = norm0.w * dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = norm1.x * dot(g001, vec3(Pf0.xy, Pf1.z));
  float n011 = norm1.y * dot(g011, vec3(Pf0.x, Pf1.yz));
  float n101 = norm1.z * dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n111 = norm1.w * dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}

void main() {
    float noise = 100.0 * pnoise(position + u_time, vec3(10.0));
    float displacement = noise / 10.0;
    vec3 newPosition = position + normal * displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
      `,
      fragmentShader: `
uniform vec2 u_resolution;
void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    gl_FragColor = vec4(vec3(st.x, st.y, 1.0), 1.0);
}
      `,
      wireframe: true });
      mat.wireframe = true;
    const geometry = new IcosahedronGeometry(25, 18);
    return new Mesh(geometry, mat);
  }

  async ngAfterViewInit(): Promise<void> {
    const host = this.canvasHost().nativeElement;
    // Creating the WebGL context is one of the slowest steps, so it gets a task of its own
    await yieldToMain();
    if (this.destroyed) return;
    try {
      this.renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch (e) {
      // No WebGL (disabled, blocklisted GPU, lost context): skip the scene, the text and links still work
      console.warn('3D scene disabled, WebGL is unavailable', e);
      return;
    }
    await yieldToMain();
    // ngOnDestroy has already disposed of the renderer
    if (this.destroyed) return;
    host.appendChild(this.renderer.domElement);
    this.watchPixelRatio();
    this.listenForInput(host);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    // Pause the timer while the tab is hidden so the model doesn't jump when we come back
    this.timer.connect(document);
    this.requestFrame();
    this.addGpuExtras(this.renderer);
  }

  /**
   * Metal (the cart, the hammer) shows only what it reflects, and lights alone leave it black. It
   * reflects a small dark room with a few warm glowing panels, drawn once here: nothing to download.
   */
  private addReflections(renderer: WebGLRenderer) {
    const room = new Scene();
    room.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ color: 0x050403, side: BackSide })));
    // Brighter than white, as lamps are
    const panel = (glow: [number, number, number], position: [number, number, number], width: number, height: number) => {
      const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ side: DoubleSide }));
      mesh.material.color.setRGB(...glow);
      mesh.position.set(...position);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
    };
    panel([1.6, 1.45, 1.25], [-4.5, 2, 3], 4, 5);
    panel([1.1, 0.95, 0.8], [4.5, 1, -3], 3, 6);
    panel([0.4, 0.37, 0.33], [0, 4.8, 0], 8, 8);
    const pmrem = new PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    disposeObject(room);
  }

  /** Reflections for metal, wherever there's a GPU to draw them, and the fog where it's fast. */
  private async addGpuExtras(renderer: WebGLRenderer) {
    // detect-gpu makes a WebGL context of its own to read the GPU name, which is slow too
    await yieldToMain();
    if (this.destroyed) return;
    const gpuTier = await getGPUTier({ benchmarksURL: `${ASSET_PATH}detect-gpu` });
    if (this.destroyed) return;
    // Drawn on the CPU, the reflections' room is a long stall, for a few highlights
    const software = gpuTier.tier === 0 || SOFTWARE_RENDERER.test(gpuTier.gpu ?? '');
    if (!software) this.addReflections(renderer);
    // detect-gpu looks the GPU's name up in its benchmarks. When the name is hidden or unknown it
    // says FALLBACK (tier 1): Brave, for one, gives every user the same generic name to stop
    // fingerprinting. Rather than never showing those the fog, it goes on trial.
    const unknown = gpuTier.type === 'FALLBACK' && !software;
    if (gpuTier.tier <= 1 && !unknown) return;
    this.fog = new Fog(this.reducedMotion.matches);
    this.scene.add(this.fog.object);
    if (unknown) this.fogTrial = [];
    // The fog lowers the pixel ratio cap
    this.resize();
  }

  private listenForInput(host: HTMLElement) {
    this.gestures = new Gestures(host, {
      press: () => {
        this.dragging = true;
        // Catching it stops a spin
        this.spinSpeed = 0;
        this.touched();
      },
      drag: (dx, dy, event) => {
        this.spin += dx * TURN_PER_PX;
        this.tilt = clamp(this.tilt + dy * TURN_PER_PX, -MAX_TILT, MAX_TILT);
        // The spin speed so far, smoothed over the last few moves, for when it's let go
        const seconds = Math.max(event.timeStamp - this.lastDrag, 1) / 1000;
        this.spinSpeed = clamp(0.6 * this.spinSpeed + 0.4 * dx * TURN_PER_PX / seconds, -MAX_SPIN, MAX_SPIN);
        this.lastDrag = event.timeStamp;
        this.touched();
      },
      pinch: (scale) => this.zoomBy(scale),
      release: () => {
        this.dragging = false;
        // Held still before letting go: no flick
        if (performance.now() - this.lastDrag > 100) this.spinSpeed = 0;
        this.touched();
      },
    });
    host.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onWheel = (event: WheelEvent) => {
    // Otherwise the page would zoom (with ctrl, as a trackpad pinch arrives)
    event.preventDefault();
    // In lines (Firefox, some mice) rather than pixels
    const pixels = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 40 : 1);
    this.zoomBy(Math.exp(-pixels * 0.0015));
  };

  /** Brings the item closer (factor above 1) or sends it away. */
  private zoomBy(factor: number) {
    this.zoomTarget = clamp(this.zoomTarget / factor, MIN_ZOOM, MAX_ZOOM);
    this.touched();
  }

  private touched() {
    this.lastTouched = performance.now();
  }

  // A hidden tab gets no frames: the gap until it's back isn't a slow frame
  private restartFrameClock = () => (this.lastFrame = undefined);

  /** Times the frames while the fog is on trial, and takes it out again if they're too slow. */
  private judgeFog(now: number) {
    const last = this.lastFrame;
    this.lastFrame = now;
    // Only once every puff is in
    if (!this.fogTrial || !this.fog || last === undefined || this.fog.smokeData.length < this.fog.NUM_INSTANCES) return;
    this.fogTrial.push(now - last);
    const total = this.fogTrial.reduce((sum, ms) => sum + ms);
    const stalled = now - last > STALL_MS;
    if (total < FOG_TRIAL_MS && !stalled) return;
    const average = total / this.fogTrial.length;
    this.fogTrial = undefined;
    if (stalled || average > SLOW_FRAME_MS) {
      this.scene.remove(this.fog.object);
      disposeObject(this.fog.object);
      this.fog = undefined;
      // Back to the higher pixel ratio cap
      this.resize();
    }
  }

  private resize() {
    const host = this.canvasHost().nativeElement;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (this.renderer) {
      // Render at the screen's real resolution so phones and HiDPI screens aren't blurry. Capped
      // because fill cost grows with the square of the ratio: 2 when the scene is light, 1.5 with
      // the fog, whose 500 overlapping transparent planes are fill-bound and soft anyway.
      const pixelRatio = Math.min(window.devicePixelRatio, this.fog ? 1.5 : 2);
      const size = this.renderer.getSize(new Vector2());
      // Resizing reallocates the drawing buffer, which is slow, and this runs several times on load
      if (pixelRatio !== this.renderer.getPixelRatio() || size.x !== width || size.y !== height) {
        this.renderer.setDrawingBufferSize(width, height, pixelRatio);
      }
      // The Perlin shader divides gl_FragCoord, which is in drawing buffer pixels
      this.renderer.getDrawingBufferSize(this.uniform['u_resolution'].value);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private watchPixelRatio = () => {
    this.dprQuery?.removeEventListener('change', this.watchPixelRatio);
    if (this.destroyed) return;
    this.resize();
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.watchPixelRatio);
  };

  private requestFrame() {
    this.frameId = requestAnimationFrame((now) => {
      this.judgeFog(now);
      this.onBeforeRender();
      this.renderer?.render(this.scene, this.camera);
      this.requestFrame();
    });
  }

  private loadItem(item: Item) {
    const load = ++this.loadId;
    // Ignore loads that finished after we moved on to another item
    const superseded = () => this.destroyed || load !== this.loadId;

    // Items without a model (the Perlin mesh) just clear the previous one
    if (item.assetPath === undefined) {
      this.showPerlinMesh(superseded);
      return;
    }
    this.gltfLoader.load(item.assetPath, async (gltf) => {
      if (!superseded()) await this.compile(gltf.scene);
      if (superseded()) {
        disposeObject(gltf.scene);
        return;
      }
      this.removeModel();
      this.model = gltf.scene;
      // Measured before it's moved, scaled or turned, so world and model coordinates are the same
      new Box3().setFromObject(this.model).getCenter(this.modelCentre);
      this.fit.set(measure(this.model, item.scaleOnLoad ?? this.DEFAULT_SCALE, item.rotationOnLoad ?? this.DEFAULT_ROTATION));
      this.scene.add(this.model);
      this.onLoaded();
    });
  }

  private async showPerlinMesh(superseded: () => boolean) {
    if (!this.mesh) {
      // Building the sphere is a sizeable chunk of work, keep it out of whatever task got us here
      await yieldToMain();
      if (superseded()) return;
      this.mesh = this.createPerlinMesh();
    }
    if (!this.mesh.parent) {
      await this.compile(this.mesh);
      if (superseded()) return;
      this.scene.add(this.mesh);
    }
    this.removeModel();
    this.onLoaded();
  }

  // Compiles the shaders before the object joins the scene, so its first frame doesn't stall on them
  private async compile(object: Object3D) {
    // Loading or building the object was a long task already, start the compile in a new one
    await yieldToMain();
    if (!this.renderer) return;
    // With KHR_parallel_shader_compile, wait for the GPU without blocking. Without it (some browsers,
    // software GL) compileAsync can't do better than compile, and logs a warning.
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) {
      await this.renderer.compileAsync(object, this.camera, this.scene);
    } else {
      this.renderer.compile(object, this.camera, this.scene);
    }
  }

  private removeModel() {
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
      this.model = undefined;
    }
  }

  // Moves on to the next item, unless someone is playing with this one
  private autoAdvance() {
    if (this.dragging || performance.now() - this.lastTouched < IDLE_MS) return;
    this.toggle();
  }

  public toggle() {
    window.clearInterval(this.intervalHandle);
    this.chosen.next();
  }

  private GetRandomInt(min: number, max: number)
  {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private getNewTarget() {
    while (true) {
      let index = this.GetRandomInt(0, this.positions.length - 1);
      if (this.positions[index] !== this.OriginalPos) {
        return this.positions[index];
      }
    }
  }

  private positions: Vector3[] = [
    new Vector3(-20, 1, 30), // up
    new Vector3(-20, -10, 30), // front left camera
    new Vector3(-20, -10, 15) // back
  ]

  ngOnDestroy(): void {
    window.clearInterval(this.intervalHandle);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.restartFrameClock);
    this.dprQuery?.removeEventListener('change', this.watchPixelRatio);
    this.destroyed = true;
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.gestures?.dispose();
    this.canvasHost().nativeElement.removeEventListener('wheel', this.onWheel);
    this.timer.dispose();
    disposeObject(this.scene);
    this.scene.environment?.dispose();
    // The Perlin mesh isn't in the scene yet if we left while its shaders compiled
    if (this.mesh && !this.mesh.parent) disposeObject(this.mesh);
    this.renderer?.dispose();
  }

  public readonly timer = new Timer();

  // Which item, shared with the theme, which shows its caption without waiting for this chunk
  private readonly chosen = inject(SkyrimItem);
  public itemIndex = this.chosen.index;
  public item = computed<Item>(() => ({ ...this.models[this.itemIndex()], ...ITEM_TEXTS[this.itemIndex()] }));
  // In the order of ITEM_TEXTS
  private readonly models: Model[] =
  [
    {
      perlin: false,
      assetPath:`${ASSET_PATH}dingus.glb`,
      shouldRotate:true,
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}raspberry_pi_3.glb`,
      shouldRotate:true,
      scaleOnLoad: new Vector3(2, 2, 2),
      rotationOnLoad: new Euler(10 * 3.14/180, 0, 0),
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}shopping_cart.glb`,
      shouldRotate:true,
      scaleOnLoad: new Vector3(2, 2, 2),
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}club_penguin_recreation.glb`,
      shouldRotate:true,
      scaleOnLoad: new Vector3(4, 4, 4),
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}halo_gravity_hammer.glb`,
      shouldRotate:true,
      scaleOnLoad: new Vector3(0.0075, 0.0075, 0.0075),
    },
    {
      perlin: true,
      shouldRotate: false,
    },
  ];
  
  //1° × π/180 = 0.01745rad
  //1rad × 180/π = 57.296°
  private readonly MIN_MS: number = 5000;
  private readonly MAX_MS: number = 15000;

  private moveAmt: number = 0.66;
  private moving: boolean = false;
  private rotateAmt: number = 0.024;


  public itemPos: Vector3;
  public OriginalPos?: Vector3;
  public TargetPos?: Vector3;

  public itemRot: Euler = this.DEFAULT_ROTATION;
  public itemScale: Vector3 = this.DEFAULT_SCALE;

  // Camera
  private readonly BASE_CAM_Z = 80; // Base camera Z position for desktop
  // Half the camera's vertical field of view, PerspectiveCamera defaults to 50 degrees
  private readonly TAN_HALF_FOV = Math.tan(25 * Math.PI / 180);
  // The models all spawn at x = -20
  private readonly MODEL_X = -20;

  // How far to pan towards the models: 0 on landscape screens, where they sit left of the caption,
  // up to 1 on portrait ones, which are too narrow to show x = -20 without shrinking the model.
  // The Perlin sphere sits at the origin, so it is never panned.
  private readonly pan = computed(() => {
    if (this.item()?.perlin) return 0;
    return Math.min(Math.max((1.2 - this.aspectRatio()) / 0.5, 0), 1);
  });

  /**
   * Where a camera looking straight down -z sees the model as big as it can, wherever it drifts and
   * however it turns: no wider than SIDE_FILL of the screen, and between the top and bottom of the band.
   */
  private readonly framing = computed(() => {
    const { radius, minY, maxY } = this.fit();
    const band = this.band();
    const tan = this.TAN_HALF_FOV;
    // The band's edges in clip space, where the screen runs from 1 at the top to -1 at the bottom
    const top = 1 - 2 * band.top;
    const bottom = 1 - 2 * band.bottom;
    const nearest = Math.max(...this.positions.map(p => p.z));
    // Turning, it sweeps a cylinder of this radius. Seen from `distance` away its outline is
    // radius / sqrt(distance² - radius²) wide, in tangents of the angle
    const across = SIDE_FILL * tan * this.aspectRatio();
    let distance = radius * Math.sqrt(1 + 1 / (across * across));
    // Its top and bottom are seen at their largest at the front of the cylinder, at camera z minus
    // (nearest + distance - p.z - radius) for a spot p. The top at the highest spot must stay under
    // the band's top, and the bottom at the lowest above its bottom; that holds from this distance on
    const ahead = (p: Vector3) => nearest - p.z - radius;
    for (const high of this.positions) for (const low of this.positions) {
      const needed = (high.y + maxY - low.y - minY) / tan - top * ahead(high) + bottom * ahead(low);
      distance = Math.max(distance, needed / (top - bottom));
    }
    // Then the camera's height that leaves as much room above as below
    const room = (p: Vector3) => (nearest + distance - p.z - radius) * tan;
    const lowest = Math.max(...this.positions.map(p => p.y + maxY - top * room(p)));
    const highest = Math.min(...this.positions.map(p => p.y + minY - bottom * room(p)));
    return new Vector3(this.MODEL_X, (lowest + highest) / 2, nearest + distance);
  });

  // Panned towards the framing, which on portrait screens puts the models between the name at the
  // top and the caption below
  public lookAtPosition = computed(() => new Vector3(this.MODEL_X * this.pan(), this.framing().y * this.pan(), 0));

  public camPosition = computed(() => {
    const aspect = this.aspectRatio();
    const lookAt = this.lookAtPosition();
    if (this.item()?.perlin) {
      // The sphere fills the screen; on portrait screens pull back so it still reads as a sphere
      const z = aspect < 1 ? this.BASE_CAM_Z * (1 + (1 - aspect) * 2) : this.BASE_CAM_Z;
      return new Vector3(0, 0, z);
    }
    const pan = this.pan();
    return new Vector3(lookAt.x, lookAt.y, this.BASE_CAM_Z * (1 - pan) + this.framing().z * pan);
  });

  private handleResize = () => this.updateAspectRatio();

  private updateAspectRatio() {
    this.aspectRatio.set(window.innerWidth / window.innerHeight);
  }

  public onLoaded() {
    let currentItem = this.item();

    // If the newely loaded item specifies a rotation we'll use it, I thinks te cat likes to face the audience
    if (currentItem.rotationOnLoad !== undefined) {
      this.itemRot = currentItem.rotationOnLoad;
    } else {
      this.itemRot = this.DEFAULT_ROTATION;
    }

    if (currentItem.scaleOnLoad !== undefined) {
      this.itemScale = currentItem.scaleOnLoad;
    } else {
      this.itemScale = this.DEFAULT_SCALE;
    }

    // TargetPos will be undefined on the initial load, OriginalPos is set for the first time in ctor
    if (this.TargetPos !== undefined) {
      this.OriginalPos = this.TargetPos;
    }
    
    this.TargetPos = this.getNewTarget();
    this.moving = true;
    // A new item starts the right way up, at the usual distance
    this.spin = this.tilt = this.spinSpeed = 0;
    this.zoomTarget = 1;
  }

  // Seconds of animation so far, only advances while motion is allowed
  private motionTime = 0;
  // The same, but standing still while the item is held: its own drift and turning wait for it to be let go
  private driftTime = 0;

  /**
   * Zooming brings the item towards the camera, along the line from the camera to its middle, so it
   * grows where it is on the screen while the camera, and the fog, stay put. Models are placed by a
   * point that is often at their feet, so it's the middle of their bounding box, however it's turned.
   */
  private zoomItem() {
    if (this.item().perlin) {
      // The sphere's middle is the origin
      this.mesh?.position.copy(this.camera.position).multiplyScalar(1 - this.zoom);
      return;
    }
    if (!this.model) return;
    this.model.updateMatrixWorld();
    const middle = this.model.localToWorld(this.modelCentre.clone());
    this.model.position.add(this.camera.position.clone().sub(middle).multiplyScalar(1 - this.zoom));
  }

  public onBeforeRender() {
    this.timer.update();
    // With reduced motion nothing drifts, spins or wobbles, so animation time stands still
    const reduceMotion = this.reducedMotion.matches;
    const realDt = this.timer.getDelta();
    const dt = reduceMotion ? 0 : realDt;
    this.motionTime += dt;
    const drift = this.dragging ? 0 : dt;
    this.driftTime += drift;

    // A flicked item spins on, slowing down
    if (!this.dragging && this.spinSpeed !== 0) {
      this.spin += this.spinSpeed * dt;
      this.spinSpeed *= Math.exp(-SPIN_FRICTION * dt);
      if (Math.abs(this.spinSpeed) < 0.01 || reduceMotion) this.spinSpeed = 0;
    }
    // The item glides in and out, or jumps with reduced motion
    this.zoom = reduceMotion ? this.zoomTarget : this.zoomTarget + (this.zoom - this.zoomTarget) * Math.exp(-realDt * 8);

    if (this.item().perlin) {
      this.uniform['u_time'].value = this.motionTime;

      if (this.mesh != null) {
        this.mesh.rotation.x = this.driftTime * 0.1 + this.tilt;
        this.mesh.rotation.y = this.spin;
        this.mesh.rotation.z = this.driftTime * 0.1;
        this.mesh.visible = true;
      }
    } else {
      // Hidden rather than scaled to 0, so its vertex shader doesn't keep running every frame
      if (this.mesh != null)
        this.mesh.visible = false;
    }
    

    this.fog?.onBeforeRender(dt);

    // Slowly rotate
    if (this.item().shouldRotate) {
      this.itemRot = new Euler(this.itemRot.x, this.itemRot.y + this.rotateAmt * drift, this.itemRot.z);
    }

    if (this.moving && this.TargetPos !== undefined && this.OriginalPos !== undefined) {
      let currentPos = this.itemPos.clone();
      const targetPos = this.TargetPos.clone();

      const direction = targetPos.clone().sub(currentPos).normalize();

      // Never step past the target, a long frame would otherwise overshoot it.
      // With reduced motion, skip the glide and appear at the target straight away. Held, it waits.
      const maxStep = this.dragging ? 0 : reduceMotion ? Infinity : this.moveAmt * dt;
      const step = Math.min(maxStep, currentPos.distanceTo(targetPos));
      currentPos.addScaledVector(direction, step);

      if (currentPos.distanceTo(targetPos) < 0.1) {
        currentPos = targetPos;
        this.moving = false;
        let millis = this.GetRandomInt(this.MIN_MS, this.MAX_MS);
        this.intervalHandle = window.setInterval(() => this.autoAdvance(), millis);
      }

      this.itemPos = currentPos;
    }

    if (this.model) {
      this.model.position.copy(this.itemPos);
      // Euler angles apply Y first, so the tilt is always towards or away from the camera
      this.model.rotation.set(this.itemRot.x + this.tilt, this.itemRot.y + this.spin, this.itemRot.z);
      this.model.scale.copy(this.itemScale);
    }

    this.zoomItem();
  }
}

/** How much room a model takes, about the point it's placed by. */
interface Fit {
  // Of the cylinder it sweeps turning about the vertical
  radius: number;
  // How far it reaches below and above
  minY: number;
  maxY: number;
}

/** Measures a model at the scale and rotation it's shown at, unmoved and not yet turned about the vertical. */
function measure(model: Object3D, scale: Vector3, rotation: Euler): Fit {
  model.scale.copy(scale);
  model.rotation.copy(rotation);
  model.updateMatrixWorld(true);
  // Vertex by vertex: a bounding box's corners stick out well past a rounded model like the cat
  const fit = { radius: 0, minY: Infinity, maxY: -Infinity };
  const vertex = new Vector3();
  model.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const position = o.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld);
      fit.radius = Math.max(fit.radius, Math.hypot(vertex.x, vertex.z));
      fit.minY = Math.min(fit.minY, vertex.y);
      fit.maxY = Math.max(fit.maxY, vertex.y);
    }
  });
  return fit;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function disposeObject(object: Object3D) {
  object.traverse(o => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach(m => {
        Object.values(m).forEach(v => v instanceof Texture && v.dispose());
        m.dispose();
      });
    }
  });
}

// Lets the browser handle input and paint before the next piece of setup work
function yieldToMain() {
  return new Promise<void>(resolve => setTimeout(resolve));
}
