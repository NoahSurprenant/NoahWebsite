import { GithubData } from '../themes/terminal/github';

/** Two weeks and a day of contributions, starting on a Saturday so the first week is short. */
export const SAMPLE: GithubData = {
  user: 'NoahSurprenant',
  since: '2018-04-24',
  repos: [
    { name: 'Headhunter', description: 'OSINT with voter data', url: 'https://github.com/NoahSurprenant/Headhunter', languages: { 'C#': 600, TypeScript: 300, HTML: 100 }, stars: 0, created: '2025-04-08', pushed: '2026-11-01' },
    { name: 'homebrew', description: '', url: 'https://github.com/NoahSurprenant/homebrew', languages: {}, stars: 3, created: '2020-01-01', pushed: '2021-01-01' },
    { name: 'HttpContextMapper', description: 'Maps contexts', url: 'https://github.com/NoahSurprenant/HttpContextMapper', languages: { 'C#': 10 }, stars: 0, created: '2023-01-01', pushed: '2023-08-16' },
  ],
  languages: { 'C#': 610, TypeScript: 300, HTML: 100 },
  days: [
    { date: '2026-10-31', count: 2 },
    { date: '2026-11-01', count: 0 },
    { date: '2026-11-02', count: 5 },
    { date: '2026-11-03', count: 1 },
    { date: '2026-11-04', count: 0 },
    { date: '2026-11-05', count: 3 },
    { date: '2026-11-06', count: 4 },
    { date: '2026-11-07', count: 1 },
    { date: '2026-11-08', count: 12 },
    { date: '2026-11-09', count: 0 },
  ],
};

/**
 * Answers fetch() from a table of URL → JSON body (or an HTTP status). Anything not in the table
 * is a network error.
 */
export function stubFetch(routes: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) => {
    if (!(url in routes)) throw new TypeError('Failed to fetch');
    const body = routes[url];
    return typeof body === 'number'
      ? new Response('', { status: body })
      : new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
