// test-e2e.mjs — drives the real UI controls end-to-end (not module imports):
// new document, typing, toolbar formatting, File-menu exports as real
// downloads, and switching documents through the library dialog.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Root the static server at the repo root and load the page at its real path,
// so relative links (incl. the ../../third_party/ example) resolve exactly as
// they do under GitHub Pages.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => { try { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html'; const buf = await readFile(path.join(ROOT, rel)); res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(buf); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, r)); const port = server.address().port;
const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
try {
  const ctx = await b.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/edot.html`);
  await page.waitForFunction(() => !!window.__edot && !!window.__edot.doc);

  // Start a fresh document so we type into a clean <p> block.
  await page.click('#menu-button'); await page.click('#mi-new'); await page.waitForTimeout(200);

  // Type into the editor surface.
  await page.click('#editor');
  await page.keyboard.type('Hello office world');
  await page.waitForTimeout(700); // allow autosave
  ok('typed text shows word count', /3 words/.test(await page.textContent('#stat-words')));

  // Bold via toolbar toggles aria-pressed AND emits a tag (not a styled span).
  await page.keyboard.press('Control+a');
  await page.click('button[data-cmd="bold"]');
  ok('bold button pressed', await page.getAttribute('button[data-cmd="bold"]', 'aria-pressed') === 'true');
  ok('bold uses a tag, not a styled span', await page.evaluate(() => {
    const h = document.getElementById('editor').innerHTML;
    return /<(b|strong)>/i.test(h) && !/style=/.test(h);
  }));

  // Name the doc so we can find it later in the library.
  await page.fill('#doc-title', 'Hello Doc');
  await page.waitForTimeout(700);

  // Export as PDF through the File menu -> real download.
  await page.click('#menu-button');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Save as PDF')]);
  ok('PDF download filename ends .pdf', /\.pdf$/.test(dl.suggestedFilename()));

  // Export DOCX too.
  await page.click('#menu-button');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=Save as Word')]);
  ok('DOCX download filename ends .docx', /\.docx$/.test(dl2.suggestedFilename()));

  // New document via menu, then switch back via library dialog.
  await page.click('#menu-button'); await page.click('#mi-new'); await page.waitForTimeout(300);
  ok('new doc resets word count', (await page.textContent('#stat-words')).startsWith('0'));

  await page.evaluate(() => window.__edot.openLibrary());
  await page.waitForTimeout(250);
  ok('library lists >=2 docs', (await page.$$('#docs-list .doc-row')).length >= 2);

  // Re-open the named doc precisely and confirm its content + bold come back.
  await page.click('.doc-open:has-text("Hello Doc")');
  await page.waitForTimeout(300);
  ok('reopened doc restores text', /Hello office world/.test(await page.textContent('#editor')));
  ok('reopened doc kept bold tag', await page.evaluate(() => /<(b|strong)>/i.test(document.getElementById('editor').innerHTML)));
  ok('title field shows reopened name', (await page.inputValue('#doc-title')) === 'Hello Doc');

  // Alignment button applies text-align and reflects pressed state.
  await page.click('#editor');
  await page.keyboard.press('Control+a');
  await page.click('button[data-cmd="alignCenter"]');
  ok('align-center button pressed', await page.getAttribute('button[data-cmd="alignCenter"]', 'aria-pressed') === 'true');
  ok('editor block is centered', await page.evaluate(() => {
    const b = document.querySelector('#editor p, #editor h1, #editor h2, #editor h3');
    return b && /center/.test(b.style.textAlign);
  }));

  // Find bar opens with Ctrl+F and counts matches.
  await page.evaluate(() => { document.getElementById('editor').innerHTML = '<p>alpha beta alpha</p>'; window.__edot.editor.onChange(); });
  await page.click('#editor');
  await page.keyboard.press('Control+f');
  await page.waitForTimeout(150);
  ok('find bar is visible', await page.isVisible('.find-bar'));
  await page.fill('#find-input', 'alpha');
  await page.waitForTimeout(150);
  ok('find shows 1/2 count', /\/2/.test(await page.textContent('#find-count')));
  await page.keyboard.press('Escape');
  ok('find bar closes on Escape', !(await page.isVisible('.find-bar')));

  // Examples dialog lists and loads the Morton book (same-origin docx import).
  await page.click('#menu-button'); await page.click('#mi-examples'); await page.waitForTimeout(150);
  ok('examples dialog lists the Morton book', await page.isVisible('text=Searching for Logic'));
  await page.click('.doc-open:has-text("Searching for Logic")');
  await page.waitForFunction(() => /Searching for Logic|searching for logic/i.test(document.getElementById('editor').textContent), null, { timeout: 20000 });
  ok('example loaded with tables', await page.evaluate(() => document.querySelectorAll('#editor table').length > 5));
  ok('example title set', /logic/i.test(await page.inputValue('#doc-title')));

  // Close document → fresh blank surface.
  await page.click('#menu-button'); await page.click('#mi-close'); await page.waitForTimeout(300);
  ok('close yields an empty document', (await page.textContent('#stat-words')).startsWith('0'));
  ok('close titles it Untitled', /Untitled/.test(await page.inputValue('#doc-title')));

  // Open-from-URL dialog: opens and validates bad input.
  await page.click('#menu-button'); await page.click('#mi-url'); await page.waitForTimeout(150);
  ok('url dialog opens', await page.isVisible('#url-input'));
  await page.fill('#url-input', 'not a url');
  await page.click('#url-open'); await page.waitForTimeout(100);
  ok('url dialog shows a validation error', await page.isVisible('#url-error'));
  await page.keyboard.press('Escape');

  // Save to GitHub dialog, driven against a mocked api.github.com.
  await page.evaluate(() => {
    const orig = window.fetch;
    window.fetch = async (url, opts = {}) => {
      if (String(url).startsWith('https://api.github.com')) {
        const m = opts.method || 'GET';
        const j = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
        if (/\/contents\//.test(url) && m === 'GET') return j({ sha: 'S', encoding: 'base64', content: btoa('# old heading\n') });
        if (/\/git\/ref\/heads\//.test(url)) return j({ object: { sha: 'B' } });
        if (/\/git\/refs$/.test(url)) return j({});
        if (/\/contents\//.test(url) && m === 'PUT') return j({ commit: { sha: 'C' } });
        if (/\/pulls$/.test(url)) return j({ number: 7, html_url: 'https://github.com/o/r/pull/7' });
        return j({});
      }
      return orig(url, opts);
    };
  });
  await page.evaluate(() => { document.getElementById('editor').innerHTML = '<h1>New heading</h1><p>edited body</p>'; window.__edot.editor.onChange(); });
  await page.click('#menu-button'); await page.click('#mi-github'); await page.waitForTimeout(150);
  ok('github dialog opens', await page.isVisible('#gh-repo'));
  await page.fill('#gh-repo', 'o/r'); await page.fill('#gh-branch', 'main');
  await page.fill('#gh-path', 'docs/x.md'); await page.fill('#gh-token', 'tok');
  await page.click('#gh-preview'); await page.waitForTimeout(250);
  ok('github preview renders a diff', (await page.$$('#gh-diff .row')).length > 0);
  ok('github diffstat shows counts', /[+−]\d/.test(await page.textContent('#gh-diffstat')));
  await page.click('#gh-commit'); await page.waitForTimeout(300);
  ok('github commit opens a PR link', /#7/.test(await page.textContent('#gh-result')));

  // Non-text path is rejected with a clear error.
  await page.fill('#gh-path', 'image.docx');
  await page.click('#gh-preview'); await page.waitForTimeout(120);
  ok('github rejects binary save-back', await page.isVisible('#gh-error'));
  await page.keyboard.press('Escape');

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await b.close(); server.close(); }
console.log(fail ? `\n${fail} E2E FAILURE(S)` : '\nE2E OK');
process.exit(fail ? 1 : 0);
