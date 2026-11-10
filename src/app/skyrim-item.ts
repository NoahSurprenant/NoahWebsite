import { computed, Injectable, signal } from '@angular/core';

/** What the Skyrim theme says about an item: the caption and who made the model. */
export interface ItemText {
  caption: string;
  attribution: Attribution;
}

/** The strip of the screen between the name and links and the caption, as fractions of its height from the top. */
export interface ClearBand {
  top: number;
  bottom: number;
}

export interface Attribution {
  short: string;
  long: string;
  url?: string;
}

/**
 * The items' words, in the order of the models in SkyrimLoadingComponent. Kept apart from the 3D
 * scene (and three.js) so the caption paints with the page instead of waiting for the scene's chunk.
 */
export const ITEM_TEXTS: readonly ItemText[] = [
  {
    caption: 'Dingus does not fight, guard or fetch. Dingus spins. Scholars have yet to learn why.',
    attribution: { short: 'dingus the cat by bean(alwayshasbean)', long: '"dingus the cat" by bean(alwayshasbean) is licensed under Creative Commons Attribution', url: 'https://skfb.ly/oAtMJ' },
  },
  {
    caption: 'Small enough to lose in a pocket, yet it runs whatever you ask of it. Many a homelab began with one.',
    attribution: { short: 'Raspberry Pi 3 by JoSaCo', long: '"Raspberry Pi 3" by JoSaCo is licensed under Creative Commons Attribution', url: 'https://skfb.ly/OBDI' },
  },
  {
    caption: 'A cart carries more than any pack mule, so long as its wheels agree on which way to go.',
    attribution: { short: 'Shopping cart model by Jiří Kuba', long: '"Shopping cart model" by Jiří Kuba is licensed under Creative Commons Attribution', url: 'https://skfb.ly/6vw6D' },
  },
  {
    caption: "Club Penguin's players gathered each day to tip the Iceberg, certain it would turn. It never did.",
    attribution: { short: 'Club Penguin recreation by LukeTheLPSWolf', long: '"Club Penguin recreation" by LukeTheLPSWolf is licensed under Creative Commons Attribution', url: 'https://skfb.ly/oB86E' },
  },
  {
    caption: 'The gravity hammer decides every Grifball match. One swing sends the bomb carrier flying, and settles most arguments.',
    attribution: { short: 'Halo Gravity Hammer by Glitch5970', long: '"Halo Gravity Hammer" by Glitch5970 is licensed under Creative Commons Attribution', url: 'https://skfb.ly/6RHzz' },
  },
  {
    caption: "Ken Perlin's noise gives smooth, natural randomness, the hills and clouds of a thousand worlds, without a seam in sight.",
    attribution: { short: 'pnoise by Stefan Gustavson', long: 'Original Perlin noise code by Stefan Gustavson are licensed under the MIT license', url: 'https://github.com/stegu/webgl-noise' },
  },
];

const randomIndex = (except?: number) => {
  while (true) {
    const index = Math.floor(Math.random() * ITEM_TEXTS.length);
    if (index !== except) return index;
  }
};

/** Which item the Skyrim theme is showing: picked at random, and changed by next(). */
@Injectable({ providedIn: 'root' })
export class SkyrimItem {
  readonly index = signal(randomIndex());
  readonly text = computed(() => ITEM_TEXTS[this.index()]);

  /** Moves on to another item, never the same one again. */
  next() {
    this.index.set(randomIndex(this.index()));
  }
}
