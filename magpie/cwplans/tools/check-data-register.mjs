// Checks magpie/cwplans/data-register.json against the committed files, and writes DATA-REGISTER.md.
//
//   node magpie/cwplans/tools/check-data-register.mjs           # check only; exit 1 on a problem
//   node magpie/cwplans/tools/check-data-register.mjs --write   # check, then write DATA-REGISTER.md and pipeline.jsonld
//
// Provenance (pipeline.json, hand-kept): every tool is an activity that used files, local raw data or external
// sources and generated files. Checked here: each tool exists and is listed (or listed as a library or test); each
// committed input and output exists; each register entry made by a tool has an activity that generates it; every
// "after" names an activity. --write exports pipeline.jsonld (W3C PROV-O, DCAT, Dublin Core) for a knowledge graph.
//
// Checks: every committed or staged data file in magpie/cwplans has an entry; every entry's file exists;
// every source and OSM extract named is defined; every page that loads OSM-derived data shows the
// "© OpenStreetMap contributors" notice with a link to https://www.openstreetmap.org/copyright.
// Data file = any tracked file except code (.mjs, .py, .c, .html), .gitignore, vendor/ directories (third-party code) and skills/.
// Why the register exists: CLAUDE.md, Data ethics, the magpie/cwplans exception.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CW = join(dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(readFileSync(join(CW, 'data-register.json'), 'utf8'));
const problems = [];

const tracked = execFileSync('git', ['ls-files', '--cached', '--', '.'], { cwd: CW, encoding: 'utf8' })
  .split('\n').filter(Boolean);
const isData = p => !/\.(mjs|py|c|sh|html)$/.test(p) && !p.endsWith('.gitignore') && !p.includes('vendor/') && !p.startsWith('skills/')
  && !['data-register.json', 'DATA-REGISTER.md'].includes(p);
const byPath = new Map(reg.files.map(f => [f.path, f]));

for (const p of tracked.filter(isData)) if (!byPath.has(p)) problems.push(`not in the register: ${p}`);
for (const f of reg.files) {
  if (!existsSync(join(CW, f.path))) problems.push(`register entry has no file: ${f.path}`);
  for (const s of f.sources) if (!reg.sources[s]) problems.push(`${f.path}: unknown source "${s}"`);
  if (!(f.osm?.use in reg.osm_use_values)) problems.push(`${f.path}: osm.use "${f.osm?.use}" is not one of ${Object.keys(reg.osm_use_values).join(', ')}`);
  if (f.osm?.extract && !reg.osm_extracts[f.osm.extract]) problems.push(`${f.path}: unknown OSM extract "${f.osm.extract}"`);
  if (f.osm?.use !== 'none' && !f.sources.includes('osm') && f.osm?.use !== 'notes') problems.push(`${f.path}: uses OSM but "osm" is not in its sources`);
  if (f.sources.includes('osm') && f.osm?.use === 'none') problems.push(`${f.path}: lists "osm" as a source but osm.use is none`);
}
for (const e of reg.osm_elsewhere_in_repo.paths)
  if (!existsSync(join(CW, '..', '..', e.path))) problems.push(`osm_elsewhere_in_repo: no file ${e.path}`);

const OSM_NOTICE = /href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>© OpenStreetMap contributors</;
const odblFiles = new Set(reg.files.filter(f => ['raw', 'derived', 'counts'].includes(f.osm.use)).map(f => f.path));
for (const pg of reg.pages) {
  const html = readFileSync(join(CW, pg.path), 'utf8');
  const osmLoads = pg.loads.filter(l => odblFiles.has(l));
  if (osmLoads.length && !OSM_NOTICE.test(html)) problems.push(`${pg.path} shows OSM data (${osmLoads.join(', ')}) but has no visible © OpenStreetMap contributors notice`);
}

