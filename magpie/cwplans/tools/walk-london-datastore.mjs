#!/usr/bin/env node
// A recorded walk through the London Datastore (data.london.gov.uk, a DataPress site): the whole catalogue, a
// triage of every dataset by written rules, and a harvest of the shortlisted open datasets clipped to the zone.
//   NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-london-datastore.mjs walk [--details] [--refresh]
//   node magpie/cwplans/tools/walk-london-datastore.mjs triage
//   NODE_USE_ENV_PROXY=1 node magpie/cwplans/tools/walk-london-datastore.mjs harvest [key ...] [--refresh]
// walk:    GET /api/v3/datasets/export.json (every public dataset, one response) and the CKAN-compatible
//          /api/action/package_search (owner organisation); --details also GETs /api/v3/dataset/<id> for each dataset
//          (resource format, archivedAt). Out: feeds/london-datastore/catalogue.json (one dataset per line).
// triage:  rules below (licence class, relevance to the zone, kind, held or listed by the project, value themes,
//          join keys, sensitivity, rank). Out: feeds/london-datastore/triage.json. No network.
// harvest: the HARVEST table below; one folder per dataset, feeds/london-datastore/<key>/, {meta, ...} files.
// Raw downloads: data/raw/london-datastore/ (gitignored), reused unless --refresh.
// Network: one request at a time, at least 1 s apart, backoff on 429 and 5xx (Retry-After honoured), project UA.
// Method, rules and the reasons: skills/cwplans-london-datastore/SKILL.md; results: feeds/london-datastore/README.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { execFileSync } from 'child_process';
import { RAW, UA, TOOLS } from './lib.mjs';

export const CW = join(TOOLS, '..');
export const OUT = join(CW, 'feeds', 'london-datastore');
export const RAWDIR = join(RAW, 'london-datastore');
mkdirSync(join(RAWDIR, 'details'), { recursive: true }); mkdirSync(OUT, { recursive: true });
export const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
export const REFRESH = args.includes('--refresh');
const BASE = 'https://data.london.gov.uk';
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) console.warn('warning: HTTPS_PROXY is set but NODE_USE_ENV_PROXY is not; Node fetch will not use the proxy');

// ---- polite fetch: one request at a time over the whole tool, >= 1 s apart, retries on 429 / 5xx / network errors
let chain = Promise.resolve(), last = 0, nReq = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function politeFetch(url, { minGapMs = 1100, tries = 6 } = {}) {
  const run = async () => {
    for (let k = 1; ; k++) {
      const wait = last + minGapMs - Date.now(); if (wait > 0) await sleep(wait);
      last = Date.now(); nReq++;
      let r, err;
      try { r = await fetch(url, { headers: { 'User-Agent': UA } }); } catch (e) { err = e; }
      if (r && r.ok) { const b = Buffer.from(await r.arrayBuffer()); last = Date.now(); return b; }
      const retry = err || r.status === 429 || r.status >= 500;
      if (!retry || k >= tries) throw new Error(`${err ? err.message : r.status} ${url}`);
      const ra = r && +r.headers.get('retry-after');
      await sleep(ra ? ra * 1000 : minGapMs * 2 ** k);
    }
  };
  const p = chain.then(run, run); chain = p.catch(() => {}); return p;
}
export async function rawFile(name, url) {
  const f = join(RAWDIR, name);
  mkdirSync(dirname(f), { recursive: true });
  if (!REFRESH && existsSync(f) && statSync(f).size > 0) return { file: f, fetched: statSync(f).mtime.toISOString().slice(0, 10), reused: true };
  writeFileSync(f, await politeFetch(url));
  return { file: f, fetched: today, reused: false };
}
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));

