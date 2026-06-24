// places.js — the lazy facade over the place-data providers.
//
// LAYERING. Apps import this module on demand (e.g. dynamic import() when a
// location field is first focused), so the suite pays nothing until a place is
// searched. This facade in turn imports each PROVIDER module only when a source
// that uses it is actually queried — REGISTRY values are import() thunks, never
// eagerly evaluated. The CATALOGUE (places-catalogue.json) is data: it says which
// sources exist, their licences, endpoints, and where any in-repo extract lives.
//
// searchPlaces() runs the enabled sources concurrently, then merges results so a
// coordless Wikidata hit (name + QID) and a GeoNames/local hit (coords) for the
// same place collapse into one Place carrying both — names plus QIDs, with
// coordinates when any source has them.

const REGISTRY = {
  wikidata: () => import('./providers/wikidata.js'),
  geonames: () => import('./providers/geonames.js'),
  local: () => import('./providers/local.js'),
};

const _mods = new Map();
function providerModule(key) {
  if (!REGISTRY[key]) throw new Error(`unknown place provider: ${key}`);
  if (!_mods.has(key)) _mods.set(key, REGISTRY[key]());
  return _mods.get(key); // a Promise<module>; cached so each provider loads once
}

let _catalogue = null;
export async function catalogue(url = new URL('../places-catalogue.json', import.meta.url), fetch = globalThis.fetch) {
  if (!_catalogue) _catalogue = await (await fetch(url)).json();
  return _catalogue;
}

// Resolve an extract source's `extract.path` (repo-relative-ish) to a fetchable URL.
function extractUrl(spec) {
  return spec.extract ? new URL(`../${spec.extract.path}`, import.meta.url) : undefined;
}

export async function searchPlaces(query, opts = {}) {
  const { sources, limit = 8, signal, fetch, config = {}, onUpdate } = opts;
  const cat = opts.catalogue || await catalogue(undefined, fetch);
  const active = new Set(['api', 'extract']); // 'planned'/'disabled' entries are catalogue docs, not queried
  const enabled = cat.sources.filter((s) =>
    active.has(s.runtime) && (!sources || sources.includes(s.id)));

  // Accumulate across sources, emitting a merged snapshot as each one resolves —
  // so a fast/offline source (the cached extract) paints immediately instead of
  // waiting on a slow or unreachable API. The awaited return is the final set.
  const acc = [];
  const snapshot = () => rank(merge(acc), query).slice(0, limit);
  await Promise.allSettled(enabled.map(async (s) => {
    const mod = await providerModule(s.provider || s.id);
    const o = {
      limit, signal, fetch,
      ...(s.options || {}),
      ...(s.extract ? { url: extractUrl(s) } : {}),
      ...(config[s.id] || {}),
    };
    const r = await mod.search(query, o);
    if (Array.isArray(r) && r.length) { acc.push(...r); if (onUpdate) onUpdate(snapshot()); }
    return r;
  }));

  return snapshot();
}

// Re-export the Wikidata coordinate lookup so a UI can fill coords on selection
// without statically importing the provider.
export async function coordsFor(wikidataId, opts = {}) {
  const mod = await providerModule('wikidata');
  return mod.coords(wikidataId, opts);
}

// ---- merge & rank ----

function keyOf(p) {
  if (p.wikidataId) return 'q:' + p.wikidataId;
  if (p.lat != null && p.lon != null) return `g:${p.name.toLowerCase()}@${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
  return 'n:' + p.name.toLowerCase();
}

export function merge(list) {
  const by = new Map();
  for (const p of list) {
    const k = keyOf(p);
    if (!by.has(k)) { by.set(k, { ...p, sources: [p.source] }); continue; }
    const e = by.get(k);
    if (e.wikidataId == null) e.wikidataId = p.wikidataId;
    if (e.lat == null && p.lat != null) { e.lat = p.lat; e.lon = p.lon; }
    if (e.description == null) e.description = p.description;
    if (e.kind == null) e.kind = p.kind;
    if (!e.sources.includes(p.source)) e.sources.push(p.source);
  }
  return [...by.values()];
}

export function rank(list, query) {
  const q = (query || '').trim().toLowerCase();
  const score = (p) => {
    let s = 0;
    const n = p.name.toLowerCase();
    if (n === q) s += 100; else if (n.startsWith(q)) s += 50; else if (n.includes(q)) s += 20;
    if (p.wikidataId) s += 8;   // entities with a stable QID rank above bare strings
    if (p.lat != null) s += 4;  // mappable places rank above coordless ones
    return s;
  };
  return list
    .map((p) => [p, score(p)])
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);
}
