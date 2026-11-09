import { LINKS, NAME } from '../../links';
import { THEMES } from '../themes';
import { Day, GithubData, Repo, total, weeks } from './github';

/** Every command, for tab completion. Aliases are left out so a Tab doesn't stop at a choice of two. */
export const COMMANDS = [
  'help', 'whoami', 'ls', 'open', 'theme', 'neofetch', 'fetch', 'contrib', 'pet', 'history', 'clear', 'echo',
  'sudo', 'exit', 'vim',
] as const;

/** Commands that can be sent as a link (#neofetch, #fetch%20Headhunter): they only print. */
export const SHAREABLE = new Set(['whoami', 'ls', 'dir', 'neofetch', 'fetch', 'contrib', 'help']);

export const HELP = `Commands:
  whoami          who this site belongs to
  ls [repos/]     list the links, or the repos
  open <link>     open one: ${LINKS.map(l => l.id).join(', ')}
  neofetch        the GitHub profile at a glance
  fetch <repo>    one repo: what it is, its languages
  contrib         a year of commits, as a landscape
  pet [off|on]    the cat on the keyboard
  theme [name]    list the themes, or switch: ${THEMES.map(t => t.id).join(', ')}
  history         what you typed
  clear           clear the screen

Tab completes. Esc leaves the prompt: then j/k scroll and : runs a command.`;

/** What a Tab press does to the line: the new line, and the choices if it was ambiguous. */
export interface Completion {
  line: string;
  options: string[];
}

/** Bash-style completion of the command, or of its first argument. */
export function complete(line: string, repos: readonly string[]): Completion {
  const words = line.split(' ');
  const [command] = words;
  let candidates: readonly string[];
  if (words.length === 1) {
    candidates = COMMANDS;
  } else if (words.length === 2) {
    candidates = argumentsFor(command.toLowerCase(), repos);
  } else {
    return { line, options: [] };
  }
  const word = words.at(-1)!;
  const options = candidates.filter(c => c.toLowerCase().startsWith(word.toLowerCase()));
  if (!options.length) return { line, options: [] };
  const head = words.slice(0, -1).map(w => `${w} `).join('');
  if (options.length === 1) {
    // A directory keeps the cursor on it, like bash
    const done = options[0].endsWith('/') ? options[0] : `${options[0]} `;
    return { line: head + done, options: [] };
  }
  return { line: head + commonPrefix(options, word), options };
}

function argumentsFor(command: string, repos: readonly string[]): readonly string[] {
  switch (command) {
    case 'open':
    case 'cat':
    case 'xdg-open':
      return LINKS.map(l => l.id);
    case 'theme':
      return THEMES.map(t => t.id);
    case 'fetch':
      return repos;
    case 'ls':
    case 'dir':
      return ['links/', 'repos/'];
    case 'pet':
      return ['on', 'off'];
    default:
      return [];
  }
}

/** The longest start every option shares, keeping what was typed when the case differs. */
export function commonPrefix(options: readonly string[], typed: string) {
  let prefix = options[0];
  for (const option of options) {
    while (!option.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
  }
  return prefix.length > typed.length ? prefix : typed;
}

/** A bar of `width` cells, filled in proportion. */
export function bar(fraction: number, width = 16) {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/** Languages by share, biggest first, the rest lumped into "other". */
export function languageBars(languages: Record<string, number>, top = 5) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, bytes]) => s + bytes, 0);
  if (!sum) return ['(no code yet)'];
  const shown = entries.slice(0, top);
  const rest = entries.slice(top).reduce((s, [, bytes]) => s + bytes, 0);
  if (rest) shown.push(['other', rest]);
  const pad = Math.max(...shown.map(([name]) => name.length));
  return shown.map(([name, bytes]) => {
    const share = bytes / sum;
    return `${name.padEnd(pad)}  ${bar(share)} ${percent(share)}`;
  });
}

const percent = (share: number) => `${share < 0.01 ? '<1' : Math.round(share * 100)}%`.padStart(4);
const thousands = (n: number) => n.toLocaleString('en-US');

/** Days in a row with a contribution, ending at the last day (or the day before, if today is empty so far). */
export function streaks(days: readonly Day[]) {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    run = day.count ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  const end = days.at(-1)?.count ? days.length - 1 : days.length - 2;
  for (let i = end; i >= 0 && days[i].count; i--) current++;
  return { current, longest };
}

export const LOGO = String.raw`
 _   _  ____
| \ | |/ ___|
|  \| |\___ \
| |\  | ___) |
|_| \_||____/
`.slice(1, -1);

/** The profile card's numbers, printed beside LOGO (under it on a phone). */
export function neofetch(data: GithubData, prompt: string) {
  const busiest = data.days.reduce((a, b) => (b.count > a.count ? b : a));
  const { current, longest } = streaks(data.days);
  const info = [
    prompt,
    '-'.repeat(prompt.length),
    `Name       ${NAME}`,
    `GitHub     ${data.user} (since ${data.since.slice(0, 4)})`,
    `Repos      ${data.repos.length} public`,
    `Contribs   ${thousands(total(data.days))} in the last year`,
    `Streak     ${current} ${current === 1 ? 'day' : 'days'} (longest ${longest})`,
    `Busiest    ${weekday(busiest.date)} ${busiest.date}, ${busiest.count}`,
    '',
    ...languageBars(data.languages),
  ];
  return info.join('\n');
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

/** One repo: what it is and what it's written in. */
export function repoCard(repo: Repo) {
  return [
    repo.name,
    '='.repeat(repo.name.length),
    ...(repo.description ? [repo.description, ''] : []),
    `created    ${repo.created}`,
    `last push  ${repo.pushed}`,
    ...(repo.stars ? [`stars      ${repo.stars}`] : []),
    '',
    ...languageBars(repo.languages),
  ].join('\n');
}

/** The year as a one-line summary under the landscape. */
export function contribSummary(days: readonly Day[]) {
  const w = weeks(days);
  return `${w.length} weeks, ${thousands(total(days))} contributions. Front is this week; hover for a week.`;
}
