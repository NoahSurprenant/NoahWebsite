import { Component, OnInit } from '@angular/core';
import { TextureLoaderService } from 'ngx-three';
import { Clock, Euler, Texture, Vector3 } from 'three';
import { ASSET_PATH } from '../assets';

// References:
// https://github.com/demike/ngx-three/

// Example of smoke with three.js
// https://codepen.io/sbrl/pen/zNdqdd?editors=0110

@Component({
  selector: 'app-skyrim-loading',
  templateUrl: './skyrim-loading.component.html',
  styleUrls: ['./skyrim-loading.component.css']
})
export class SkyrimLoadingComponent implements OnInit {

  constructor(service: TextureLoaderService) {
    // Not sure why I couldn't just load the locally texture with the pipe on the decorator so I am using the service here to do it
    this.cloudTexture = service.load(this.cloudPath);
    this.initSmokeData();
  }

  ngOnInit() {
  }

  public readonly clock = new Clock(true);

  // Smoke/fog
  public cloudTexture: Texture | null;
  public cloudPath = `${ASSET_PATH}clouds.png`;
  public smokeData: { pos: Vector3; rotation: Euler; scale: Vector3; }[] = [];
  readonly NUM_INSTANCES = 120;
  readonly SMOKE_SIZE = 130;
  readonly SMOKE_MAX_X = 50;
  readonly SMOKE_MIN_X = -90;
  readonly SMOKE_MAX_Y = 150;
  readonly SMOKE_MIN_Y = -150;
  readonly SMOKE_MAX_Z = -50;
  readonly SMOKE_MIN_Z = -50;

  // Cat
  public assetPath = `${ASSET_PATH}dingus.glb`;
  private minZ: number = -20;
  private maxZ: number = 15;
  private moveAmt: number = 0.96;
  private movingToward: boolean = true;
  private shouldRotate: boolean = true;
  private rotateAmt: number = 0.024;
  public catPosition: [x: number, y: number, z: number] = [-15, 0, this.minZ];
  public catRotation: [x: number, y: number, z: number] = [0, -45, 0];

  // Camera
  public lookAtPosition: [x: number, y: number, z: number] = [0, 0, 0];
  public camPosition: [x: number, y: number, z: number] = [0, 0, 80];

  private GetRandom(min: number, max: number)
  {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private initSmokeData() {
    for (let i = 0; i < this.NUM_INSTANCES; i++) {
      let pos = new Vector3(0, 0 , 0);
      let rotation = new Euler(0, 0, 0);
      let scale = new Vector3(1, 1, 1);

      pos.x = this.GetRandom(this.SMOKE_MIN_X, this.SMOKE_MAX_X);
      pos.y = this.GetRandom(this.SMOKE_MIN_Y, this.SMOKE_MAX_Y);
      pos.z = this.GetRandom(this.SMOKE_MIN_Z, this.SMOKE_MAX_Z);

      let newZ = Math.random() * 360;
      rotation.z = newZ * Math.PI / 180

      this.smokeData.push({pos, rotation, scale});
    }
  }

  private ranOnce: boolean = false;

  public onBeforeRender() {

    const dt = this.clock.getDelta();

    // Slowly rotate cat
    if (this.shouldRotate) {
      this.catRotation = [this.catRotation[0], this.catRotation[1] + this.rotateAmt * dt, this.catRotation[2]];
    }

    this.smokeData.forEach( (data) => {
      let newZEuler = data.rotation.z + dt * 0.008;
      data.rotation = new Euler(data.rotation.x, data.rotation.y, newZEuler);
    });

    // Slowly bring cat towards camera until a point
    if (this.movingToward) {
      this.catPosition = [this.catPosition[0], this.catPosition[1], this.catPosition[2] + this.moveAmt * dt];
      if (this.catPosition[2] >= this.maxZ) {
        this.catPosition = [this.catPosition[0], this.catPosition[1], this.maxZ];
        this.movingToward = false;
      }
      //console.log("moving toward");
    } else {
      //console.log("not moving toward");
    }


  }
}
