// Turns the e2e run's axe scans (axe-results/scans.jsonl, written by e2e/axe.ts) into Markdown for
// the run's summary and the PR comment: how many scans, and every violation with where it was.
// Usage: node e2e/axe-summary.mjs > axe.md
import { readFile } from 'node:fs/promises';

const lines = await readFile('axe-results/scans.jsonl', 'utf8').then(text => text.split('\n').filter(Boolean), () => []);
// A retried test scans again; its last scan of each thing counts
const scans = [...new Map(lines.map(line => JSON.parse(line)).map(scan => [scan.name, scan])).values()];
const failed = scans.filter(scan => scan.violations.length);

let out = '### Accessibility (axe)\n\n';
if (!scans.length) {
  out += 'No axe scans ran (the e2e tests stopped before them).\n';
} else if (!failed.length) {
  out += `✅ No violations in ${scans.length} scans: every theme on a desktop and a phone, and the terminal after each command on a desktop, tablet and phone.\n`;
} else {
  out += `❌ ${failed.length} of ${scans.length} scans found problems:\n\n| Scan | Rule | Impact | Elements |\n|---|---|---|---|\n`;
  for (const scan of failed) {
    for (const v of scan.violations) out += `| ${scan.name} | \`${v.id}\`: ${v.help} | ${v.impact} | ${v.nodes} |\n`;
  }
  out += '\nThe e2e job\'s log names the elements.\n';
}
process.stdout.write(out);
