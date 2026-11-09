// Lighthouse CI (https://github.com/GoogleChrome/lighthouse-ci), run by the lighthouse job in
// .github/workflows/ci.yml once per preset: LIGHTHOUSE_PRESET=mobile|desktop. It audits every theme
// of the production build, served by e2e/serve.mjs with the CSP from netlify.toml (which also
// answers /api/github and /api/visitors, the Netlify functions).
// (Not LHCI_*: lhci reads those environment variables as its own options.)
//
// Accessibility, best practices and SEO must be 100 on every theme. Performance is reported against
// 98 on desktop and 80 on mobile (an emulated mid-range phone on slow 4G) but only warns: the 3D
// themes render with software WebGL on the runner, which says little about real devices.
const desktop = process.env.LIGHTHOUSE_PRESET === 'desktop';
const port = 4300;

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node e2e/serve.mjs',
      startServerReadyPattern: 'Serving',
      url: ['skyrim', 'terminal', 'xbox', 'mecha'].map(theme => `http://127.0.0.1:${port}/?theme=${theme}`),
      // A single mobile run varies a lot on a shared runner; take the median of three
      numberOfRuns: desktop ? 1 : 3,
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        chromeFlags: '--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'categories:performance': ['warn', { minScore: desktop ? 0.98 : 0.8 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
