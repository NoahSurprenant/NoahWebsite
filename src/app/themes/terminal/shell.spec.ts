import { SAMPLE } from '../../testing/github';
import { bar, commonPrefix, complete, contribSummary, languageBars, neofetch, repoCard, streaks } from './shell';

describe('tab completion', () => {
  const repos = SAMPLE.repos.map(r => r.name);

  it('completes a command', () => {
    expect(complete('neo', repos)).toEqual({ line: 'neofetch ', options: [] });
    expect(complete('h', repos)).toEqual({ line: 'h', options: ['help', 'history'] });
    expect(complete('he', repos)).toEqual({ line: 'help ', options: [] });
    expect(complete('zzz', repos)).toEqual({ line: 'zzz', options: [] });
  });

  it('completes the argument', () => {
    expect(complete('open gi', repos)).toEqual({ line: 'open github ', options: [] });
    expect(complete('cat re', repos).line).toBe('cat resume ');
    expect(complete('xdg-open e', repos).line).toBe('xdg-open email ');
    expect(complete('theme x', repos).line).toBe('theme xbox ');
    expect(complete('pet o', repos)).toEqual({ line: 'pet o', options: ['on', 'off'] });
    expect(complete('ls r', repos)).toEqual({ line: 'ls repos/', options: [] });
    expect(complete('dir ', repos).options).toEqual(['links/', 'repos/']);
    expect(complete('echo h', repos)).toEqual({ line: 'echo h', options: [] });
  });

  it('completes repos to the longest shared start, keeping the typed case', () => {
    expect(complete('fetch h', repos)).toEqual({ line: 'fetch h', options: ['Headhunter', 'homebrew', 'HttpContextMapper'] });
    expect(complete('fetch hE', repos)).toEqual({ line: 'fetch Headhunter ', options: [] });
    expect(complete('fetch Ht', repos).line).toBe('fetch HttpContextMapper ');
  });

  it('leaves later words alone', () => {
    expect(complete('fetch Headhunter x', repos)).toEqual({ line: 'fetch Headhunter x', options: [] });
  });

  it('finds the longest shared start', () => {
    expect(commonPrefix(['help', 'history'], 'h')).toBe('h');
    expect(commonPrefix(['links/', 'linux'], 'l')).toBe('lin');
    expect(commonPrefix(['Abc', 'abd'], 'ab')).toBe('ab');
  });
});

describe('printing', () => {
  it('draws bars', () => {
    expect(bar(0.5, 4)).toBe('██░░');
    expect(bar(2, 2)).toBe('██');
    expect(bar(-1, 2)).toBe('░░');
  });

  it('lists languages biggest first, the rest as other', () => {
    expect(languageBars({ a: 1, b: 3 })).toEqual([
      `b  ${bar(0.75)}  75%`,
      `a  ${bar(0.25)}  25%`,
    ]);
    expect(languageBars({ a: 1000, b: 1 }, 1)).toEqual([`a      ${bar(1000 / 1001)} 100%`, `other  ${bar(0)}  <1%`]);
    expect(languageBars({})).toEqual(['(no code yet)']);
  });

  it('counts streaks, letting today be empty so far', () => {
    expect(streaks(SAMPLE.days)).toEqual({ current: 4, longest: 4 });
    expect(streaks([{ date: 'a', count: 1 }, { date: 'b', count: 1 }])).toEqual({ current: 2, longest: 2 });
    expect(streaks([{ date: 'a', count: 1 }, { date: 'b', count: 0 }, { date: 'c', count: 0 }])).toEqual({ current: 0, longest: 1 });
    expect(streaks([])).toEqual({ current: 0, longest: 0 });
  });

  it('prints the profile beside the logo', () => {
    const lines = neofetch(SAMPLE, 'guest@host').split('\n');
    expect(lines[0]).toMatch(/^ _ +_ +____ +guest@host$/);
    expect(lines.map(l => l.trim())).toContain('Contribs   28 in the last year');
    expect(lines.some(l => l.includes('Streak     4 days (longest 4)'))).toBe(true);
    expect(lines.some(l => l.includes('Busiest    Sun 2026-11-08, 12'))).toBe(true);
    const one = neofetch({ ...SAMPLE, days: [{ date: '2026-11-09', count: 1 }] }, 'g');
    expect(one).toContain('Streak     1 day (longest 1)');
  });

  it('prints a repo', () => {
    expect(repoCard(SAMPLE.repos[0])).toBe([
      'Headhunter',
      '==========',
      'OSINT with voter data',
      '',
      'created    2025-04-08',
      'last push  2026-11-01',
      '',
      ...languageBars(SAMPLE.repos[0].languages),
    ].join('\n'));
    const bare = repoCard(SAMPLE.repos[1]);
    expect(bare).not.toContain('\n\ncreated');
    expect(bare).toContain('stars      3');
    expect(bare).toContain('(no code yet)');
  });

  it('sums up the year', () => {
    expect(contribSummary(SAMPLE.days)).toBe('3 weeks, 28 contributions. Front is this week; hover for a week.');
  });
});
