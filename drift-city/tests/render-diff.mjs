// Renders the same views with two builds of the city (Node Dawn, dawn-run.mjs) and compares the pixels, so a
// change meant to be invisible (a performance change) can be proved invisible, or its difference seen.
//   node drift-city/tests/render-diff.mjs <old city.html> <new city.html> <outdir> [view ...]
// Views: street (HOP=place:street_1), high (FREEALT=2: 2 km up), night (HOP=place:street_1 TOD=3), cellar
// (HOP=place:lantern_cellar). Writes <outdir>/<view>-old.png, -new.png, -diff.png (differences x8) and prints the
// mean and 99th-percentile absolute difference per channel, on 0..255. Needs ImageMagick for the PNGs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [oldPage, newPage, out, ...views0] = process.argv.slice(2);
const VIEWS = { street: { HOP: 'place:street_1' }, high: { FREEALT: '2' }, night: { HOP: 'place:street_1', TOD: '3' }, cellar: { HOP: 'place:lantern_cellar' } };
const views = views0.length ? views0 : Object.keys(VIEWS);
fs.mkdirSync(out, { recursive: true });
function render(page, env, tag) {
  const dir = join(out, tag);
  fs.mkdirSync(dir, { recursive: true });
  const txt = execFileSync('node', [join(here, 'dawn-run.mjs')], { env: { ...process.env, PAGE: page, OUT: dir, W: '400', H: '300', DPR: '1', FRAMES: '40', FREEZE: '1', ...env }, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 1800000 });
  const err = (txt.match(/errors (.*)/) || [])[1] || '?';
  const j = JSON.parse(fs.readFileSync(join(dir, 'frame.json')));
  return { px: fs.readFileSync(join(dir, 'frame.rgb')), w: j.w, h: j.h, err, gpu: (txt.match(/GPU work ([\d.]+) ms: scene ([\d.]+)/) || []).slice(1).map(Number) };
}
const png = (buf, w, h, file) => {
  fs.writeFileSync(file + '.ppm', Buffer.concat([Buffer.from(`P6 ${w} ${h} 255\n`), buf]));
  try { execFileSync('convert', [file + '.ppm', file]); fs.unlinkSync(file + '.ppm'); } catch { /* keep the PPM */ }
};
for (const v of views) {
  const a = render(oldPage, VIEWS[v], v + '-old'), b = render(newPage, VIEWS[v], v + '-new');
  const n = Math.min(a.px.length, b.px.length), diffs = new Uint8Array(n), d = Buffer.alloc(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const x = Math.abs(a.px[i] - b.px[i]); diffs[i] = x; sum += x; d[i] = Math.min(255, x * 8); }
  const sorted = Array.from(diffs).sort((x, y) => x - y);
  png(a.px, a.w, a.h, join(out, v + '-old.png')); png(b.px, b.w, b.h, join(out, v + '-new.png')); png(d, a.w, a.h, join(out, v + '-diff.png'));
  console.log(`${v}: mean ${(sum / n).toFixed(2)}, p99 ${sorted[Math.floor(n * 0.99)]}, max ${sorted[n - 1]}; errors old "${a.err}" new "${b.err}"; GPU old ${a.gpu.join('/')} new ${b.gpu.join('/')} ms (total/scene)`);
}
