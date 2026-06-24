// providers/local.js — offline search over an in-repo cached extract (the
// catalogue's `extract` sources). The file is newline-delimited JSON, one
// normalized Place per line, already carrying { name, wikidataId, lat, lon }.
// Small extracts live in the repo (LFS for the larger gzipped ones); this
// provider needs no network, so it also makes the whole stack testable offline
// and gives the suite a usable baseline when APIs are blocked.
//
// Pass either a preloaded `index` (array of Place), or a `url` + `fetch` to load
// and parse it once. Parsed extracts are cached by url for the session.

const _cache = new Map();

export function parseNdjson(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = JSON.parse(l);
    return {
      name: p.name,
      wikidataId: p.wikidataId ?? p.qid ?? null,
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      kind: p.kind ?? null,
      description: p.description ?? null,
      source: p.source ?? 'local',
    };
  });
}

async function load(url, fetch) {
  if (!_cache.has(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`local extract ${res.status}`);
    _cache.set(url, parseNdjson(await res.text()));
  }
  return _cache.get(url);
}

export async function search(query, { limit = 8, index, url, fetch = globalThis.fetch } = {}) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const places = index || (url ? await load(url, fetch) : []);
  const starts = [];
  const contains = [];
  for (const p of places) {
    const n = p.name.toLowerCase();
    if (n.startsWith(q)) starts.push(p);
    else if (n.includes(q)) contains.push(p);
    if (starts.length >= limit) break;
  }
  return starts.concat(contains).slice(0, limit);
}
