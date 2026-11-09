// Saves the GitHub numbers the terminal theme prints (neofetch, fetch <repo>, contrib) to
// src/assets/github.json. Run by `npm run build`; a failed request keeps the last snapshot, so a
// GitHub outage or rate limit never breaks a deploy. GITHUB_TOKEN, when set, lifts the rate limit.
import { readFile, writeFile } from 'node:fs/promises';

const USER = 'NoahSurprenant';
const OUT = new URL('../src/assets/github.json', import.meta.url);
const headers = {
  'User-Agent': 'noahsurprenant.com build',
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function get(url, json = true) {
  const response = await fetch(url, { headers: json ? headers : { 'User-Agent': headers['User-Agent'] } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return json ? response.json() : response.text();
}

/** The profile's contribution calendar: the public HTML has a cell per day and a tooltip with the count. */
async function contributions() {
  const html = await get(`https://github.com/users/${USER}/contributions`, false);
  const dates = new Map();
  for (const [, date, id] of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="([^"]+)"/g)) dates.set(id, date);
  const days = [];
  for (const [, id, text] of html.matchAll(/for="([^"]+)"[^>]*>([^<]+)</g)) {
    const date = dates.get(id);
    if (!date) continue;
    const count = /^(\d+) contribution/.exec(text)?.[1];
    days.push({ date, count: count ? Number(count) : 0 });
  }
  if (days.length < 300) throw new Error(`only ${days.length} days in the contribution calendar`);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

async function snapshot() {
  const user = await get(`https://api.github.com/users/${USER}`);
  const all = await get(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`);
  const repos = [];
  const totals = {};
  for (const repo of all.filter(r => !r.fork && !r.archived && r.name !== USER)) {
    const languages = await get(repo.languages_url);
    for (const [name, bytes] of Object.entries(languages)) totals[name] = (totals[name] ?? 0) + bytes;
    repos.push({
      name: repo.name,
      description: repo.description ?? '',
      url: repo.html_url,
      languages,
      stars: repo.stargazers_count,
      created: repo.created_at.slice(0, 10),
      pushed: repo.pushed_at.slice(0, 10),
    });
  }
  return {
    user: USER,
    since: user.created_at.slice(0, 10),
    repos: repos,
    languages: totals,
    days: await contributions(),
  };
}

try {
  const data = await snapshot();
  await writeFile(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`github.json: ${data.repos.length} repos, ${data.days.length} days`);
} catch (error) {
  await readFile(OUT); // No snapshot at all is a real failure
  console.warn(`github.json: kept the last snapshot (${error.message})`);
}
