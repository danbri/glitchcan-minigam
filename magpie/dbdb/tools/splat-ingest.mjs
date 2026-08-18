#!/usr/bin/env node
/* splat-ingest.mjs — take a downloaded scan and make it clippable.
 *
 * Reads the licence off the scene page (or the HF repo tag), refuses
 * anything not open, thins the scan to a working weight, writes
 * splats/<name>.sog and a PlayCanvas viewer, and prints the entries a
 * person must paste. It stops before registering the scene: the up-axis and
 * the name are judgements.
 *
 * WHY the gate is applied twice, and why the official viewer rather than a
 * hand-rolled one: the splat-discovery skill.
 *
 * Usage:
 *   node magpie/dbdb/tools/splat-ingest.mjs <hash> <name> [--keep 200000]
 *   node magpie/dbdb/tools/splat-ingest.mjs hf:<owner>/<repo>/<file> <name>
 *   # after: put the downloaded file at splats/incoming/<hash>.<ext>
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPLATS = path.resolve(HERE, '../splats');
const IN = path.join(SPLATS, 'incoming');
const argv = process.argv.slice(2);
const [hash, name] = argv.filter(a => !a.startsWith('--'));
const ki = argv.indexOf('--keep');
const KEEP = ki < 0 ? 200000 : parseInt(argv[ki + 1], 10);

if (!hash || !name) {
  console.error('usage: splat-ingest.mjs <hash|hf:repo/file> <name> [--keep N]');
  process.exit(2);
}
fs.mkdirSync(IN, { recursive: true });

const st = a => execFileSync('npx', ['-y', '@playcanvas/splat-transform', '-w', '-q', '-g', 'cpu', ...a],
  { stdio: ['ignore', 'pipe', 'pipe'] });

/* PlayCanvas's own viewer, not a hand-rolled one (splat-discovery skill) */
function makeViewer(sog, name) {
  const dir = path.join(SPLATS, 'view');
  fs.mkdirSync(dir, { recursive: true });
  const html = path.join(dir, name + '.html');
  st([sog, html]);
  return html;
}

/* Hugging Face: no account gate, so this branch really fetches. The tag is
   recorded as the uploader's CLAIM, with the repo named (skill §1a). */
