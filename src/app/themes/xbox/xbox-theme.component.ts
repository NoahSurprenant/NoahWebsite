import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { LINKS, NAME } from '../../links';
import { ShaderCanvas } from '../shader-canvas';
import { XBOX_SHADER } from './xbox-backdrop';

const INTRO_MS = 1600;

/** The original Xbox dashboard's main menu: the glowing green orb and a column of gel buttons. */
@Component({
  selector: 'app-xbox-theme',
  templateUrl: './xbox-theme.component.html',
  styleUrls: ['./xbox-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XboxThemeComponent implements AfterViewInit, OnDestroy {
  protected readonly name = NAME;
  protected readonly links = LINKS;
  private readonly backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private shader?: ShaderCanvas;

  ngAfterViewInit() {
    const host = this.backdrop().nativeElement;
    const start = performance.now();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shader = new ShaderCanvas(host, XBOX_SHADER, () => {
      const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
      const portrait = aspect < 1;
      return {
        // Where the CSS leaves room: left of the menu, or above it on portrait screens
        u_orb: portrait ? [aspect * 0.5, 0.7] : [aspect * 0.3, 0.55],
        u_radius: portrait ? Math.min(aspect * 0.32, 0.14) : Math.min(0.24, aspect * 0.15),
        u_intro: still ? 1 : Math.min((performance.now() - start) / INTRO_MS, 1),
      };
    }, 12);
  }

  ngOnDestroy() {
    this.shader?.dispose();
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
