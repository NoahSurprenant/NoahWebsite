import { TestBed } from '@angular/core/testing';
import { fakeCanvas, manualFrames } from '../../testing/canvas';
import { stubMatchMedia } from '../../testing/match-media';
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
