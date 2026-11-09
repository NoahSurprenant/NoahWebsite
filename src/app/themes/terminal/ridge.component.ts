import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Day, total, weeks } from './github';

const FG = '#3dff6e';
const BG = '#0a0f0a';
const DIM = '#1f9c43';
/** How long the weeks take to rise, back to front */
const RISE_MS = 1100;
const DAYS = 7;
/** Flat ground either side of the week, so the end days' hills have room to come down */
const MARGIN = 0.6;
const SPAN = DAYS + 2 * MARGIN;
const SAMPLES = 84;
/** Width of a day's hill, in days */
const SPREAD = 0.32;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A year of contributions as a landscape: one ridge per week, oldest at the back, each day a hill
 * as tall as its count. Hovering (or the arrow keys) picks out a week.
 */
@Component({
  selector: 'app-ridge',
  template: `
    <canvas #canvas tabindex="0" role="img" [attr.aria-label]="label()"
      (pointermove)="hover($event)" (pointerleave)="pick(null)" (keydown)="step($event)"></canvas>
    <p class="caption" aria-live="polite">{{ caption() }}</p>
  `,
  styles: `
    :host { display: block; max-width: 720px; margin: 0.5em 0; }
    canvas { display: block; width: 100%; aspect-ratio: 4 / 3; outline: none; cursor: crosshair; }
    canvas:focus-visible { box-shadow: 0 0 0 1px var(--dim, #1f9c43); }
    .caption { margin: 0.25em 0 0; color: var(--dim, #1f9c43); min-height: 1.45em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RidgeComponent {
  readonly days = input.required<readonly Day[]>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly weeks = computed(() => weeks(this.days()));
  /** The week picked out, counted from the oldest */
  protected readonly picked = signal<number | null>(null);
  /** 0 → 1 while the ridges rise */
  private progress = 1;

  protected readonly label = computed(() =>
    `${total(this.days()).toLocaleString('en-US')} contributions over ${this.weeks().length} weeks, one ridge per week`);

  protected readonly caption = computed(() => {
    const index = this.picked();
    if (index === null) return '';
    const week = this.weeks()[index];
    const count = total(week);
    return `Week of ${week[0].date}: ${count} ${count === 1 ? 'contribution' : 'contributions'}`;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const observer = new ResizeObserver(() => this.draw());
      observer.observe(canvas);
      let frame = 0;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.progress = 0;
        let start: number | undefined;
        const tick = (time: number) => {
          start ??= time;
          this.progress = Math.min(1, (time - start) / RISE_MS);
          this.draw();
          if (this.progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      }
      this.draw();
      destroyRef.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    });
  }

  protected hover(event: PointerEvent) {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    const { top, gap } = this.layout(rect.width, rect.height);
    const row = Math.round((event.clientY - rect.top - top) / gap);
    this.pick(Math.max(0, Math.min(this.weeks().length - 1, row)));
  }

  protected step(event: KeyboardEvent) {
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    event.preventDefault();
    const last = this.weeks().length - 1;
    const current = this.picked() ?? last;
    this.pick(Math.max(0, Math.min(last, current + delta)));
  }

  pick(index: number | null) {
    this.picked.set(index);
    this.draw();
  }

  /** Where the ridges sit: the first baseline, the gap between them, and the tallest hill. */
  private layout(width: number, height: number) {
    const rows = this.weeks().length;
    const peak = height * 0.3;
    const top = peak + 8;
    const bottom = height - 22;
    return { top, gap: (bottom - top) / Math.max(1, rows - 1), peak, left: 34, right: width - 8 };
  }

  private draw() {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 400;
    const scale = window.devicePixelRatio;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);

    const all = this.weeks();
    const max = Math.max(1, ...this.days().map(d => d.count));
    const { top, gap, peak, left, right } = this.layout(width, height);
    const shown = Math.ceil(this.progress * all.length);
    context.font = '11px ui-monospace, monospace';
    context.textBaseline = 'middle';

    all.forEach((week, row) => {
      if (row >= shown) return;
      const base = top + row * gap;
      // Each week rises from flat, the back ones first
      const rise = Math.min(1, this.progress * all.length - row);
      const counts = new Array<number>(DAYS).fill(0);
      for (const day of week) counts[new Date(`${day.date}T00:00:00Z`).getUTCDay()] = day.count;

      // Filled down to the baseline to hide the ridges behind, but only the top is drawn
      const ridge = new Path2D();
      for (let s = 0; s <= SAMPLES; s++) {
        const t = (s / SAMPLES) * SPAN - MARGIN;
        ridge.lineTo(left + (s / SAMPLES) * (right - left), base - ridgeHeight(counts, max, t, row) * peak * rise);
      }
      const area = new Path2D(ridge);
      area.lineTo(right, base + 1);
      area.lineTo(left, base + 1);
      area.closePath();
      context.fillStyle = BG;
      context.fill(area);
      const picked = this.picked() === row;
      context.strokeStyle = picked ? '#c8ffd6' : FG;
      context.globalAlpha = picked ? 1 : 0.35 + 0.65 * (row / Math.max(1, all.length - 1));
      context.lineWidth = picked ? 2 : 1;
      context.stroke(ridge);
      context.globalAlpha = 1;

      // The month down the left side, at its first week
      const month = week[0].date.slice(0, 7);
      if (row === 0 || month !== all[row - 1][0].date.slice(0, 7)) {
        context.fillStyle = DIM;
        context.fillText(new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), 0, base);
      }
    });

    context.fillStyle = DIM;
    WEEKDAYS.forEach((letter, day) => context.fillText(letter, left + ((day + 0.5 + MARGIN) / SPAN) * (right - left) - 3, height - 8));
  }
}

/** How high the ridge is at `t` days into the week: a hill per day, scaled so the busiest day is 1. */
function ridgeHeight(counts: readonly number[], max: number, t: number, row: number) {
  let sum = 0;
  counts.forEach((count, day) => {
    if (!count) return;
    const d = t - (day + 0.5);
    // Log scale, so an ordinary day still makes a hill next to the busiest one
    sum += (Math.log1p(count) / Math.log1p(max)) * Math.exp(-(d * d) / (2 * SPREAD * SPREAD));
  });
  // Down to the baseline at both ends, with a little texture so quiet weeks aren't ruler-straight
  const edge = Math.sin((Math.PI * (t + MARGIN)) / SPAN);
  const taper = Math.min(1, Math.min(t + MARGIN, DAYS + MARGIN - t) / MARGIN);
  const grain = 0.018 * (1 + Math.sin(t * 9.1 + row * 1.7) * Math.sin(t * 3.7 + row * 0.6)) * edge;
  return Math.min(1.15, sum) * taper * taper * (3 - 2 * taper) + grain;
}
