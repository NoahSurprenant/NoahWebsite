import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { ShaderCanvas } from '../shader-canvas';
import { SelectHintComponent } from './select-hint.component';
import { XBOX_SHADER } from './xbox-backdrop';

const INTRO_MS = 1600;
// The orb never grows past this fraction of the screen height
const MAX_RADIUS = 0.24;
// Width the orb and its petals take up, in orb diameters
const PETAL_SPAN = 1.6;

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

  ngAfterViewInit() {
    this.layout();
    window.addEventListener('resize', this.layout);
    // The name's height changes when its web font arrives
    document.fonts?.ready.then(this.layout);

    const start = performance.now();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shader = new ShaderCanvas(this.backdrop().nativeElement, XBOX_SHADER, () => ({
      u_orb: [this.orb.x, this.orb.y],
      u_radius: this.orb.radius,
      u_intro: still ? 1 : Math.min((performance.now() - start) / INTRO_MS, 1),
    }), 12);
    if (!this.shader.running) this.orbSlot().nativeElement.classList.add('fallback');
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.layout);
    this.shader?.dispose();
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