// ================================================================== walk
const ext = s => { const m = /\.([A-Za-z0-9]{1,8})$/.exec((s || '').split('?')[0]); return m ? m[1].toLowerCase() : null; };
async function walk() {
  const exp = await rawFile('export.json', `${BASE}/api/v3/datasets/export.json`);
  const ckan = await rawFile('package_search.json', `${BASE}/api/action/package_search`);
  const list = readJson(exp.file), pkg = new Map(readJson(ckan.file).result.result.map(p => [p.id, p]));
  const DETAILS = args.includes('--details');
  let nDetails = 0;
  if (DETAILS) for (const [i, d] of list.entries()) {
    const f = `details/${d.id}.json`;
    try { const r = await rawFile(f, `${BASE}/api/v3/dataset/${d.id}`); if (!r.reused && i % 50 === 0) console.log(`details ${i + 1}/${list.length}`); nDetails++; }
    catch (e) { console.warn('details failed', d.id, e.message); }
  } else nDetails = readdirSync(join(RAWDIR, 'details')).length;
  const detail = id => { const f = join(RAWDIR, 'details', id + '.json'); return existsSync(f) ? readJson(f) : null; };
  const datasets = list.map(d => {
    const p = pkg.get(d.id), det = detail(d.id);
    const fmt = new Map(Object.entries(det?.resources || {}).map(([k, v]) => [k, v.format]));
    return {
      id: d.id,
      title: d.title,
      slug: d.webpage.replace(`${BASE}/dataset/`, ''),
      publisher: d.logo?.title || p?.maintainer || d.custom?.author || null,
      publisher_from: d.logo?.title ? 'organisation' : p?.maintainer ? 'maintainer' : d.custom?.author ? 'author' : null,
      licence: d.licence?.title || null,
      topics: (d.topics || []).map(t => t.id),
      tags: (d.tags || []).map(t => typeof t === 'string' ? t : t.id || t.title),
      geo: d.custom?.geo || null,
      update_frequency: d.custom?.update_frequency || null,
      created: d.createdAt?.slice(0, 10) || null, modified: d.updatedAt?.slice(0, 10) || null,
      next_review: d.nextReviewDate || null, archived: det?.archivedAt || null,
      resources: (d.resources || []).map(r => {
        const file = r.url.split('/').pop(), std = r.url === `${BASE}/download/${d.id}/${r.id}/${file}`;
        let name = file; try { name = decodeURIComponent(file); } catch { }
        return {
          id: r.id, ...(std ? { file } : { url: r.url }), ...(r.title && r.title !== name && r.title !== r.filename ? { title: r.title } : {}),
          format: ext(name) || fmt.get(r.id) || null, ...(fmt.get(r.id) ? { kind: fmt.get(r.id) } : {}), size: r.size ?? null, date: r.timestamp?.slice(0, 10) || null,
          ...(r.timeframeFrom || r.timeframeTo ? { timeframe: [r.timeframeFrom || null, r.timeframeTo || null] } : {}),
        };
      }),
      links: (d.links || []).map(l => ({ title: l.title, url: l.url, http: l.httpStatus ?? null, checked: l.qaTimestamp?.slice(0, 10) || null })),
    };
  });
  const meta = {
    source: 'London Datastore (Greater London Authority), https://data.london.gov.uk/',
    api: { export: `${BASE}/api/v3/datasets/export.json`, dataset: `${BASE}/api/v3/dataset/<id>`, ckan_compat: `${BASE}/api/action/package_search`,
      note: 'DataPress platform. /api/3/action/* redirects (307) to /api/action/*; package_search returns all datasets in one response (q, rows, start ignored); organization_list and license_list answer 410 "Deprecated Route: use /api/v3/datasets/export.json and /api/v3/dataset/:id" (2026-10-04). Docs: https://datapress.com/docs/api' },
    terms: { url: `${BASE}/about/terms-and-conditions`, read: '2026-10-04',
      summary: 'Data may be used for any purpose within the site terms; each dataset carries its own licence; a re-user must state that the GLA cannot warrant the quality or accuracy of the data, and must not imply GLA endorsement. robots.txt disallows only /debug, /manage/, /login, /logout.' },
    fetched: { export: exp.fetched, package_search: ckan.fetched, details: nDetails ? `${nDetails} of ${list.length} datasets (api/v3/dataset/<id>)` : 'not fetched' },
    method: 'walk-london-datastore.mjs walk: the export lists every public dataset with its licence, topics, tags, custom fields (geo = spatial granularity, update_frequency), resources and links. Publisher = the organisation (logo title), else the CKAN maintainer, else custom.author. Contacts (names and emails), descriptions and logos are not kept. Resource URL = https://data.london.gov.uk/download/<dataset id>/<resource id>/<file> unless the record gives "url" (a different form). format = the file extension; kind = the publisher\'s generic format (spreadsheet, document, csv, zip...) from api/v3/dataset/<id>, only where that record was fetched (a check of the first 186 datasets on 2026-10-04 showed no field the export lacks besides this generic format, and no archivedAt).',
    resource_url_template: `${BASE}/download/{dataset}/{id}/{file}` + ' (file as it appears in the URL, percent-encoded; a resource whose URL has another form keeps "url"); title only when it differs from the file name; date = the resource timestamp (day)',
    licence_urls: Object.fromEntries([...new Map(list.filter(d => d.licence?.url).map(d => [d.licence.title, d.licence.url]))]),
    counts: { datasets: datasets.length, resources: datasets.reduce((s, d) => s + d.resources.length, 0), links: datasets.reduce((s, d) => s + d.links.length, 0) },
    licence_of_this_file: 'Catalogue metadata from the London Datastore (site terms: any purpose); each dataset\'s own licence is in its record.',
  };
  datasets.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(OUT, 'catalogue.json'), '{"meta":' + JSON.stringify(meta, null, 1) + ',\n"datasets":[\n' + datasets.map(d => JSON.stringify(d)).join(',\n') + '\n]}\n');
  console.log(`catalogue: ${datasets.length} datasets, ${meta.counts.resources} resources, ${nReq} requests`);
}

// ================================================================== triage
// Every class comes from a written rule; the reasons list the rule and the evidence.
const ZONE_BOROUGHS = { 'tower hamlets': 'E09000030', southwark: 'E09000028', lewisham: 'E09000023', greenwich: 'E09000011', newham: 'E09000025', 'city of london': 'E09000001' };
const OTHER_BOROUGHS = ['barking', 'dagenham', 'barnet', 'bexley', 'brent', 'bromley', 'camden', 'croydon', 'ealing', 'enfield', 'hackney', 'hammersmith', 'fulham', 'haringey', 'harrow', 'havering', 'hillingdon', 'hounslow', 'islington', 'kensington', 'chelsea', 'kingston', 'lambeth', 'merton', 'redbridge', 'richmond', 'sutton', 'waltham forest', 'wandsworth', 'westminster',
  'wembley', 'old oak', 'park royal', 'heathrow', 'croydon', 'olympic park', 'queen elizabeth olympic park', 'stratford', 'brent cross', 'kings cross', 'vauxhall', 'nine elms', 'battersea', 'white city', 'elephant and castle', 'tottenham', 'woolwich', 'thamesmead', 'beckton', 'barking riverside'];
