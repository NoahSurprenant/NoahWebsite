import { Component } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { SkyrimLoadingComponent } from './skyrim-loading/skyrim-loading.component';

// The real scene needs WebGL, which the test DOM doesn't have
@Component({ selector: 'app-skyrim-loading', template: '<p class="stub-scene"></p>' })
class SkyrimLoadingStubComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AppComponent, {
      remove: { imports: [SkyrimLoadingComponent] },
      add: { imports: [SkyrimLoadingStubComponent] },
    });
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      // Drive the scene's @defer block by hand so tests can see both states
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'Noah Surprenant'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Noah Surprenant');
  });

  it('should render name and links before the scene loads', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.name')?.textContent).toContain('Noah Surprenant');
    expect(compiled.querySelectorAll('.list a').length).toBe(4);
    expect(compiled.querySelector('.scene-placeholder')).toBeTruthy();
    expect(compiled.querySelector('app-skyrim-loading')).toBeNull();
  });

  it('should swap the placeholder for the scene once the deferred block loads', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const [deferBlock] = await fixture.getDeferBlocks();
    await deferBlock.render(DeferBlockState.Complete);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.scene-placeholder')).toBeNull();
    // The stub, not the WebGL component, was rendered
    expect(compiled.querySelector('app-skyrim-loading .stub-scene')).toBeTruthy();
  });

  it('should give every icon link an accessible name', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.list a'));
    expect(links.map(a => a.getAttribute('aria-label'))).toEqual([
      'LinkedIn',
      'GitHub',
      'Email',
      'Resume (PDF)',
    ]);
    for (const a of links) {
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
