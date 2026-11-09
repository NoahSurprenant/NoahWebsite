import { TestBed } from '@angular/core/testing';
import { ITEM_TEXTS, SkyrimItem } from './skyrim-item';

describe('SkyrimItem', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts on a random item and never repeats one', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = TestBed.inject(SkyrimItem);
    expect(item.index()).toBe(3);
    expect(item.text()).toBe(ITEM_TEXTS[3]);
    // The same one comes up first; it's passed over for the next
    random.mockReturnValueOnce(0.5).mockReturnValueOnce(0);
    item.next();
    expect(item.index()).toBe(0);
  });

  it('has words for every item', () => {
    for (const { caption, attribution } of ITEM_TEXTS) {
      expect(caption.length).toBeGreaterThan(40);
      expect(attribution.short).toBeTruthy();
    }
  });
});
