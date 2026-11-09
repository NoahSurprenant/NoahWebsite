/** What scripts/github-snapshot.mjs saves at build time: public repos and the contribution calendar. */
export interface GithubData {
  user: string;
  /** Account creation date, YYYY-MM-DD */
  since: string;
  /** Most recently pushed first */
  repos: Repo[];
  /** Bytes of code per language, over all the repos */
  languages: Record<string, number>;
  /** The last year, oldest first */
  days: Day[];
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

export const GITHUB_DATA_URL = 'assets/github.json';

/** Loads the snapshot once and shares it. A failed load is retried next time it's asked for. */
export class GithubLoader {
  private pending?: Promise<GithubData>;

  load(): Promise<GithubData> {
    this.pending ??= fetch(GITHUB_DATA_URL).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<GithubData>;
    });
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
