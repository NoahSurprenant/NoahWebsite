import { TestBed } from '@angular/core/testing';
import { Cat } from './cat';
import { KeyboardComponent } from './keyboard.component';

describe('KeyboardComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [Cat] });
  });
  afterEach(() => vi.useRealTimers());

  async function create() {
    const fixture = TestBed.createComponent(KeyboardComponent);
    await fixture.whenStable();
    vi.useFakeTimers();
    const el = fixture.nativeElement as HTMLElement;
    const press = async (code: string) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code }));
      fixture.detectChanges();
    };
    const key = (label: string) => Array.from(el.querySelectorAll('.key')).find(k => k.textContent === label)!;
    return { fixture, el, press, key };
  }

  it('lights a key while it is pressed', async () => {
    const { fixture, press, key } = await create();
    await press('KeyQ');
    expect(key('q').classList).toContain('lit');
    await press('KeyQ');
    vi.advanceTimersByTime(160);
    fixture.detectChanges();
    expect(key('q').classList).not.toContain('lit');
  });

  it('ignores keys it does not show', async () => {
    const { el, press } = await create();
    await press('F5');
    expect(el.querySelector('.lit')).toBeNull();
  });

  it('has the cat walk to the key, facing the way it goes', async () => {
    const { el, press } = await create();
    const cat = () => el.querySelector<HTMLElement>('.cat')!;
    expect(cat().textContent).toContain('zZ');
    const start = parseFloat(cat().style.left);
    await press('KeyA');
    expect(parseFloat(cat().style.left)).toBeLessThan(start);
    expect(cat().classList).toContain('left');
    expect(cat().classList).toContain('chasing');
    await press('Space');
    expect(cat().classList).not.toContain('left');
  });

  it('has no cat when it is away', async () => {
    TestBed.inject(Cat).pet('off');
    const { el } = await create();
    expect(el.querySelector('.cat')).toBeNull();
  });

  it('stops its timers when it goes', async () => {
    const { fixture, press } = await create();
    await press('KeyQ');
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(1); // only the cat's
  });
});
