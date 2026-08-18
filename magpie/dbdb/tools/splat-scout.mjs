#!/usr/bin/env node
/* splat-scout.mjs — find source scans and prove you may use them.
 *
 * Searches the superspl.at catalogue (the public playcanvas.com/api behind
 * it) or Hugging Face, applies the author's own two gates —
 * downloads.enabled and downloads.license — and prints a shortlist with
 * view links. It downloads nothing from superspl.at; that endpoint is 401
 * without an account.
 *
 * WHICH licences are usable, why an HF licence tag is a claim rather than a
 * grant, and the whole seven-catalogue picture: the splat-discovery skill.
 *
 * Usage:
 *   node magpie/dbdb/tools/splat-scout.mjs jungle "abandoned car" ruins
 *   node magpie/dbdb/tools/splat-scout.mjs --source hf splat 3dgs
 *   node magpie/dbdb/tools/splat-scout.mjs --json --limit 100 mill grove
 *   node magpie/dbdb/tools/splat-scout.mjs --wants        # the story want-list
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://playcanvas.com/api';
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const useWants = argv.includes('--wants');
const li = argv.indexOf('--limit');
const LIMIT = li < 0 ? 100 : Math.min(100, parseInt(argv[li + 1], 10) || 100);

const WANTS = JSON.parse(
  fs.readFileSync(path.join(HERE, '../splats/wanted.json'), 'utf8'));

let terms = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--limit');
if (useWants) terms = [...new Set(WANTS.wants.flatMap(w => w.search))];
if (!terms.length) {
  console.error('usage: splat-scout.mjs [--json] [--limit N] <term> ...   |   --wants');
  process.exit(2);
}

const UA = { 'User-Agent': 'glitchcan-minigam splat scout (github.com/danbri/glitchcan-minigam)',
             Accept: 'application/json' };
async function api(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.json();
      if (r.status === 401 || r.status === 403) return { _denied: r.status };
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return null;
}

/* RELEVANCE. The catalogue's search is generous: "mill" returned a
   millipede, "grove" a Mazda MX-5. Keep a hit only if a word of the
   term actually appears in the title or description — the caller can
   turn that off with --loose when trawling for surprises. */
const loose = argv.includes('--loose');
const relevant = (r, term) => {
  if (loose) return true;
  const hay = ((r.title || '') + ' ' + (r.description || '')).toLowerCase();
  return term.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    .some(w => hay.includes(w));
};

const si = argv.indexOf('--source');
const SOURCE = si < 0 ? 'superspl' : argv[si + 1];

/* ─────────── Hugging Face ─────────── */
const SPLAT_EXT = /\.(ply|splat|sog|ksplat|spz)$/i;
const HF_OPEN = /^(mit|apache-2\.0|bsd-3-clause|bsd-2-clause|unlicense|cc0-1\.0|cc-by-4\.0|cc-by-sa-4\.0)$/;
if (SOURCE === 'hf') {
  const repos = new Map();
  for (const kind of ['models', 'datasets']) for (const term of terms) {
    const d = await api(`https://huggingface.co/api/${kind}`
      + `?search=${encodeURIComponent(term)}&limit=${LIMIT}&full=true`);
    if (!Array.isArray(d)) continue;
    for (const r of d) repos.set(kind + '/' + r.id, { ...r, _kind: kind });
  }
  const rows = [];
  for (const r of repos.values()) {
    const files = (r.siblings || []).map(s => s.rfilename).filter(f => SPLAT_EXT.test(f));
    if (!files.length) continue;
    const lic = (r.tags || []).find(t => t.startsWith('license:'))?.slice(8) || null;
    rows.push({ repo: r.id, kind: r._kind, licence: lic, files: files.length,
      gated: !!r.gated, sample: files.slice(0, 8),
      open: !!lic && HF_OPEN.test(lic) && !r.gated && !r.private });
  }
  const ok = rows.filter(r => r.open), no = rows.filter(r => !r.open);
  if (asJson) { console.log(JSON.stringify({ usable: ok, rejected: no.length }, null, 1)); process.exit(0); }
  console.log('\nHUGGING FACE — public repos declaring an open licence\n');
  for (const r of ok.sort((a, b) => b.files - a.files))
    console.log('  ' + (r.licence || '').padEnd(14) + String(r.files).padStart(3) + ' files  '
      + r.repo.padEnd(42) + r.sample.map(f => f.split('/').pop().replace(SPLAT_EXT, '')).slice(0, 4).join(', '));
  console.log(`\n${ok.length} usable · ${no.length} without an open licence or gated · ${rows.length} with splat files`);
  console.log('\nAn HF licence tag is the UPLOADER\'S CLAIM, not proof they made it.');
  console.log('Prefer repos where the uploader is plausibly the maker. Fetch with:');
  console.log('  npm run splat:ingest hf:<repo>/<file> <name>');
  process.exit(0);
}

const seen = new Map();                       // hash -> record (+ terms)
for (const term of terms) {
  const d = await api(`${API}/splats/explore?limit=${LIMIT}&search=${encodeURIComponent(term)}`);
  if (!d || !d.result) { console.error('search failed:', term); continue; }
  for (const r of d.result) {
    if (!relevant(r, term)) continue;
    const rec = seen.get(r.hash) || { ...r, terms: new Set() };
    rec.terms.add(term);
    seen.set(r.hash, rec);
  }
}

const OPEN = /^(by|by-sa|cc0|zero)$/;
const rows = [...seen.values()].map(r => {
  const dl = r.downloads || {};
  return {
    hash: r.hash, title: (r.title || '').trim(), user: r.user?.username || '?',
    licence: dl.license || null, offered: !!dl.enabled,
    format: r.format, mb: +(r.size / 1e6).toFixed(1),
    view: 'https://superspl.at/scene/' + r.hash,
    thumb: r.thumbnails?.m || r.thumbnails?.s || null,   // judge it by eye
    terms: [...r.terms],
  };
});
const usable = rows.filter(r => r.offered && r.licence && OPEN.test(r.licence));
const restricted = rows.filter(r => r.offered && r.licence && !OPEN.test(r.licence));
const notOffered = rows.filter(r => !r.offered);

if (asJson) {
  console.log(JSON.stringify({ usable, restricted, notOffered: notOffered.length }, null, 1));
  process.exit(0);
}

console.log('\nUSABLE — the author enabled downloads under an open licence\n');
for (const r of usable.sort((a, b) => a.mb - b.mb))
  console.log('  ' + r.hash + '  ' + ('CC ' + r.licence.toUpperCase()).padEnd(9)
    + String(r.mb).padStart(7) + 'MB ' + r.format.padEnd(5) + ' '
    + r.user.padEnd(17) + r.title.slice(0, 52) + '   [' + r.terms.join(',') + ']');

console.log('\nOFFERED BUT RESTRICTED — nc/nd; not for this pack without the owner saying so\n');
for (const r of restricted)
  console.log('  ' + r.hash + '  ' + ('CC ' + r.licence.toUpperCase()).padEnd(12)
    + r.user.padEnd(17) + r.title.slice(0, 48));

console.log(`\n${usable.length} usable · ${restricted.length} restricted · `
  + `${notOffered.length} not offered for download by their author · ${rows.length} seen`);
console.log('\nNothing was downloaded. The file endpoint is 401 without a PlayCanvas');
console.log('account; open a view link, sign in, download, then run splat-ingest.mjs.');
