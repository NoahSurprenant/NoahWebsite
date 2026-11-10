import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { LINKS, NAME } from '../../links';
import { ClearBand, SkyrimItem } from '../../skyrim-item';
import { SkyrimLoadingComponent } from '../../skyrim-loading/skyrim-loading.component';

// Space kept between the item and the links above it or the caption below, in pixels
const GAP = 12;

@Component({
  selector: 'app-skyrim-theme',
  templateUrl: './skyrim-theme.component.html',
  styleUrls: ['./skyrim-theme.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkyrimLoadingComponent, FaIconComponent],
})
export class SkyrimThemeComponent {
  protected readonly name = NAME;
  protected readonly links = LINKS;
  protected readonly item = inject(SkyrimItem);
  // Where the scene has room for the item, between the links and the caption
  protected readonly band = signal<ClearBand>({ top: 0.12, bottom: 0.7 });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly caption = viewChild.required<ElementRef<HTMLElement>>('caption');

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Each caption is a different length, and the layout changes with the screen
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.measure());
      [this.host, this.list().nativeElement, this.caption().nativeElement].forEach(el => observer.observe(el));
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measure() {
    const host = this.host.getBoundingClientRect();
    if (host.height === 0) return;
    const top = this.list().nativeElement.getBoundingClientRect().bottom + GAP - host.top;
    const bottom = this.caption().nativeElement.getBoundingClientRect().top - GAP - host.top;
    this.band.set({ top: top / host.height, bottom: bottom / host.height });
  }
}
