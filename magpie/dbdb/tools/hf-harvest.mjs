#!/usr/bin/env node
/* hf-harvest.mjs — BULK SOURCE SCANS FROM HUGGING FACE, LICENCE FIRST.
 *
 * The store grew one scan at a time because superspl.at answers 401 to
 * anyone without an account: a signed-in human has to press download.
 * Hugging Face has no such gate — a public repo serves its files to
 * anyone — so this is the channel that can actually multiply the corpus.
 *
 * WHAT IT WILL AND WILL NOT TAKE:
 *   - the repo must carry an OPEN licence tag. No tag is not permission;
 *     59 of the 78 repos carrying splat files declare nothing, and they
 *     are all skipped.
 *   - gated or private repos are skipped even when the tag looks open.
 *   - the tag is recorded as the UPLOADER'S CLAIM, with the repo named,
 *     because a licence tag proves what the uploader asserts, not that
 *     they made the capture. Every harvested scan carries `verified:
 *     false` until somebody has looked at it and said otherwise.
 *
 * It downloads, converts to a working .sog, thins to a workable weight,
 * and writes a manifest. It does NOT register scenes, cut elements, or
 * decide that anything is good — a scan nobody has looked at is not an
 * asset.
 *
 * Usage:
 *   node magpie/dbdb/tools/hf-harvest.mjs --survey        # what is out there
 *   node magpie/dbdb/tools/hf-harvest.mjs --repo aleatorydialogue/trained_splats
 *   node magpie/dbdb/tools/hf-harvest.mjs --all --limit 40
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPLATS = path.resolve(HERE, '../splats');
const HARVEST = path.join(SPLATS, 'harvest');
const INCOMING = path.join(SPLATS, 'incoming');
const argv = process.argv.slice(2);
const has = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const KEEP = +opt('keep', 160000);
const LIMIT = +opt('limit', 999);
const MAXMB = +opt('maxmb', 90);

const UA = { 'User-Agent': 'glitchcan-minigam splat harvest' };
const OPEN = /^(mit|apache-2\.0|bsd-[23]-clause|unlicense|cc0-1\.0|cc-by-4\.0|cc-by-sa-4\.0)$/;
const EXT = /\.(ply|splat|sog|spz|ksplat)$/i;
const TERMS = ['gaussian splatting', '3dgs', 'splat', 'gaussian-splatting scene',
  'ply gaussian', 'radiance field', 'nerf capture', 'sogs', 'spz splat', '3d scan splat'];

async function survey() {
  const repos = new Map();
  for (const kind of ['models', 'datasets']) for (const t of TERMS) {
    const u = `https://huggingface.co/api/${kind}?search=${encodeURIComponent(t)}&limit=100&full=true`;
    const j = await fetch(u, { headers: UA }).then(r => r.ok ? r.json() : []).catch(() => []);
    for (const r of j) {
      const lic = (r.tags || []).find(x => x.startsWith('license:'))?.slice(8) || null;
      const files = (r.siblings || []).map(s => s.rfilename).filter(f => EXT.test(f));
      if (!files.length || repos.has(r.id)) continue;
      repos.set(r.id, { kind, id: r.id, lic, gated: !!r.gated, private: !!r.private, files });
    }
  }
  const usable = [...repos.values()]
    .filter(r => !r.gated && !r.private && r.lic && OPEN.test(r.lic));
  return { all: [...repos.values()], usable };
}

const st = a => execFileSync('npx', ['-y', '@playcanvas/splat-transform', '-w', '-q', '-g', 'cpu', ...a],
  { stdio: ['ignore', 'pipe', 'pipe'] });

/* a scan name that stays a filename: the repo's own name for the thing,
   lowercased, with the owner kept only when two repos collide */
const slug = f => path.basename(f).replace(/\.[^.]+$/, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);

