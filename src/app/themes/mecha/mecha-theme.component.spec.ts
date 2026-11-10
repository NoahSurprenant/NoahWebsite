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

  it('lights up whole cells of the background honeycomb, never between them', async () => {
    stubMatchMedia();
    fakeCanvas();
    manualFrames();
    const fixture = TestBed.createComponent(MechaThemeComponent);
    await fixture.whenStable();
    const height = 26 * Math.sqrt(3);
    for (const cell of (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.grid i')) {
      // The pattern's cells are centred 26px + 39px per column across, and half a cell down + a
      // cell per row, every other column half a cell higher
      const col = parseFloat(cell.style.left) / 39;
      expect(Number.isInteger(col)).toBe(true);
      const centre = (parseFloat(cell.style.top) + height / 2) / height;
      const row = centre - 0.5 + (col % 2) / 2;
      expect(row).toBeCloseTo(Math.round(row), 6);
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
