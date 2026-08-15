#!/usr/bin/env node
/* splat-scout.mjs — FIND SOURCE SCANS, AND PROVE YOU MAY USE THEM.
 *
 * The pack's source scenes were originally found by hand and the method
 * was lost. This is that hunt, written down, and it now asks the
 * catalogue rather than scraping its HTML: superspl.at is a front end
 * for `https://playcanvas.com/api`, whose `splats/explore` endpoint is
 * public and returns everything that matters.
 *
 * TWO GATES, AND BOTH ARE THE AUTHOR'S, NOT OURS:
 *
 *   downloads.enabled   the creator's own switch. false means they did
 *                       not offer the file. That is an answer.
 *   downloads.license   the licence they attached to that offer.
 *
 * Only `by`, `by-sa`, `cc0`/`zero` are usable here: `nd` forbids
 * derivatives and a crop is emphatically a derivative; `nc` is a live
 * risk for a published game. Those are reported separately, never
 * promoted.
 *
 * IT DOWNLOADS NOTHING. The file endpoint answers 401 Unauthorized to
 * everyone without a PlayCanvas account, including for scenes whose
 * authors enabled downloads — measured on every format. Working around
 * that is not this tool's business. What it produces is a shortlist
 * with hashes and view links, so a person who is logged in can fetch
 * them, and `splat-ingest.mjs` takes them from there.
 *
 * Usage:
 *   node magpie/dbdb/tools/splat-scout.mjs jungle "abandoned car" ruins
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
