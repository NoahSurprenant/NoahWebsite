// Collects what the terminal theme prints about GitHub (neofetch, fetch <repo>, contrib): the
// public repos, their languages and the last year's contribution calendar, in one GraphQL query.
// Shared by the /api/github Netlify function (live) and scripts/github-snapshot.mjs (the fallback
// file). GraphQL needs a token: a fine-grained one with no permissions can read public data.

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
  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap(w => w.contributionDays)
    .map(d => ({ date: d.date, count: d.contributionCount }));
  // Contributions to repos the token can't see come only as a total
  const hidden = user.contributionsCollection.restrictedContributionsCount;
  return { user: USER, since: user.createdAt.slice(0, 10), repos, languages, days, private: hidden };
}
