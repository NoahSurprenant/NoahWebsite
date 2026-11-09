// Collects what the terminal theme prints about GitHub (neofetch, fetch <repo>, contrib): the
// public repos, their languages and the last year's contribution calendar. Shared by the
// /api/github Netlify function (live) and scripts/github-snapshot.mjs (the fallback file).
//
// The repos come from one GraphQL query, which needs a token: a fine-grained one with no
// permissions can read public data. The calendar is read from the profile's public contribution
// graph, which counts private work day by day like the profile does. If GitHub won't serve that
// page, the GraphQL calendar is used instead: it only has the days in repos the token can see,
// with the rest as one total.

export const USER = 'NoahSurprenant';

const QUERY = `query ($login: String!) {
  user(login: $login) {
    createdAt
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name description url stargazerCount createdAt pushedAt isArchived
        languages(first: 20, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
    contributionsCollection {
      restrictedContributionsCount
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

export async function snapshot(token = process.env.GITHUB_TOKEN) {
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'noahsurprenant.com' },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  const body = await response.json().catch(() => null);
  const user = body?.data?.user;
  if (!response.ok || !user) throw new Error(`GitHub GraphQL: ${response.status} ${JSON.stringify(body?.errors ?? '')}`);

  const repos = user.repositories.nodes
    .filter(r => !r.isArchived && r.name !== USER)
    .map(r => ({
      name: r.name,
      description: r.description ?? '',
      url: r.url,
      languages: Object.fromEntries(r.languages.edges.map(e => [e.node.name, e.size])),
      stars: r.stargazerCount,
      created: r.createdAt.slice(0, 10),
      pushed: r.pushedAt.slice(0, 10),
    }));
  const languages = {};
  for (const repo of repos) {
    for (const [name, bytes] of Object.entries(repo.languages)) languages[name] = (languages[name] ?? 0) + bytes;
  }
  const base = { user: USER, since: user.createdAt.slice(0, 10), repos, languages };
  try {
    return { ...base, days: await profileCalendar() };
  } catch (error) {
    console.warn(`Profile calendar unavailable, using GraphQL's (${error.message})`);
  }
  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap(w => w.contributionDays)
    .map(d => ({ date: d.date, count: d.contributionCount }));
  // Contributions to repos the token can't see come only as a total
  return { ...base, days, private: user.contributionsCollection.restrictedContributionsCount };
}

/** The profile's public contribution graph: a cell per day, and a tooltip with its count. */
async function profileCalendar() {
  const response = await fetch(`https://github.com/users/${USER}/contributions`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const dates = new Map();
  for (const [, date, id] of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="([^"]+)"/g)) dates.set(id, date);
  const days = [];
  for (const [, id, text] of html.matchAll(/for="([^"]+)"[^>]*>([^<]+)</g)) {
    const date = dates.get(id);
    if (!date) continue;
    const count = /^(\d+) contribution/.exec(text)?.[1];
    days.push({ date, count: count ? Number(count) : 0 });
  }
  if (days.length < 300) throw new Error(`only ${days.length} days in the graph`);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
