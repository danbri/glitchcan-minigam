#!/usr/bin/env node
/* splat-scout.mjs — FIND CC-LICENSED SCENES, AND PROVE THE LICENCE.
 *
 * The pack's source scenes were originally found by hand: a headless
 * browser at the superspl.at gallery, reading every scene page's
 * rel=license link. That worked and then vanished, so the next hunt
 * started from nothing. This is that hunt, written down.
 *
 * It searches the catalogue for a topic, opens every result, and
 * records the licence THE PAGE DECLARES — not one inferred from a
 * gallery that mixes licences freely. Nothing is downloaded here; this
 * only produces a shortlist a human can look at.
 *
 * A scene with no rel=license is reported as UNKNOWN and must not be
 * used. "Probably fine" is not a licence.
 *
 * Usage:
 *   node magpie/dbdb/tools/splat-scout.mjs jungle "abandoned car" ruin
 *   node magpie/dbdb/tools/splat-scout.mjs --json jungle > hits.json
 */
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const terms = args.filter(a => a !== '--json');
if (!terms.length) { console.error('usage: splat-scout.mjs [--json] <term> ...'); process.exit(2); }

const UA = { 'User-Agent': 'glitchcan-minigam splat scout (github.com/danbri/glitchcan-minigam)' };
const get = async url => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return await r.text();
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  return null;
};

/* the gallery is server-rendered, so the listing is in the HTML */
const ids = new Map();                       // id -> {title, user, terms:Set}
for (const term of terms) {
  const html = await get('https://superspl.at/?q=' + encodeURIComponent(term));
  if (!html) { console.error('search failed:', term); continue; }
  const re = /href="\/scene\/([a-f0-9]{8})"[^>]*>([^<]{1,120})</g;
  let m;
  while ((m = re.exec(html))) {
    const [, id, label] = m;
    const title = label.trim();
    if (!title) continue;                    // the thumbnail anchor has no text
    const rec = ids.get(id) || { title, terms: new Set() };
    rec.terms.add(term);
    ids.set(id, rec);
  }
}

const rows = [];
for (const [id, rec] of ids) {
  const html = await get('https://superspl.at/scene/' + id);
  if (!html) { rows.push({ id, ...rec, licence: 'FETCH-FAILED' }); continue; }
  const lic = /rel="license"\s+href="([^"]+)"/.exec(html);
  const ttl = /<title>([^<]*)<\/title>/.exec(html);
  const usr = /href="\/user\/([^"]+)"/.exec(html);
  rows.push({
    id,
    title: ttl ? ttl[1].replace(/ - SuperSplat$/, '').trim() : rec.title,
    user: usr ? usr[1] : '?',
    licence: lic ? lic[1] : 'UNKNOWN',
    terms: [...rec.terms],
  });
}

const ok = rows.filter(r => /creativecommons\.org\/(licenses|publicdomain)/.test(r.licence));
const no = rows.filter(r => !ok.includes(r));

if (asJson) { console.log(JSON.stringify({ ok, rejected: no }, null, 1)); process.exit(0); }

console.log('\nUSABLE — the page declares a Creative Commons licence\n');
for (const r of ok)
  console.log('  ' + r.id + '  ' + shortLic(r.licence).padEnd(10)
    + r.user.padEnd(18) + r.title.slice(0, 64) + '   [' + r.terms.join(',') + ']');
console.log('\nNOT USABLE — no licence declared on the page (do not download)\n');
for (const r of no)
  console.log('  ' + r.id + '  ' + r.licence.slice(0, 14).padEnd(16)
    + r.user.padEnd(18) + r.title.slice(0, 60));
console.log('\n' + ok.length + ' usable of ' + rows.length + ' found');

function shortLic(u) {
  const m = /licenses\/([a-z-]+)\//.exec(u); if (m) return 'CC ' + m[1].toUpperCase();
  if (/publicdomain\/zero/.test(u)) return 'CC0';
  return u.slice(0, 10);
}
