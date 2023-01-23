import { Component, OnInit } from '@angular/core';
import { Clock } from 'three';
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

  constructor() {
  }

  ngOnInit() {
  }

  public readonly clock = new Clock(true);

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

 
  public onBeforeRender() {

    const dt = this.clock.getDelta();

    // Slowly rotate cat
    if (this.shouldRotate) {
      this.catRotation = [this.catRotation[0], this.catRotation[1] + this.rotateAmt * dt, this.catRotation[2]];
    }

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
