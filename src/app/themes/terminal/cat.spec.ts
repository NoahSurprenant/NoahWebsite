import { TestBed } from '@angular/core/testing';
import { Cat } from './cat';

describe('Cat', () => {
  const leftOf = (a: string, b: string) => a < b;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [Cat] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('naps until a key is pressed, chases it, then watches and dozes off', () => {
    const cat = TestBed.inject(Cat);
    expect(cat.mood()).toBe('napping');
    expect(cat.face()).toContain('zZ');

    cat.press('KeyA', leftOf);
    expect(cat.mood()).toBe('chasing');
    expect(cat.key()).toBe('KeyA');
    expect(cat.facingLeft()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(cat.mood()).toBe('watching');

    // The same key again doesn't turn it round
    cat.press('KeyA', () => false);
    expect(cat.facingLeft()).toBe(true);
    cat.press('KeyZ', leftOf);
    expect(cat.facingLeft()).toBe(false);
    vi.advanceTimersByTime(600 + 15000);
    expect(cat.mood()).toBe('napping');
  });

  it('purrs when petted, ignoring keys meanwhile', () => {
    const cat = TestBed.inject(Cat);
    expect(cat.pet()).toBe('prrrrr');
    expect(cat.mood()).toBe('purring');
    cat.press('KeyA', leftOf);
    expect(cat.mood()).toBe('purring');
    vi.advanceTimersByTime(3000);
    expect(cat.mood()).toBe('watching');
    expect(cat.pet('on')).toBe('The cat is already here.');
    vi.advanceTimersByTime(15000);
    expect(cat.mood()).toBe('napping');
  });

  it('goes away and comes back, remembering', () => {
    const cat = TestBed.inject(Cat);
    expect(cat.pet('off')).toBe('The cat wanders off.');
    expect(cat.mood()).toBe('away');
    expect(cat.face()).toBe('');
    cat.press('KeyA', leftOf);
    expect(cat.mood()).toBe('away');
    expect(localStorage.getItem('terminal-cat')).toBe('off');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Cat] });
    const next = TestBed.inject(Cat);
    expect(next.mood()).toBe('away');
    expect(next.pet()).toBe('The cat is back, asleep on the keyboard.');
    expect(next.mood()).toBe('napping');
    expect(localStorage.getItem('terminal-cat')).toBe('on');
  });

  it('still works with storage off', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const cat = TestBed.inject(Cat);
    expect(cat.mood()).toBe('napping');
    expect(cat.pet('off')).toBe('The cat wanders off.');
  });

  it('stops its timers when the terminal goes', () => {
    const cat = TestBed.inject(Cat);
    cat.press('KeyA', leftOf);
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(60000);
    expect(cat.mood()).toBe('chasing');
  });
});
