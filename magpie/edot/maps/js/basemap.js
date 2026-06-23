// basemap.js — turn a maps-config basemap entry into a MapLibre style.
//
// Raster basemaps become a tiny inline style JSON with a single raster source +
// layer (works with no vector-tile backend, the whole point of the default).
// Vector basemaps are just a remote style URL handed straight to MapLibre.
//
// {s} subdomain placeholders are expanded here (MapLibre only understands
// {z}/{x}/{y}), honouring each provider's tile-usage policy: maxzoom is capped
// and attribution is carried through so the attribution control can show it.

// Expand a {s} subdomain tile template into one URL per subdomain.
export function expandSubdomains(template, subdomains) {
  if (!/\{s\}/.test(template)) return [template];
  return (subdomains && subdomains.length ? subdomains : ['a', 'b', 'c'])
    .map((s) => template.replace('{s}', s));
}

// Build a MapLibre raster style JSON for a raster basemap entry.
export function buildRasterStyle(entry) {
  const tiles = (entry.tiles || []).flatMap((t) => expandSubdomains(t, entry.subdomains));
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: entry.tileSize || 256,
        maxzoom: entry.maxzoom || 19,
        attribution: entry.attribution || '',
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  };
}

// Resolve a basemap entry to something setStyle() can take: an inline style
// object (raster) or a URL string (vector). Returns { style, vector }.
export function resolveBasemapStyle(entry) {
  if (!entry) return { style: { version: 8, sources: {}, layers: [] }, vector: false };
  if (entry.type === 'vector' && entry.styleUrl) return { style: entry.styleUrl, vector: true };
  return { style: buildRasterStyle(entry), vector: false };
}
