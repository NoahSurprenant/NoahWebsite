import { Texture, TextureLoader, Vector2 } from 'three';
import { Fog } from './fog';

describe('Fog', () => {
  beforeEach(() => {
    // The cloud texture arrives at once
    vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new Texture(document.createElement('img'));
      onLoad?.(texture);
      return texture;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('tells points inside its spawn area from those outside', () => {
    const fog = new Fog();
    const square = [new Vector2(0, 0), new Vector2(10, 0), new Vector2(10, 10), new Vector2(0, 10), new Vector2(0, 0)];
    expect(fog.ray_casting(new Vector2(5, 5), square)).toBe(true);
    expect(fog.ray_casting(new Vector2(15, 5), square)).toBe(false);
  });

  it('spawns puffs only inside the area, trying again for points outside it', () => {
    const fog = new Fog();
    // First the bottom right corner, outside the polygon, then a point low on the left, inside it
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0.15).mockReturnValueOnce(0.15);
    const spawn = fog.getNewSpawnVector();
    expect(fog.ray_casting(new Vector2(spawn.x, spawn.y), fog.points2D)).toBe(true);
    expect(spawn.z).toBe(fog.Z);
  });

  it('adds the puffs a batch per frame until all are there', () => {
    const fog = new Fog();
    fog.onBeforeRender(0);
    expect(fog.smokeData.length).toBe(fog.BATCH_SIZE);
    for (let i = 0; i < 30; i++) fog.onBeforeRender(0);
    expect(fog.smokeData.length).toBe(fog.NUM_INSTANCES);
    expect(fog.object.children.length).toBe(fog.NUM_INSTANCES);
  });

  it('fades each puff in as it rises to the middle, out towards the top, then starts it again', () => {
    const fog = new Fog();
    fog.onBeforeRender(0);
    const puff = fog.smokeData[0];
    Object.assign(puff, { originalHeight: 0, maxHeight: 100, speed: 10 });

    puff.mesh.position.y = 25;
    fog.onBeforeRender(0);
    expect(puff.material.opacity).toBeCloseTo(0.5);

    puff.mesh.position.y = 75;
    fog.onBeforeRender(1);
    expect(puff.material.opacity).toBeCloseTo(0.5);
    expect(puff.mesh.position.y).toBe(85);

    puff.mesh.position.y = 95;
    fog.onBeforeRender(1);
    expect(puff.mesh.position.y).toBe(0);
  });

  it('starts the puffs partway up for reduced motion, where they never move', () => {
    // Every random number the same: each puff spawns at the same point inside the area
    vi.spyOn(Math, 'random').mockReturnValue(0.15);
    const still = new Fog(true);
    still.onBeforeRender(0);
    const puff = still.smokeData[0];
    expect(puff.mesh.position.y).toBeGreaterThan(puff.originalHeight);
  });
});
