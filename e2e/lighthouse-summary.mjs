// Turns a Lighthouse CI run (.lighthouseci/lhr-*.json) into a Markdown table of the category
// scores, a row per theme, for the run's summary and the PR comment. Several runs of a page: the
// one with the median performance score, as lhci assert uses. Performance under the target in
// lighthouserc.cjs (which only warns) gets a GitHub warning annotation, on stderr.
// Usage: LIGHTHOUSE_PRESET=desktop|mobile node e2e/lighthouse-summary.mjs > lighthouse.md
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = '.lighthouseci';
const desktop = process.env.LIGHTHOUSE_PRESET === 'desktop';
const target = desktop ? 98 : 80;
const categories = [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['best-practices', 'Best practices'], ['seo', 'SEO']];

const runs = new Map();
const files = await readdir(dir).catch(() => []);
for (const file of files.filter(f => /^lhr-.*\.json$/.test(f))) {
  const lhr = JSON.parse(await readFile(join(dir, file), 'utf8'));
  runs.set(lhr.requestedUrl, [...(runs.get(lhr.requestedUrl) ?? []), lhr]);
}
const reports = [...runs.values()]
  .map(all => all.sort((a, b) => a.categories.performance.score - b.categories.performance.score)[Math.floor(all.length / 2)])
  .sort((a, b) => a.requestedUrl.localeCompare(b.requestedUrl));

const score = (lhr, key) => Math.round(lhr.categories[key].score * 100);
const mark = (value, needed) => `${value === 100 || value >= needed ? '' : value >= needed - 10 ? '🟠 ' : '🔴 '}${value}`;

let out = `### Lighthouse, ${desktop ? 'desktop' : 'mobile'}\n\n`;
if (!reports.length) {
  out += 'No Lighthouse reports (the job stopped before them).\n';
} else {
  out += `| Theme | ${categories.map(([, label]) => label).join(' | ')} |\n|---|${categories.map(() => '---|').join('')}\n`;
  for (const lhr of reports) {
    const theme = new URL(lhr.requestedUrl).searchParams.get('theme');
    out += `| ${theme} | ${categories.map(([key]) => mark(score(lhr, key), key === 'performance' ? target : 100)).join(' | ')} |\n`;
    if (score(lhr, 'performance') < target) {
      console.error(`::warning title=Lighthouse ${desktop ? 'desktop' : 'mobile'}::${theme} performance ${score(lhr, 'performance')}, under ${target}`);
    }
  }
  out += `\nAccessibility, best practices and SEO must be 100; performance is reported against ${target}${desktop ? '' : ' (median of three runs)'}.\n`;
}
process.stdout.write(out);
