// Query the cwplans knowledge graph's Shardborough store in the browser: the Factoidal Lean engine (WebAssembly)
// plans each SPARQL query against the store manifest, this worker fetches only the blocks the plan names (the
// service worker keeps them), and the engine answers from those bytes. The same steps as @factoidal/core's
// bin/store.mjs (openStore, planQuery, queryStore), with fetch() in place of the file system.
// Messages: {id, type: 'init', base} | {id, type: 'query', sparql} | {id, type: 'describe', iri}. Skill: cwplans-kgx.
import { loadL4 } from 'https://cdn.jsdelivr.net/npm/@factoidal/core@0.7.1/l4-assets/l4factoidal.js';

const MAX_KEYS = 60, MAX_BYTES = 7_500_000;       // under the engine's per-query caps (64 artifacts, 8,388,608 bytes)
let engine, base, gen, manifestHex, entries = [], blocks = new Map();
const HEX = Array.from({ length: 256 }, (_, b) => b.toString(16).padStart(2, '0'));
const hexOf = u8 => { const p = new Array(u8.length); for (let i = 0; i < u8.length; i++) p[i] = HEX[u8[i]]; return p.join(''); };
const getBytes = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} for ${url}`); return new Uint8Array(await r.arrayBuffer()); };

async function init(b) {
  base = b; engine = await loadL4();
  gen = (await (await fetch(base + 'shardborough/CURRENT', { cache: 'no-cache' })).text()).trim();
  let manifest; for (const name of ['manifest.sbm2', 'manifest.sbm1']) { try { manifest = await getBytes(`${base}shardborough/${gen}/${name}`); break; } catch {} }
  if (!manifest) throw new Error('no manifest in ' + gen);
  manifestHex = hexOf(manifest);
  const ins = engine.call('storeManifestInspect', [manifestHex]); entries = ins.entries;
  return { generation: gen, rows: ins.totalRows, bytes: ins.totalBytes, blocks: entries.length, predicates: [...new Set(entries.map(e => e.predicate))].length, engine: engine.version() };
}
async function fetchKeys(keys) {
  const need = keys.filter(k => !blocks.has(k)); let fetched = 0;
  await Promise.all(need.map(async k => { const b = await getBytes(`${base}shardborough/${gen}/${k}`); blocks.set(k, b); fetched += b.length; }));
  return fetched;
}
async function query(sparql) {
  const t0 = performance.now();
  const plan = engine.call('storeQueryPlan', [manifestHex, sparql]);
  const keys = plan.keys.concat(plan.blobKeys ?? []);
  const fetched = await fetchKeys(keys);
  let total = 0; const artifacts = []; for (const k of keys) { artifacts.push({ key: k, offset: total, len: blocks.get(k).length }); total += blocks.get(k).length; }
  const blob = new Uint8Array(total); for (const a of artifacts) blob.set(blocks.get(a.key), a.offset);
  const env = engine.callBlobIO('storeQuery', [manifestHex, sparql, JSON.stringify(artifacts)], blob).envelope;
  if (env.ok === false) throw new Error(env.error || 'query refused');
  return { ...env, ms: Math.round(performance.now() - t0), blocks: keys.length, bytesRead: total, bytesFetched: fetched };
}
// everything about one IRI: the predicates in batches that stay under the caps, out-links and in-links
function batches() {
  const per = new Map(); for (const e of entries) { const p = per.get(e.predicate) || { n: 0, bytes: 0 }; p.n++; p.bytes += e.bytes; per.set(e.predicate, p); }
  const out = []; let cur = [], n = 0, bytes = 0;
  for (const [p, c] of [...per].sort((a, b) => b[1].bytes - a[1].bytes)) {
    if (cur.length && (n + c.n > MAX_KEYS || bytes + c.bytes > MAX_BYTES)) { out.push(cur); cur = []; n = 0; bytes = 0; }
    cur.push(p); n += c.n; bytes += c.bytes;
  }
  if (cur.length) out.push(cur); return out;
}
async function describe(iri) {
  const t0 = performance.now(), rows = { out: [], in: [] };
  for (const preds of batches()) {
    const o = preds.map(p => `{ <${iri}> <${p}> ?o BIND(<${p}> AS ?p) }`).join(' UNION ');
    const i = preds.map(p => `{ ?s <${p}> <${iri}> BIND(<${p}> AS ?p) }`).join(' UNION ');
    rows.out.push(...(await query(`SELECT ?g ?p ?o WHERE { GRAPH ?g { ${o} } }`)).srj.results.bindings);
    rows.in.push(...(await query(`SELECT ?g ?s ?p WHERE { GRAPH ?g { ${i} } } LIMIT 500`)).srj.results.bindings);
  }
  return { ...rows, ms: Math.round(performance.now() - t0) };
}
self.onmessage = async ({ data }) => {
  try {
    const r = data.type === 'init' ? await init(data.base) : data.type === 'query' ? await query(data.sparql) : await describe(data.iri);
    self.postMessage({ id: data.id, ok: true, r, cached: blocks.size });
  } catch (err) { self.postMessage({ id: data.id, ok: false, error: String(err?.message || err) }); }
};
