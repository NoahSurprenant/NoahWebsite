# NoahWebsite

My personal website: a three.js scene styled after the Skyrim loading screen, built with Angular 22.

## Development

Requires Node 24 (Angular 22 needs `^22.22.3 || ^24.15.0`).

```sh
npm ci
npm start       # dev server at http://localhost:4200/
npm run build   # production build into dist/noah-website
npm test        # unit tests via Vitest (jsdom)
```

## Deployment

Netlify builds and deploys the site. The build command and publish directory are set in the Netlify UI; the Node version is pinned in `netlify.toml`.

GitHub Actions (`.github/workflows/ci.yml`) builds and tests every pull request and every push to `master`.

## Dependency updates

Renovate runs monthly and opens one grouped PR for all dependency updates. Angular majors are split into their own PR, since they should be done with `ng update` so its migrations run.
