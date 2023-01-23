import { Component } from '@angular/core';
import { TextureLoaderService } from 'ngx-three';
import * as THREE from 'three';
import { Clock, Euler, MathUtils, Vector2, Vector3 } from 'three';
import { ASSET_PATH } from '../assets';

@Component({
  selector: 'app-fog',
  templateUrl: './fog.component.html',
  styleUrls: ['./fog.component.css']
})
export class FogComponent {
  // Only for previewing the points
  public points: Vector3[] = [];

  public points2D: Vector2[] = [
    new Vector2(-130, -80), // top left
    new Vector2(-80, -100), //
    new Vector2(0, -150),
    new Vector2(100, -200), // bottom right
    new Vector2(-130, -200),//bottom left
  ];

  readonly minX: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly minY: number;
  readonly Z: number = -50;

  private textureLoader: TextureLoaderService;
  
  constructor(service: TextureLoaderService) {
    this.textureLoader = service;

    // Push points into 3d array, so I have preview of locations,
    this.points2D.forEach(p => {
      let point3D = new Vector3(p.x, p.y, -50);
      this.points.push(point3D);
    });

    // Determine the min and max possible spawn locations
    this.minX = Math.min.apply(null, this.points2D.map(i => i.x));
    this.maxX = Math.max.apply(null, this.points2D.map(i => i.x));
    this.minY = Math.min.apply(null, this.points2D.map(i => i.y));
    this.maxY = Math.max.apply(null, this.points2D.map(i => i.y));

    this.initSmokeData();
  }

  getNewSpawnVector() {
    while (true)
    {
      let ranX = this.GetRandomInt(this.minX, this.maxX);
      let ranY = this.GetRandomInt(this.minY, this.maxY);
      let ranPoint = new Vector2(ranX, ranY);
      if (this.ray_casting(ranPoint, this.points2D)) {
        return new Vector3(ranPoint.x, ranPoint.y, this.Z);
      }
    }
  }

  // Checks if point is in polygon, not inclusive
  ray_casting(point: Vector2, polygon: Vector2[]) {
    var n=polygon.length,
        is_in=false,
        x=point.x,
        y=point.y,
        x1,x2,y1,y2;

    for(var i=0; i < n-1; ++i){
        x1=polygon[i].x;
        x2=polygon[i+1].x;
        y1=polygon[i].y;
        y2=polygon[i+1].y;

        if(y < y1 != y < y2 && x < (x2-x1) * (y-y1) / (y2-y1) + x1){
            is_in=!is_in;
        }
    }
    return is_in;
  }

  public readonly clock = new Clock(true);

  // Smoke/fog
  public cloudPath = `${ASSET_PATH}clouds.png`;
  public smokeData: { pos: Vector3; rotation: Euler; scale: Vector3; maxHeight: number; originalHeight: number; speed: number; material: THREE.MeshLambertMaterial }[] = [];
  readonly NUM_INSTANCES = 500;
  readonly SMOKE_SIZE = 200;

  private GetRandomInt(min: number, max: number)
  {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private GetRandomFloat(min: number, max: number)
  {
    return Math.random() * (max - min) + min;
  }

  private initSmokeData() {
    let cloudText = this.textureLoader.load(this.cloudPath);

    for (let i = 0; i < this.NUM_INSTANCES; i++) {
      let pos = this.getNewSpawnVector();
      let originalHeight = pos.y;
      let maxHeight = originalHeight + this.GetRandomInt(20, 60);
      let rotation = new Euler(0, 0, 0);
      let scale = new Vector3(1, 1, 1);


      let newZ = Math.random() * 360;
      rotation.z = newZ * Math.PI / 180
      
      let speed = this.GetRandomFloat(0.05, 1);

      let material = new THREE.MeshLambertMaterial();
      material.map = cloudText;
      material.transparent = true;
      this.smokeData.push({pos, rotation, scale, maxHeight, originalHeight, speed, material});
    }
  }

  public onBeforeRender() {

    const dt = this.clock.getDelta();

    this.smokeData.forEach( (data) => {
      let newZEuler = data.rotation.z + dt * 0.008;
      data.rotation = new Euler(data.rotation.x, data.rotation.y, newZEuler);

      let newPos = new Vector3(data.pos.x, data.pos.y + data.speed * dt, data.pos.z);
      
      let newOpacity = data.material.opacity;

      let currentHeight = data.pos.y;

      let minHeight = data.originalHeight;
      let maxHeight = data.maxHeight;
      let midHeight = (maxHeight + minHeight) / 2;

      // Opacity should go from 0 at bottom to 1 at middle, to 0 at top again. So that it fades out and in as it comes and goes
      if (currentHeight < midHeight) { // lerp with bottom half
        let inverseLerp = MathUtils.inverseLerp(minHeight, midHeight, currentHeight); // Goes from 0 to 1
        newOpacity = inverseLerp;
      } else { // lerp with top half
        let inserveLerp2 = MathUtils.inverseLerp(midHeight, maxHeight, currentHeight); // Goes from 0 to 1
        let inserveLerp2Inverted = 1 - inserveLerp2; // from 1 to 0;
        newOpacity = inserveLerp2Inverted;
      }


      if (newPos.y >= data.maxHeight) {
        newPos.y = data.originalHeight;
      }

      data.material.opacity = newOpacity;
      data.pos = newPos;
    });


  }
}
