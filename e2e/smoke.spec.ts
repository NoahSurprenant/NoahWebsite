import { expect, Page, test } from '@playwright/test';

// Smoke test of the production build in a real browser, so a dependency bump that breaks the 3D
// scene (or starts needing something the CSP blocks) fails CI. The unit tests stub the scene out.
//
// The server (e2e/serve.mjs) sends the enforced CSP from netlify.toml.

const ICON_LINKS = ['LinkedIn', 'GitHub', 'Email', 'Resume (PDF)'];

/** Collects everything that should make the test fail, from the moment the page starts loading. */
async function watchForProblems(page: Page, origin: string) {
  const problems: string[] = [];
  const pending = new Set<unknown>();

  page.on('pageerror', (e) => problems.push(`Page error: ${e.stack ?? e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const { url, lineNumber } = m.location();
      problems.push(`Console error: ${m.text()}${url ? ` (${url}:${lineNumber})` : ''}`);
    }
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol !== 'blob:' && url.protocol !== 'data:' && url.origin !== origin) {
      problems.push(`Request to another origin: ${r.method()} ${r.url()}`);
    }
    pending.add(r);
  });
  page.on('requestfinished', (r) => pending.delete(r));
  page.on('requestfailed', (r) => {
    pending.delete(r);
    // Chromium sometimes reports a model fetch as net::ERR_ABORTED although the page got it (its
    // textures load straight after). A real abort rejects the fetch, which GLTFLoader logs as a
    // console error, and 404s and CSP blocks are caught by the other listeners.
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(`Request failed: ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });

  // CSP violations are also logged to the console, but the event names the directive and the URL
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations.push(`CSP violation: ${e.effectiveDirective} blocked ${e.blockedURI || '(inline)'} at ${e.sourceFile}:${e.lineNumber}`);
    });
  });

  return {
    /** Everything reported so far, CSP violations included. */
    async all() {
      const csp = await page
        .evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)
        .catch((e: Error) => [`Could not read the CSP violations: ${e.message}`]);
      return [...problems, ...csp];
    },
    /** Waits until no requests are in flight, e.g. for a model to finish downloading. */
    async settle() {
      await expect.poll(() => pending.size, { message: 'requests still in flight' }).toBe(0);
    },
  };
}

/** Number of visibly non-black pixels in the WebGL canvas (sampled at 1/4 size). */
function litPixels(page: Page) {
  return page.locator('app-skyrim-loading canvas').evaluate((canvas: HTMLCanvasElement) => {
    // The renderer keeps its drawing buffer (preserveDrawingBuffer), so it can be read back here
    const w = Math.max(1, Math.floor(canvas.width / 4));
    const h = Math.max(1, Math.floor(canvas.height / 4));
    const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && data[i] + data[i + 1] + data[i + 2] > 30) lit++;
    }
    return lit;
  });
}

test('the page loads, renders the 3D scene and cycles items, with the production CSP', async ({ page, baseURL }) => {
  const problems = await watchForProblems(page, new URL(baseURL!).origin);

  try {
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy'], 'the server sends the CSP').toContain("default-src 'self'");

    // The static content
    await expect(page.locator('.name')).toHaveText('Noah Surprenant');
    for (const name of ICON_LINKS) {
      const link = page.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link.locator('svg')).toBeVisible();
    }

    // The deferred scene: a caption, and a canvas with something drawn on it
    const caption = page.locator('app-skyrim-loading .caption');
    await expect(caption).toBeVisible();
    // "You got a cat" is the template's placeholder text, replaced by the real caption on render
    await expect(caption).not.toHaveText('You got a cat');
    await expect(caption).toHaveText(/\S.{40,}/);
    await expect.poll(() => litPixels(page), { message: 'the canvas draws non-black pixels', timeout: 30_000 }).toBeGreaterThan(100);
    await problems.settle();

    // Item cycling. Normally a loaded model glides to a new spot (11-19 units at 0.66 units/s), then
    // a 5-15 s interval switches the item: 20-45 s in all. With prefers-reduced-motion the app skips
    // the glide (the model appears at its target on the next frame), so the switch comes 5-15 s
    // later. The component checks the media query every frame, so turning it on now, after the scene
    // has loaded and rendered with motion, takes the same switch path without any test hooks.
    //
    // Playwright's fake clock (fastForward) would skip even that wait, but it also takes over
    // requestAnimationFrame, and SwiftShader needs ~1 s per frame for the 1M-triangle shopping cart.
    // Together they stalled the page for 20-50 s at a time when tried, so the test waits in real time.
    const firstCaption = await caption.textContent();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(caption, 'the item changes').not.toHaveText(firstCaption!, { timeout: 45_000 });
    await expect(caption).toHaveText(/\S.{40,}/);

    // The next item (usually another model) loads and draws without errors too
    await problems.settle();
    await expect.poll(() => litPixels(page), { message: 'the canvas still draws after the switch', timeout: 30_000 }).toBeGreaterThan(100);
  } finally {
    // Checked even when a step above failed, and reported instead of it: the cause (a 404, a CSP
    // violation, an exception) says more than the symptom (a blank canvas, a caption that never changes)
    expect(await problems.all(), 'errors, CSP violations or other-origin requests on the page').toEqual([]);
  }
});

