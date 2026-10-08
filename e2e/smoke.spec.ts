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
