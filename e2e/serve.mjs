// Tiny static server for the Playwright smoke test. It serves the production build and sends the
// Content-Security-Policy from netlify.toml, read at startup so the test always checks the policy
// that is actually deployed. It is always sent as the enforcing header (even if netlify.toml is
// switched to Report-Only), so anything the policy would block fails the test.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(repoRoot, 'dist', 'noah-website', 'browser');
const port = Number(process.env.PORT ?? 4300);

function readCsp(toml) {
  const matches = [...toml.matchAll(/^\s*Content-Security-Policy(?:-Report-Only)?\s*=\s*"([^"]+)"\s*$/gm)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Content-Security-Policy in netlify.toml, found ${matches.length}`);
  }
  return matches[0][1];
}

try {
  await stat(join(root, 'index.html'));
} catch {
  throw new Error(`No build in ${root}, run "npx ng build" first (npm run e2e does)`);
}

const csp = readCsp(await readFile(join(repoRoot, 'netlify.toml'), 'utf8'));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};

async function fileFor(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (path !== root && !path.startsWith(root + sep)) return undefined;
  try {
    const s = await stat(path);
    if (s.isFile()) return path;
    if (s.isDirectory()) return fileFor(join(urlPath, 'index.html'));
  } catch {
    // Not found
  }
  return undefined;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const path = await fileFor(pathname);
  if (!path) {
    res.writeHead(404, { 'Content-Security-Policy': csp, 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Security-Policy': csp,
    'Content-Type': types[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(await readFile(path));
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port} with CSP: ${csp}`);
});
