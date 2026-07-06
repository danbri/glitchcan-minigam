// test-editor-host.mjs — the document HOST features ported into the suite's
// Editor app (js/editor-host.js): My documents + autosave, Open (Examples /
// Research / file / URL), View source, and Save-to-GitHub (request shaping only,
// no network). Drives index.html#editor headlessly. No WebGL.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ndjson': 'application/x-ndjson', '.wasm': 'application/wasm' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/index.html`);
  await page.waitForFunction(() => document.querySelector('.menubar') && document.querySelectorAll('.rail button').length >= 7);

  // Enter the dedicated Editor app and wait for the host (titlebar + booted doc).
  await page.click('.rail button[data-nav="editor"]');
  await page.waitForSelector('.view[data-app="editor"] .eh-titlebar .eh-title');
  await page.waitForFunction(() => { const v = document.querySelector('.view[data-app="editor"]'); return v && v._host && v._host.doc; });

  ok('Editor app injects a document titlebar', await page.$('.view[data-app="editor"] .eh-titlebar .eh-title') != null);
  ok('host boots a document (welcome/restored)', await page.evaluate(() => !!document.querySelector('.view[data-app="editor"]')._host.doc));

  // 1) Autosave: title + content edits persist to the shared library.
  const MARK = 'PORTTEST-' + Date.now();
  const saved = await page.evaluate(async (mark) => {
    const host = document.querySelector('.view[data-app="editor"]')._host;
    host.titleEl.value = 'Port Test ' + mark;
    host.el.setContent(`<p>body ${mark}</p>`);
    host.el.dispatchEvent(new CustomEvent('edot-change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700)); // > 500ms debounce
    const docs = await host.library.listDocs();
    const d = docs.find((x) => x.title === 'Port Test ' + mark);
    return { found: !!d, html: d && d.html };
  }, MARK);
  ok('autosave writes title + content to the library', saved.found);
  ok('autosaved content round-trips', !!saved.html && saved.html.includes(MARK));

  // 2) My documents lists the saved doc, marks the current one.
  await page.evaluate(() => document.querySelector('.view[data-app="editor"]')._host.myDocuments());
  await page.waitForSelector('dialog.eh-dialog[open] .eh-list .eh-item');
  const mydocs = await page.evaluate((mark) => {
    const dlg = document.querySelector('dialog.eh-dialog[open]');
    const names = [...dlg.querySelectorAll('.eh-item-main .nm')].map((n) => n.textContent);
    return { titleMatch: names.some((n) => n === 'Port Test ' + mark), hasCurrent: !!dlg.querySelector('.eh-current'), count: names.length };
  }, MARK);
  ok('My documents lists the saved document', mydocs.titleMatch);
  ok('My documents marks the current document', mydocs.hasCurrent);
  await page.evaluate(() => document.querySelector('dialog.eh-dialog[open]').close());

  // 3) Open dialog shows Examples + a Research section, plus file/URL openers.
  await page.evaluate(() => document.querySelector('.view[data-app="editor"]')._host.openDialog());
  await page.waitForSelector('dialog.eh-dialog[open]');
  const open = await page.evaluate(() => {
    const dlg = document.querySelector('dialog.eh-dialog[open]');
    const groups = [...dlg.querySelectorAll('.eh-grp')].map((g) => g.textContent);
    const exampleRows = dlg.querySelectorAll('.eh-list .eh-item-main').length;
    const text = dlg.textContent;
    return { hasExamples: groups.some((g) => /Examples/.test(g)), hasResearch: groups.some((g) => /Research/.test(g)), exampleRows, hasFile: /Open a file/.test(text), hasUrl: /Open from URL/.test(text) };
  });
  ok('Open dialog lists Examples', open.hasExamples && open.exampleRows >= 1);
  ok('Open dialog has a Research section', open.hasResearch);
  ok('Open dialog offers file + URL openers', open.hasFile && open.hasUrl);
  await page.evaluate(() => document.querySelector('dialog.eh-dialog[open]').close());

  // 4) View source renders the document as Markdown/HTML/text.
  await page.evaluate(() => document.querySelector('.view[data-app="editor"]')._host.viewSource());
  await page.waitForSelector('dialog.eh-dialog[open] .eh-textarea');
  await page.waitForFunction(() => { const t = document.querySelector('dialog.eh-dialog[open] .eh-textarea'); return t && t.value.length > 0; }, null, { timeout: 4000 });
  const src = await page.evaluate(() => {
    const dlg = document.querySelector('dialog.eh-dialog[open]');
    return { hasText: dlg.querySelector('.eh-textarea').value.length > 0, hasFormats: dlg.querySelectorAll('select option').length >= 3, hasCopy: /Copy/.test(dlg.textContent) };
  });
  ok('View source renders the document text', src.hasText);
  ok('View source offers md/html/txt + copy', src.hasFormats && src.hasCopy);
  await page.evaluate(() => document.querySelector('dialog.eh-dialog[open]').close());

  // 5) Save to GitHub: dialog + honest request shaping (no network).
  await page.evaluate(() => document.querySelector('.view[data-app="editor"]')._host.saveToGitHub());
  await page.waitForSelector('dialog.eh-dialog[open]');
  const gh = await page.evaluate(() => {
    const host = document.querySelector('.view[data-app="editor"]')._host;
    const el = host.ghEl;
    const defaultPath = el.path.value; // derived from the title slug
    // Drive the parser exactly as Preview/Commit would, but without any fetch.
    el.repo.value = 'danbri/glitchcan-minigam'; el.path.value = 'notes.md'; el.token.value = 'ghp_' + 'x'.repeat(36);
    let parsed = null, err = null;
    try { parsed = host._ghParse(); } catch (e) { err = e.message; }
    const fields = ['repo', 'branch', 'path', 'token', 'message'].every((k) => !!el[k]);
    return { defaultPath, fields, parsed, err, hasPreview: !!el.preview, hasCommit: !!el.commit };
  });
  ok('Save to GitHub dialog has repo/branch/path/token/message fields', gh.fields && gh.hasPreview && gh.hasCommit);
  ok('default path is the title slug as its own folder', /\//.test(gh.defaultPath) && /\.md$/.test(gh.defaultPath));
  ok('a bare filename is foldered (notes.md → notes/notes.md)', gh.parsed && gh.parsed.path === 'notes/notes.md');
  ok('parser extracts owner/repo and branch', gh.parsed && gh.parsed.owner === 'danbri' && gh.parsed.repo === 'glitchcan-minigam' && !!gh.parsed.branch);
  await page.evaluate(() => document.querySelector('dialog.eh-dialog[open]').close());

  // 5b) Save to… — the unified Connections storage layer. Lists every storage
  //     mount (the real OPFS device today) plus GitHub-as-a-PR, and actually
  //     writes the document through the ResourceSource interface.
  await page.evaluate(() => {
    const host = document.querySelector('.view[data-app="editor"]')._host;
    host.el.setContent('<p>STORAGEMARK body</p>');
    host.titleEl.value = 'Storage Doc';
    host.saveToStorage();
  });
  await page.waitForSelector('dialog.eh-dialog[open] .eh-list .eh-item');
  const dest = await page.evaluate(() => {
    const dlg = document.querySelector('dialog.eh-dialog[open]');
    const labels = [...dlg.querySelectorAll('.eh-item-main .nm')].map((n) => n.textContent);
    return { hasDevice: labels.some((l) => /storage|device/i.test(l)), hasGithub: labels.some((l) => /github/i.test(l)) };
  });
  ok('Save to… lists the local device storage mount', dest.hasDevice);
  ok('Save to… folds GitHub (pull request) in as a destination', dest.hasGithub);
  await page.evaluate(() => {
    const dlg = document.querySelector('dialog.eh-dialog[open]');
    const radios = dlg.querySelectorAll('input[type=radio]'); radios[0].checked = true; radios[0].dispatchEvent(new Event('change'));
    const sel = dlg.querySelector('select'); sel.value = 'html'; sel.dispatchEvent(new Event('change'));
    dlg.querySelector('.eh-field input[type=text]').value = '/eh-test/storage-doc.html';
    dlg.querySelector('.eh-btn-primary').click();
  });
  await page.waitForFunction(() => { const r = document.querySelector('dialog.eh-dialog[open] .eh-result'); return r && !r.hidden; }, null, { timeout: 5000 });
  const back = await page.evaluate(async () => {
    const { getKernel } = await import('./js/edot-kernel.js');
    const src = getKernel().capabilities.invoke('storage.source', { id: 'device' });
    const bytes = await src.read('/eh-test/storage-doc.html');
    return new TextDecoder().decode(bytes);
  });
  ok('Save to… writes the document to the device (OPFS) mount, read back via ResourceSource', /STORAGEMARK/.test(back));
  await page.evaluate(() => document.querySelector('dialog.eh-dialog[open]')?.close());

  // 6) New document resets the surface.
  await page.evaluate(() => document.querySelector('.view[data-app="editor"]')._host.newDocument());
  await page.waitForFunction(() => document.querySelector('.view[data-app="editor"]')._host.titleEl.value === 'Untitled document');
  ok('New document opens a blank Untitled document', await page.evaluate(() => {
    const host = document.querySelector('.view[data-app="editor"]')._host;
    return host.titleEl.value === 'Untitled document' && /<p>(<br>)?<\/p>/.test(host.el.getContent());
  }));

  // 7) Command-registry parity: the toolbar's full formatting surface is now
  //    discoverable as editor.* commands (⌘K palette + Actions), and they run.
  const parity = await page.evaluate(async () => {
    const { getRegistry } = await import('./js/command-registry.js');
    const ids = getRegistry().contributions({ app: 'editor' }).map((c) => c.id);
    const want = ['editor.strike', 'editor.clearFormat', 'editor.h3', 'editor.blockquote',
      'editor.code', 'editor.indent', 'editor.outdent', 'editor.alignJustify', 'editor.tagSemantic'];
    return { present: want.every((id) => ids.includes(id)), count: ids.length };
  });
  ok('formatting commands (strike/indent/justify/quote/code/…) are in the registry', parity.present);
  const ran = await page.evaluate(async () => {
    const { getRegistry } = await import('./js/command-registry.js');
    const host = document.querySelector('.view[data-app="editor"]')._host;
    host.el.setContent('<p>parity</p>');
    const el = host.el.querySelector('.page'); const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus();
    getRegistry().run('editor.strike', { app: 'editor' });
    return host.el.getContent();
  });
  ok('running editor.strike via the registry strikes the selection', /<(s|strike|del)\b|text-decoration/i.test(ran));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs.slice(0, 4));
} finally {
  await browser.close();
  server.close();
}
console.log(fail ? '\nEDITOR-HOST FAIL' : '\nEDITOR-HOST OK');
process.exit(fail ? 1 : 0);
