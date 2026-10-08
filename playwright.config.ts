import { defineConfig, devices } from '@playwright/test';

// Browser smoke test of the production build (npm run e2e builds it first). See e2e/smoke.spec.ts.
const port = 4300;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  // One retry at most, so a one-off hiccup on a shared runner doesn't fail the PR but a real
  // breakage (which fails every time) still does
  retries: 1,
  timeout: 90_000,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // A system Chromium can be used instead of Playwright's download, e.g. CHROMIUM_PATH=/usr/bin/chromium
          executablePath: process.env['CHROMIUM_PATH'] || undefined,
          // Software WebGL, so the scene renders on machines without a GPU (CI runners)
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://127.0.0.1:${port}/`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
