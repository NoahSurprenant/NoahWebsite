import { expect, test } from '@playwright/test';
import { axeViolations } from './axe';

// Accessibility: axe (https://github.com/dequelabs/axe-core) on every theme at a computer's size and
// a phone's, and on the terminal after each of its commands (e2e/terminal.spec.ts). Any violation
// fails, listed with the elements it was found on.

const SIZES = [
  ['desktop', 1920, 1080],
  ['phone', 360, 640],
] as const;

for (const theme of ['skyrim', 'terminal', 'xbox', 'mecha']) {
  for (const [device, width, height] of SIZES) {
    test(`axe finds nothing in ?theme=${theme} on a ${device}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height });
      await page.goto(`/?theme=${theme}`);
      await expect(page.locator(`app-${theme}-theme`)).toBeVisible();
      await page.waitForTimeout(1500);
      expect(await axeViolations(page, `${theme}, ${device}`)).toEqual([]);
    });
  }
}
