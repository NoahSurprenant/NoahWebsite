import { Component, input } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { ClearBand } from '../../skyrim-item';
import { SkyrimLoadingComponent } from '../../skyrim-loading/skyrim-loading.component';
import { manualFrames } from '../../testing/canvas';
import { SkyrimThemeComponent } from './skyrim-theme.component';

// The real scene needs WebGL, which the test DOM doesn't have
@Component({ selector: 'app-skyrim-loading', template: '' })
class SkyrimLoadingStubComponent {
  readonly band = input<ClearBand>();
}

describe('SkyrimThemeComponent', () => {
  let frames: ReturnType<typeof manualFrames>;

  beforeEach(() => {
    frames = manualFrames();
    TestBed.overrideComponent(SkyrimThemeComponent, {
      remove: { imports: [SkyrimLoadingComponent] },
      add: { imports: [SkyrimLoadingStubComponent] },
    });
    // Drive the scene's @defer block by hand
    TestBed.configureTestingModule({ deferBlockBehavior: DeferBlockBehavior.Manual });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The theme with its scene showing, and its parts laid out at the given heights. */
  async function create() {
    const fixture = TestBed.createComponent(SkyrimThemeComponent);
    await fixture.whenStable();
    const [deferBlock] = await fixture.getDeferBlocks();
    await deferBlock.render(DeferBlockState.Complete);
    const el = fixture.nativeElement as HTMLElement;
    const layout = (host: { top: number; height: number }, listBottom: number, captionTop: number) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: host.top, height: host.height } as DOMRect);
      vi.spyOn(el.querySelector('.list')!, 'getBoundingClientRect').mockReturnValue({ bottom: listBottom } as DOMRect);
      vi.spyOn(el.querySelector('.caption')!, 'getBoundingClientRect').mockReturnValue({ top: captionTop } as DOMRect);
      frames.resize();
      fixture.detectChanges();
    };
    const band = () => fixture.debugElement.query(debug => debug.componentInstance instanceof SkyrimLoadingStubComponent)
      .componentInstance.band() as ClearBand;
    return { fixture, layout, band };
  }

  it('tells the scene where the item has room, between the links and the caption', async () => {
    const { layout, band } = await create();
    layout({ top: 100, height: 1000 }, 188, 712);
    expect(band().top).toBeCloseTo(0.1);
    expect(band().bottom).toBeCloseTo(0.6);
  });

  it('keeps the last band while the theme has no height', async () => {
    const { layout, band } = await create();
    layout({ top: 0, height: 1000 }, 88, 612);
    layout({ top: 0, height: 0 }, 0, 0);
    expect(band().top).toBeCloseTo(0.1);
  });

  it('stops measuring once destroyed', async () => {
    const { fixture } = await create();
    const measure = vi.spyOn(fixture.nativeElement as HTMLElement, 'getBoundingClientRect');
    fixture.destroy();
    frames.resize();
    expect(measure).not.toHaveBeenCalled();
  });
});
