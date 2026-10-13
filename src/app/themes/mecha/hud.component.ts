import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';

const BATTERY_MS = 5 * 60 * 1000;
const VOTE_MS = 3500;
const CORES = ['CORE·1', 'CORE·2', 'CORE·3'];
const WAVES = [
  { color: '#3dff6e', speed: 1.0, freq: 0.045, amp: 0.3 },
  { color: '#ff7a00', speed: 1.6, freq: 0.07, amp: 0.22 },
  { color: '#e3001b', speed: 0.7, freq: 0.03, amp: 0.35 },
];

/**
 * The command centre readouts: the internal battery counting down to its activity limit, sync
 * ratio waveforms, and three computers voting on a resolution.
 */
@Component({
  selector: 'app-hud',
  templateUrl: './hud.component.html',
  styleUrls: ['./hud.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudComponent implements AfterViewInit, OnDestroy {
  protected readonly cores = CORES;
  readonly votes = signal<boolean[]>([true, true, false]);
  protected readonly sync = signal('41.3');

  private readonly timer = viewChild.required<ElementRef<HTMLElement>>('timer');
  private readonly graph = viewChild.required<ElementRef<HTMLCanvasElement>>('graph');
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly start = performance.now();
  private frameId?: number;
  private voteInterval?: number;
  private lastSync = 0;

  ngAfterViewInit() {
    this.voteInterval = window.setInterval(() => {
      if (!this.reducedMotion.matches) this.votes.set(CORES.map(() => Math.random() < 0.6));
    }, VOTE_MS);
    this.frame(this.start);
  }

  ngOnDestroy() {
    window.clearInterval(this.voteInterval);
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
  }

  protected approved() {
    return this.votes().filter(Boolean).length >= 2;
  }

  // The timer and graph change every frame, so they're drawn straight into the DOM rather than
  // through change detection
  private frame = (now: number) => {
    const still = this.reducedMotion.matches;
    const elapsed = still ? 0 : now - this.start;
    this.drawTimer(BATTERY_MS - (elapsed % BATTERY_MS));
    this.drawGraph(still ? 0 : elapsed / 1000);
    if (!still && now - this.lastSync > 200) {
      this.lastSync = now;
      this.sync.set((41 + Math.sin(now / 900) * 2.5 + Math.random() * 0.6).toFixed(1));
    }
    this.frameId = requestAnimationFrame(this.frame);
  };

  private drawTimer(ms: number) {
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    const el = this.timer().nativeElement;
    el.textContent = `${pad(ms / 60000)}:${pad((ms / 1000) % 60)}:${pad((ms / 10) % 100)}`;
    // The last minute goes red
    el.classList.toggle('low', ms < 60000);
  }

  private drawGraph(t: number) {
    const canvas = this.graph().nativeElement;
    const ratio = Math.min(window.devicePixelRatio, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgb(61 255 110 / 18%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += 20) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (const wave of WAVES) {
      ctx.strokeStyle = wave.color;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const phase = x * wave.freq - t * wave.speed * 3;
        const y = h / 2 + h * wave.amp * (Math.sin(phase) * 0.7 + Math.sin(phase * 2.7 + 1.3) * 0.3);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
