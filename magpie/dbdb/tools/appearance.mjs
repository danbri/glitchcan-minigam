#!/usr/bin/env node
/* appearance.mjs — derived appearance tags, and near-duplicate detection.
 *
 * Measures every pack element off its thumbnail and its recorded dims and
 * writes a `appearance` block into pack.json: palette, tone, form, mass,
 * cover, and a dHash used to flag near-duplicate pairs.
 *
 * DERIVED, never judged: this tool must not touch subjects.json, which is
 * human judgement. That rule, the hue calibration, the duplicate thresholds
 * and what they caught are in the splat-catalogue skill (§2-§4).
 *
 * Usage:
 *   node magpie/dbdb/tools/appearance.mjs            # report only
 *   node magpie/dbdb/tools/appearance.mjs --write    # into pack.json
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(HERE, '../splats/pack/pack.json');
const THUMBS = path.resolve(HERE, '../splats/pack/thumbs');
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');

const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));

const b = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'] });
const pg = await b.newPage();

/* in the page, because Node cannot decode a webp */
const measure = async (file) => {
  const u = 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64');
  return pg.evaluate(async (url) => {
    const im = await createImageBitmap(await (await fetch(url)).blob());
    const cv = new OffscreenCanvas(im.width, im.height), g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data;
    const W = im.width, H = im.height;

    /* lit = above the backdrop, whose brightest pixel is 27+34+40 */
    let lit = 0, sr = 0, sg = 0, sb = 0, topMass = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
    const hues = new Array(12).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2];
      if (r + gg + bb <= 125) continue;
      lit++; sr += r; sg += gg; sb += bb;
      if (y < H / 2) topMass++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx - mn > 26) {                     /* only coloured pixels vote */
        let h = 0;
        if (mx === r) h = ((gg - bb) / (mx - mn) + 6) % 6;
        else if (mx === gg) h = (bb - r) / (mx - mn) + 2;
        else h = (r - gg) / (mx - mn) + 4;
        hues[Math.floor(h * 2) % 12]++;
      }
    }
    if (!lit) return null;

    /* dHash: 9x8, each pixel against its right neighbour */
    const s = new OffscreenCanvas(9, 8), sg2 = s.getContext('2d');
    sg2.drawImage(im, 0, 0, 9, 8);
    const sd = sg2.getImageData(0, 0, 9, 8).data;
    let hash = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const a = (y * 9 + x) * 4, c = (y * 9 + x + 1) * 4;
      const la = sd[a] + sd[a + 1] + sd[a + 2], lc = sd[c] + sd[c + 1] + sd[c + 2];
      hash += la > lc ? '1' : '0';
    }
    const n = lit;
    return {
      lit: lit / (W * H),
      rgb: [sr / n / 255, sg / n / 255, sb / n / 255],
      hues, topShare: topMass / n,
      box: [(x1 - x0) / W, (y1 - y0) / H],
      hash: BigInt('0b' + hash).toString(16).padStart(16, '0')
    };
  }, u);
};

/* green starts at the yellow-green bucket — foliage renders at hue
   ~1.5-2.5 of 6, and a naive naming calls a fern "yellow" (skill §3) */
const HUE_NAME = ['red', 'orange', 'yellow', 'green', 'green', 'green',
  'cyan', 'cyan', 'blue', 'violet', 'magenta', 'red'];

const rows = [];
for (const el of pack.elements) {
  const f = path.join(THUMBS, el.id + '.webp');
  if (!fs.existsSync(f)) { console.log(`  ${el.id.padEnd(12)} no thumbnail — run npm run splat:thumbs`); continue; }
  const m = await measure(f);
  if (!m) { console.log(`  ${el.id.padEnd(12)} thumbnail is empty`); continue; }

  const [W, H, D] = el.dims;
  const [r, g, bl] = m.rgb;
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  const light = (r + g + bl) / 3;
  const top = m.hues.indexOf(Math.max(...m.hues));
  const warm = ['red', 'orange', 'yellow'].includes(HUE_NAME[top]);
  const palette = sat < 0.12 ? 'grey'
    : warm && light < 0.46 ? 'brown'
    : HUE_NAME[top];
  const tone = light < 0.30 ? 'dark' : light < 0.58 ? 'mid' : 'bright';
  const foot = Math.max(W, D);
  const form = H > foot * 1.6 ? 'tall'
    : H > foot * 0.8 ? 'upright'
    : H > foot * 0.28 ? 'squat' : 'flat';
  const volume = Math.max(0.2, W * H * D);
  const perM3 = el.count / volume;
  const mass = perM3 < 300 ? 'sparse' : perM3 < 3000 ? 'medium' : 'dense';

  const appearance = { palette, tone, form, mass,
    light: +light.toFixed(3), sat: +sat.toFixed(3),
    perM3: Math.round(perM3), cover: +m.lit.toFixed(3),
    topHeavy: +m.topShare.toFixed(2), hash: m.hash };
  rows.push({ el, appearance });
  console.log(`  ${el.id.padEnd(12)} ${palette.padEnd(7)} ${tone.padEnd(6)} ${form.padEnd(8)}`
    + `${mass.padEnd(7)} ${String(Math.round(perM3)).padStart(6)}/m3  ${m.hash}`);
}

/* near-duplicates: a pair must fail BOTH tests, picture and box (skill §4) */
const bits = h => BigInt('0x' + h);
const dist = (a, b) => { let x = bits(a) ^ bits(b), n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const near = [];
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const A = rows[i], B = rows[j];
  const d = dist(A.appearance.hash, B.appearance.hash);
  const sim = A.el.dims.map((v, k) => Math.min(v, B.el.dims[k]) / Math.max(v, B.el.dims[k]));
  const geom = sim.reduce((a, b) => a * b, 1);
  if (d <= 12 && geom > 0.82) near.push({ a: A.el.id, b: B.el.id, d, geom: +geom.toFixed(2),
    scene: A.el.scene === B.el.scene });
}

console.log(`\n${rows.length} elements measured`);
if (near.length) {
  console.log(`\n${near.length} near-duplicate pair(s) — REPORTED, NOT REMOVED:`);
  for (const p of near.sort((x, y) => x.d - y.d))
    console.log(`  ${p.a} ~ ${p.b}   hash distance ${String(p.d).padStart(2)} · box match ${p.geom}`
      + (p.scene ? ' · same source scene' : ' · DIFFERENT scenes'));
  console.log('\n  A pair here is a question, not a verdict: fern/fern2/fern3 are one');
  console.log('  cut at three densities on purpose. Check before touching anything.');
} else console.log('\nno near-duplicates above threshold');

const counts = k => rows.reduce((m, r) => (m[r.appearance[k]] = (m[r.appearance[k]] || 0) + 1, m), {});
for (const k of ['palette', 'tone', 'form', 'mass'])
  console.log(`\n${k}: ` + Object.entries(counts(k)).sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v} ${n}`).join(' · '));

if (WRITE) {
  for (const { el, appearance } of rows)
    pack.elements.find(e => e.id === el.id).appearance = appearance;
  pack.appearanceNote = 'DERIVED, not judged: measured from the thumbnail render and the '
    + 'recorded dims by tools/appearance.mjs. Rewritable at any time. The hand-written '
    + 'judgement lives in subjects.json and is never touched by this tool.';
  fs.writeFileSync(PACK, JSON.stringify(pack, null, 1) + '\n');
  console.log('\nwritten into pack.json');
}
await b.close();