// The 3D scene is only in the default theme, which the test above covers in depth
for (const theme of ['terminal', 'xbox', 'mecha']) {
  test(`?theme=${theme} shows that theme and every link, with the production CSP`, async ({ page, baseURL }) => {
    const problems = await watchForProblems(page, new URL(baseURL!).origin);
    try {
      await page.goto(`/?theme=${theme}`);
      await expect(page.locator(`app-${theme}-theme`)).toBeVisible();
      await expect(page.locator('app-skyrim-theme')).toHaveCount(0);
      for (const name of ICON_LINKS) {
        await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
      }
      await problems.settle();
    } finally {
      expect(await problems.all(), 'errors, CSP violations or other-origin requests on the page').toEqual([]);
    }
  });
}

test('the cog switches theme, puts it in the URL and remembers it', async ({ page, baseURL }) => {
  const problems = await watchForProblems(page, new URL(baseURL!).origin);
  try {
    await page.goto('/');
    await expect(page.locator('app-skyrim-theme')).toBeVisible();

    await page.getByRole('button', { name: 'Change theme' }).click();
    const menu = page.getByRole('group', { name: 'Themes' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Skyrim' })).toHaveAttribute('aria-pressed', 'true');
    await menu.getByRole('button', { name: 'Terminal' }).click();

    await expect(page.locator('app-terminal-theme')).toBeVisible();
    await expect(menu, 'picking a theme closes the menu').toBeHidden();
    expect(new URL(page.url()).searchParams.get('theme')).toBe('terminal');

    // The URL can be shared, and the pick is remembered without it
    await page.reload();
    await expect(page.locator('app-terminal-theme')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('app-terminal-theme')).toBeVisible();
    // A link still wins over the remembered pick
    await page.goto('/?theme=xbox');
    await expect(page.locator('app-xbox-theme')).toBeVisible();
    await problems.settle();
  } finally {
    expect(await problems.all(), 'errors, CSP violations or other-origin requests on the page').toEqual([]);
  }
});

// The screen sizes, by device; the name goes in each screenshot's file name, which the contact
// sheets use for order and captions. The "Activate Windows" watermark (April Fools' Day, on the
// desktop) is a joke overlay on top of everything, so the layout checks leave it out.
const SIZES = [
  ['desktop', 1920, 1080],
  ['laptop', 1280, 720],
  ['tablet-landscape', 1024, 768],
  ['tablet-portrait', 768, 1024],
  // A phone on its side with the browser's address and tab bars showing: little height is left
  ['phone-landscape', 820, 300],
  ['phone-portrait', 360, 640],
] as const;

// Per theme, the parts that must each be fully on screen and must not overlap one another.
// "text:" measures an element's text rather than its box, for right-aligned text in a wide box.
const LAYOUT: Record<string, string[]> = {
  // The name and each icon rather than the list, whose box spans the width on phones
  skyrim: ['.cog', 'text:app-skyrim-theme .name', 'app-skyrim-theme .list a', 'app-skyrim-loading .caption'],
  terminal: ['.cog', 'app-terminal-theme .screen'],
  xbox: ['.cog', 'app-xbox-theme .name', 'app-xbox-theme .orb', 'app-xbox-theme .menu', 'app-xbox-theme .buttons'],
  mecha: ['.cog', 'app-title-card h1', 'app-hud .panel', 'app-mecha-theme .console', 'app-banner'],
};

/** Every problem with the layout: parts off screen or overlapping, and links not fully visible. */
function layoutProblems(page: Page, selectors: string[]) {
  return page.evaluate((selectors) => {
    const problems: string[] = [];
    const boxes: { name: string; r: DOMRect }[] = [];
    const textBox = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };
    for (const entry of selectors) {
      const text = entry.startsWith('text:');
      const selector = text ? entry.slice(5) : entry;
      document.querySelectorAll(selector).forEach((el, i) => {
        const r = text ? textBox(el) : el.getBoundingClientRect();
        // Hidden at this size (display: none)
        if (r.width === 0 || r.height === 0) return;
        boxes.push({ name: `${selector}[${i}]`, r });
      });
    }
    const onScreen = (r: DOMRect) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    for (const { name, r } of boxes) {
      if (!onScreen(r)) problems.push(`${name} is off screen`);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        // Two panels of the same readout stack touch; only a real overlap counts
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        if (overlap) problems.push(`${boxes[i].name} overlaps ${boxes[j].name}`);
      }
    }
    document.querySelectorAll('a[aria-label]').forEach(a => {
      const r = a.getBoundingClientRect();
      if (r.width === 0 || !onScreen(r)) problems.push(`link ${a.getAttribute('aria-label')} is not fully on screen`);
    });
    return problems;
  }, selectors);
}

