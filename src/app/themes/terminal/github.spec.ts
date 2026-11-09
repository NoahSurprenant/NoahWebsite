import { SAMPLE, stubFetch } from '../../testing/github';
import { findRepo, GITHUB_API_URL, GITHUB_DATA_URL, GithubLoader, total, weeks } from './github';

describe('GithubLoader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the live numbers once and shares them', async () => {
    const live = { ...SAMPLE, private: 7 };
    const fetch = stubFetch({ [GITHUB_API_URL]: live, [GITHUB_DATA_URL]: SAMPLE });
    const loader = new GithubLoader();
    expect(await loader.load()).toEqual(live);
    expect(await loader.load()).toEqual(live);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the copy saved at build time', async () => {
    stubFetch({ [GITHUB_API_URL]: 502, [GITHUB_DATA_URL]: SAMPLE });
    expect(await new GithubLoader().load()).toEqual(SAMPLE);
  });

  it('tries again after a failed load', async () => {
    const fetch = stubFetch({ [GITHUB_DATA_URL]: 500 });
    const loader = new GithubLoader();
    await expect(loader.load()).rejects.toThrow('HTTP 500');
    await expect(loader.load()).rejects.toThrow('HTTP 500');
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});

describe('GitHub snapshot helpers', () => {
  it('finds a repo by name in any case, with or without the directory', () => {
    expect(findRepo(SAMPLE, 'headhunter')?.name).toBe('Headhunter');
    expect(findRepo(SAMPLE, 'repos/Headhunter/')?.name).toBe('Headhunter');
    expect(findRepo(SAMPLE, 'nope')).toBeUndefined();
    expect(findRepo(SAMPLE, undefined)).toBeUndefined();
  });

  it('groups days into weeks from Sunday', () => {
    expect(weeks(SAMPLE.days).map(w => w.map(d => d.date.slice(8)))).toEqual([
      ['31'], ['01', '02', '03', '04', '05', '06', '07'], ['08', '09'],
    ]);
    expect(weeks([])).toEqual([]);
  });

  it('adds up the contributions', () => {
    expect(total(SAMPLE.days)).toBe(28);
  });
});
