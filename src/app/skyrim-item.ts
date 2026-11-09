import { computed, Injectable, signal } from '@angular/core';

/** What the Skyrim theme says about an item: the caption and who made the model. */
export interface ItemText {
  caption: string;
  attribution: Attribution;
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
    caption: 'You have acquired a feline companion, a creature of mystery and power. Its spinning abilities shall prove to be formidable ally in battle and a constant source of amusement.',
    attribution: { short: 'dingus the cat by bean(alwayshasbean)', long: '"dingus the cat" by bean(alwayshasbean) is licensed under Creative Commons Attribution', url: 'https://skfb.ly/oAtMJ' },
  },
  {
    caption: 'The Raspberry Pi, a small yet powerful device, can be a valuable tool in your journey. With its capability to run various programs and control machinery, it may come in handy on your endeavors.',
    attribution: { short: 'Raspberry Pi 3 by JoSaCo', long: '"Raspberry Pi 3" by JoSaCo is licensed under Creative Commons Attribution', url: 'https://skfb.ly/OBDI' },
  },
  {
    caption: 'Carts be a mighty useful tool for any traveler, but be warned, not all carts be in good condition. Ye may come across some with a broken wheel or two, and that can make them quite difficult to maneuver.',
    attribution: { short: 'Shopping cart model by Jiří Kuba', long: '"Shopping cart model" by Jiří Kuba is licensed under Creative Commons Attribution', url: 'https://skfb.ly/6vw6D' },
  },
  {
    caption: "'Tis the ancient ritual of Tipping the Iceberg! With a mighty leap, we strike the Iceberg with all our might, causing it to shift and reveal the bounties hidden within.",
    attribution: { short: 'Club Penguin recreation by LukeTheLPSWolf', long: '"Club Penguin recreation" by LukeTheLPSWolf is licensed under Creative Commons Attribution', url: 'https://skfb.ly/oB86E' },
  },
  {
    caption: "'Tis the gravity hammer, a weapon of great power and destruction. In the game of Grifball, it is a weapon of great importance. With a swing of this mighty hammer, a warrior can send their foes flying.",
    attribution: { short: 'Halo Gravity Hammer by Glitch5970', long: '"Halo Gravity Hammer" by Glitch5970 is licensed under Creative Commons Attribution', url: 'https://skfb.ly/6RHzz' },
  },
  {
    caption: 'Perlin Noise is a craft of subtle beauty, a technique that weaves smooth, flowing patterns. Created by Ken Perlin, it shapes textures and terrains with natural grace, free of harsh marks.',
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
