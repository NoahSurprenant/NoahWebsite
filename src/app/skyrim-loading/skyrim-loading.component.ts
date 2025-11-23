import { Component, computed, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { Clock, Euler, IcosahedronGeometry, IUniform, Mesh, ShaderMaterial, Vector2, Vector3 } from 'three';
import { ASSET_PATH } from '../assets';
import { FogComponent } from '../fog/fog.component';
import { Item } from '../item';
import { getGPUTier } from 'detect-gpu';
import { ThScene } from '@noahsurprenant/ngx-three';

// References:
// https://github.com/demike/ngx-three/

// Example of smoke with three.js
// https://codepen.io/sbrl/pen/zNdqdd?editors=0110

// Perlin noise
// https://github.com/ashima/webgl-noise/blob/master/src/classicnoise3D.glsl

@Component({
  selector: 'app-skyrim-loading',
  templateUrl: './skyrim-loading.component.html',
  styleUrls: ['./skyrim-loading.component.css']
})
export class SkyrimLoadingComponent implements OnInit, OnDestroy {
  private readonly DEFAULT_SCALE: Vector3 = new Vector3(1, 1, 1);
  private readonly DEFAULT_ROTATION: Euler = new Euler(0, 0, 0);
  private readonly DEFAULT_LOCATION: Vector3 = new Vector3(0, 0, 0);

  private intervalHandle?: number;
  private uniform?: { [uniform: string]: IUniform };
  private mesh?: Mesh;

  scene = viewChild.required(ThScene);

  // Responsive camera positioning
  private aspectRatio = signal<number>(window.innerWidth / window.innerHeight);
  
  constructor() {
    let initialIndex = this.GetRandomInt(0, this.positions.length - 1);
    this.OriginalPos = this.positions[initialIndex];
    this.itemPos = this.OriginalPos;

    this.itemIndex = this.getNewItemIndex();
  }

  async ngOnInit(): Promise<void> {
    const gpuTier = await getGPUTier();
    this.renderFog.set(gpuTier.tier > 1);

    // Set initial aspect ratio
    this.updateAspectRatio();

    // Add resize listener
    window.addEventListener('resize', this.handleResize);

    this.uniform = {
      u_resolution: {value: new Vector2(window.innerWidth, window.innerHeight)},
      u_time: {value: 0.0},
    };
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
    this.mesh = new Mesh(geometry, mat);
    this.scene().objRef?.add(this.mesh);
  }

  public toggle() {
    window.clearInterval(this.intervalHandle);
    this.itemIndex = this.getNewItemIndex();
    //console.log("toggle called new index is " + this.itemIndex);
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

  private getNewItemIndex() {
    while (true) {
      let index = this.GetRandomInt(0, this.items.length - 1);
      if (index !== this.itemIndex) {
        return index;
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
  }

  renderFog = signal(false);
  fogComp = viewChild<FogComponent>('fogComp');

  public readonly clock = new Clock(true);

  public itemIndex: number = -1;
  public items: Item[] =
  [
    {
      perlin: false,
      assetPath:`${ASSET_PATH}dingus.glb`,
      shouldRotate:true,
      caption:"You have acquired a feline companion, a creature of mystery and power. Its spinning abilities shall prove to be formidable ally in battle and a constant source of amusement.",
      attribution: { short:"dingus the cat by bean(alwayshasbean)", long:'"dingus the cat" by bean(alwayshasbean) is licensed under Creative Commons Attribution', url:"https://skfb.ly/oAtMJ"}
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}raspberry_pi_3.glb`,
      shouldRotate:true,
      caption:"The Raspberry Pi, a small yet powerful device, can be a valuable tool in your journey. With its capability to run various programs and control machinery, it may come in handy on your endeavors.",
      scaleOnLoad: new Vector3(2, 2, 2),
      rotationOnLoad: new Euler(10 * 3.14/180, 0, 0),
      attribution: { short:"Raspberry Pi 3 by JoSaCo", long:'"Raspberry Pi 3" by JoSaCo is licensed under Creative Commons Attribution', url:"https://skfb.ly/OBDI"}
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}shopping_cart.glb`,
      shouldRotate:true,
      caption:"Carts be a mighty useful tool for any traveler, but be warned, not all carts be in good condition. Ye may come across some with a broken wheel or two, and that can make them quite difficult to maneuver.",
      scaleOnLoad: new Vector3(2, 2, 2),
      attribution: { short:"Shopping cart model by Jiří Kuba", long:'"Shopping cart model" by Jiří Kuba is licensed under Creative Commons Attribution', url:"https://skfb.ly/6vw6D"}
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}club_penguin_recreation.glb`,
      shouldRotate:true,
      caption:"'Tis the ancient ritual of Tipping the Iceberg! With a mighty leap, we strike the Iceberg with all our might, causing it to shift and reveal the bounties hidden within.",
      scaleOnLoad: new Vector3(4, 4, 4),
      attribution: { short:"Club Penguin recreation by LukeTheLPSWolf", long:'"Club Penguin recreation" by LukeTheLPSWolf is licensed under Creative Commons Attribution', url:"https://skfb.ly/oB86E"}
    },
    {
      perlin: false,
      assetPath:`${ASSET_PATH}halo_gravity_hammer.glb`,
      shouldRotate:true,
      caption:"'Tis the gravity hammer, a weapon of great power and destruction. In the game of Grifball, it is a weapon of great importance. With a swing of this mighty hammer, a warrior can send their foes flying.",
      scaleOnLoad: new Vector3(0.0075, 0.0075, 0.0075),
      attribution: { short:"Halo Gravity Hammer by Glitch5970", long:'"Halo Gravity Hammer" by Glitch5970 is licensed under Creative Commons Attribution', url:"https://skfb.ly/6RHzz"}
    },
    {
      perlin: true,
      // I don't really have a file to load here, reusing dingus with query parameter to fool computer into loading
      // even if dingus was already loaded
      assetPath:`${ASSET_PATH}dingus.glb?foo=bar`,
      shouldRotate: false,
      caption:"Perlin Noise is a craft of subtle beauty, a technique that weaves smooth, flowing patterns. Created by Ken Perlin, it shapes textures and terrains with natural grace, free of harsh marks.",
      scaleOnLoad: new Vector3(0, 0, 0),
      attribution: { short:"pnoise by Stefan Gustavson", long:'Original Perlin noise code by Stefan Gustavson are licensed under the MIT license', url:"https://github.com/stegu/webgl-noise"}
    },
  ];
  
  //1° × π/180 = 0.01745rad
  //1rad × 180/π = 57.296°
  private readonly MIN_MS: number = 5000;
  private readonly MAX_MS: number = 15000;

  private moveAmt: number = 0.66;
  private moving: boolean = false;
  private shouldRotate: boolean = true;
  private rotateAmt: number = 0.024;


  public itemPos: Vector3;
  public OriginalPos?: Vector3;
  public TargetPos?: Vector3;

  public itemRot: Euler = this.DEFAULT_ROTATION;
  public itemScale: Vector3 = this.DEFAULT_SCALE;

  // Camera
  private readonly BASE_CAM_Z = 80; // Base camera Z position for desktop
  
  // Compute camera look-at position based on aspect ratio
  // For portrait/narrow screens, shift the look-at point to better frame the model
  public lookAtPosition = computed(() => {
    const aspect = this.aspectRatio();
    // On portrait screens, shift look-at to the left to center the model
    // Models are positioned at X = -20, so we need to look more to the left on narrow screens
    const xOffset = aspect < 1 ? -10 * (1 - aspect) : 0; // Up to -10 on very narrow screens
    return new Vector3(xOffset, 0, 0);
  });
  
  // Compute camera position based on aspect ratio
  // For portrait/narrow screens (aspect < 1), pull camera back to fit the model
  public camPosition = computed(() => {
    const aspect = this.aspectRatio();
    // On portrait screens (aspect < 1), increase Z distance
    // On landscape screens (aspect >= 1), use base distance
    const zDistance = aspect < 1 
      ? this.BASE_CAM_Z * (1 + (1 - aspect) * 0.5) // Pull back by up to 50% on very narrow screens
      : this.BASE_CAM_Z;
    return new Vector3(0, 0, zDistance);
  });

  private handleResize = () => {
    this.updateAspectRatio();
    if (this.uniform) {
      this.uniform['u_resolution'].value = new Vector2(window.innerWidth, window.innerHeight);
    }
  };

  private updateAspectRatio() {
    this.aspectRatio.set(window.innerWidth / window.innerHeight);
  }

  public onLoaded() {
    //console.log("on loaded" + this.itemIndex);
    let currentItem = this.items[this.itemIndex];

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
    //console.log("new target:");
    //console.log(this.TargetPos);
    this.moving = true;
  }

  //private n: number = 0;

  public onBeforeRender() {
    const dt = this.clock.getDelta();

    if (this.items[this.itemIndex].perlin) {
      if (this.uniform != null)
        this.uniform['u_time'].value = this.clock.getElapsedTime();
  
      if (this.mesh != null) {
        this.mesh.rotation.x = this.clock.getElapsedTime() * 0.1;
        this.mesh.rotation.z = this.clock.getElapsedTime() * 0.1;
        this.mesh.scale.set(1, 1, 1);
      }
    } else {
      if (this.mesh != null)
        this.mesh.scale.set(0, 0, 0);
    }
    

    if (this.renderFog())
      this.fogComp()?.onBeforeRender();

    // if (this.clock.elapsedTime > this.n + 5) {
    //   console.log("current pos before render");
    //   console.log(this.itemPos);
    //   this.n = this.clock.elapsedTime
    // }
    
    // Slowly rotate
    if (this.shouldRotate) {
      this.itemRot = new Euler(this.itemRot.x, this.itemRot.y + this.rotateAmt * dt, this.itemRot.z);
    }

    if (this.moving && this.TargetPos !== undefined && this.OriginalPos !== undefined) {
      let currentPos = this.itemPos.clone();
      const targetPos = this.TargetPos.clone();

      const direction = targetPos.clone().sub(currentPos).normalize();
      
      const moveAmt = new Vector3(direction.x * this.moveAmt * dt, direction.y * this.moveAmt * dt, direction.z * this.moveAmt * dt);
      currentPos.add(moveAmt);

      if (currentPos.distanceTo(targetPos) < 0.1) {
        //console.log("got to target");
        currentPos = targetPos;
        this.moving = false;
        let millis = this.GetRandomInt(this.MIN_MS, this.MAX_MS);
        this.intervalHandle = window.setInterval(() => this.toggle(), millis);
      }

      this.itemPos = currentPos;
    }

  }
}

export interface Uniforms {
  u_resolution: {
    type: string,
    value: Vector2,
  },
  u_time: {
    type: string,
    value: number,
  },
}