// ---- provenance: pipeline.json
const PIPE = join(CW, 'pipeline.json'), pipe = existsSync(PIPE) ? JSON.parse(readFileSync(PIPE, 'utf8')) : null;
if (pipe) {
  const acts = pipe.activities, ids = new Set(acts.map(a => a.id)), listed = new Set([...acts.map(a => a.tool), ...(pipe.libraries || []).map(l => l.tool), ...(pipe.tests || []).map(t => t.tool)]);
  const scripts = tracked.filter(p => /^(tools\/[^/]+|registry\/sources\/[^/]+\/tools\/[^/]+)\.(mjs|py|sh)$/.test(p));
  for (const t of scripts) if (!listed.has(t)) problems.push(`pipeline.json: tool not listed: ${t}`);
  const made = new Set();
  for (const a of acts) {
    if (!existsSync(join(CW, a.tool))) problems.push(`pipeline.json ${a.id}: no tool ${a.tool}`);
    for (const d of a.after || []) if (!ids.has(d)) problems.push(`pipeline.json ${a.id}: after names unknown activity ${d}`);
    for (const u of [...(a.used || []), ...(a.generated || [])]) {
      if (u.file && !existsSync(join(CW, u.file))) problems.push(`pipeline.json ${a.id}: no committed file ${u.file}`);
      if (u.source && !reg.sources[u.source]) problems.push(`pipeline.json ${a.id}: unknown source ${u.source}`);
    }
    for (const g of a.generated || []) if (g.file) made.add(g.file);
  }
  for (const f of reg.files) if (/tools\/[\w-]+\.(mjs|py|sh)/.test(f.produced_by || '') && !made.has(f.path)) problems.push(`pipeline.json: no activity generates ${f.path} (register: produced by ${f.produced_by})`);
}

