import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { stubMatchMedia } from '../../testing/match-media';
import { HudComponent } from './hud.component';
import { MechaThemeComponent } from './mecha-theme.component';

describe('MechaThemeComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('puts the links on hexagons, under the title card and readouts', async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-title-card h1')).toBeTruthy();
    expect(el.querySelector('app-hud .timer')).toBeTruthy();
    expect(Array.from(el.querySelectorAll('.console a span')).map(s => s.textContent))
      .toEqual(['LinkedIn', 'GitHub', 'Email', 'Resume']);
    expect(el.querySelectorAll('.grid i').length).toBe(12);
  });

  it('lights up whole cells of the background grid, never between its lines', async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    for (const cell of (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.grid i')) {
      // Each cell's centre is 26px across and 45px down from its corner, on the lines' half-steps
      const across = (parseFloat(cell.style.left) + 26) / 26;
      const down = (parseFloat(cell.style.top) + 45) / 45;
      expect(Number.isInteger(across) && Number.isInteger(down)).toBe(true);
      expect((across + down) % 2).toBe(1);
    }
  });

  it('blacks out the whole theme when the HUD runs out of power', async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const hud = fixture.debugElement.query(By.directive(HudComponent)).componentInstance as HudComponent;
    hud.power.set('down');
    await fixture.whenStable();
    expect(el.querySelector('app-power-down')?.classList.contains('down')).toBe(true);
  });

  it('runs the banner message twice, so its scroll loops without a jump', async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).querySelector('app-banner')!.textContent!;
    expect(text.startsWith('EMERGENCY')).toBe(true);
    expect(text.slice(0, text.length / 2)).toBe(text.slice(text.length / 2));
  });

  it("names nothing from the show it's styled after", async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toMatch(/neon|genesis|evangelion|nerv|magi|melchior|balthasar|casper|eva\b/i);
  });
});
