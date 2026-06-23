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

  // 7. PDF export produces a valid, multi-object PDF.
  const pdf = await page.evaluate(async () => {
    const { htmlToPdf } = await import('./js/io-pdf.js');
    const long = Array.from({ length: 80 }, (_, i) => `<p>Paragraph number ${i} with some <strong>bold</strong> and <em>italic</em> words to force wrapping and page breaks across the document body.</p>`).join('');
    const blob = await htmlToPdf('<h1>Title</h1>' + long + '<ul><li>item</li></ul>', 'PDFTest');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return { size: buf.length, head: s.slice(0, 8), hasEOF: s.includes('%%EOF'), pages: (s.match(/\/Type \/Page[^s]/g) || []).length, hasXref: s.includes('\nxref\n') };
  });
  ok('pdf starts with %PDF-', pdf.head.startsWith('%PDF-'));
  ok('pdf ends with EOF', pdf.hasEOF);
  ok('pdf has xref + multiple pages', pdf.hasXref && pdf.pages >= 2);
  ok('pdf is substantial', pdf.size > 3000);

  // 8. Local document library persists across reloads (IndexedDB).
  const docId = await page.evaluate(async () => {
    const { Library } = await import('./js/library.js');
    const lib = await Library.create();
    const d = await lib.createDoc('Persisted Doc', '<p>library content</p>');
    return d.id;
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__edot);
  const persisted = await page.evaluate(async (id) => {
    const { Library } = await import('./js/library.js');
    const lib = await Library.create();
    const d = await lib.getDoc(id);
    return d && d.title === 'Persisted Doc' && /library content/.test(d.html);
  }, docId);
  ok('library persists docs across reload', persisted);
  ok('library reports a backend kind', await page.evaluate(() => /IndexedDB|localStorage/.test(window.__edot.library.kind)));

  // 9. RDFa attributes survive sanitize + HTML export.
  const rdfa = await page.evaluate(async () => {
    const { sanitizeHtml } = await import('./js/document-model.js');
    const { documentToHtml } = await import('./js/io-html.js');
    const dirty = '<p typeof="schema:Person"><span property="schema:name" onclick="x()">Ada</span></p>';
    const clean = sanitizeHtml(dirty);
    const full = documentToHtml(clean, 'Semantic');
    return { clean, full };
  });
  ok('rdfa property survives sanitize', /property="schema:name"/.test(rdfa.clean) && /typeof="schema:Person"/.test(rdfa.clean));
  ok('rdfa sanitize still drops handlers', !/onclick/.test(rdfa.clean));
  ok('html export declares vocab + prefixes', /vocab="https:\/\/schema.org\/"/.test(rdfa.full) && /prefix="schema:/.test(rdfa.full));

  // 9b. Paragraph alignment: sanitizer keeps only text-align; round-trips docx.
  const alignSan = await page.evaluate(async () => {
    const { sanitizeHtml } = await import('./js/document-model.js');
    return sanitizeHtml('<p style="text-align:center;color:red;position:fixed" onclick="x()">Hi</p>');
  });
  ok('sanitize keeps text-align only', /text-align: center/.test(alignSan) && !/color/.test(alignSan) && !/position/.test(alignSan) && !/onclick/.test(alignSan));

  const alignDocx = await page.evaluate(async () => {
    const { htmlToDocx, docxToHtml } = await import('./js/io-docx.js');
    const src = '<p style="text-align: center">Centered</p><h2 style="text-align: right">Righty</h2><p style="text-align: justify">Just</p>';
    const blob = await htmlToDocx(src, 'Align');
    const ab = await blob.arrayBuffer();
    // peek at document.xml for w:jc
    const { unzip, utf8 } = await import('./js/zip.js');
    const entries = await unzip(ab);
    const xml = utf8.decode(entries['word/document.xml']);
    const html = await docxToHtml(ab);
    return { xml, html };
  });
  ok('docx emits w:jc center+right+both', /w:jc w:val="center"/.test(alignDocx.xml) && /w:jc w:val="right"/.test(alignDocx.xml) && /w:jc w:val="both"/.test(alignDocx.xml));
  ok('docx import restores alignment', /text-align: center/.test(alignDocx.html) && /text-align: right/.test(alignDocx.html) && /text-align: justify/.test(alignDocx.html));

  const alignPdf = await page.evaluate(async () => {
    const { htmlToPdf } = await import('./js/io-pdf.js');
    const blob = await htmlToPdf('<p style="text-align:center">Centered line of text</p><p style="text-align:right">Right line</p>', 'AP');
    return (await blob.arrayBuffer()).byteLength;
  });
  ok('pdf with alignment renders', alignPdf > 800);

  // 9c. Find & replace over the live editor.
  const fr = await page.evaluate(async () => {
    document.getElementById('editor').innerHTML = '<p>foo bar foo baz foo</p>';
    window.__edot.editor.onChange();
    const f = window.__edot.findReplace;
    f.open(true);
    f.findInput.value = 'foo'; f.search();
    const count = f.matches.length;
    f.replaceInput.value = 'X'; f.replaceAll();
    const html = document.getElementById('editor').innerHTML;
    f.close();
    return { count, html };
  });
  ok('find locates all matches', fr.count === 3);
  ok('replace all replaces every match', !/foo/.test(fr.html) && (fr.html.match(/X/g) || []).length === 3);

  // 9d. DOCX with a table + embedded image: build a real fixture, import it.
  const docxRich = await page.evaluate(async () => {
    const { zipSync } = await import('./js/zip.js');
    const { docxToHtml } = await import('./js/io-docx.js');
    // 1x1 transparent PNG
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const bin = atob(pngB64);
    const png = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) png[i] = bin.charCodeAt(i);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const doc = `<?xml version="1.0"?>
<w:document ${NS}><w:body>
<w:p><w:r><w:t>Before table</w:t></w:r></w:p>
<w:tbl>
  <w:tr><w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr>
  <w:tr><w:tc><w:p><w:r><w:t>A2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:drawing><a:graphic><a:graphicData><a:blip r:embed="rId10"/></a:graphicData></a:graphic></w:drawing></w:r></w:p>
</w:body></w:document>`;
    const files = {
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': doc,
      'word/_rels/document.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
      'word/media/image1.png': png,
    };
    const blob = await zipSync(files);
    return docxToHtml(await blob.arrayBuffer());
  });
  ok('docx import renders a table', /<table>(?:<tbody>)?<tr><td>A1<\/td><td>B1<\/td><\/tr><tr><td>A2<\/td><td>B2<\/td><\/tr>(?:<\/tbody>)?<\/table>/.test(docxRich));
  ok('docx import embeds the image as data-URL', /<img src="data:image\/png;base64,iVBOR/.test(docxRich));
  ok('docx import keeps document order (text, table, image)',
    docxRich.indexOf('Before table') < docxRich.indexOf('<table>') && docxRich.indexOf('<table>') < docxRich.indexOf('<img'));

  // 9e. Table round-trips: HTML -> DOCX -> HTML, and HTML -> Markdown.
  const tableTrip = await page.evaluate(async () => {
    const { htmlToDocx, docxToHtml } = await import('./js/io-docx.js');
    const { htmlToMarkdown } = await import('./js/io-markdown.js');
    const src = '<table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>';
    const docx = await htmlToDocx(src, 'T');
    const back = await docxToHtml(await docx.arrayBuffer());
    const md = htmlToMarkdown(src);
    return { back, md };
  });
  ok('docx export+import preserves a table', /<table>.*<td>a<\/td><td>b<\/td>.*<\/table>/s.test(tableTrip.back));
  ok('markdown export emits a GFM table', /\| H1 \| H2 \|/.test(tableTrip.md) && /\| --- \| --- \|/.test(tableTrip.md) && /\| a \| b \|/.test(tableTrip.md));

  // 9f. Sanitizer keeps tables/images but still strips danger.
  const sanTbl = await page.evaluate(async () => {
    const { sanitizeHtml } = await import('./js/document-model.js');
    return sanitizeHtml('<table onclick="x()"><tr><td colspan="2" style="color:red">c</td></tr></table>' +
      '<img src="data:image/png;base64,AAAA" onerror="x()"><img src="data:text/html,evil">');
  });
  ok('sanitizer keeps table + colspan', /<table>(?:<tbody>)?<tr><td colspan="2">c<\/td><\/tr>(?:<\/tbody>)?<\/table>/.test(sanTbl));
  ok('sanitizer keeps data:image but drops handlers + data:text/html',
    /<img src="data:image\/png;base64,AAAA">/.test(sanTbl) && !/onclick|onerror|data:text\/html/.test(sanTbl));

  // 9g. URL resolution: git hosting links rewrite to raw, plain URLs pass through.
  const urls = await page.evaluate(async () => {
    const { resolveSourceUrl, filenameFromUrl } = await import('./js/open-url.js');
    const r = {};
    r.ghBlob = resolveSourceUrl('https://github.com/danbri/glitchcan-minigam/blob/master/magpie/edot/README.md');
    r.ghRaw = resolveSourceUrl('https://raw.githubusercontent.com/o/r/main/a/b.md');
    r.gist = resolveSourceUrl('https://gist.github.com/user/abc123');
    r.gitlab = resolveSourceUrl('https://gitlab.com/o/r/-/blob/main/doc.md');
    r.bitbucket = resolveSourceUrl('https://bitbucket.org/o/r/src/main/doc.md');
    r.plain = resolveSourceUrl('https://example.org/a/page.html');
    let threw = false; try { resolveSourceUrl('not a url'); } catch { threw = true; }
    r.threw = threw;
    r.fnPath = filenameFromUrl('https://x/y/report.docx');
    r.fnCt = filenameFromUrl('https://gist.githubusercontent.com/u/i/raw', 'text/markdown');
    return r;
  });
  ok('github blob -> raw.githubusercontent', urls.ghBlob.url === 'https://raw.githubusercontent.com/danbri/glitchcan-minigam/master/magpie/edot/README.md' && urls.ghBlob.provider === 'github' && urls.ghBlob.corsRisk === false);
  ok('raw github passes through (no cors risk)', urls.ghRaw.provider === 'github' && urls.ghRaw.corsRisk === false);
  ok('gist -> gist raw', /gist\.githubusercontent\.com\/user\/abc123\/raw/.test(urls.gist.url));
  ok('gitlab blob -> raw', urls.gitlab.url.includes('/-/raw/') && urls.gitlab.corsRisk === true);
  ok('bitbucket src -> raw', urls.bitbucket.url.includes('/raw/'));
  ok('plain cross-origin url flagged corsRisk', urls.plain.provider === 'web' && urls.plain.corsRisk === true);
  ok('invalid url throws', urls.threw === true);
  ok('filename from path keeps extension', urls.fnPath === 'report.docx');
  ok('filename from content-type when no ext', /\.md$/.test(urls.fnCt));

  // 9h. Examples manifest is wired and includes the Morton book.
  ok('examples manifest present', await page.evaluate(async () => {
    const { EXAMPLES } = await import('./js/examples.js');
    return EXAMPLES.length >= 1 && EXAMPLES.some((e) => e.local && /searching-for-logic\.docx$/.test(e.src));
  }));

  // 9i. Multi-instance hygiene: destroy() leaves no accumulated global DOM.
  const teardown = await page.evaluate(async () => {
    const count = () => ({
      live: document.querySelectorAll('[aria-live]').length,
      bars: document.querySelectorAll('.find-bar').length,
      toasts: document.querySelectorAll('.toast').length,
    });
    const before = count();
    const { App } = await import('./js/edot-app.js');
    window.__edot.destroy();
    window.__edot = new App();
    await new Promise((r) => setTimeout(r, 150));
    const after = count();
    return { before, after };
  });
  ok('destroy()+reinstantiate does not leak DOM',
    teardown.after.live === teardown.before.live &&
    teardown.after.bars === teardown.before.bars &&
    teardown.after.toasts === teardown.before.toasts);

  // 9j. Diff engine: detects edits/additions and collapses context to gaps.
  const diff = await page.evaluate(async () => {
    const { diffLines, diffStats, collapse } = await import('./js/diff.js');
    const d = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne');
    const s = diffStats(d);
    const big = collapse(diffLines(
      Array.from({ length: 50 }, (_, i) => 'L' + i).join('\n'),
      Array.from({ length: 50 }, (_, i) => (i === 25 ? 'CHANGED' : 'L' + i)).join('\n')), 2);
    return { add: s.add, del: s.del, hasGap: big.some((r) => r.type === 'gap') };
  });
  ok('diff counts edits + additions', diff.add === 2 && diff.del === 1);
  ok('diff collapses unchanged runs into gaps', diff.hasGap);

  // 9k. git-remote: unicode base64 + mocked commit-via-PR sequence/payloads.
  const git = await page.evaluate(async () => {
    const { GitHubRemote, commitViaPullRequest, utf8ToB64, b64ToUtf8 } = await import('./js/git-remote.js');
    const round = b64ToUtf8(utf8ToB64('héllo — wörld\n€ 𝄞')) === 'héllo — wörld\n€ 𝄞';
    const calls = [];
    const fake = async (url, opts) => {
      const body = opts.body ? JSON.parse(opts.body) : null;
      calls.push({ url, method: opts.method, body, auth: opts.headers.Authorization });
      const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
      if (/\/contents\//.test(url) && opts.method === 'GET') return j({ sha: 'OLDSHA', encoding: 'base64', content: btoa('old') });
      if (/\/git\/ref\/heads\//.test(url)) return j({ object: { sha: 'BASESHA' } });
      if (/\/git\/refs$/.test(url)) return j({});
      if (/\/contents\//.test(url) && opts.method === 'PUT') return j({ commit: { sha: 'C' } });
      if (/\/pulls$/.test(url)) return j({ number: 42, html_url: 'https://github.com/o/r/pull/42' });
      return j({});
    };
    const { branch, pr } = await commitViaPullRequest(new GitHubRemote('TKN', fake),
      { owner: 'o', repo: 'r', path: 'docs/a.md', baseBranch: 'main', message: 'msg', contentText: 'new text', title: 't', body: 'b' });
    const put = calls.find((c) => c.method === 'PUT');
    const ref = calls.find((c) => c.method === 'POST' && /git\/refs$/.test(c.url));
    const pull = calls.find((c) => /pulls$/.test(c.url));
    return {
      round, prNumber: pr.number, branch,
      putContent: put && atob(put.body.content), putSha: put && put.body.sha, putBranch: put && put.body.branch,
      refOk: ref && ref.body.ref === `refs/heads/${branch}`,
      prHead: pull && pull.body.head, prBase: pull && pull.body.base, auth: put && put.auth,
    };
  });
  ok('git base64 round-trips unicode (incl. astral)', git.round);
  ok('git PUT commits decoded content', git.putContent === 'new text');
  ok('git PUT uses existing sha + new branch', git.putSha === 'OLDSHA' && git.putBranch === git.branch);
  ok('git creates branch ref off base', git.refOk);
  ok('git PR head=branch, base=main', git.prHead === git.branch && git.prBase === 'main');
  ok('git authorizes with bearer token', git.auth === 'Bearer TKN');
  ok('git returns the PR number', git.prNumber === 42);

  // 9l. exportText: source-format string; binary formats blocked.
  const ex = await page.evaluate(async () => {
    const IO = await import('./js/io.js');
    const md = await IO.exportText('<h1>T</h1><p><strong>b</strong></p>', 'Doc', 'md');
    let blocked = false; try { await IO.exportText('<p>x</p>', 'D', 'docx'); } catch { blocked = true; }
    return { md, blocked, isText: IO.isTextFormat('md') && !IO.isTextFormat('docx') };
  });
  ok('exportText returns source-format markdown', /^# T/m.test(ex.md) && /\*\*b\*\*/.test(ex.md));
  ok('exportText blocks binary formats', ex.blocked && ex.isText);

  // 9m. Symbol-font logic glyphs decode to Unicode (not tofu squares).
  const sym = await page.evaluate(async () => {
    const { decodeSymbolText, decodeSymbolFont, isSymbolFont } = await import('./js/symbol-font.js');
    return {
      pua: decodeSymbolText('\uF022x \uF0C9 \uF024y'), // PUA decoded regardless of font
      full: decodeSymbolFont('"$É'),                   // Symbol-font byte range -> ∀ ∃ ⊃
      ascii: decodeSymbolText('Cat', { full: false }),      // non-symbol ASCII untouched
      isSym: isSymbolFont('SymbolMT') && isSymbolFont('Symbol') && !isSymbolFont('Georgia'),
    };
  });
  ok('symbol PUA decodes to logic glyphs', /^∀x ⊃ ∃y$/.test(sym.pua));
  ok('symbol-font byte range decodes ∀∃⊃', sym.full === '∀∃⊃');
  ok('non-symbol ASCII is left intact', sym.ascii === 'Cat');
  ok('isSymbolFont matches Symbol/SymbolMT only', sym.isSym);

  const symDoc = await page.evaluate(async () => {
    const { zipSync } = await import('./js/zip.js');
    const { docxToHtml } = await import('./js/io-docx.js');
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const doc = `<?xml version="1.0"?><w:document ${NS}><w:body>` +
      '<w:p><w:r><w:rPr><w:rFonts w:ascii="Symbol"/></w:rPr><w:t>"</w:t></w:r>' +
      '<w:r><w:t>x is happy</w:t></w:r></w:p></w:body></w:document>';
    const files = {
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': doc,
    };
    return docxToHtml(await (await zipSync(files)).arrayBuffer());
  });
  ok('docx Symbol-font run imports ∀ (not a square)', /∀x is happy/.test(symDoc));

  // 10. LibreOffice bridge reports not-configured gracefully.
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