async function take(repo, file, lic, kind) {
  const name = slug(file);
  const out = path.join(HARVEST, name + '.sog');
  if (fs.existsSync(out)) return { name, skipped: 'already held' };
  const url = `https://huggingface.co/${kind === 'datasets' ? 'datasets/' : ''}${repo}`
    + `/resolve/main/${file.split('/').map(encodeURIComponent).join('/')}`;
  /* ASK THE SIZE FIRST. One repo in this survey holds a 265MB LiDAR dump;
     downloading it cost ten minutes and produced nothing a game can use.
     A scene worth cutting elements from is a few tens of MB. */
  const head = await fetch(url, { method: 'HEAD', headers: UA }).catch(() => null);
  const bytes = +(head?.headers.get('content-length') || 0);
  if (bytes > MAXMB * 1e6) return { name, skipped: `too big (${(bytes / 1e6) | 0}MB)` };
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return { name, error: 'HTTP ' + res.status };
  const raw = path.join(INCOMING, name + path.extname(file));
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  const mb = fs.statSync(raw).size / 1e6;
  try {
    const tmp = path.join(INCOMING, name + '.tmp.ply');
    st([raw, tmp]);
    const head = fs.readFileSync(tmp, { encoding: 'latin1' }).slice(0, 4096);
    const total = +(/element vertex (\d+)/.exec(head)?.[1] || 0);
    /* decimation must WRITE a .ply — splat-transform refuses "-d N x.sog" */
    if (total > KEEP) {
      const thin = path.join(INCOMING, name + '.thin.ply');
      st([tmp, '-d', String(KEEP), thin]); st([thin, out]); fs.unlinkSync(thin);
    } else st([tmp, out]);
    fs.unlinkSync(tmp); fs.unlinkSync(raw);
    return { name, repo, file, kind, licence: lic, claim: 'uploader tag, unverified',
      splats: Math.min(total, KEEP), source: +mb.toFixed(1),
      mb: +(fs.statSync(out).size / 1e6).toFixed(1), verified: false, looked: false };
  } catch (e) {
    fs.rmSync(raw, { force: true });
    fs.rmSync(path.join(INCOMING, name + '.tmp.ply'), { force: true });
    return { name, error: String(e.message || e).slice(0, 120) };
  }
}

const { all, usable } = await survey();
if (has('survey')) {
  console.log(`${all.length} HF repos carry splat files`);
  console.log(`  ${usable.length} declare an open licence`
    + ` · ${all.filter(r => !r.lic).length} declare none (skipped)`
    + ` · ${all.filter(r => r.gated || r.private).length} gated`);
  console.log(`  ${usable.reduce((a, r) => a + r.files.length, 0)} files reachable\n`);
  for (const r of usable.sort((a, b) => b.files.length - a.files.length))
    console.log(`  ${String(r.files.length).padStart(4)}  ${r.lic.padEnd(12)} ${r.id}`);
  process.exit(0);
}

fs.mkdirSync(HARVEST, { recursive: true });
fs.mkdirSync(INCOMING, { recursive: true });
/* order matters when the budget is time: personal-capture repos first,
   research dumps (nuscenes, vkitti, SLAM sequences) last — they are big,
   slow, and almost never a thing you can cut a prop out of */
const RESEARCH = /3dgs_viewer|SplaTAM|nuscenes|vkitti/i;
const want = (has('all') ? usable : usable.filter(r => r.id === opt('repo', '')))
  .sort((a, b) => (RESEARCH.test(a.id) ? 1 : 0) - (RESEARCH.test(b.id) ? 1 : 0)
                || b.files.length - a.files.length);
if (!want.length) { console.error('nothing selected — try --survey, --repo <id>, or --all'); process.exit(2); }

/* --manifest lets two harvesters run side by side without clobbering
   each other's record; the files on disk are the truth, the manifests
   merge later */
const manifestPath = path.join(HARVEST, opt('manifest', 'harvest.json'));
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { note: 'Raw scans fetched from Hugging Face. The licence is the UPLOADER\'S '
      + 'CLAIM, not proof they made the capture, so every entry starts verified:false '
      + 'and looked:false. Nothing here is an asset until somebody has looked at it.',
      scans: [] };
const held = new Set(manifest.scans.map(s => s.name));

let n = 0;
for (const r of want) for (const f of r.files) {
  if (n >= LIMIT) break;
  const got = await take(r.id, f, r.lic, r.kind);
  if (got.skipped) { console.log(`  ${got.name.padEnd(26)} ${got.skipped}`); continue; }
  if (got.error) { console.log(`  ${got.name.padEnd(26)} FAILED ${got.error}`); continue; }
  n++;
  if (!held.has(got.name)) { manifest.scans.push(got); held.add(got.name); }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`  ${got.name.padEnd(26)} ${String(got.splats).padStart(7)} splats`
    + ` · ${got.source}MB -> ${got.mb}MB · ${got.licence}`);
}
console.log(`\n${n} scans harvested · ${manifest.scans.length} held · ${HARVEST}`);
