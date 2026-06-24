// providers/geonames.js — populated places, admin divisions and their timezones
// from the GeoNames gazetteer (12M+ features, CC-BY). Returns coordinates (which
// Wikidata search doesn't) but NOT QIDs — so it pairs well with wikidata.js: the
// facade merges a coordless QID hit with a GeoNames coordinate hit for the same
// place. Needs a free username (geonames.org); without one this source is a no-op.

const API = 'https://secure.geonames.org/searchJSON';

export async function search(query, { limit = 8, username, fetch = globalThis.fetch, signal } = {}) {
  const q = (query || '').trim();
  if (!q || !username) return [];
  const url = `${API}?q=${encodeURIComponent(q)}&maxRows=${limit}`
    + `&style=MEDIUM&username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geonames ${res.status}`);
  const data = await res.json();
  return (data.geonames || []).map((g) => ({
    name: g.name,
    wikidataId: null,
    lat: g.lat != null ? Number(g.lat) : null,
    lon: g.lng != null ? Number(g.lng) : null,
    kind: g.fcodeName || g.fcode || null,
    description: [g.adminName1, g.countryName].filter(Boolean).join(', ') || null,
    source: 'geonames',
  }));
}
