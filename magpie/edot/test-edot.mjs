// test-edot.mjs — headless smoke test for the edot editor.
// Serves the folder, loads edot.html in Chromium, then exercises the format
// round-trips and core editing through the real browser DOM.
//
// Run:  node magpie/edot/test-edot.mjs

import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript' };

const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'edot.html';
    const buf = await readFile(path.join(DIR, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let failures = 0;
const ok = (name, cond) => { console.log(`${cond ? '✅' : '❌'} ${name}`); if (!cond) failures++; };

try {
  const page = await browser.newPage();
  const errors = [];
  // Ignore the browser's automatic /favicon.ico probe — not an app error.
  const isNoise = (t) => /favicon\.ico/.test(t) || /status of 404.*favicon/.test(t);
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.location().url + m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', () => {});

  await page.goto(`${base}/edot.html`);
  await page.waitForFunction(() => !!window.__edot);

  // 1. App boots, toolbar built, welcome content present.
  ok('app boots', await page.evaluate(() => !!window.__edot));
  ok('toolbar has buttons', await page.evaluate(() => document.querySelectorAll('#toolbar .tbtn').length > 8));
  ok('roving tabindex: one tab stop', await page.evaluate(() =>
    Array.from(document.querySelectorAll('#toolbar .tbtn')).filter((b) => b.tabIndex === 0).length === 1));
  ok('editor is contenteditable textbox', await page.evaluate(() => {
    const e = document.getElementById('editor');
    return e.getAttribute('contenteditable') === 'true' && e.getAttribute('role') === 'textbox';
  }));

  // 2. Markdown round-trip through the real module.
  const mdRoundtrip = await page.evaluate(async () => {
    const { markdownToHtml, htmlToMarkdown } = await import('./js/io-markdown.js');
    const md = '# Title\n\nSome **bold** and *italic* and `code`.\n\n- one\n- two\n\n> a quote\n';
    const html = markdownToHtml(md);
    const back = htmlToMarkdown(html);
    return { html, back };
  });
  ok('markdown -> html has h1', /<h1>Title<\/h1>/.test(mdRoundtrip.html));
  ok('markdown -> html has strong/em/code', /<strong>bold<\/strong>/.test(mdRoundtrip.html) && /<em>italic<\/em>/.test(mdRoundtrip.html) && /<code>code<\/code>/.test(mdRoundtrip.html));
  ok('markdown -> html has list', /<ul><li>one<\/li><li>two<\/li><\/ul>/.test(mdRoundtrip.html));
  ok('html -> markdown preserves heading', /^# Title/m.test(mdRoundtrip.back));
  ok('html -> markdown preserves bold', /\*\*bold\*\*/.test(mdRoundtrip.back));

  // 3. DOCX round-trip: HTML -> docx blob -> unzip -> back to HTML.
  const docx = await page.evaluate(async () => {
    const { htmlToDocx, docxToHtml } = await import('./js/io-docx.js');
    const src = '<h1>Doc Title</h1><p>Hello <strong>bold</strong> and <em>italic</em> and <u>under</u>.</p><ul><li>alpha</li><li>beta</li></ul><ol><li>first</li></ol><blockquote><p>quoted</p></blockquote>';
    const blob = await htmlToDocx(src, 'Test');
    const ab = await blob.arrayBuffer();
    const html = await docxToHtml(ab);
    return { size: blob.size, html };
  });
  ok('docx blob is non-trivial', docx.size > 800);
  ok('docx -> html keeps heading', /<h1>Doc Title<\/h1>/.test(docx.html));
  ok('docx -> html keeps bold', /<strong>bold<\/strong>/.test(docx.html));
  ok('docx -> html keeps italic', /<em>italic<\/em>/.test(docx.html));
  ok('docx -> html keeps underline', /<u>under<\/u>/.test(docx.html));
  ok('docx -> html keeps bullet list', /<ul><li>alpha<\/li><li>beta<\/li><\/ul>/.test(docx.html));
  ok('docx -> html keeps numbered list', /<ol><li>first<\/li><\/ol>/.test(docx.html));
  ok('docx -> html keeps blockquote text', /quoted/.test(docx.html));

  // 4. ZIP layer integrity (CRC + deflate/inflate via streams).
  const zipOk = await page.evaluate(async () => {
    const { zipSync, unzip, utf8 } = await import('./js/zip.js');
    const payload = 'x'.repeat(5000) + ' the quick brown fox';
    const blob = await zipSync({ 'a.txt': payload, 'dir/b.txt': 'short' });
    const entries = await unzip(await blob.arrayBuffer());
    return utf8.decode(entries['a.txt']) === payload && utf8.decode(entries['dir/b.txt']) === 'short';
  });
  ok('zip round-trip (deflate+store)', zipOk);

  // 5. Sanitizer drops scripts/styles, keeps structure.
  const sanit = await page.evaluate(async () => {
    const { sanitizeHtml } = await import('./js/document-model.js');
    return sanitizeHtml('<p onclick="x()">hi<script>alert(1)<\/script></p><style>x{}</style><b>bold</b>');
  });
  ok('sanitizer removes scripts', !/script|alert|onclick|style/i.test(sanit));
  ok('sanitizer keeps content', /hi/.test(sanit) && /<b>bold<\/b>/.test(sanit));

  // 6. Typing updates word count and dirty state.
  await page.click('#editor');
  await page.evaluate(() => { document.getElementById('editor').innerHTML = '<p>one two three four five</p>'; window.__edot.editor.onChange(); });
  await page.waitForTimeout(50);
  ok('word count reflects content', /5 words/.test(await page.textContent('#stat-words')));

  // 7. LibreOffice bridge reports not-configured gracefully.
  const loState = await page.evaluate(async () => {
    const LO = await import('./js/libreoffice-bridge.js');
    let code = null;
    try { await LO.convert(new Uint8Array([1]), 'odt', 'pdf'); } catch (e) { code = e.code; }
    return { configured: LO.isConfigured(), code };
  });
  ok('LibreOffice reports unconfigured', loState.configured === false && loState.code === 'NO_BACKEND');

  ok('no console errors', errors.length === 0);
  if (errors.length) console.log('   errors:', errors);

} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