// place names inside the 3D model box [-0.095, 51.474, 0.015, 51.522] (and the Royal Docks just east of it)
const ZONE_PLACES = ['thames', 'canary wharf', 'isle of dogs', 'docklands', 'poplar', 'millwall', 'cubitt town', 'blackwall', 'limehouse', 'royal docks', 'royal victoria', 'royal albert', 'silvertown', 'greenwich peninsula', 'north greenwich', 'deptford', 'rotherhithe', 'canada water', 'surrey quays', 'wapping', 'leamouth', 'lower lea', 'bow creek', 'e14', 'canning town', 'shadwell', 'bermondsey', 'tower bridge', 'london bridge'];
const GEO = {
  fine: ['Point Location', 'Coordinates', 'Unit Postcode', '20 Metre Grid', '100m Grid Squares', 'Custom Polygons', 'Output Area', 'Lower Super Output Area', 'Middle Super Output Area', 'Ward', 'Postcode Sector', 'Street and Neighbourhood', 'Town Centres', 'Schools', 'Hospitals', 'Train Stations', 'Education Institution', '1km Grid Squares', 'Airports'],
  borough: ['Local Authority', 'Borough', 'Primary Care Organisations', 'Parliamentary Constituency', 'GLA Constituency', 'Hospital Trust'],
  coarse: ['Greater London', 'Region', 'Sub-Region', 'Country', 'Worldwide', 'N/A', 'Other'],
};
const SPATIAL_FORMATS = ['gpkg', 'geojson', 'shp', 'kml', 'kmz', 'gml', 'dwg', 'tab', 'mif'];
const MACHINE_FORMATS = ['csv', 'xlsx', 'xls', 'xlsm', 'ods', 'json', 'geojson', 'gpkg', 'zip', 'shp', 'kml', 'xml', 'ttl', 'txt', 'tsv', 'gml', 'parquet'];
export const LICENCE_CLASS = [
  [/^Open Government Licence/i, 'ogl', true],
  [/^Creative Commons Attribution Share-Alike/i, 'share-alike', false],
  [/Open Database License|ODbL/i, 'share-alike', false],
  [/^Creative Commons Non-Commercial/i, 'restricted', false],
  [/^Creative Commons Attribution$/i, 'cc-by', true],
  [/^Open Data Commons Attribution License/i, 'odc-by', true],
  [/^(Public Domain|Open Data Commons Public Domain)/i, 'public-domain', true],
  [/^All Rights Reserved/i, 'restricted', false],
  [/Transport Data Service Licence/i, 'other', false],
];
const THEMES = {
  'buildings-places': [3, /\b(building|buildings|land|sites?|development|brownfield|tall|opportunity areas?|town centres?|high streets?|boundar\w*|footprint|uprn|address|propert\w*|epc|energy performance|stock model|floorspace|density|open spaces?|green spaces?|public realm|parks?|place|regeneration|housing zones?|local plan|london plan|ldd|completions?|permissions?|conservation)\b/i],
  'occupants-organisations': [3, /\b(business|businesses|compan\w*|enterprises?|employers?|workplace|schools?|colleges?|nurser\w*|gp|pharmac\w*|hospitals?|shops?|retail|pubs?|restaurants?|charit\w*|voluntary|cultural infrastructure|venues?|creative|hotels?|offices?|universit\w*|libraries|library|organisations?|market traders?|markets?|night time|night-time|clubs?)\b/i],
  'events-works': [2, /\b(incidents?|fires?|crime|collisions?|casualt\w*|planning applications?|referr\w*|works|streetworks|events?|licensing|complaints?|enforcement|rescues?|inspections?|callouts?|disruptions?|closures?|power cuts?|anti-?social)\b/i],
  transport: [2, /\b(transport|stations?|tube|underground|buses|bus|cycle|cycling|roads?|traffic|rail|dlr|river|piers?|parking|ev charg\w*|electric vehicles?|journeys?|ptal|cars?|taxis?|freight|walking|streets?|streetworks|tfl|ulez|congestion)\b/i],
  environment: [2, /\b(air quality|no2|pm2\.?5|pm10|emissions?|laei|trees?|canopy|flood|green|biodiversity|habitat|noise|energy|solar|heat|carbon|climate|water|waste|recycl\w*|temperature|nature|sinc|pollution|electricity|gas|retrofit|decentralised)\b/i],
  'people-housing': [1, /\b(population|census|demograph\w*|housing|households?|deprivation|income|poverty|ethnic\w*|benefits?|claimant|health|life expectancy|rents?|house prices?|affordab\w*|homeless\w*|overcrowd\w*|elections?|labour market|unemployment|earnings|projections?|migration|births?|well-?being)\b/i],
  heritage: [3, /\b(heritage|listed buildings?|conservation areas?|historic|archaeolog\w*|blue plaques?|monuments?|scheduled|world heritage|locally listed)\b/i],
};
// Datastore topics -> themes (in addition to the keyword rules on title and tags)
const TOPIC_THEMES = { planning: 'buildings-places', housing: 'people-housing', demographics: 'people-housing', environment: 'environment', transport: 'transport',
  'art-and-culture': 'occupants-organisations', 'crime-and-community-safety': 'events-works', health: 'people-housing', 'income-poverty-welfare': 'people-housing' };
// Records about individual people in sensitive situations: catalogued, never harvested (CLAUDE.md data ethics).
const SENSITIVE = /\b(homicide|victims?|strip search|intimate|suicide|custody|stop and search|stop & search|hate crime|domestic abuse|sexual|safeguarding|missing persons?|rough sleep\w*|chain|bariatric|deaths? in)\b/i;
const JOIN_KEYS = { uprn: /\buprn\b/i, toid: /\btoid\b/i, postcode: /postcode/i, ward: /\bwards?\b/i, lsoa: /\blsoa|lower super output/i, msoa: /\bmsoa|middle super output/i, oa: /\boutput areas?\b/i, borough: /\bborough|local authorit/i, company: /companies house|company number/i };
const RELEVANCE_W = { 'zone-place': 5, 'zone-borough': 4, 'london-fine': 3, 'london-borough': 1.5, unknown: 1, 'london-coarse': 0.3, 'other-area': 0 };

