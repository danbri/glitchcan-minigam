#!/usr/bin/env node
/* pack-lod.mjs — four-level LOD pyramids for the pack.
 *
 * PlayCanvas's splat budget and LOD system are driven by an octree that
 * only the LOD format carries; with plain .compressed.ply every knob of it
 * is inert. This builds lod-meta.json pyramids so those knobs do something.
 *
 * The measurements behind that, and what the budget actually does, are in
 * the splat-discovery skill.
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

/* the manifest list is READ FROM DISK, never from this run — building a few
   by name used to replace it and silently un-LOD the rest (skill) */
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
