// A press that moves less than this, in CSS pixels, and lets go within TAP_MS is a tap, not a drag
const TAP_SLOP = 8;
const TAP_MS = 400;

export interface GestureHandlers {
  /** One pointer moved by dx, dy CSS pixels while pressed. */
  drag?(dx: number, dy: number, event: PointerEvent): void;
  /** Two pointers moved apart (scale above 1) or together (below 1) since the last call. */
  pinch?(scale: number): void;
  /** A quick press and release in one spot, reported after the release. */
  tap?(event: PointerEvent): void;
  /** The first pointer went down. */
  press?(): void;
  /** The last pointer came up. */
  release?(): void;
}

/**
 * Mouse, pen and touch input on one element, as drags, two-finger pinches and taps. The element
 * keeps the pointers it gets until they come up, so a drag can leave it, and it should have
 * `touch-action: none` so the browser doesn't scroll or zoom the page instead.
 */
export class Gestures {
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private start?: { x: number; y: number; time: number };
  // Whether this press is a tap still: it hasn't moved far, and only ever had one pointer
  private tapping = false;

  constructor(private readonly element: HTMLElement, private readonly handlers: GestureHandlers) {
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    element.addEventListener('pointerup', this.up);
    element.addEventListener('pointercancel', this.cancel);
  }

  dispose() {
    this.element.removeEventListener('pointerdown', this.down);
    this.element.removeEventListener('pointermove', this.move);
    this.element.removeEventListener('pointerup', this.up);
    this.element.removeEventListener('pointercancel', this.cancel);
  }

  private down = (event: PointerEvent) => {
    // Only the main mouse button
    if (event.button !== 0) return;
    this.element.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.start = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      this.tapping = true;
      this.handlers.press?.();
    } else {
      this.tapping = false;
    }
  };

  private move = (event: PointerEvent) => {
    const last = this.pointers.get(event.pointerId);
    if (!last) return;
    if (this.pointers.size === 1) {
      if (Math.hypot(event.clientX - this.start!.x, event.clientY - this.start!.y) > TAP_SLOP) this.tapping = false;
      this.handlers.drag?.(event.clientX - last.x, event.clientY - last.y, event);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      return;
    }
    const before = this.spread();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = this.spread();
    if (before > 0 && after > 0) this.handlers.pinch?.(after / before);
  };

  private up = (event: PointerEvent) => {
    if (!this.pointers.has(event.pointerId)) return;
    const tap = this.tapping && event.timeStamp - this.start!.time < TAP_MS;
    this.cancel(event);
    if (tap) this.handlers.tap?.(event);
  };

  private cancel = (event: PointerEvent) => {
    if (!this.pointers.delete(event.pointerId)) return;
    this.tapping = false;
    if (this.pointers.size === 0) this.handlers.release?.();
  };

  /** How far apart the first two pointers are. */
  private spread() {
    const [a, b] = this.pointers.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
