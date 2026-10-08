import * as THREE from 'three';
import { Group, MathUtils, Mesh, PlaneGeometry, TextureLoader, Vector2, Vector3 } from 'three';
import { ASSET_PATH } from '../assets';

export class Fog {
  // Everything the fog draws, add this to the scene
  public readonly object = new Group();

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

  private textureLoader = new TextureLoader();

  // Reusable geometry, shared by every smoke mesh. This allows us to have 1 planeGeometry instead of 1 per smokeData
  private readonly geometry: PlaneGeometry;

  constructor() {
    // Determine the min and max possible spawn locations
    this.minX = Math.min.apply(null, this.points2D.map(i => i.x));
    this.maxX = Math.max.apply(null, this.points2D.map(i => i.x));
    this.minY = Math.min.apply(null, this.points2D.map(i => i.y));
    this.maxY = Math.max.apply(null, this.points2D.map(i => i.y));

    this.geometry = new PlaneGeometry(this.SMOKE_SIZE, this.SMOKE_SIZE);

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

  // Smoke/fog
  public cloudPath = `${ASSET_PATH}clouds.png`;
  public smokeData: { mesh: Mesh; maxHeight: number; originalHeight: number; speed: number; material: THREE.MeshLambertMaterial }[] = [];
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
    this.textureLoader.load(this.cloudPath, (cloudText) => {
      for (let i = 0; i < this.NUM_INSTANCES; i++) {
        let pos = this.getNewSpawnVector();
        let originalHeight = pos.y;
        let maxHeight = originalHeight + this.GetRandomInt(20, 60);

        let speed = this.GetRandomFloat(0.05, 1);

        let material = new THREE.MeshLambertMaterial();
        material.map = cloudText;
        material.transparent = true;

        let mesh = new Mesh(this.geometry, material);
        mesh.position.copy(pos);
        // Start each puff partway through its rise, so even a still frame (reduced motion) shows the fog
        mesh.position.y = this.GetRandomFloat(originalHeight, maxHeight);

        let newZ = Math.random() * 360;
        mesh.rotation.z = newZ * Math.PI / 180

        this.object.add(mesh);
        this.smokeData.push({mesh, maxHeight, originalHeight, speed, material});
      }
    });
  }

  public onBeforeRender(dt: number) {

    this.smokeData.forEach( (data) => {
      data.mesh.rotation.z += dt * 0.008;

      let currentHeight = data.mesh.position.y;

      let newOpacity = data.material.opacity;

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

      let newY = currentHeight + data.speed * dt;
      if (newY >= data.maxHeight) {
        newY = data.originalHeight;
      }

      data.material.opacity = newOpacity;
      data.mesh.position.y = newY;
    });
  }
}