// what the project already has: dataset ids and slugs in the committed files, by role
function projectHas(cat) {
  const files = execFileSync('git', ['ls-files', '--cached', '--', '.'], { cwd: CW, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(p => !p.startsWith('feeds/london-datastore/') && /\.(json|md|mjs|js)$/.test(p) && !/^(METHODS|DATA-REGISTER)\.md$|pipeline\.jsonld$/.test(p));
  const ids = new Set(cat.map(d => d.id)), bySlug = new Map(cat.map(d => [d.slug, d.id]));
  const has = new Map(), unknownRefs = new Set();
  const add = (id, role, where) => { const h = has.get(id) || { held: new Set(), listed: new Set(), excluded: new Set() }; h[role].add(where); has.set(id, h); };
  for (const p of files) {
    const text = readFileSync(join(CW, p), 'utf8');
    if (!text.includes('data.london.gov.uk')) continue;
    // role of the file: data held (register, tools, data files) / a catalogue entry (feeds) / a source left out
    const roleOf = (idx) => {
      if (/^feeds\//.test(p)) {
        if (/-excluded\.json$/.test(p) || /SURVEY/.test(p)) return /SURVEY/.test(p) && !/left out|Left out|not suitable|superseded|Not suitable/.test(text.slice(idx, idx + 400)) ? 'listed' : 'excluded';
        if (/feeds\.json$|events\.json$/.test(p)) { const ex = text.indexOf('"excluded"'); return ex > 0 && idx > ex ? 'excluded' : 'listed'; }
        return 'listed';
      }
      return /\.md$/.test(p) ? 'listed' : 'held';                    // data-register.json, pipeline.json, tools, data files
    };
    for (const m of text.matchAll(/data\.london\.gov\.uk\/(dataset|download)\/([A-Za-z0-9_.%-]+)/g)) {
      const tok = m[2].replace(/[.)]+$/, '');
      if (!tok) continue;
      let id = ids.has(tok) ? tok : bySlug.get(tok) || (ids.has(tok.split('-').pop()) ? tok.split('-').pop() : null)
        || cat.find(d => d.slug.slice(0, d.slug.lastIndexOf('-')) === tok)?.id;            // an old slug without the id
      if (!id) { unknownRefs.add(tok); continue; }
      add(id, roleOf(m.index), p);
    }
  }
  return { has, unknownRefs: [...unknownRefs] };
}

function triage() {
  const cat = readJson(join(OUT, 'catalogue.json')).datasets;
  const { has, unknownRefs } = projectHas(cat);
  const out = {}, counts = { licence: {}, relevance: {}, kind: {}, have: {}, themes: {}, sensitive: 0, open_relevant_new: 0 };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const d of cat) {
    const reasons = [];
    const text = [d.title, ...d.tags, d.slug].join(' | ').toLowerCase().replace(/-/g, ' ');
    const titleL = d.title.toLowerCase(), pubL = (d.publisher || '').toLowerCase();
    // licence
    let lic = 'none', open = false;
    if (d.licence) { const hit = LICENCE_CLASS.find(([re]) => re.test(d.licence)); [lic, open] = hit ? [hit[1], hit[2]] : ['other', false]; }
    reasons.push(`licence: ${d.licence || 'none stated'} -> ${lic}`);
    // relevance
    const zoneB = Object.keys(ZONE_BOROUGHS).filter(b => new RegExp(`\\b${b}\\b`).test(text + ' | ' + pubL));
    const otherB = OTHER_BOROUGHS.filter(b => new RegExp(`\\b${b}\\b`).test(text + ' | ' + pubL));
    const placeText = (titleL + ' | ' + d.tags.join(' | ').toLowerCase()).replace(/-/g, ' ').replace(/upon thames|thames estuary|thames gateway|thamesmead/g, '');
    const places = ZONE_PLACES.filter(z => new RegExp(`\\b${z}\\b`).test(placeText));
    const geoClass = GEO.fine.includes(d.geo) ? 'fine' : GEO.borough.includes(d.geo) ? 'borough' : GEO.coarse.includes(d.geo) ? 'coarse' : null;
    const formats = [...new Set(d.resources.map(r => r.format).filter(Boolean))];
    let rel;
    if (places.length) { rel = 'zone-place'; reasons.push(`names a place in the zone: ${places.join(', ')}`); }
    else if (zoneB.length && zoneB.length + otherB.length <= 3 && !otherB.length) { rel = 'zone-borough'; reasons.push(`names only zone boroughs: ${zoneB.join(', ')}`); }
    else if (otherB.length && otherB.length + zoneB.length <= 3) { rel = 'other-area'; reasons.push(`names only places outside the zone: ${[...otherB, ...zoneB].join(', ')}`); }
    else if (geoClass === 'fine') { rel = 'london-fine'; reasons.push(`geo "${d.geo}": London-wide at a granularity finer than a borough`); }
    else if (geoClass === 'borough') { rel = 'london-borough'; reasons.push(`geo "${d.geo}": borough rows cover the zone boroughs, no finer`); }
    else if (geoClass === 'coarse') { rel = 'london-coarse'; reasons.push(`geo "${d.geo}": London or coarser`); }
    else {
      const kw = Object.entries(JOIN_KEYS).filter(([k, re]) => k !== 'borough' && k !== 'company' && re.test(text)).map(([k]) => k);
      const sp = formats.filter(f => SPATIAL_FORMATS.includes(f));
      if (kw.length || sp.length) { rel = 'london-fine'; reasons.push(`no geo field; inferred fine from ${[...kw.map(k => 'title/tag "' + k + '"'), ...sp.map(f => 'format ' + f)].join(', ')}`); }
      else if (JOIN_KEYS.borough.test(text)) { rel = 'london-borough'; reasons.push('no geo field; inferred borough from title/tags'); }
      else { rel = 'unknown'; reasons.push(`no geo field (${d.geo ?? 'unset'}) and no granularity word`); }
    }
    // kind
    const f = d.update_frequency;
    const kind = !f ? 'unknown' : f === 'One off' ? 'static' : ['Daily', 'Hourly', 'Realtime'].includes(f) ? 'live' : 'periodic';
    const newest = d.resources.map(r => r.date).filter(Boolean).sort().pop() || d.modified;
    const stale = (newest || '') < '2020-01-01';
    reasons.push(`kind: update_frequency ${f || 'unset'} -> ${kind}; newest resource ${newest?.slice(0, 10) || '?'}${stale ? ' (stale: before 2020)' : ''}`);
    // the project already has it?
    const h = has.get(d.id);
    const have = h?.held.size ? 'held' : h?.listed.size ? 'listed' : h?.excluded.size ? 'excluded-before' : 'new';
    if (h) reasons.push(`project: ${have} (${[...h.held, ...h.listed, ...h.excluded].join(', ')})`);
    // value themes
    const vtext = [d.title, ...d.tags].join(' ');
    const themes = [...new Set([...Object.entries(THEMES).filter(([, [, re]]) => re.test(vtext)).map(([k]) => k), ...d.topics.map(t => TOPIC_THEMES[t]).filter(Boolean)])];
    const value = themes.reduce((s, t) => s + THEMES[t][0], 0);
    const keys = Object.entries(JOIN_KEYS).filter(([, re]) => re.test(text + ' ' + (d.geo || ''))).map(([k]) => k);
    if (['Point Location', 'Coordinates'].includes(d.geo) || formats.some(x => SPATIAL_FORMATS.includes(x))) keys.push('coordinates');
    const sensitive = SENSITIVE.test(d.title);
    if (sensitive) reasons.push('sensitive: title names records about people in sensitive situations; catalogued, never harvested');
    const machine = formats.some(x => MACHINE_FORMATS.includes(x));
    const year = +(newest || '2000').slice(0, 4);
    const recency = year >= 2024 ? 1 : year >= 2021 ? 0.8 : year >= 2016 ? 0.5 : 0.3;
    const score = sensitive ? 0 : +(RELEVANCE_W[rel] * Math.max(value, 0.5) * recency * (machine ? 1 : 0.4) * (keys.some(k => k !== 'borough') ? 1.3 : 1)
      * (open ? 1 : 0) * (have === 'held' ? 0 : have === 'listed' ? 0.8 : 1)).toFixed(2);
    const relevant = ['zone-place', 'zone-borough', 'london-fine'].includes(rel);
    out[d.id] = { title: d.title, licence: lic, open, relevance: rel, relevant, kind, stale, have, themes, keys: [...new Set(keys)], formats, sensitive, score, reasons };
    inc(counts.licence, lic); inc(counts.relevance, rel); inc(counts.kind, kind); inc(counts.have, have); themes.forEach(t => inc(counts.themes, t));
    if (sensitive) counts.sensitive++;
    if (open && relevant && have === 'new' && !sensitive) counts.open_relevant_new++;
  }
  const ranked = Object.entries(out).filter(([, t]) => t.score > 0).sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
  const meta = {
    made: today, from: 'feeds/london-datastore/catalogue.json', tool: 'tools/walk-london-datastore.mjs triage',
    rules: {
      licence: 'license title -> class: Open Government Licence v2/v3 -> ogl; Creative Commons Attribution -> cc-by; Open Data Commons Attribution -> odc-by; Public Domain / PDDL -> public-domain (all four open); CC BY-SA and ODbL -> share-alike (not allowed, CLAUDE.md); CC Non-Commercial and All Rights Reserved -> restricted; Transport Data Service Licence -> other; empty -> none.',
      relevance: `first match wins: zone-place (title or tag names a place in the model box, after removing "upon Thames", "Thames Estuary", "Thames Gateway" and "Thamesmead": ${ZONE_PLACES.join(', ')}); zone-borough (names only zone boroughs: ${Object.keys(ZONE_BOROUGHS).join(', ')}); other-area (names 1-3 places, none in the zone); london-fine (geo field ${GEO.fine.join(', ')}; or, with no geo field, a ward/LSOA/MSOA/OA/postcode/UPRN/TOID word or a spatial file format); london-borough (geo ${GEO.borough.join(', ')}, or a borough word); london-coarse (geo ${GEO.coarse.join(', ')}); else unknown. Relevant = zone-place, zone-borough, london-fine.`,
      kind: 'update_frequency: One off -> static; Daily, Hourly, Realtime -> live; any other value -> periodic; unset -> unknown. stale = newest resource timestamp (else dataset modified) before 2020-01-01.',
      have: 'dataset id or slug found in a committed file of magpie/cwplans (not this folder or generated docs): in data-register.json, pipeline.json, tools or data files -> held; in a hand-written note (.md), feeds catalogues (feeds.json sources, events.json, feeds/works, feeds/underground) or the 2026-10-03 survey -> listed; in an "excluded" list or a survey "left out" line -> excluded-before; else new.',
      value: 'themes by keyword on title and tags, plus the Datastore topics (' + Object.entries(TOPIC_THEMES).map(([k, v]) => `${k} -> ${v}`).join(', ') + '); weights: ' + Object.entries(THEMES).map(([k, [w]]) => `${k} ${w}`).join(', ') + '. value = sum of the weights.',
      keys: 'join keys named in title, tags, slug or geo: ' + Object.keys(JOIN_KEYS).join(', ') + '; coordinates when geo is a point or a spatial format is present.',
      sensitive: 'title matches ' + SENSITIVE.source + ' -> catalogued, score 0, never harvested.',
      score: 'relevance weight (' + Object.entries(RELEVANCE_W).map(([k, v]) => `${k} ${v}`).join(', ') + ') x max(value, 0.5) x recency (newest year >= 2024: 1, >= 2021: 0.8, >= 2016: 0.5, else 0.3) x (a machine-readable format ? 1 : 0.4) x (a join key finer than a borough ? 1.3 : 1) x (open ? 1 : 0) x (held 0, listed 0.8, else 1); 0 when sensitive.',
    },
    counts, unmatched_references: unknownRefs,
    ranked,
  };
  writeFileSync(join(OUT, 'triage.json'), '{"meta":' + JSON.stringify(meta, null, 1) + ',\n"datasets":{\n' + Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => JSON.stringify(k) + ':' + JSON.stringify(v)).join(',\n') + '\n}}\n');
  console.log(JSON.stringify(counts, null, 1));
  console.log('top 40:'); for (const id of ranked.slice(0, 40)) { const t = out[id]; console.log(id, t.score, t.relevance, t.licence, t.have, t.kind, t.themes.join('+'), '|', t.title); }
}