for (const [theme, selectors] of Object.entries(LAYOUT)) {
  test(`the ${theme} theme fits every screen size without overlaps`, async ({ page }) => {
    const problems: string[] = [];
    for (const [index, [device, width, height]] of SIZES.entries()) {
      await page.setViewportSize({ width, height });
      await page.goto(`/?theme=${theme}`);
      await expect(page.locator(`app-${theme}-theme`)).toBeVisible();
      if (theme === 'skyrim') await expect(page.locator('app-skyrim-loading .caption')).not.toHaveText('You got a cat');
      // Let the entrance animations finish and the web font arrive, both of which move things
      await page.waitForTimeout(2500);
      // For review: CI puts these on the PR (e2e/contact-sheets.mjs)
      await page.screenshot({ path: `screenshots/${theme}/${index + 1}-${device}-${width}x${height}.png` });
      const check = async (what: string) => {
        for (const p of await layoutProblems(page, selectors)) problems.push(`${width}x${height}${what}: ${p}`);
      };
      if (theme === 'mecha') {
        // The episode titles differ in length; every card has to fit
        const card = page.locator('app-title-card');
        for (let episode = 0; episode < 8; episode++) {
          await check(` (card "${await card.locator('.title').textContent()}")`);
          await card.click();
        }
      } else {
        await check('');
      }
    }
    expect(problems).toEqual([]);
  });
}

test('the Neon Genesis theme blacks out when its battery runs out, and the links still work', async ({ page }) => {
  // The battery lasts five minutes, so the clock is faked and fast-forwarded
  await page.clock.install();
  await page.goto('/?theme=mecha');
  await page.clock.runFor(1000);
  await page.clock.fastForward('04:59');

  const overlay = page.locator('app-power-down');
  const stage = async () => {
    await page.clock.runFor(200);
    return overlay.getAttribute('class');
  };
  await expect.poll(stage, { message: 'the screen goes dark' }).toContain('down');
  await expect(overlay).toContainText('ACTIVITY LIMIT REACHED');
  await expect(page.locator('app-hud .timer')).toHaveText('00:00:00');

  // The overlay lets clicks through: each link is still what's under the pointer
  for (const name of ICON_LINKS) {
    const link = page.getByRole('link', { name, exact: true });
    const box = (await link.boundingBox())!;
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('aria-label'), [box.x + box.width / 2, box.y + box.height / 2]);
    expect(hit, `${name} is clickable in the dark`).toBe(name);
  }

  await expect.poll(stage, { message: 'external power comes on' }).toContain('external');
  await expect(page.locator('app-hud .modes .on')).toHaveText('EXTERNAL');
  await expect.poll(stage, { message: 'and the countdown starts again' }).not.toMatch(/down|external/);
  await expect(page.locator('app-hud .timer')).toHaveText(/^04:5\d:\d\d$/);
});
