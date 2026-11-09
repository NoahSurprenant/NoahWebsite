import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Cat } from './cat';

interface Key {
  code: string;
  label: string;
  /** Width in key units */
  wide?: number;
}

const row = (codes: string, labels: string): Key[] =>
  codes.split(' ').map((code, i) => ({ code, label: labels.split(' ')[i] }));

const ROWS: Key[][] = [
  [...row('Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal', '` 1 2 3 4 5 6 7 8 9 0 - ='), { code: 'Backspace', label: '⌫', wide: 1.5 }],
  [{ code: 'Tab', label: 'tab', wide: 1.5 }, ...row('KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Backslash', 'q w e r t y u i o p [ ] \\')],
  [{ code: 'Escape', label: 'esc', wide: 1.75 }, ...row('KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote', 'a s d f g h j k l ; \''), { code: 'Enter', label: '⏎', wide: 1.75 }],
  [{ code: 'ShiftLeft', label: 'shift', wide: 2.25 }, ...row('KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash', 'z x c v b n m , . /'), { code: 'ShiftRight', label: 'shift', wide: 2.25 }],
  [{ code: 'Space', label: '', wide: 6 }],
];

/** Where each key's middle is, in key units from the left, for the cat to walk to. */
const CENTERS = new Map<string, number>();
for (const keys of ROWS) {
  let x = 0;
  for (const key of keys) {
    const wide = key.wide ?? 1;
    CENTERS.set(key.code, x + wide / 2);
    x += wide;
  }
}
// The space bar is centred under the others
CENTERS.set('Space', 7.25);
const WIDTH = 15;
/** How long a key stays lit */
const LIT_MS = 160;

/** A faint keyboard under the terminal that lights up as you type, with the cat walking on it. */
@Component({
  selector: 'app-keyboard',
  template: `
    @for (keys of rows; track $index) {
      <div class="row">
        @for (key of keys; track key.code) {
          <span class="key" [class.lit]="lit().has(key.code)" [style.flex-grow]="key.wide ?? 1">{{ key.label }}</span>
        }
      </div>
    }
    @if (cat.mood() !== 'away') {
      <span class="cat" [class.left]="cat.facingLeft()" [class]="cat.mood()" [style.left.%]="catLeft()">{{ cat.face() }}</span>
    }
  `,
  styleUrl: './keyboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '(document:keydown)': 'press($event)' },
})
export class KeyboardComponent {
  protected readonly rows = ROWS;
  protected readonly cat = inject(Cat);
  protected readonly lit = signal<ReadonlySet<string>>(new Set());
  protected readonly catLeft = computed(() => (CENTERS.get(this.cat.key())! / WIDTH) * 100);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  protected press(event: KeyboardEvent) {
    if (!CENTERS.has(event.code)) return;
    this.lit.update(lit => new Set(lit).add(event.code));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.lit.update(lit => {
        const next = new Set(lit);
        next.delete(event.code);
        return next;
      });
    }, LIT_MS);
    this.timers.add(timer);
    this.cat.press(event.code, (a, b) => CENTERS.get(a)! < CENTERS.get(b)!);
  }
}
