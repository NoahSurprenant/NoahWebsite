import { Component } from '@angular/core';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { AppComponent, isAprilFools } from './app.component';
import { SkyrimLoadingComponent } from './skyrim-loading/skyrim-loading.component';
import { REDUCED_MOTION, stubMatchMedia } from './testing/match-media';
import { ThemeService } from './themes/theme.service';
import { SkyrimThemeComponent } from './themes/skyrim/skyrim-theme.component';

// The real scene needs WebGL, which the test DOM doesn't have
@Component({ selector: 'app-skyrim-loading', template: '<p class="stub-scene"></p>' })
class SkyrimLoadingStubComponent {}

const LINK_NAMES = ['LinkedIn', 'GitHub', 'Email', 'Resume (PDF)'];

describe('AppComponent', () => {
  beforeEach(async () => {
    stubMatchMedia(REDUCED_MOTION);
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    TestBed.overrideComponent(SkyrimThemeComponent, {
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
    expect(links.map(a => a.getAttribute('aria-label'))).toEqual(LINK_NAMES);
    for (const a of links) {
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('should list every theme behind the cog, with the current one pressed', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.cog')?.getAttribute('aria-label')).toBe('Change theme');
    const buttons = Array.from(compiled.querySelectorAll<HTMLButtonElement>('#theme-menu button'));
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['Skyrim', 'Terminal', 'Xbox', 'Neon Genesis']);
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);

    buttons[2].click();
    await fixture.whenStable();
    expect(compiled.querySelector('app-xbox-theme')).toBeTruthy();
    expect(compiled.querySelector('app-skyrim-theme')).toBeNull();
    expect(window.location.search).toBe('?theme=xbox');
  });

  for (const theme of ['terminal', 'xbox', 'mecha'] as const) {
    it(`should show the name and every link in the ${theme} theme`, async () => {
      TestBed.inject(ThemeService).theme.set(theme);
      const fixture = TestBed.createComponent(AppComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector(`app-${theme}-theme`)).toBeTruthy();
      expect(compiled.textContent?.toUpperCase().replace(/\s+/g, ' ')).toContain('NOAH SURPRENANT');
      const links = Array.from(compiled.querySelectorAll(`app-${theme}-theme a`));
      expect(links.map(a => a.getAttribute('aria-label'))).toEqual(LINK_NAMES);
    });
  }
});

describe('AppComponent watermark', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** The app, as loaded on the given day. Only Date is faked, so whenStable() still works. */
  function loadOn(day: Date) {
    vi.useFakeTimers({ toFake: ['Date'], now: day });
    stubMatchMedia(REDUCED_MOTION);
    TestBed.overrideComponent(SkyrimThemeComponent, {
      remove: { imports: [SkyrimLoadingComponent] },
      add: { imports: [SkyrimLoadingStubComponent] },
    });
    return TestBed.createComponent(AppComponent);
  }

  it('knows April Fools\' Day', () => {
    expect(isAprilFools(new Date(2027, 3, 1, 0, 0))).toBe(true);
    expect(isAprilFools(new Date(2027, 3, 1, 23, 59))).toBe(true);
    expect(isAprilFools(new Date(2027, 2, 31, 23, 59))).toBe(false);
    expect(isAprilFools(new Date(2027, 3, 2))).toBe(false);
    expect(isAprilFools(new Date(2027, 0, 1))).toBe(false);
  });

  it('never shows "Activate Windows" on other days', async () => {
    const fixture = loadOn(new Date(2026, 9, 14, 12));
    vi.stubGlobal('innerWidth', 1920);
    vi.stubGlobal('innerHeight', 1080);
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.windows-watermark')).toBeNull();
  });

  it('shows "Activate Windows" on April Fools\' Day, only on full-size desktop windows', async () => {
    const fixture = loadOn(new Date(2027, 3, 1, 12));
    const resize = async (width: number, height: number) => {
      vi.stubGlobal('innerWidth', width);
      vi.stubGlobal('innerHeight', height);
      window.dispatchEvent(new Event('resize'));
      await fixture.whenStable();
      return !!(fixture.nativeElement as HTMLElement).querySelector('.windows-watermark');
    };
    expect(await resize(1920, 1080)).toBe(true);
    expect(await resize(1919, 1080)).toBe(false);
    expect(await resize(1920, 800)).toBe(false);
  });
});
