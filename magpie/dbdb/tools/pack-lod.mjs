#!/usr/bin/env node
/* pack-lod.mjs — GIVE THE ENGINE SOMETHING IT CAN ACTUALLY LOD.
 *
 * PlayCanvas 2.21 has a whole scene-level budget and level-of-detail
 * system for unified gsplats: app.scene.gsplat.splatBudget caps how
 * many Gaussians are DRAWN, and the engine spends that budget through
 * LOD, nearest first. We were setting it and nothing happened.
 *
 * The reason is in the engine: LOD is driven by `octree.lodLevels`,
 * and a `.compressed.ply` has no octree. Measured, in a nine-stamp
 * scene:
 *
 *     .compressed.ply   budget ignored — every splat drawn, always
 *     lod-meta.json     budget 120k -> 135k drawn (honoured)
 *
 * So the pack is converted to PlayCanvas's LOD format. Each element
 * becomes a four-level pyramid — full, half, quarter, eighth — as
 * splats/pack/lod/<id>/lod-meta.json. The engine then picks a level
 * per placement by distance and spends the frame budget across the
 * whole scene, smoothly, instead of us switching whole hedges off.
 *
 * This also makes the hand-cut `lite` pack redundant: LOD is the same
 * saving, chosen per stamp per frame rather than once for everybody.
 *
 * splat-transform v3.3.0 does decimation on the CPU. (An older note in
 * pack-lite.mjs says --decimate needs WebGPU; that was true of an
 * earlier version and is no longer.)
 *
 * Usage: node magpie/dbdb/tools/pack-lod.mjs [id ...]   (default: all)
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(HERE, '../splats/pack');
const OUT = path.join(PACK, 'lod');
const TMP = path.join(OUT, '_tmp');
const manifest = JSON.parse(fs.readFileSync(path.join(PACK, 'pack.json'), 'utf8'));

fs.mkdirSync(TMP, { recursive: true });
const st = args => execFileSync('npx',
  ['-y', '@playcanvas/splat-transform', '-w', '-q', '-g', 'cpu', ...args],
  { stdio: ['ignore', 'pipe', 'pipe'] });

const want = process.argv.slice(2);
const els = manifest.elements.filter(e => !want.length || want.includes(e.id));
const rows = [];

for (const el of els) {
  const src = path.join(PACK, el.file);
  const half = path.join(TMP, el.id + '.50.ply');
  const quarter = path.join(TMP, el.id + '.25.ply');
  const eighth = path.join(TMP, el.id + '.12.ply');
  const dst = path.join(OUT, el.id, 'lod-meta.json');
  fs.mkdirSync(path.dirname(dst), { recursive: true });

  st([src, '-d', '50%', half]);
  st([src, '-d', '25%', quarter]);
  st([src, '-d', '12.5%', eighth]);
  /* FOUR levels, not three. With three, the coarsest level is the floor
     the budget cannot go below — measured, the bottom three rungs of
     the quality ladder all landed within 15% of each other because
     they were all asking for less than a quarter-detail scene costs.
     An eighth level gives the ladder somewhere to go. */
  st([src, '-l', '0', half, '-l', '1', quarter, '-l', '2', eighth, '-l', '3', dst]);

  const meta = JSON.parse(fs.readFileSync(dst, 'utf8'));
  const bytes = du(path.dirname(dst));
  rows.push({ id: el.id, lods: meta.lodLevels, counts: meta.counts,
              was: fs.statSync(src).size, now: bytes });
  console.log(el.id.padEnd(12),
    meta.lodLevels + ' LODs', String(meta.counts.join('/')).padStart(20),
    ' ' + (fs.statSync(src).size / 1024 | 0) + 'K -> ' + (bytes / 1024 | 0) + 'K');
  fs.unlinkSync(half); fs.unlinkSync(quarter); fs.unlinkSync(eighth);
}
fs.rmSync(TMP, { recursive: true, force: true });

/* A manifest flag, so the page can prefer LOD and fall back without
   probing the network for something that may not be there.
   READ FROM DISK, not from this run: building a few elements by name
   used to REPLACE the list, which quietly dropped the other eighteen
   back to flat plys and turned the whole budget system off for them.
   What is on disk is the truth, and it self-corrects on deletion. */
const built = fs.readdirSync(OUT, { withFileTypes: true })
  .filter(d => d.isDirectory() && fs.existsSync(path.join(OUT, d.name, 'lod-meta.json')))
  .map(d => d.name).sort();
manifest.lod = { dir: 'lod', levels: 4, ids: built };
fs.writeFileSync(path.join(PACK, 'pack.json'), JSON.stringify(manifest, null, 1));

const was = rows.reduce((a, r) => a + r.was, 0), now = rows.reduce((a, r) => a + r.now, 0);
console.log('\n' + rows.length + ' elements · ' + (was / 1e6).toFixed(1) + 'MB -> '
  + (now / 1e6).toFixed(1) + 'MB on disk');
console.log('lod pack ->', OUT);

function du(dir) {
  let n = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true }))
    n += f.isDirectory() ? du(path.join(dir, f.name))
                         : fs.statSync(path.join(dir, f.name)).size;
  return n;
}
