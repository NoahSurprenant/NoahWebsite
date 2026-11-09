// Refreshes src/assets/github.json, the copy the terminal falls back to when /api/github
// (netlify/functions/github.mts) can't answer. Run by `npm run build`; a failed request keeps the
// last copy, so a GitHub outage never breaks a deploy.
import { readFile, writeFile } from 'node:fs/promises';
import { snapshot } from './github.mjs';

const OUT = new URL('../src/assets/github.json', import.meta.url);

try {
  const data = await snapshot();
  await writeFile(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`github.json: ${data.repos.length} repos, ${data.days.length} days`);
} catch (error) {
  await readFile(OUT); // No copy at all is a real failure
  console.warn(`github.json: kept the last copy (${error.message})`);
}
