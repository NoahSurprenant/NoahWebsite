import { expect, Page, test } from '@playwright/test';
import { axeViolations } from './axe';

// The terminal after each of its commands, at three screen sizes: a screenshot of each
// (screenshots/terminal-commands/, one contact sheet with a row per command, put on the PR), and
// axe on each. /api/github and /api/visitors are answered by e2e/serve.mjs.

const SIZES = [
  ['desktop', 1920, 1080],
  ['tablet-portrait', 768, 1024],
  ['phone-portrait', 360, 640],
] as const;

/** What to do for each picture, named by the row it goes in */
const STEPS: [string, (page: Page) => Promise<void>][] = [
  ['help', page => run(page, 'help')],
  ['neofetch', page => run(page, 'neofetch')],
  ['ls-repos', page => run(page, 'ls repos/')],
  ['fetch', page => run(page, 'fetch PlayGrifball/GrifballWebApp')],
  ['contrib', async page => {
    await run(page, 'contrib');
    // Pick out a week, as hovering does
    const canvas = page.locator('app-ridge canvas').last();
    await canvas.focus();
    await canvas.press('ArrowUp');
  }],
  ['tab', async page => {
    await run(page, 'clear');
    await page.locator('.input-line input').fill('fetch h');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
  }],
  ['normal-mode', async page => {
    await run(page, 'pet');
    await page.keyboard.press('Escape');
    await page.keyboard.type(':theme');
  }],
];

async function run(page: Page, command: string) {
  const input = page.locator('.input-line input');
  await input.focus();
  await input.fill(command);
  await input.press('Enter');
}

for (const [device, width, height] of SIZES) {
  test(`terminal commands on a ${device} (${width}x${height}): screenshots and axe`, async ({ page }) => {
    // Seven commands, each with a screenshot and a full axe scan
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    await page.goto('/?theme=terminal');
    await expect(page.locator('.links a')).toHaveCount(4);
    const problems: string[] = [];
    for (const [index, [label, step]] of STEPS.entries()) {
      await step(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `screenshots/terminal-commands/${index + 1}-${device}-${width}x${height}--${label}.png` });
      for (const violation of await axeViolations(page)) problems.push(`${label}: ${violation}`);
    }
    expect(problems).toEqual([]);
  });
}
