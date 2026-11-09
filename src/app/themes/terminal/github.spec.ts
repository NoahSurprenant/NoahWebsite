import { SAMPLE, stubFetch } from '../../testing/github';
import { findRepo, GITHUB_DATA_URL, GithubLoader, total, weeks } from './github';

describe('GithubLoader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the snapshot once and shares it', async () => {
    const fetch = stubFetch({ [GITHUB_DATA_URL]: SAMPLE });
    const loader = new GithubLoader();
    expect(await loader.load()).toEqual(SAMPLE);
    expect(await loader.load()).toEqual(SAMPLE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('tries again after a failed load', async () => {
    const fetch = stubFetch({ [GITHUB_DATA_URL]: 500 });
    const loader = new GithubLoader();
    await expect(loader.load()).rejects.toThrow('HTTP 500');
    await expect(loader.load()).rejects.toThrow('HTTP 500');
    expect(fetch).toHaveBeenCalledTimes(2);
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
