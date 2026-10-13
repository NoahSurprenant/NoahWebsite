// Puts the e2e layout test's screenshots (screenshots/<theme>/<width>x<height>.png) side by side,
// one contact sheet per theme (screenshots/<theme>.png), so a PR's look can be reviewed at a
// glance. CI uploads each sheet unzipped, which GitHub shows in the browser.
import { chromium } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'screenshots';
// Every screenshot is scaled to this height, so desktops and phones line up
const HEIGHT = 360;

const themes = (await readdir(dir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
const browser = await chromium.launch({ executablePath: process.env['CHROMIUM_PATH'] || undefined });
const page = await browser.newPage({ viewport: { width: 1800, height: 600 } });

for (const theme of themes) {
  const files = (await readdir(join(dir, theme))).filter(f => f.endsWith('.png'));
  // Widest first
  files.sort((a, b) => parseInt(b) - parseInt(a));
  const shots = await Promise.all(files.map(async file => {
    const data = (await readFile(join(dir, theme, file))).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${file.replace('.png', '')}</figcaption></figure>`;
  }));
  await page.setContent(`<!doctype html>
    <style>
      body { margin: 0; padding: 24px; background: #222; color: #eee; font: 16px system-ui, sans-serif; width: fit-content; }
      h1 { margin: 0 0 16px; font-size: 24px; }
      main { display: flex; flex-wrap: wrap; gap: 16px; max-width: 1752px; }
      figure { margin: 0; }
      img { display: block; height: ${HEIGHT}px; outline: 1px solid #555; }
      figcaption { margin-top: 4px; color: #aaa; }
    </style>
    <h1>${theme}</h1>
    <main>${shots.join('')}</main>`);
  await page.locator('body').screenshot({ path: join(dir, `${theme}.png`) });
  console.log(`${dir}/${theme}.png: ${files.length} screenshots`);
}

await browser.close();
