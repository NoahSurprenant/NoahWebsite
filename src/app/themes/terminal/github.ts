/** What scripts/github-snapshot.mjs saves at build time: public repos and the contribution calendar. */
export interface GithubData {
  user: string;
  /** Account creation date, YYYY-MM-DD */
  since: string;
  /** Most recently pushed first */
  repos: Repo[];
  /** Bytes of code per language, over all the repos */
  languages: Record<string, number>;
  /** The last year, oldest first. Only contributions the snapshot's token can see. */
  days: Day[];
  /** Contributions over the same year to repos the token can't see, which come only as a total */
  private?: number;
}

export interface Repo {
  name: string;
  description: string;
  url: string;
  /** Bytes of code per language */
  languages: Record<string, number>;
  stars: number;
  created: string;
  pushed: string;
}

export interface Day {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

/** Collected live by netlify/functions/github.mts, at most a few hours old */
export const GITHUB_API_URL = '/api/github';
/** The copy saved at build time, for when the live one can't be had */
export const GITHUB_DATA_URL = 'assets/github.json';

async function getJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<GithubData>;
}

/** Loads the numbers once and shares them. A failed load is retried next time they're asked for. */
export class GithubLoader {
  private pending?: Promise<GithubData>;

  load(): Promise<GithubData> {
    this.pending ??= getJson(GITHUB_API_URL).catch(() => getJson(GITHUB_DATA_URL));
    this.pending.catch(() => (this.pending = undefined));
    return this.pending;
  }
}

/** Finds a repo by name, ignoring case. */
export function findRepo(data: GithubData, name: string | undefined) {
  const wanted = name?.toLowerCase().replace(/^repos\//, '').replace(/\/$/, '');
  return data.repos.find(repo => repo.name.toLowerCase() === wanted);
}

/** Groups the days into weeks starting on Sunday, like GitHub's calendar. The first week may be short. */
export function weeks(days: readonly Day[]): Day[][] {
  const out: Day[][] = [];
  for (const day of days) {
    if (!out.length || new Date(`${day.date}T00:00:00Z`).getUTCDay() === 0) out.push([]);
    out.at(-1)!.push(day);
  }
  return out;
}

export const total = (days: readonly Day[]) => days.reduce((sum, day) => sum + day.count, 0);
