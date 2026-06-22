import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'edot.html';
    const buf = await readFile(path.join(DIR, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/edot.html`);
await page.waitForFunction(() => !!window.__edot);

// Generate a representative PDF and pull the bytes out as a base64 string.
const b64 = await page.evaluate(async () => {
  const { htmlToPdf } = await import('./js/io-pdf.js');
  const html = `<h1>edot — PDF export</h1>
  <p>This document exercises <strong>bold</strong>, <em>italic</em>, <a href="https://example.org">links</a>, and long paragraphs that must wrap across the printable width of the A4 page to prove the line-breaking engine works correctly without overflowing the margins.</p>
  <h2>A bulleted list</h2><ul><li>First item</li><li>Second item with more text to wrap</li><li>Third</li></ul>
  <h2>An ordered list</h2><ol><li>Step one</li><li>Step two</li></ol>
  <blockquote><p>A block quote, indented with a coloured bar.</p></blockquote>
  <h3>Some code</h3><pre><code>function hello() {\n  return 42;\n}</code></pre>
  <hr>
  ${Array.from({ length: 60 }, (_, i) => `<p>Filler paragraph ${i} to push content onto additional pages and verify automatic page breaking and the cross-reference table remain valid.</p>`).join('')}`;
  const blob = await htmlToPdf(html, 'edot PDF verification');
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
});

const bytes = Buffer.from(b64, 'base64');
await writeFile('/tmp/edot-sample.pdf', bytes);
console.log(`PDF written: ${bytes.length} bytes`);

// ---- structural validation ----
const s = bytes.toString('latin1');
let fail = 0;
const chk = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

chk('header %PDF-', s.startsWith('%PDF-'));
chk('single %%EOF at end', s.trimEnd().endsWith('%%EOF'));

// Parse startxref + xref table, verify each offset lands on "N 0 obj".
const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(s.trimEnd() + '\n');
chk('startxref present', !!sx);
const xrefPos = sx ? +sx[1] : -1;
chk('startxref points at "xref"', s.slice(xrefPos, xrefPos + 4) === 'xref');

const xrefBlock = s.slice(xrefPos);
const m = /xref\s+0\s+(\d+)\s+([\s\S]*?)\s*trailer/.exec(xrefBlock);
chk('xref table parses', !!m);
let offsetsValid = true;
if (m) {
  const count = +m[1];
  const rows = m[2].trim().split('\n').map((l) => l.trim());
  chk('xref count matches size', rows.length === count);
  // row 0 is the free head; rows 1..n-1 are object offsets
  for (let i = 1; i < rows.length; i++) {
    const off = parseInt(rows[i].slice(0, 10), 10);
    const at = s.slice(off, off + 20);
    if (!new RegExp(`^${i} 0 obj`).test(at)) { offsetsValid = false; break; }
  }
}
chk('every xref offset lands on its object', offsetsValid);

// trailer -> Root -> Catalog -> Pages chain
const tr = /trailer\s*<<([\s\S]*?)>>/.exec(s);
const rootNo = tr && /\/Root\s+(\d+)\s+0\s+R/.exec(tr[1]);
chk('trailer has /Root', !!rootNo);
const catalog = rootNo && new RegExp(`\\n${rootNo[1]} 0 obj\\s*<<([\\s\\S]*?)>>`).exec(s);
chk('Root resolves to a Catalog', catalog && /\/Type\s*\/Catalog/.test(catalog[1]));
const pagesNo = catalog && /\/Pages\s+(\d+)\s+0\s+R/.exec(catalog[1]);
const pagesObj = pagesNo && new RegExp(`\\n${pagesNo[1]} 0 obj\\s*<<([\\s\\S]*?)>>`).exec(s);
chk('Catalog -> Pages node', pagesObj && /\/Type\s*\/Pages/.test(pagesObj[1]));
const kidCount = pagesObj && /\/Count\s+(\d+)/.exec(pagesObj[1]);
const kids = pagesObj && /\/Kids\s*\[([^\]]*)\]/.exec(pagesObj[1]);
const kidRefs = kids ? (kids[1].match(/\d+ 0 R/g) || []).length : 0;
chk('Pages /Count matches /Kids length', kidCount && +kidCount[1] === kidRefs && kidRefs >= 2);

// content stream /Length values match actual stream bytes
let lenOk = true;
const re = /<< \/Length (\d+) >>\s*stream\n([\s\S]*?)\nendstream/g;
let mm, nStreams = 0;
while ((mm = re.exec(s))) { nStreams++; if (Buffer.byteLength(mm[2], 'latin1') !== +mm[1]) lenOk = false; }
chk(`content /Length matches bytes (${nStreams} streams)`, lenOk && nStreams >= 2);

// ---- attempt a visual render (full Chromium may show the PDF viewer) ----
try {
  const pv = await browser.newPage();
  await pv.goto('file:///tmp/edot-sample.pdf', { timeout: 8000 }).catch(() => {});
  await pv.waitForTimeout(1500);
  await pv.screenshot({ path: '/tmp/edot-pdf-render.png' });
  console.log('render screenshot attempted -> /tmp/edot-pdf-render.png');
} catch (e) { console.log('render attempt skipped:', e.message); }

await browser.close();
server.close();
console.log(fail ? `\n${fail} PDF VALIDATION FAILURE(S)` : '\nPDF structurally valid');
process.exit(fail ? 1 : 0);