// ================================================================== harvest
// The shortlist taken from triage.json by hand judgement (README "Shortlist"): open licence, relevant, new to the
// project, machine-readable. file: the resource's file name (as in its URL, decoded); fmt: how to read it.
const HARVEST = {
  'conservation-areas':        { id: 'emqwg', file: 'Conservation_Areas.gpkg', fmt: 'gpkg', theme: 'heritage' },
  'southwark-local-list':      { id: 'e1r5k', fmt: 'geojson', theme: 'heritage' },
  'site-allocations':          { id: '2jxpm', file: 'Site_Allocations.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'brownfield-register':       { id: '2og9g', file: 'Brownfield_Register.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'central-activities-zone':   { id: '23jxk', file: 'caz_lp_2021.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'strategic-industrial-land': { id: '2y5xy', file: 'Strategic_Industrial_Land.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'locally-significant-industrial-sites': { id: '29z31', file: 'Locally_Significant_Industrial_Sites.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'safeguarded-wharves':       { id: '2g90r', file: 'Safeguarded_Wharves.gpkg', fmt: 'gpkg', theme: 'transport' },
  'article4-office-residential': { id: '2gy3r', file: 'Article_4_Directions_Office_to_Residential.gpkg', fmt: 'gpkg', theme: 'buildings-places' },
  'designated-open-space':     { id: 'e195k', file: 'Designated_Open_Space.gpkg', fmt: 'gpkg', theme: 'environment' },
  'flood-risk':                { id: '2w4wy', file: 'Flood_Risk.gpkg', fmt: 'gpkg', theme: 'environment' },
  'air-quality-monitoring-sites': { id: '23n41', file: 'Air_quality_monitoring_sites.gpkg', fmt: 'gpkg', theme: 'environment' },
  'cultural-infrastructure-2024': { id: '2zj1y', fmt: 'csv', theme: 'occupants-organisations' },
  'lvmf-2026-consultation':    { id: '2gqpn', fmt: 'shpzip', all: true, theme: 'heritage' },
};
// The zone: the 3D model box (tools/fetch-docklands.mjs BOX_BNG / BOX_WGS84); in_cw: the Canary Wharf registry box.
const ZONE_BNG = { e0: 532400, e1: 539900, n0: 176700, n1: 182300 }, ZONE_WGS84 = [-0.0950, 51.4740, 0.0150, 51.5220];
const CW_BOX = [-0.03, 51.498, -0.005, 51.51];
const DROP_FIELD = /e-?mail|phone|tel(ephone)?$|^tel|contact|^fax|mobile|website_contact|^owner_?name|person/i;

// ---- GeoPackage (node:sqlite) and WKB
function readWkb(buf, off = 0) {
  const le = buf[off] === 1; let o = off + 1;
  const u32 = () => { const v = le ? buf.readUInt32LE(o) : buf.readUInt32BE(o); o += 4; return v; };
  const f64 = () => { const v = le ? buf.readDoubleLE(o) : buf.readDoubleBE(o); o += 8; return v; };
  let t = u32(); let dims = 2;
  if (t & 0x80000000) dims++; if (t & 0x40000000) dims++; t &= 0x0fffffff;
  if (t > 1000) { const dc = Math.floor(t / 1000); dims = dc === 3 ? 4 : 3; t %= 1000; }
  const pt = () => { const c = [f64(), f64()]; for (let i = 2; i < dims; i++) f64(); return c; };
  const pts = () => { const n = u32(), a = []; for (let i = 0; i < n; i++) a.push(pt()); return a; };
  const sub = () => { const g = readWkb(buf, o); o = g.end; return g.geom; };
  let geom;
  if (t === 1) geom = { type: 'Point', coordinates: pt() };
  else if (t === 2) geom = { type: 'LineString', coordinates: pts() };
  else if (t === 3) { const n = u32(), r = []; for (let i = 0; i < n; i++) r.push(pts()); geom = { type: 'Polygon', coordinates: r }; }
  else if (t >= 4 && t <= 6) { const n = u32(), parts = []; for (let i = 0; i < n; i++) parts.push(sub().coordinates); geom = { type: ['MultiPoint', 'MultiLineString', 'MultiPolygon'][t - 4], coordinates: parts }; }
  else if (t === 7) { const n = u32(), g = []; for (let i = 0; i < n; i++) g.push(sub()); geom = { type: 'GeometryCollection', geometries: g }; }
  else throw new Error(`WKB geometry type ${t} not handled`);
  return { geom, end: o };
}
function gpkgGeom(b) {
  if (!b || b.length < 8 || b[0] !== 0x47 || b[1] !== 0x50) return null;
  const flags = b[3]; if (flags & 0x10) return null;                       // empty geometry
  const env = (flags >> 1) & 7, envLen = [0, 32, 48, 48, 64][env] ?? 0;
  return readWkb(Buffer.from(b), 8 + envLen).geom;
}
async function readGpkg(file) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  const layers = db.prepare(`SELECT c.table_name t, g.column_name g, g.srs_id s FROM gpkg_contents c JOIN gpkg_geometry_columns g ON g.table_name = c.table_name WHERE c.data_type = 'features'`).all();
  const out = [];
  for (const L of layers) {
    for (const row of db.prepare(`SELECT * FROM "${L.t}"`).all()) {
      const geom = gpkgGeom(row[L.g]); const props = { ...row }; delete props[L.g];
      out.push({ layer: L.t, srs: L.s, geom, props });
    }
  }
  db.close();
  return { layers: layers.map(l => ({ table: l.t, srs: l.s })), features: out };
}

// ---- ESRI shapefile (.shp + .dbf + .prj) from a zip, through unzip
function readShp(shp) {
  const feats = []; let o = 100;
  while (o + 8 <= shp.length) {
    const len = shp.readInt32BE(o + 4) * 2; const c = o + 8; o = c + len;
    const type = shp.readInt32LE(c); if (type === 0) { feats.push(null); continue; }
    const base = type % 10;
    if (base === 1) { feats.push({ type: 'Point', coordinates: [shp.readDoubleLE(c + 4), shp.readDoubleLE(c + 12)] }); continue; }
    if (base === 8) { const n = shp.readInt32LE(c + 36), a = []; for (let i = 0; i < n; i++) a.push([shp.readDoubleLE(c + 40 + 16 * i), shp.readDoubleLE(c + 48 + 16 * i)]); feats.push({ type: 'MultiPoint', coordinates: a }); continue; }
    const np = shp.readInt32LE(c + 36), n = shp.readInt32LE(c + 40), parts = [];
    for (let i = 0; i < np; i++) parts.push(shp.readInt32LE(c + 44 + 4 * i));
    const p0 = c + 44 + 4 * np, rings = parts.map((s, i) => { const e = i + 1 < np ? parts[i + 1] : n, r = []; for (let k = s; k < e; k++) r.push([shp.readDoubleLE(p0 + 16 * k), shp.readDoubleLE(p0 + 16 * k + 8)]); return r; });
    if (base === 3) feats.push(rings.length === 1 ? { type: 'LineString', coordinates: rings[0] } : { type: 'MultiLineString', coordinates: rings });
    else if (base === 5) {                                   // clockwise rings are outer (shapefile spec), the rest are holes of the last outer
      const polys = []; for (const r of rings) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; if (a <= 0 || !polys.length) polys.push([r]); else polys[polys.length - 1].push(r); }
      feats.push(polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys });
    } else throw new Error(`shapefile type ${type} not handled`);
  }
  return feats;
}
function readDbf(dbf, utf8) {
  const n = dbf.readUInt32LE(4), hl = dbf.readUInt16LE(8), rl = dbf.readUInt16LE(10), fields = [];
  for (let o = 32; dbf[o] !== 0x0d && o < hl; o += 32) fields.push({ name: dbf.toString('latin1', o, o + 11).replace(/\0.*$/, ''), type: String.fromCharCode(dbf[o + 11]), len: dbf[o + 16] });
  const rows = [];
  for (let i = 0; i < n; i++) {
    let o = hl + i * rl + 1; const r = {};
    for (const f of fields) { const raw = dbf.toString(utf8 ? 'utf8' : 'latin1', o, o + f.len).trim(); o += f.len; r[f.name] = f.type === 'N' || f.type === 'F' ? (raw === '' ? null : +raw) : raw || null; }
    rows.push(r);
  }
  return rows;
}
function readShpZip(zipFile) {
  const names = execFileSync('unzip', ['-Z1', zipFile], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const get = n => execFileSync('unzip', ['-p', zipFile, n], { maxBuffer: 1 << 30 });
  const out = [];
  for (const shpName of names.filter(n => /\.shp$/i.test(n))) {
    const stem = shpName.slice(0, -4), find = e => names.find(n => n.toLowerCase() === (stem + e).toLowerCase());
    const prj = find('.prj') ? get(find('.prj')).toString() : '', cpg = find('.cpg') ? get(find('.cpg')).toString() : '';
    const geoms = readShp(get(shpName)), rows = find('.dbf') ? readDbf(get(find('.dbf')), /utf-?8/i.test(cpg)) : [];
    const srs = /British_National_Grid|OSGB_1936|27700/i.test(prj) ? 27700 : /WGS_1984|4326/i.test(prj) && !/Mercator/i.test(prj) ? 4326 : null;
    if (!srs) throw new Error(`${shpName}: unknown projection ${prj.slice(0, 80)}`);
    geoms.forEach((g, i) => out.push({ layer: stem.split('/').pop(), srs, geom: g, props: rows[i] || {} }));
  }
  return { layers: [...new Set(out.map(f => f.layer))].map(l => ({ table: l, srs: out.find(f => f.layer === l).srs })), features: out };
}
// ---- RFC 4180 CSV
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const h = rows[0].map(x => x.replace(/^﻿/, '').trim());
  return rows.slice(1).filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---- geometry helpers: walk coordinates, test against the zone box, transform to WGS84
const eachPt = (g, f) => { if (!g) return; if (g.type === 'GeometryCollection') return g.geometries.forEach(x => eachPt(x, f)); const w = c => typeof c[0] === 'number' ? f(c) : c.forEach(w); w(g.coordinates); };
const mapPts = (g, f) => g.type === 'GeometryCollection' ? { ...g, geometries: g.geometries.map(x => mapPts(x, f)) } : { ...g, coordinates: (function m(c) { return typeof c[0] === 'number' ? f(c) : c.map(m); })(g.coordinates) };
function bboxOf(g) { const b = [Infinity, Infinity, -Infinity, -Infinity]; eachPt(g, ([x, y]) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }); return b; }
function segHitsBox(a, b, B) {           // Liang-Barsky
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - B[0]], [dx, B[2] - a[0]], [-dy, a[1] - B[1]], [dy, B[3] - a[1]]]) {
    if (p === 0) { if (q < 0) return false; } else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
}
const ringsOf = g => !g ? [] : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'GeometryCollection' ? g.geometries.flatMap(ringsOf) : [];
function pointInPolys(p, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : g.type === 'GeometryCollection' ? g.geometries.filter(x => /Polygon/.test(x.type)).flatMap(x => x.type === 'Polygon' ? [x.coordinates] : x.coordinates) : [];
  return polys.some(rings => rings.reduce((inside, r, i) => { let c = false; for (let a = 0, b = r.length - 1; a < r.length; b = a++) { if ((r[a][1] > p[1]) !== (r[b][1] > p[1]) && p[0] < (r[b][0] - r[a][0]) * (p[1] - r[a][1]) / (r[b][1] - r[a][1]) + r[a][0]) c = !c; } return i === 0 ? c : inside && !c; }, false));
}
// a geometry meets box B [x0, y0, x1, y1]: a vertex inside, an edge crossing, or the box inside a polygon
function meets(g, B) {
  const bb = bboxOf(g); if (bb[2] < B[0] || bb[0] > B[2] || bb[3] < B[1] || bb[1] > B[3]) return false;
  let hit = false; eachPt(g, ([x, y]) => { if (x >= B[0] && x <= B[2] && y >= B[1] && y <= B[3]) hit = true; }); if (hit) return true;
  for (const r of ringsOf(g)) for (let i = 0; i + 1 < r.length; i++) if (segHitsBox(r[i], r[i + 1], B)) return true;
  return pointInPolys([(B[0] + B[2]) / 2, (B[1] + B[3]) / 2], g);
}
const r6 = v => Math.round(v * 1e6) / 1e6, r1 = v => Math.round(v * 10) / 10;
const cleanProps = p => { const kept = {}, dropped = new Set(); for (const [k, v] of Object.entries(p)) { if (DROP_FIELD.test(k)) { dropped.add(k); continue; } kept[k] = typeof v === 'bigint' ? Number(v) : v instanceof Uint8Array ? null : v === '' ? null : v; } return { kept, dropped }; };

