import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { Gestures } from '../gestures';
import { ShaderCanvas } from '../shader-canvas';
import { SelectHintComponent } from './select-hint.component';
import { XBOX_SHADER } from './xbox-backdrop';

const INTRO_MS = 1600;
// The orb never grows past this fraction of the screen height
const MAX_RADIUS = 0.24;
// Width the orb and its petals take up, in orb diameters
const PETAL_SPAN = 1.6;
// Spun round by hand, the shells slow down by this much per second, and never go faster than
// MAX_SPIN radians a second. A tap gives them a nudge too.
const SPIN_FRICTION = 0.8;
const MAX_SPIN = 14;
const TAP_SPIN = 2.5;

/** The original Xbox dashboard's main menu: the glowing orb, and pods wired to bars. */
@Component({
  selector: 'app-xbox-theme',
  templateUrl: './xbox-theme.component.html',
  styleUrls: ['./xbox-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectHintComponent],
})
export class XboxThemeComponent implements AfterViewInit, OnDestroy {
  protected readonly name = NAME;
  protected readonly links = LINKS;
  // How far each item bows out to follow the orb: the middle two most
  protected readonly arc = [0, 1, 1, 0];
  private readonly dashboard = viewChild.required<ElementRef<HTMLElement>>('dashboard');
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private readonly hints = viewChild.required('hints', { read: ElementRef<HTMLElement> });
  /** Where the orb goes. The shader draws it here; without WebGL, CSS does. */
  private readonly orbSlot = viewChild.required<ElementRef<HTMLElement>>('orb');
  private shader?: ShaderCanvas;
  // In the shader's units: screen heights, from the bottom left
  private orb = { x: 0, y: 0, radius: 0 };
  private gestures?: Gestures;
  private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)');
  // The shells' turn and speed, in radians; when the orb was last tapped; the last frame and drag
  private spin = 0;
  private spinSpeed = 0;
  private dragging = false;
  private tappedAt = -Infinity;
  private lastFrame?: number;
  private lastDrag = 0;

  ngAfterViewInit() {
    this.layout();
    window.addEventListener('resize', this.layout);
    // The console starts with the first item selected. Only with a mouse: on a phone, focus would
    // show for no reason, as nothing there is selected until it's tapped.
    if (window.matchMedia('(pointer: fine)').matches) {
      this.menu().nativeElement.querySelector('a')?.focus({ preventScroll: true });
    }
    // The name's height changes when its web font arrives
    document.fonts?.ready.then(this.layout);

    const start = performance.now();
    const still = this.still.matches;
    this.shader = new ShaderCanvas(this.backdrop().nativeElement, XBOX_SHADER, () => ({
      u_orb: [this.orb.x, this.orb.y],
      u_radius: this.orb.radius,
      u_intro: still ? 1 : Math.min((performance.now() - start) / INTRO_MS, 1),
      ...this.play(),
    }), 12);
    if (!this.shader.running) {
      this.orbSlot().nativeElement.classList.add('fallback');
      return;
    }
    // The shader's orb can be spun round and tapped (the page mustn't scroll instead)
    Object.assign(this.orbSlot().nativeElement.style, { touchAction: 'none', cursor: 'grab' });
    this.gestures = new Gestures(this.orbSlot().nativeElement, {
      press: () => {
        this.dragging = true;
        this.spinSpeed = 0;
      },
      drag: this.turn,
      tap: () => {
        if (this.still.matches) return;
        this.tappedAt = performance.now();
        this.spinSpeed += TAP_SPIN;
      },
      release: () => {
        this.dragging = false;
        // Held still before letting go, or with reduced motion: no flick
        if (this.still.matches || performance.now() - this.lastDrag > 100) this.spinSpeed = 0;
      },
    });
  }

  /** Dragging round the orb turns its shells with the pointer, like a dial. */
  private turn = (dx: number, dy: number, event: PointerEvent) => {
    const box = this.orbSlot().nativeElement.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    // Angles with y up, as in the shader
    const before = Math.atan2(cy - event.clientY + dy, event.clientX - dx - cx);
    const after = Math.atan2(cy - event.clientY, event.clientX - cx);
    // The short way round, across the jump from pi to -pi
    const turn = (after - before + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.spin += turn;
    const seconds = Math.max(event.timeStamp - this.lastDrag, 1) / 1000;
    this.spinSpeed = Math.min(Math.max(0.6 * this.spinSpeed + 0.4 * turn / seconds, -MAX_SPIN), MAX_SPIN);
    this.lastDrag = event.timeStamp;
  };

  /** Moves the spin on a frame, and tells the shader where the play is at. */
  private play() {
    const now = performance.now();
    const dt = Math.min((now - (this.lastFrame ?? now)) / 1000, 0.1);
    this.lastFrame = now;
    if (!this.dragging) {
      this.spin += this.spinSpeed * dt;
      this.spinSpeed *= Math.exp(-SPIN_FRICTION * dt);
    }
    return {
      u_spin: this.spin,
      u_energy: Math.min(Math.abs(this.spinSpeed) / MAX_SPIN, 1),
      u_pulse: Math.min((now - this.tappedAt) / 1000, 100),
    };
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.layout);
    this.shader?.dispose();
    this.gestures?.dispose();
  }

  /**
   * Fits the orb in the space the text leaves: below the name, above the button hints and left of
   * the menu, or between the name and the menu on portrait screens.
   */
  readonly layout = () => {
    const host = this.dashboard().nativeElement;
    const width = host.clientWidth, height = host.clientHeight;
    if (!height) return;
    // offsetTop rather than the bounding box, which the swoop-in animations move
    const heading = this.heading().nativeElement;
    const top = heading.offsetTop + heading.offsetHeight;
    const menu = this.menu().nativeElement.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const portrait = width < height;
    const right = portrait ? width : menu.left - hostBox.left;
    const bottom = portrait ? menu.top - hostBox.top : this.hints().nativeElement.offsetTop;
    // The petals reach out to about 1.6 radii either side, so the width needs that much room
    const radius = Math.max(0, Math.min(right / PETAL_SPAN, bottom - top, height * MAX_RADIUS * 2) / 2 * 0.85);
    const cx = right / 2, cy = (top + bottom) / 2;

    this.orb = { x: cx / height, y: (height - cy) / height, radius: radius / height };
    Object.assign(this.orbSlot().nativeElement.style, {
      left: `${cx - radius}px`,
      top: `${cy - radius}px`,
      width: `${radius * 2}px`,
      height: `${radius * 2}px`,
    });
  };

  /**
   * The pointer takes the keyboard focus with it, which is what lights an item: so the item under
   * the pointer and the one Enter opens are always the same.
   */
  protected hover(event: MouseEvent) {
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  }

  /** Up and down move between the buttons, like the controller's d-pad. */
  protected onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll('a'));
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === 'ArrowUp' ? -1 : 1;
    items[(current + step + items.length) % items.length]?.focus();
    event.preventDefault();
  }
}
