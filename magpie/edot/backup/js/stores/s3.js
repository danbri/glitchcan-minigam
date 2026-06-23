// stores/s3.js — store an encrypted backup in S3-compatible object storage.
//
// Browser reality: raw AWS SigV4 from a page is awkward (you'd ship the secret
// key to the browser, and the bucket needs permissive CORS). So the PRIMARY,
// CORS-friendly path here is **presigned URLs**: the user (or a tiny backend)
// presigns short-lived PUT/GET/DELETE URLs and the browser just follows them.
// The blob is opaque ciphertext, so a plain HTTP PUT/GET is all we need.
//
// Two cfg styles are supported:
//   A) Presign callback (recommended):
//        cfg.presign(method, id) -> Promise<url>   // you implement signing server-side
//      and cfg.listUrl / cfg.list() for listing (S3 ListObjectsV2 is XML).
//   B) Direct per-id URLs for quick tests / fully-public-write buckets:
//        cfg.urls = { put(id), get(id), del(id), list }  (each -> url string)
//
// SigV4 is intentionally NOT implemented in-browser (secret exposure). The
// `presign` seam keeps signing server-side and testable. Documented in README.
//
// cfg: { presign?, urls?, listUrl?, prefix?, region?, bucket?, fetchImpl? }

export const id = 's3';
export const label = 'S3-compatible (presigned)';

const EXT = '.enc';

function f(cfg) { return cfg.fetchImpl || ((...a) => fetch(...a)); }
function key(cfg, bid) { return `${(cfg.prefix || 'edot-backups').replace(/\/+$/, '')}/${safeId(bid)}${EXT}`; }

// Resolve a URL for one operation from whichever cfg style is provided.
async function urlFor(cfg, method, bid) {
  if (typeof cfg.presign === 'function') return cfg.presign(method, key(cfg, bid));
  if (cfg.urls) {
    if (method === 'PUT' && cfg.urls.put) return typeof cfg.urls.put === 'function' ? cfg.urls.put(bid) : cfg.urls.put;
    if (method === 'GET' && cfg.urls.get) return typeof cfg.urls.get === 'function' ? cfg.urls.get(bid) : cfg.urls.get;
    if (method === 'DELETE' && cfg.urls.del) return typeof cfg.urls.del === 'function' ? cfg.urls.del(bid) : cfg.urls.del;
  }
  throw new Error(`S3: no way to obtain a presigned ${method} URL (set cfg.presign or cfg.urls).`);
}

export async function put(bid, bytes, cfg) {
  const url = await urlFor(cfg, 'PUT', bid);
  const res = await f(cfg)(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: toBody(bytes),
  });
  if (!res.ok) throw new Error(`S3 PUT failed (${res.status}).`);
  return {};
}

export async function get(bid, cfg) {
  const url = await urlFor(cfg, 'GET', bid);
  const res = await f(cfg)(url, { method: 'GET' });
  if (!res.ok) throw new Error(`S3 GET failed (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function remove(bid, cfg) {
  const url = await urlFor(cfg, 'DELETE', bid);
  const res = await f(cfg)(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed (${res.status}).`);
  return {};
}

// Listing: S3 ListObjectsV2 returns XML (?list-type=2&prefix=...). The user
// supplies a presigned/anonymous list URL; we parse <Contents><Key><Size>.
export async function list(cfg) {
  const url = cfg.listUrl
    || (typeof cfg.presign === 'function' ? await cfg.presign('LIST', (cfg.prefix || 'edot-backups')) : null)
    || (cfg.urls && (typeof cfg.urls.list === 'function' ? cfg.urls.list() : cfg.urls.list));
  if (!url) throw new Error('S3: set cfg.listUrl (or cfg.presign / cfg.urls.list) to list backups.');
  const res = await f(cfg)(url, { method: 'GET' });
  if (!res.ok) throw new Error(`S3 LIST failed (${res.status}).`);
  return parseListXml(await res.text(), cfg.prefix || 'edot-backups');
}

// Minimal, dependency-free parse of ListObjectsV2 XML <Contents> entries.
export function parseListXml(xml, prefix) {
  const out = [];
  const re = /<Contents>([\s\S]*?)<\/Contents>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const k = tag(block, 'Key');
    if (!k || !k.endsWith(EXT)) continue;
    const base = k.replace(new RegExp(`^${escapeRe(prefix.replace(/\/+$/, ''))}/`), '').slice(0, -EXT.length);
    out.push({
      id: base,
      size: Number(tag(block, 'Size')) || 0,
      modified: tag(block, 'LastModified') || null,
    });
  }
  return out;
}

// ---- helpers ----
function tag(s, name) { const m = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`).exec(s); return m ? m[1] : ''; }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function safeId(bid) { return String(bid).replace(/[^A-Za-z0-9._-]/g, '_'); }
function toBody(bytes) { return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); }
