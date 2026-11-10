// Renders src/assets/og-image.png, the picture shown when a link to the site is shared: the four
// themes in a 2x2 grid. Run `npm run og-image` (builds, then serves the build the way the e2e tests
// do), or `node scripts/og-image.mjs https://example.netlify.app` to picture a deployed site.
// A system Chromium can be used instead of Playwright's download: CHROMIUM_PATH=/usr/bin/chromium
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../src/assets/og-image.png', import.meta.url));
// What link previews expect; each theme is drawn at this size too, then shrunk into its quarter
const WIDTH = 1200;
const HEIGHT = 630;
const PORT = 4310;

/** Gets each theme to a moment worth showing */
const THEMES = {
  // The penguin
  skyrim: { item: 3, settle: 7000 },
  terminal: { settle: 12000, commands: ['clear', 'neofetch'] },
  xbox: { settle: 7000 },
  // Before the title card is redrawn, 8 seconds in
  mecha: { settle: 4500 },
};
// How many items ITEM_TEXTS in src/app/skyrim-item.ts has
const ITEMS = 6;

async function serve() {
  const server = spawn(process.execPath, ['e2e/serve.mjs'], { cwd: repoRoot, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('exit', code => reject(new Error(`e2e/serve.mjs exited with ${code}`)));
  });
  return server;
}

async function shoot(browser, base, theme, { item, settle, commands = [] }) {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  await context.addInitScript(([item, items]) => {
    // Not a first visit, so no hint by the cog
    localStorage.setItem('theme-hint', '1');
    // The first Math.random() picks the Skyrim item
    if (item === null) return;
    const random = Math.random;
    let first = true;
    Math.random = () => (first ? ((first = false), (item + 0.5) / items) : random());
  }, [item ?? null, ITEMS]);
  const page = await context.newPage();
  await page.goto(`${base}/?theme=${theme}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(settle);
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
  }
  if (commands.length) {
    // The last command's output from the top, rather than scrolled to the bottom
    await page.evaluate(() => [...document.querySelectorAll('.command')].at(-1)?.scrollIntoView({ block: 'start' }));
  }
  // A deploy preview's Netlify toolbar
  await page.evaluate(() => document.querySelectorAll('iframe, netlify-drawer, [id^=netlify]').forEach(e => e.remove()));
  const png = await page.screenshot();
  await context.close();
  return png;
}

const base = process.argv[2]?.replace(/\/$/, '');
const server = base ? undefined : await serve();
const browser = await chromium.launch({
  executablePath: process.env['CHROMIUM_PATH'] || undefined,
  // WebGL for the Skyrim and Xbox themes, without a GPU if need be
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const shots = [];
  for (const [theme, how] of Object.entries(THEMES)) shots.push(await shoot(browser, base ?? `http://127.0.0.1:${PORT}`, theme, how));
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(`<style>
      body { margin: 0; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 4px; width: ${WIDTH}px; height: ${HEIGHT}px; background: #000; }
      img { display: block; width: 100%; height: 100%; object-fit: cover; }
    </style>
    ${shots.map(png => `<img src="data:image/png;base64,${png.toString('base64')}">`).join('')}`);
  await writeFile(out, await page.screenshot());
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
  server?.kill();
}
