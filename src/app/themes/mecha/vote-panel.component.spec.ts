import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VotePanelComponent } from './vote-panel.component';

@Component({
  imports: [VotePanelComponent],
  template: '<app-vote-panel [votes]="votes()"></app-vote-panel>',
})
class HostComponent {
  readonly votes = signal([true, true, true]);
}

describe('VotePanelComponent', () => {
  async function show(votes: boolean[]) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.votes.set(votes);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      boxes: Array.from(el.querySelectorAll<HTMLElement>('.box')),
      result: el.querySelector('.result')!,
    };
  }

  it('lays the three computers out as on the display: 1 and 3 side by side, 2 underneath', async () => {
    const { boxes } = await show([true, true, true]);
    expect(boxes.map(b => [b.textContent, b.style.gridArea])).toEqual([['1', 'one'], ['2', 'two'], ['3', 'three']]);
  });

  it('lights the computers that approve, and passes on a majority', async () => {
    const { boxes, result } = await show([true, false, true]);
    expect(boxes.map(b => b.classList.contains('deny'))).toEqual([false, true, false]);
    expect(result.textContent).toBe('RESOLUTION: APPROVED');
    expect(result.classList.contains('deny')).toBe(false);
  });

  it('rejects without a majority', async () => {
    const { result } = await show([false, false, true]);
    expect(result.textContent).toBe('RESOLUTION: REJECTED');
    expect(result.classList.contains('deny')).toBe(true);
  });
});
