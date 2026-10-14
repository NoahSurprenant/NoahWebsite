import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Power } from './hud.component';
import { PowerDownComponent } from './power-down.component';

@Component({
  imports: [PowerDownComponent],
  template: '<app-power-down [power]="power()"></app-power-down>',
})
class HostComponent {
  readonly power = signal<Power>('internal');
}

describe('PowerDownComponent', () => {
  async function create() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const overlay = (fixture.nativeElement as HTMLElement).querySelector('app-power-down')!;
    const show = async (power: Power) => {
      fixture.componentInstance.power.set(power);
      await fixture.whenStable();
    };
    return { overlay, show };
  }

  it('shows nothing while the battery lasts', async () => {
    const { overlay } = await create();
    expect(overlay.className).toBe('');
    expect(overlay.textContent?.trim()).toBe('');
  });

  it('goes dark with the activity limit warning when it runs out', async () => {
    const { overlay, show } = await create();
    await show('down');
    expect(overlay.classList.contains('down')).toBe(true);
    expect(overlay.querySelector('.limit')?.textContent).toBe('ACTIVITY LIMIT REACHEDINTERNAL POWER DEPLETED');
  });

  it('announces external power, then clears', async () => {
    const { overlay, show } = await create();
    await show('external');
    expect(overlay.classList.contains('external')).toBe(true);
    expect(overlay.querySelector('.restored')?.textContent).toBe('EXTERNAL POWER CONNECTED');
    await show('internal');
    expect(overlay.className).toBe('');
  });

  it('is hidden from screen readers', async () => {
    const { overlay } = await create();
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
  });
});
