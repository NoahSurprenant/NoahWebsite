import { Component, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { Clock, Euler, Vector3 } from 'three';
import { ASSET_PATH } from '../assets';
import { FogComponent } from '../fog/fog.component';
import { Item } from '../item';
import { getGPUTier } from 'detect-gpu';

// References:
// https://github.com/demike/ngx-three/

// Example of smoke with three.js
// https://codepen.io/sbrl/pen/zNdqdd?editors=0110

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

  constructor() {
    let initialIndex = this.GetRandomInt(0, this.positions.length - 1);
    this.OriginalPos = this.positions[initialIndex];
    this.itemPos = this.OriginalPos;

    this.itemIndex = this.getNewItemIndex();
  }

  async ngOnInit(): Promise<void> {
    const gpuTier = await getGPUTier();
    this.renderFog.set(gpuTier.tier > 1);
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
  }

  renderFog = signal(false);
  fogComp = viewChild<FogComponent>('fogComp');

  public readonly clock = new Clock(true);

  public itemIndex: number = -1;
  public items: Item[] =
  [
    {
      assetPath:`${ASSET_PATH}dingus.glb`,
      shouldRotate:true,
      caption:"You have acquired a feline companion, a creature of mystery and power. Its spinning abilities shall prove to be formidable ally in battle and a constant source of amusement.",
      attribution: { short:"dingus the cat by bean(alwayshasbean)", long:'"dingus the cat" by bean(alwayshasbean) is licensed under Creative Commons Attribution', url:"https://skfb.ly/oAtMJ"}
    },
    {
      assetPath:`${ASSET_PATH}raspberry_pi_3.glb`,
      shouldRotate:true,
      caption:"The Raspberry Pi, a small yet powerful device, can be a valuable tool in your journey. With its capability to run various programs and control machinery, it may come in handy on your endeavors.",
      scaleOnLoad: new Vector3(2, 2, 2),
      rotationOnLoad: new Euler(10 * 3.14/180, 0, 0),
      attribution: { short:"Raspberry Pi 3 by JoSaCo", long:'"Raspberry Pi 3" by JoSaCo is licensed under Creative Commons Attribution', url:"https://skfb.ly/OBDI"}
    },
    {
      assetPath:`${ASSET_PATH}shopping_cart.glb`,
      shouldRotate:true,
      caption:"Carts be a mighty useful tool for any traveler, but be warned, not all carts be in good condition. Ye may come across some with a broken wheel or two, and that can make them quite difficult to maneuver.",
      scaleOnLoad: new Vector3(2, 2, 2),
      attribution: { short:"Shopping cart model by Jiří Kuba", long:'"Shopping cart model" by Jiří Kuba is licensed under Creative Commons Attribution', url:"https://skfb.ly/6vw6D"}
    },
    {
      assetPath:`${ASSET_PATH}club_penguin_recreation.glb`,
      shouldRotate:true,
      caption:"'Tis the ancient ritual of Tipping the Iceberg! With a mighty leap, we strike the Iceberg with all our might, causing it to shift and reveal the bounties hidden within.",
      scaleOnLoad: new Vector3(4, 4, 4),
      attribution: { short:"Club Penguin recreation by LukeTheLPSWolf", long:'"Club Penguin recreation" by LukeTheLPSWolf is licensed under Creative Commons Attribution', url:"https://skfb.ly/oB86E"}
    },
    {
      assetPath:`${ASSET_PATH}halo_gravity_hammer.glb`,
      shouldRotate:true,
      caption:"'Tis the gravity hammer, a weapon of great power and destruction. In the game of Grifball, it is a weapon of great importance. With a swing of this mighty hammer, a warrior can send their foes flying.",
      scaleOnLoad: new Vector3(0.0075, 0.0075, 0.0075),
      attribution: { short:"Halo Gravity Hammer by Glitch5970", long:'"Halo Gravity Hammer" by Glitch5970 is licensed under Creative Commons Attribution', url:"https://skfb.ly/6RHzz"}
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
  public lookAtPosition: Vector3 = this.DEFAULT_LOCATION;
  public camPosition: Vector3 = new Vector3(0, 0, 80);

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