async function harvest(keys) {
  const { bngProjector } = await import('./lib.mjs'); const proj4 = (await import('proj4')).default;
  await bngProjector(); const P = proj4('EPSG:4326', 'BNG');
  const toWgs = ([e, n]) => { const [lon, lat] = P.inverse([e, n]); return [r6(lon), r6(lat)]; }, toBng = ([lon, lat]) => P.forward([lon, lat]);
  const cat = new Map(readJson(join(OUT, 'catalogue.json')).datasets.map(d => [d.id, d]));
  const tri = readJson(join(OUT, 'triage.json')).datasets;
  const BOXB = [ZONE_BNG.e0, ZONE_BNG.n0, ZONE_BNG.e1, ZONE_BNG.n1];
  const CWB = (() => { const a = toBng([CW_BOX[0], CW_BOX[1]]), b = toBng([CW_BOX[2], CW_BOX[3]]); return [a[0], a[1], b[0], b[1]]; })();
  const summary = [];
  for (const key of keys.length ? keys : Object.keys(HARVEST)) {
    const H = HARVEST[key]; if (!H) throw new Error(`unknown harvest key ${key}`);
    const d = cat.get(H.id), T = tri[H.id];
    if (!T.open || T.sensitive) throw new Error(`${key}: ${H.id} is not open (${T.licence}) or is sensitive`);
    const pick = (d.resources.filter(r => H.file ? decodeURIComponent(r.file || r.url.split('/').pop()) === H.file : r.format === H.fmt || (H.fmt === 'shpzip' && r.format === 'zip')));
    if (!pick.length) throw new Error(`${key}: no resource ${H.file || H.fmt} in ${H.id}`);
    const resources = H.all ? pick : [pick.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]];
    let feats = [], layers = [];
    const used = [];
    for (const r of resources) {
      const url = r.url || `${BASE}/download/${H.id}/${r.id}/${r.file}`, name = decodeURIComponent(url.split('/').pop());
      const raw = await rawFile(`${H.id}/${name}`, url);
      used.push({ resource: r.id, file: name, url, size: r.size, resource_date: r.date, fetched: raw.fetched });
      let got;
      if (H.fmt === 'gpkg') got = await readGpkg(raw.file);
      else if (H.fmt === 'shpzip') got = readShpZip(raw.file);
      else if (H.fmt === 'geojson') { const j = readJson(raw.file); const crs = j.crs?.properties?.name || ''; const srs = /27700/.test(crs) ? 27700 : 4326; got = { layers: [{ table: name, srs, crs }], features: j.features.map(f => ({ layer: name, srs, geom: f.geometry, props: f.properties || {} })) }; }
      else if (H.fmt === 'csv') {
        const rows = parseCsv(readFileSync(raw.file, 'utf8'));
        const cols = Object.keys(rows[0] || {}), lat = cols.find(c => /^lat(itude)?$/i.test(c)), lon = cols.find(c => /^(lon|lng|long|longitude)$/i.test(c)), ea = cols.find(c => /^(easting|x|x_coord)$/i.test(c)), no = cols.find(c => /^(northing|y|y_coord)$/i.test(c));
        if (!(lat && lon) && !(ea && no)) throw new Error(`${key}: no coordinate columns in ${cols.join(', ')}`);
        got = { layers: [{ table: name, srs: lat ? 4326 : 27700, columns: lat ? [lon, lat] : [ea, no] }], features: rows.map(p => {
          const x = +(lat ? p[lon] : p[ea]), y = +(lat ? p[lat] : p[no]);
          return { layer: name, srs: lat ? 4326 : 27700, geom: isFinite(x) && isFinite(y) && x && y ? { type: 'Point', coordinates: [x, y] } : null, props: p };
        }) };
      }
      feats.push(...got.features.map(f => ({ ...f, resource: r.id }))); layers.push(...got.layers);
    }
    // to BNG for the zone test, then WGS84 for the output
    const kept = [], dropped = new Set(); let noGeom = 0;
    for (const f of feats) {
      if (!f.geom) { noGeom++; continue; }
      const gB = f.srs === 4326 ? mapPts(f.geom, c => toBng(c)) : f.geom;
      if (!meets(gB, BOXB)) continue;
      const { kept: props, dropped: dr } = cleanProps(f.props); dr.forEach(x => dropped.add(x));
      const bb = bboxOf(gB), inside = bb[0] >= BOXB[0] && bb[1] >= BOXB[1] && bb[2] <= BOXB[2] && bb[3] <= BOXB[3];
      kept.push({ type: 'Feature', properties: { ...(layers.length > 1 ? { layer: f.layer } : {}), ...props, in_cw: meets(gB, CWB), whole_in_zone: inside },
        geometry: f.srs === 4326 ? mapPts(f.geom, ([x, y]) => [r6(x), r6(y)]) : mapPts(f.geom, toWgs) });
    }
    const lic = d.licence, licUrl = readJson(join(OUT, 'catalogue.json')).meta.licence_urls[lic] || null;
    const meta = {
      source: `London Datastore: ${d.title} (${d.publisher})`, dataset: H.id, page: `${BASE}/dataset/${d.slug}`, resources: used,
      licence: lic, licence_url: licUrl,
      attribution: (T.licence === 'ogl' ? `Contains public sector information licensed under the ${lic} (${d.publisher}).` : `${d.publisher}, ${lic}.`) + ' The GLA cannot warrant the quality or accuracy of the data (London Datastore terms).',
      dataset_modified: d.modified, update_frequency: d.update_frequency, geo: d.geo, theme: H.theme,
      layers, crs_source: [...new Set(layers.map(l => l.srs))].map(s => 'EPSG:' + s).join(', '), crs_output: 'EPSG:4326 (WGS84), 6 decimal places; BNG to WGS84 through the OS OSTN15 grid (lib.mjs bngProjector)',
      method: `walk-london-datastore.mjs harvest ${key}: download ${H.all ? 'every ' + H.fmt + ' resource' : 'the newest matching resource'} (${H.fmt}); read every feature; keep a feature whose geometry meets the zone (the 3D model box, BNG E ${ZONE_BNG.e0}-${ZONE_BNG.e1}, N ${ZONE_BNG.n0}-${ZONE_BNG.n1}; WGS84 ${ZONE_WGS84.join(', ')}): a vertex inside, an edge crossing the box or the box inside a polygon. Whole geometries are kept (not cut at the box): whole_in_zone says whether all of it lies inside. in_cw: the geometry meets the Canary Wharf registry box ${CW_BOX.join(', ')}. Source attributes kept as published except fields matching ${DROP_FIELD.source} (none are expected).`,
      counts: { source_features: feats.length, no_geometry: noGeom, in_zone: kept.length, in_cw: kept.filter(f => f.properties.in_cw).length },
      fields_dropped: [...dropped],
    };
    const dir = join(OUT, key); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, key + '.geojson'), '{"type":"FeatureCollection","meta":' + JSON.stringify(meta, null, 1) + ',\n"features":[\n' + kept.map(f => JSON.stringify(f)).join(',\n') + '\n]}\n');
    summary.push([key, H.id, lic, meta.counts]);
    console.log(key, H.id, JSON.stringify(meta.counts));
  }
  return summary;
}

// ================================================================== main
const cmd = args[0];
if (cmd === 'walk') await walk();
else if (cmd === 'triage') triage();
else if (cmd === 'harvest') await harvest(args.slice(1).filter(a => !a.startsWith('--')));
else { console.log('usage: walk-london-datastore.mjs walk [--details] [--refresh] | triage | harvest [key ...] [--refresh]\nharvest keys: ' + Object.keys(HARVEST).join(' ')); }
