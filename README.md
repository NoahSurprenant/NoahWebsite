# NoahWebsite

My personal website: a three.js scene styled after the Skyrim loading screen, built with Angular 22.

## Development

Requires Node 24 (Angular 22 needs `^22.22.3 || ^24.15.0`).

```sh
npm ci
npm start       # dev server at http://localhost:4200/
npm run build   # production build into dist/noah-website
npm test        # unit tests via Vitest (jsdom)
npm run e2e     # production build + browser smoke test (Playwright, Chromium)
```

The smoke test (`e2e/`) serves the production build with the `Content-Security-Policy` from `netlify.toml` (always enforced) and loads it in Chromium with software WebGL. It fails on page or console errors, CSP violations, requests to other origins, a blank canvas, or items that never switch. Run `npx playwright install chromium` once first, or point it at an installed Chromium with `CHROMIUM_PATH=/usr/bin/chromium npm run e2e`.

## Deployment

Netlify builds and deploys the site. The build command and publish directory are set in the Netlify UI; the Node version is pinned in `netlify.toml`.

GitHub Actions (`.github/workflows/ci.yml`) builds and tests every pull request and every push to `master`, and runs the browser smoke test in a separate job.

## Dependency updates

Renovate runs monthly and opens one grouped PR for all dependency updates. Angular majors are split into their own PR, since they should be done with `ng update` so its migrations run.
