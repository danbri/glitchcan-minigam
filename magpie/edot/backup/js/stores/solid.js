// stores/solid.js — store an encrypted backup in a Solid Pod (LDP container).
//
// Solid resources are plain HTTP resources inside an LDP container:
//   PUT    <container><id>.enc      create/replace the resource
//   GET    <container><id>.enc      read it
//   DELETE <container><id>.enc      remove it
//   GET    <container>  (Accept: text/turtle)   list contained resources via
//          ldp:contains triples in the container description.
//
// AUTH — TIER-1 SHIM vs PRODUCTION:
//   Here: a bearer access token from cfg (Authorization: Bearer <token>). That's
//   enough to talk to a Pod for which you already hold a token.
//   Production Solid is **Solid-OIDC + DPoP**: you authenticate with the Pod's
//   OIDC issuer and present *DPoP-bound* access tokens (a per-request proof JWT
//   signed by a key bound to the token). Bearer-only tokens are rejected by
//   DPoP-enforcing servers. Wiring that up belongs with magpie/edot/auth/
//   (OidcClient/AuthSession) — see SOLID-OIDC TODO below. This is the storage
//   adapter that will later consume those tokens.
//
// cfg: { container, token?, dpopHeaders?, fetchImpl? }
//   container : Pod container URL ending in '/', e.g. https://you.pod/edot-backups/
//   token     : bearer access token (Tier-1 shim)
//   dpopHeaders: optional async (method, url) -> { Authorization, DPoP } so a
//                future Solid-OIDC/DPoP layer can inject proofs without forking
//                this file. (SOLID-OIDC TODO seam.)

export const id = 'solid';
export const label = 'Solid Pod';

const EXT = '.enc';

function ctx(cfg) {
  if (!cfg.container) throw new Error('Solid: cfg.container (Pod container URL) is required.');
  const container = cfg.container.replace(/\/+$/, '') + '/';
  const f = cfg.fetchImpl || ((...a) => fetch(...a));
  return { container, f };
}

// Resolve auth headers. Prefer a DPoP provider (production seam); fall back to
// the Tier-1 bearer token. SOLID-OIDC TODO: dpopHeaders is where AuthSession
// hands us a DPoP proof + bound access token per request.
async function authHeaders(cfg, method, url) {
  if (typeof cfg.dpopHeaders === 'function') return (await cfg.dpopHeaders(method, url)) || {};
  return cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {};
}

const resUrl = (container, bid) => container + encodeURIComponent(safeId(bid)) + EXT;

export async function put(bid, bytes, cfg) {
  const { container, f } = ctx(cfg);
  const url = resUrl(container, bid);
  const res = await f(url, {
    method: 'PUT',
    headers: { ...(await authHeaders(cfg, 'PUT', url)), 'Content-Type': 'application/octet-stream' },
    body: toBody(bytes),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) throw new Error(`Solid PUT failed (${res.status}).`);
  return {};
}

export async function get(bid, cfg) {
  const { container, f } = ctx(cfg);
  const url = resUrl(container, bid);
  const res = await f(url, { method: 'GET', headers: await authHeaders(cfg, 'GET', url) });
  if (!res.ok) throw new Error(`Solid GET failed (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function remove(bid, cfg) {
  const { container, f } = ctx(cfg);
  const url = resUrl(container, bid);
  const res = await f(url, { method: 'DELETE', headers: await authHeaders(cfg, 'DELETE', url) });
  if (!res.ok && res.status !== 204 && res.status !== 404) throw new Error(`Solid DELETE failed (${res.status}).`);
  return {};
}

// List the container: GET it as Turtle and read ldp:contains. We keep parsing
// to a narrow regex over contained-resource references (the relative <name.enc>
// URIs) — no RDF library, no CDN.
export async function list(cfg) {
  const { container, f } = ctx(cfg);
  const res = await f(container, {
    method: 'GET',
    headers: { ...(await authHeaders(cfg, 'GET', container)), Accept: 'text/turtle' },
  });
  if (!res.ok) throw new Error(`Solid container GET failed (${res.status}).`);
  return parseContainer(await res.text(), container);
}

// Extract backup ids from a container's Turtle: any contained reference ending
// in .enc, whether written as <name.enc>, <https://pod/.../name.enc>, or in a
// ldp:contains list. Returns {id,size,modified}; Turtle listings carry no size.
export function parseContainer(turtle, container) {
  const ids = new Set();
  const re = /<([^>]*?\.enc)>/g;       // any IRI token ending in .enc
  let m;
  while ((m = re.exec(turtle))) {
    let ref = m[1];
    // Normalise absolute IRIs down to the container-relative basename.
    if (ref.startsWith(container)) ref = ref.slice(container.length);
    const name = ref.replace(/^\.?\//, '').split('/').pop();
    if (name && name.endsWith(EXT)) ids.add(decodeURIComponent(name.slice(0, -EXT.length)));
  }
  return [...ids].map((bid) => ({ id: bid, size: null, modified: null }));
}

// ---- helpers ----
function safeId(bid) { return String(bid).replace(/[^A-Za-z0-9._-]/g, '_'); }
function toBody(bytes) { return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); }
