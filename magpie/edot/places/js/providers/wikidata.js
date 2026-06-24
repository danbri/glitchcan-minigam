// providers/wikidata.js — names + Wikidata QIDs from the live entity search.
//
// wbsearchentities returns label + QID + a short disambiguating description for
// any entity, CORS-enabled (origin=*), no key. It does NOT return coordinates,
// so coords() lazily pulls P625 for a chosen entity — you only pay for the one
// the user actually picks.
//
// Normalized Place shape (shared across providers):
//   { name, wikidataId, lat, lon, kind, description, source }

const API = 'https://www.wikidata.org/w/api.php';

export async function search(query, { limit = 8, lang = 'en', fetch = globalThis.fetch, signal } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const url = `${API}?action=wbsearchentities&format=json&origin=*`
    + `&language=${lang}&uselang=${lang}&type=item&limit=${limit}&search=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`wikidata ${res.status}`);
  const data = await res.json();
  return (data.search || []).map((e) => ({
    name: e.label || e.id,
    wikidataId: e.id,            // e.g. "Q23436"
    lat: null,
    lon: null,
    kind: null,
    description: e.description || null,
    source: 'wikidata',
  }));
}

// Lazily resolve coordinates (P625) for one entity, after the user selects it.
export async function coords(qid, { fetch = globalThis.fetch, signal } = {}) {
  if (!qid) return null;
  const url = `${API}?action=wbgetclaims&format=json&origin=*&property=P625&entity=${encodeURIComponent(qid)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`wikidata ${res.status}`);
  const data = await res.json();
  const v = data?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  return v ? { lat: v.latitude, lon: v.longitude } : null;
}
