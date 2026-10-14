# NoahWebsite

My personal website, built with Angular 22. It has several themes; the default is a three.js scene styled after the Skyrim loading screen.

## Themes

| Theme | Link |
| --- | --- |
| Skyrim loading screen (default) | https://noahsurprenant.com/ |
| Terminal (try `help`) | https://noahsurprenant.com/?theme=terminal |
| Xbox (the original dashboard) | https://noahsurprenant.com/?theme=xbox |
| Neon Genesis (title card and HUD) | https://noahsurprenant.com/?theme=mecha |

The cog in the top-left corner switches theme. A pick is remembered (localStorage) and put in the address bar, so the URL can be copied and sent. A `?theme=` link always wins over the remembered pick; unknown values fall back to it, then to Skyrim.

Each theme is a component under `src/app/themes/` that draws the whole page from the shared name and links in `src/app/links.ts`. To add one: create the component, add it to `THEMES` in `src/app/themes/themes.ts` and to the `@switch` in `app.component.html`, give the cog its colours under `[data-theme="..."]` in `src/styles.css`, and add it to `LAYOUT` in `e2e/smoke.spec.ts` and to the screenshot uploads in `.github/workflows/ci.yml`.

## Development

Requires Node 24 (Angular 22 needs `^22.22.3 || ^24.15.0`).

```sh
npm ci
npm start       # dev server at http://localhost:4200/
npm run build   # production build into dist/noah-website
npm test        # unit tests via Vitest (jsdom); add --coverage for the report
npm run e2e     # production build + browser smoke test (Playwright, Chromium)
```

The smoke test (`e2e/`) serves the production build with the `Content-Security-Policy` from `netlify.toml` (always enforced) and loads it in Chromium with software WebGL. It fails on page or console errors, CSP violations, requests to other origins, a blank canvas, or items that never switch. Run `npx playwright install chromium` once first, or point it at an installed Chromium with `CHROMIUM_PATH=/usr/bin/chromium npm run e2e`.

## Deployment

Netlify builds and deploys the site. The build command and publish directory are set in the Netlify UI; the Node version is pinned in `netlify.toml`.

GitHub Actions (`.github/workflows/ci.yml`) builds and tests every pull request and every push to `master`, and runs the browser smoke test in a separate job. Unit tests must cover 100% of the code (statements, branches, functions and lines; thresholds in `angular.json`), so a PR that adds untested code fails. jsdom has no WebGL, so the specs stand in for three.js's renderer and loaders with `vi.mock` and the fakes in `src/app/testing/`.

The browser tests also check every theme at six screen sizes (desktop, laptop, tablet and phone, the last two both ways up) for anything off screen or overlapping, and screenshot each one. CI turns those into one picture per theme and links them in a comment on the PR (updated on each push) and in the run summary, so a PR's look can be reviewed without checking it out. Locally they land in `screenshots/`; `node e2e/contact-sheets.mjs` makes the per-theme pictures.

## Dependency updates

Renovate runs monthly and opens one grouped PR for all dependency updates. Angular majors are split into their own PR, since they should be done with `ng update` so its migrations run.