if (hash.startsWith('hf:')) {
  const spec = hash.slice(3);
  const m = /^([^/]+\/[^/]+)\/(.+)$/.exec(spec);
  if (!m) { console.error('expected hf:<owner>/<repo>/<path>'); process.exit(2); }
  const [, repo, file] = m;
  const meta = await fetch(`https://huggingface.co/api/models/${repo}`,
    { headers: { 'User-Agent': 'glitchcan-minigam splat ingest' } })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const lic = (meta?.tags || []).find(t => t.startsWith('license:'))?.slice(8) || null;
  const OPEN = /^(mit|apache-2\.0|bsd-[23]-clause|unlicense|cc0-1\.0|cc-by-4\.0|cc-by-sa-4\.0)$/;
  console.log(`${repo} · ${file}`);
  console.log(`licence claimed by the uploader: ${lic || 'NONE'}`);
  if (!lic || !OPEN.test(lic) || meta?.gated || meta?.private) {
    console.error('\nREFUSED. No open licence declared on that repo.');
    process.exit(1);
  }
  const url = `https://huggingface.co/${repo}/resolve/main/${file.split('/').map(encodeURIComponent).join('/')}`;
  const dst = path.join(IN, name + path.extname(file));
  const res = await fetch(url, { headers: { 'User-Agent': 'glitchcan-minigam splat ingest' } });
  if (!res.ok) { console.error('fetch failed: HTTP ' + res.status); process.exit(1); }
  fs.writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${(fs.statSync(dst).size / 1e6).toFixed(1)}MB -> incoming/${path.basename(dst)}`);

  const out = path.join(SPLATS, name + '.sog');
  const tmp = path.join(IN, name + '.tmp.ply');
  st([dst, tmp]);
  const head = fs.readFileSync(tmp, { encoding: 'latin1' }).slice(0, 4096);
  const total = +(/element vertex (\d+)/.exec(head)?.[1] || 0);
  /* decimation must WRITE a .ply — splat-transform refuses "-d ... x.sog"
     with "output must be .ply". So thin first, then convert. */
  if (total > KEEP) {
    const thin = path.join(IN, name + '.thin.ply');
    st([tmp, '-d', String(KEEP), thin]); st([thin, out]); fs.unlinkSync(thin);
  } else st([tmp, out]);
  fs.unlinkSync(tmp);
  console.log(`${total} -> ${Math.min(total, KEEP)} gaussians · `
    + `${(fs.statSync(out).size / 1e6).toFixed(1)}MB -> splats/${name}.sog`);
  console.log('look at it: splats/view/' + name + '.html  (PlayCanvas\'s own viewer)');
  makeViewer(out, name);
  console.log(`
SRC entry for splatpack.mjs (the up-axis is a judgement — look first):
   ${name}: { src: 'splats/${name}.sog', up: [0, -1, 0],
     credit: '${file.replace(/\.[^.]+$/, '')} · ${repo} (Hugging Face) · ${lic} (uploader's claim)' },
`);
  process.exit(0);
}

/* 1. THE TERMS, FROM THE SCENE PAGE ITSELF.
   The explore API carries a structured `downloads.enabled` but is only
   searchable by text, not by hash — a lookup by hash 404s. The scene
   page always carries the authoritative thing anyway: the rel=license
   link the author set. And the download gate has already been applied
   by the site, because that file could not have been fetched at all
   unless the author had offered it. So: read the licence, refuse
   anything not open, and record where it came from. */
const page = await fetch('https://superspl.at/scene/' + hash,
  { headers: { 'User-Agent': 'glitchcan-minigam splat ingest' } })
  .then(r => r.ok ? r.text() : null).catch(() => null);
if (!page) { console.error('cannot reach the scene page for ' + hash); process.exit(1); }

const licUrl = /rel="license"\s+href="([^"]+)"/.exec(page)?.[1] || null;
const title = (/<title>([^<]*)<\/title>/.exec(page)?.[1] || '')
  .replace(/ - SuperSplat$/, '').trim();
const user = /href="\/user\/([^"]+)"/.exec(page)?.[1] || '?';
const licId = !licUrl ? null
  : /publicdomain\/zero/.test(licUrl) ? 'CC0 1.0'
  : (/licenses\/([a-z-]+)\//.exec(licUrl)?.[1] || '').toUpperCase();

console.log(`${title} · ${user}`);
console.log(`licence on the page: ${licId || 'NONE DECLARED'}`);
if (!licId || !/^(BY|BY-SA|CC0)/.test(licId)) {
  console.error('\nREFUSED. Not offered under a licence this pack can use.');
  console.error('nd forbids derivatives and a crop is one; nc is a live risk for a');
  console.error('published game. That is the author\'s answer, not ours to reinterpret.');
  process.exit(1);
}

/* 2. the file the human fetched */
const cand = fs.readdirSync(IN).filter(f => f.startsWith(hash));
if (!cand.length) {
  console.error(`\nnothing at splats/incoming/${hash}.* yet.`);
  console.error(`open https://superspl.at/scene/${hash} signed in, download, and put it there.`);
  process.exit(1);
}
const src = path.join(IN, cand[0]);
console.log('ingesting', cand[0]);

/* 3. down to a working weight — the pack clips from ~150-300k, not from
      a 200MB streaming scene */
const out = path.join(SPLATS, name + '.sog');
const tmp = path.join(IN, name + '.tmp.ply');
st([src, tmp]);
const head = fs.readFileSync(tmp, { encoding: 'latin1', flag: 'r' }).slice(0, 4096);
const total = +(/element vertex (\d+)/.exec(head)?.[1] || 0);
if (total > KEEP) {
  const thin = path.join(IN, name + '.thin.ply');
  st([tmp, '-d', String(KEEP), thin]); st([thin, out]); fs.unlinkSync(thin);
} else st([tmp, out]);
fs.unlinkSync(tmp);
console.log(`${total} -> ${Math.min(total, KEEP)} gaussians · ${(fs.statSync(out).size / 1e6).toFixed(1)}MB`
  + ` -> splats/${name}.sog`);
console.log('look at it: splats/view/' + name + '.html  (PlayCanvas\'s own viewer)');
makeViewer(out, name);

/* 4. the judgements left to a person */
const credit = `${title} · ${user} · superspl.at/scene/${hash} · `
  + (licId === 'CC0 1.0' ? 'CC0 1.0' : `CC ${licId} 4.0`);
console.log(`
NEXT, BY HAND — the up-axis and the name are judgements, so they are yours:

1. splatpack.mjs, in SRC:
   ${name}: { src: 'splats/${name}.sog', up: [0, -1, 0],
     credit: '${credit}' },

2. dream.html, in SCENES (keep the two in sync), then:

   node magpie/dbdb/tools/object-scout.mjs ${name}

3. clip what you like the look of, then:
   node magpie/dbdb/tools/asset-index.mjs --fix   # describe it, no uses
   node magpie/dbdb/tools/pack-lod.mjs <newIds>   # or LOD stays off for it
`);
