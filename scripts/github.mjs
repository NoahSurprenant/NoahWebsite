// Collects what the terminal theme prints about GitHub (neofetch, fetch <repo>, contrib) for the
// /api/github Netlify function: the public repos and their languages from one GraphQL query
// (which needs a token: a fine-grained one with no permissions can read public data), and the
// last year's contributions from the profile's public contribution graph, which counts private
// work day by day just like the profile does.

export const USER = 'NoahSurprenant';
/** Organizations whose public repos are listed too, as ORG/name */
const ORGS = ['PlayGrifball'];

const REPO_FIELDS = `nodes {
  name description url stargazerCount createdAt pushedAt isArchived
  languages(first: 20, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
}`;

const QUERY = `query ($login: String!) {
  user(login: $login) {
    createdAt
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      ${REPO_FIELDS}
    }
  }
  ${ORGS.map((org, i) => `org${i}: organization(login: "${org}") {
    repositories(first: 100, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) { ${REPO_FIELDS} }
  }`).join('\n')}
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

  // An org can refuse a token (PlayGrifball refuses ones that live longer than a year). The rest
  // still comes through, but a list missing those repos isn't a good answer: fail, so the last
  // full one is served instead
  if (body.errors) throw new Error(`GitHub GraphQL: ${body.errors.map(e => e.message).join('; ')}`);
  const lists = [
    ...user.repositories.nodes.map(r => ({ ...r, prefix: '' })),
    ...ORGS.flatMap((org, i) => (body.data[`org${i}`]?.repositories.nodes ?? []).map(r => ({ ...r, prefix: `${org}/` }))),
  ];
  const repos = lists
    .filter(r => !r.isArchived && r.name !== USER)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .map(r => ({
      name: r.prefix + r.name,
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
  return { user: USER, since: user.createdAt.slice(0, 10), repos, languages, days: await profileCalendar() };
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
