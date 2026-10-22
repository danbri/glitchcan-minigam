// Static server for the runner tests. It behaves like GitHub Pages in the ways the
// runner depends on: the repository is served under /glitchcan-minigam/ (stories use
// absolute /glitchcan-minigam/... paths), Access-Control-Allow-Origin: * (module scripts
// in opaque-origin frames are CORS requests), JavaScript MIME types for .mjs, and 404 for
// /favicon.ico at the root. It also serves .ma as application/miniapp-pkg+zip, which
// Pages does not.
//
//   node magpie/miniapps/test/serve.mjs [port]
//   -> http://127.0.0.1:<port>/glitchcan-minigam/magpie/miniapps/runner.html
//   import { serve } from './serve.mjs'; const s = await serve(0); s.url; s.close();
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PREFIX = '/glitchcan-minigam';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ink': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.ma': 'application/miniapp-pkg+zip', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon',
};

export function serve(port = 0, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path !== PREFIX && !path.startsWith(PREFIX + '/')) { res.statusCode = 404; return res.end(); }   // as on danbri.github.io
    let file = join(repo, path.slice(PREFIX.length));
    if (!file.startsWith(repo)) { res.statusCode = 403; return res.end(); }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, host, () => {
    const url = `http://${host}:${server.address().port}${PREFIX}`;
    ok({ url, server, close: () => new Promise((r) => server.close(r)) });
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve(Number(process.argv[2] || 8765));
  console.log(`serving ${repo} at ${s.url}/`);
}
