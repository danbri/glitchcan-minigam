// stores/webdav.js — store an encrypted backup on a WebDAV server.
//
// Plain HTTP verbs against a WebDAV collection (base URL):
//   PUT      <base>/<id>.enc        upload ciphertext (raw bytes)
//   GET      <base>/<id>.enc        download ciphertext
//   PROPFIND <base>/  Depth: 1      list the collection (XML multistatus)
//   DELETE   <base>/<id>.enc        remove
// Basic auth from cfg (user/pass). `fetchImpl` injectable for testing.
//
// CORS: most WebDAV servers (Nextcloud, Apache mod_dav) need CORS headers added
// to allow a browser origin, and PROPFIND must be in Access-Control-Allow-Methods.
// Documented in README; the protocol itself is fully implemented here.
//
// cfg: { baseUrl, user?, password?, fetchImpl? }

export const id = 'webdav';
export const label = 'WebDAV';

const EXT = '.enc';

function ctx(cfg) {
  if (!cfg.baseUrl) throw new Error('WebDAV: cfg.baseUrl is required.');
  const base = cfg.baseUrl.replace(/\/+$/, '') + '/';
  const f = cfg.fetchImpl || ((...a) => fetch(...a));
  const headers = {};
  if (cfg.user != null) headers.Authorization = 'Basic ' + b64utf8(`${cfg.user}:${cfg.password || ''}`);
  return { base, f, headers };
}

const fileUrl = (base, bid) => base + encodeURIComponent(safeId(bid)) + EXT;

export async function put(bid, bytes, cfg) {
  const { base, f, headers } = ctx(cfg);
  const res = await f(fileUrl(base, bid), {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
    body: toBody(bytes),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) throw new Error(`WebDAV PUT failed (${res.status}).`);
  return {};
}

export async function get(bid, cfg) {
  const { base, f, headers } = ctx(cfg);
  const res = await f(fileUrl(base, bid), { method: 'GET', headers });
  if (!res.ok) throw new Error(`WebDAV GET failed (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function remove(bid, cfg) {
  const { base, f, headers } = ctx(cfg);
  const res = await f(fileUrl(base, bid), { method: 'DELETE', headers });
  if (!res.ok && res.status !== 204 && res.status !== 404) throw new Error(`WebDAV DELETE failed (${res.status}).`);
  return {};
}

export async function list(cfg) {
  const { base, f, headers } = ctx(cfg);
  const res = await f(base, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: '1', 'Content-Type': 'application/xml' },
    // Ask only for the props we use — keeps responses small and predictable.
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop>'
        + '<d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>',
  });
  if (!res.ok && res.status !== 207) throw new Error(`WebDAV PROPFIND failed (${res.status}).`);
  return parsePropfind(await res.text());
}

// Parse a WebDAV multistatus body into {id,size,modified}. Namespace-agnostic
// (matches d:response / D:response / response) so it works across servers.
export function parsePropfind(xml) {
  const out = [];
  const re = /<(?:\w+:)?response[\s>]([\s\S]*?)<\/(?:\w+:)?response>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const href = decodeURIComponent(tag(block, 'href') || '');
    const name = href.replace(/\/+$/, '').split('/').pop();
    if (!name || !name.endsWith(EXT)) continue;     // skip the collection itself + non-backups
    out.push({
      id: name.slice(0, -EXT.length),
      size: Number(tag(block, 'getcontentlength')) || 0,
      modified: tag(block, 'getlastmodified') || null,
    });
  }
  return out;
}

// ---- helpers ----
function tag(s, local) { const m = new RegExp(`<(?:\\w+:)?${local}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${local}>`).exec(s); return m ? m[1].trim() : ''; }
function safeId(bid) { return String(bid).replace(/[^A-Za-z0-9._-]/g, '_'); }
function toBody(bytes) { return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); }
function b64utf8(str) {
  const u8 = new TextEncoder().encode(str);
  let bin = ''; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
