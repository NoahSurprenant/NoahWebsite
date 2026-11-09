import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export type CatMood = 'napping' | 'watching' | 'chasing' | 'purring' | 'away';

const STORAGE_KEY = 'terminal-cat';
/** How long the cat watches with nothing typed before it dozes off */
const DOZE_MS = 15000;
/** How long it takes to cross the keyboard to a key */
const POUNCE_MS = 600;
const PURR_MS = 3000;

const FACES: Record<CatMood, string> = {
  napping: '(=-.-=) zZ',
  watching: '(=o.o=)',
  chasing: '(=^.^=)',
  purring: '(=^.^=) prr',
  away: '',
};

/**
 * The cat that lives on the on-screen keyboard. It naps until something is typed, then chases the
 * keys. `pet off` sends it away, remembered for next time.
 */
@Injectable()
export class Cat {
  readonly mood = signal<CatMood>(this.readStored() === 'off' ? 'away' : 'napping');
  /** The code (KeyboardEvent.code) of the key it's sitting on */
  readonly key = signal('KeyG');
  /** Which way it last walked */
  readonly facingLeft = signal(false);
  readonly face = computed(() => FACES[this.mood()]);

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** A key went down somewhere: wake up and go after it. */
  press(code: string, leftOf: (a: string, b: string) => boolean) {
    if (this.mood() === 'away' || this.mood() === 'purring') return;
    if (code !== this.key()) this.facingLeft.set(leftOf(code, this.key()));
    this.key.set(code);
    this.mood.set('chasing');
    this.later(POUNCE_MS, () => this.watch());
  }

  /** `pet`, `pet on`, `pet off`. Returns what the terminal prints. */
  pet(arg?: string): string {
    if (arg === 'off') {
      this.mood.set('away');
      this.store('off');
      return 'The cat wanders off.';
    }
    if (this.mood() === 'away') {
      this.mood.set('napping');
      this.store('on');
      return 'The cat is back, asleep on the keyboard.';
    }
    if (arg === 'on') return 'The cat is already here.';
    this.mood.set('purring');
    this.later(PURR_MS, () => this.watch());
    return 'prrrrr';
  }

  /** Watches for a while, then dozes off. */
  private watch() {
    this.mood.set('watching');
    this.later(DOZE_MS, () => this.mood.set('napping'));
  }

  private later(ms: number, then: () => void) {
    clearTimeout(this.timer);
    this.timer = setTimeout(then, ms);
  }

  private readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private store(value: string) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage is off; the cat just doesn't remember
    }
  }
}
