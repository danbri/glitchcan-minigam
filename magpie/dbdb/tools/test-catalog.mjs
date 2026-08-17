#!/usr/bin/env node
/* test-catalog.mjs — the catalogue page, checked against the pack.
 *
 * A catalogue that quietly shows 33 of 34 elements, or loses a credit,
 * is worse than none: it becomes the thing people trust. So this asserts
 * the page against pack.json itself — every element carded, every
 * thumbnail present and non-empty, every credit rendered, the facets
 * filtering, and the detail view actually putting a splat on screen.
 *
 * Usage: node magpie/dbdb/tools/test-catalog.mjs      (npm run test:catalog)
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const PORT = 8977;
const pack = JSON.parse(fs.readFileSync(path.join(HERE, '../splats/pack/pack.json'), 'utf8'));

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.ply': 'application/octet-stream', '.sog': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  fs.readFile(path.join(ROOT, u), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails.push(msg); };

/* every thumbnail exists on disk before the browser is even started —
   a broken <img> is invisible in a headless screenshot */
const thumbs = path.join(HERE, '../splats/pack/thumbs');
const missing = pack.elements.filter(e => {
  const f = path.join(thumbs, e.id + '.jpg');
  return !fs.existsSync(f) || fs.statSync(f).size < 2000;
});
ok(missing.length === 0, `thumbnails present for all ${pack.elements.length} elements`
  + (missing.length ? ' — missing/tiny: ' + missing.map(e => e.id).join(', ') : ''));

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
/* the CDN-first-vendored-fallback is the house pattern, and this container
   cannot reach jsdelivr. That failure is EXPECTED and is not a page error;
   everything else is. */
const expected = u => (u || '').includes('cdn.jsdelivr.net');
pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
pg.on('console', m => {
  if (m.type() === 'error' && !expected(m.location()?.url)) errs.push('console: ' + m.text().slice(0, 200));
});
pg.on('requestfailed', r => { if (!expected(r.url())) errs.push('404/failed: ' + r.url().split('/').pop()); });

await pg.goto(`http://localhost:${PORT}/magpie/dbdb/catalog.html`);
await pg.waitForSelector('.card', { timeout: 60000 });

const cards = await pg.$$eval('.card .id', ns => ns.map(n => n.textContent));
ok(cards.length === pack.elements.length,
  `${cards.length} cards for ${pack.elements.length} elements`);
const absent = pack.elements.map(e => e.id).filter(id => !cards.includes(id));
ok(absent.length === 0, 'no element missing from the grid' + (absent.length ? ': ' + absent : ''));

/* the thumbnails really decoded, not just requested */
const broken = await pg.$$eval('.card img', imgs =>
  imgs.filter(i => i.complete && i.naturalWidth === 0).length);
ok(broken === 0, 'every thumbnail decoded in the page');

const tally = await pg.textContent('#tally');
ok(/\b34\b|\b\d+\b/.test(tally) && tally.includes('gaussians'), `tally reads: ${tally.trim()}`);

/* attribution is a licence condition, not decoration */
const creditText = await pg.textContent('#credits');
const scenes = [...new Set(pack.elements.map(e => e.credit).filter(Boolean))];
ok(scenes.every(c => creditText.includes(c.split(' · ')[0])),
  `all ${scenes.length} source credits shown in the footer`);

/* search narrows, and a facet chip narrows */
await pg.fill('#q', 'rust');
await pg.waitForTimeout(200);
const rusty = await pg.$$eval('.card .id', ns => ns.map(n => n.textContent));
ok(rusty.length > 0 && rusty.length < cards.length, `search "rust" -> ${rusty.length} cards`);
await pg.fill('#q', '');
await pg.waitForTimeout(200);

const chip = await pg.$('.chips .chip');
const chipName = await chip.textContent();
await chip.click();
await pg.waitForTimeout(200);
const faceted = await pg.$$eval('.card .id', ns => ns.length);
ok(faceted > 0 && faceted < cards.length, `facet "${chipName}" -> ${faceted} cards`);
await chip.click();
await pg.waitForTimeout(200);

/* the detail view must put a real splat on screen, not an empty canvas */
await pg.click('.card');
await pg.waitForSelector('dialog[open]', { timeout: 20000 });
const title = await pg.textContent('#dTitle');
ok(pack.elements.some(e => e.id === title.trim()), `detail opened for "${title.trim()}"`);
const rows = await pg.$$eval('#dTable tr', rs => rs.length);
ok(rows >= 8, `detail table has ${rows} rows`);

/* Count lit pixels from a SCREENSHOT of the view, not from the canvas.
   drawImage() on a WebGL canvas without preserveDrawingBuffer comes back
   blank once the frame is composited — a check written that way reports
   "nothing rendered" about a picture the user can plainly see. */
const view = pg.locator('.view');
let litPct = 0;
for (let i = 0; i < 30 && litPct < 1; i++) {
  await pg.waitForTimeout(4000);
  const png = 'data:image/png;base64,' + (await view.screenshot()).toString('base64');
  litPct = await pg.evaluate(async u => {
    const im = await createImageBitmap(await (await fetch(u)).blob());
    const cv = new OffscreenCanvas(im.width, im.height), g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data;
    let lit = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { n++; if (d[i] + d[i+1] + d[i+2] > 48) lit++; }
    return 100 * lit / n;
  }, png);
}
ok(litPct >= 1, `live view rendered the element (${litPct.toFixed(1)}% of the view is lit)`);

await pg.screenshot({ path: path.join(HERE, 'catalog-check.png'), fullPage: false });
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));

await b.close(); srv.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
