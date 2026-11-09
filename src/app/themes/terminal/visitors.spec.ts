import { stubFetch } from '../../testing/github';
import { loadVisitors, short, sparkline, VISITORS_URL } from './visitors';

describe('visitors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the hours', async () => {
    stubFetch({ [VISITORS_URL]: { hours: [1, 2, 3] } });
    expect(await loadVisitors()).toEqual([1, 2, 3]);
  });

  it('shows nothing without numbers', async () => {
    stubFetch({ [VISITORS_URL]: 503 });
    expect(await loadVisitors()).toBeNull();
    stubFetch({ [VISITORS_URL]: { hours: [] } });
    expect(await loadVisitors()).toBeNull();
    stubFetch({ [VISITORS_URL]: { error: 'nope' } });
    expect(await loadVisitors()).toBeNull();
    stubFetch({});
    expect(await loadVisitors()).toBeNull();
  });

  it('draws a sparkline', () => {
    expect(sparkline([0, 1, 2, 4, 8])).toBe('▁▂▃▅█');
    expect(sparkline([0, 0])).toBe('▁▁');
  });

  it('shortens big numbers', () => {
    expect(short(999)).toBe('999');
    expect(short(1234)).toBe('1.2k');
    expect(short(12345)).toBe('12k');
  });
});