const size = p => { if (!existsSync(join(CW, p))) return '(written below)'; const n = statSync(join(CW, p)).size; return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.ceil(n / 1e3)} kB`; };
const osmRows = reg.files.filter(f => f.osm.use !== 'none');
const reviews = reg.files.filter(f => f.review);
console.log(`${reg.files.length} files registered, ${tracked.filter(isData).length} data files tracked; ${osmRows.length} use OSM (${[...odblFiles].length} hold OSM data); ${reviews.length} marked for review.`);

if (process.argv.includes('--write')) {
  const esc = s => String(s).replace(/\|/g, '\\|');
  const lic = s => reg.sources[s] ? `${reg.sources[s].name.split(' (')[0]} (${reg.sources[s].licence})` : s;
  const out = [
    '# Data register: magpie/cwplans',
    '',
    `Generated from \`data-register.json\` by \`tools/check-data-register.mjs --write\` on ${new Date().toISOString().slice(0, 10)}. Edit the JSON, not this file.`,
    '',
    '## Policy',
    '',
    ...Object.entries(reg.policy).map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`),
    '',
    '## OpenStreetMap (ODbL) use',
    '',
    'Attribution on every page that shows OSM data: "© OpenStreetMap contributors", linked to https://www.openstreetmap.org/copyright.',
    '',
    '| extract | OSM data as of | fetched | committed |',
    '|---|---|---|---|',
    ...Object.entries(reg.osm_extracts).map(([k, e]) => `| ${k}: ${esc(e.url)} | ${esc(e.osm_data_as_of || '(API, live)')} | ${e.fetched} | ${e.committed ? 'yes' : 'no (' + e.local_path + ')'} |`),
    '',
    '| file | size | use | what OSM data | extract | shown on |',
    '|---|---|---|---|---|---|',
    ...osmRows.map(f => `| \`${f.path}\` | ${size(f.path)} | ${f.osm.use} | ${esc(f.osm.what || '')} | ${f.osm.extract || ''} | ${(f.shown_on || []).join(', ')} |`),
    '',
    'Use values: ' + Object.entries(reg.osm_use_values).map(([k, v]) => `**${k}**: ${v}`).join('; ') + '.',
    '',
    '### OSM elsewhere in the repository (not this project)',
    '',
    reg.osm_elsewhere_in_repo.note,
    '',
    ...reg.osm_elsewhere_in_repo.paths.map(e => `- \`${e.path}\`: ${e.use}, ${e.what}`),
    '',
    '## Marked for review',
    '',
    ...reviews.map(f => `- \`${f.path}\`: ${f.review}`),
    '',
    '## All registered files',
    '',
    '| file | size | what | sources (licence) |',
    '|---|---|---|---|',
    ...reg.files.map(f => `| \`${f.path}\` | ${size(f.path)} | ${esc(f.what)} | ${esc(f.sources.map(lic).join('; '))} |`),
    '',
    '## Sources',
    '',
    '| key | source | licence | attribution or note |',
    '|---|---|---|---|',
    ...Object.entries(reg.sources).map(([k, s]) => `| ${k} | ${esc(s.name)} | ${esc(s.licence)} | ${esc([s.attribution, s.note].filter(Boolean).join(' '))} |`),
    '',
  ].join('\n');
  writeFileSync(join(CW, 'DATA-REGISTER.md'), out);
  console.log('wrote DATA-REGISTER.md');
  if (pipe) {   // JSON-LD for a knowledge graph: activities, the files they used and made, and the external sources
    const BASE = 'https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/', REG = 'https://danbri.github.io/glitchcan-minigam/magpie/cwplans/data-register.json#';
    const fileId = p => BASE + p, srcId = k => REG + 'source/' + k, actId = id => REG + 'activity/' + id, localId = p => 'urn:cwplans:local:' + encodeURI(p);
    // a local path with a placeholder (<run>, <E>_<N>) is a pattern, not one file: a blank node with the pattern
    const ref = u => u.file ? { '@id': fileId(u.file) } : u.local ? (/[<>]/.test(u.local) ? { 'cwp:pathPattern': u.local } : { '@id': localId(u.local) }) : { '@id': srcId(u.source), ...(u.endpoint ? { 'dcat:accessURL': u.endpoint } : {}), ...(u.request ? { 'dct:description': u.request } : {}) };
    const graph = [];
    for (const a of pipe.activities) graph.push({ '@id': actId(a.id), '@type': 'prov:Activity', 'rdfs:label': a.id, 'dct:description': a.method, 'prov:used': (a.used || []).map(ref), 'prov:generated': (a.generated || []).map(ref),
      'cwp:tool': { '@id': fileId(a.tool) }, 'cwp:command': a.command, 'cwp:kind': a.kind, 'cwp:rule': a.rules || [], 'cwp:network': !!a.network, 'cwp:deterministic': a.deterministic !== false, 'cwp:after': (a.after || []).map(d => ({ '@id': actId(d) })) });
    const by = new Map(); for (const a of pipe.activities) for (const g of a.generated || []) if (g.file) by.set(g.file, actId(a.id));
    for (const f of reg.files) graph.push({ '@id': fileId(f.path), '@type': ['prov:Entity', 'dcat:Distribution'], 'dct:title': f.what, 'prov:wasDerivedFrom': f.sources.map(k => ({ '@id': srcId(k) })), ...(by.has(f.path) ? { 'prov:wasGeneratedBy': { '@id': by.get(f.path) } } : {}), 'cwp:osmUse': f.osm.use, ...(f.review ? { 'cwp:review': f.review } : {}) });
    for (const [k, v] of Object.entries(reg.sources)) graph.push({ '@id': srcId(k), '@type': ['prov:Entity', 'dcat:Dataset'], 'dct:title': v.name, 'dct:license': v.licence, ...(v.url ? { 'dcat:landingPage': v.url } : {}), ...(v.attribution ? { 'cwp:attribution': v.attribution } : {}) });
    writeFileSync(join(CW, 'pipeline.jsonld'), JSON.stringify({ '@context': { prov: 'http://www.w3.org/ns/prov#', dct: 'http://purl.org/dc/terms/', dcat: 'http://www.w3.org/ns/dcat#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#', cwp: REG + 'vocab/' }, '@graph': graph }, null, 1));
    console.log(`wrote pipeline.jsonld: ${pipe.activities.length} activities, ${reg.files.length} files, ${Object.keys(reg.sources).length} sources`);
  }
}

if (problems.length) { console.error(problems.map(p => '  ' + p).join('\n')); process.exit(1); }
