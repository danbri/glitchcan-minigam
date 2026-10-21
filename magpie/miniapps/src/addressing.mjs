// MiniApp URI parser: W3C MiniApp Addressing, Group Note of 2026-08-11, section 4.
// https://www.w3.org/TR/miniapp-addressing/
//
//   miniappuri    = uri-prefix uri-infix "/" identify path-abempty ["?" query] ["#" fragment]
//   uri-prefix    = (custom-scheme "://") / ("https://" host "/")
//   custom-scheme = 1*unreserved
//   uri-infix     = "miniapp"
//   identify      = id [";version=" version]
//   id            = 1*unreserved
//   version       = *unreserved
//
// Why this file is shaped as it is: magpie/miniapps/README.md.

const UNRESERVED = /^[A-Za-z0-9\-._~]+$/;
const UNRESERVED_OR_EMPTY = /^[A-Za-z0-9\-._~]*$/;

/**
 * Parse a MiniApp URI. Returns
 *   { ok: true, scheme, host, id, version, path, query, fragment }
 * or { ok: false, error }. `id` and `version` are lower-cased, because the
 * Note makes both case-insensitive. `version` is null when absent.
 */
export function parseMiniAppUri(input) {
  if (typeof input !== 'string') return { ok: false, error: 'not a string' };
  let rest;
  let scheme;
  let host = null;
  const m = /^([^:/?#]+):\/\/(.*)$/s.exec(input);
  if (!m) return { ok: false, error: 'no "scheme://" prefix' };
  scheme = m[1];
  if (scheme.toLowerCase() === 'https') {
    const slash = m[2].indexOf('/');
    if (slash <= 0) return { ok: false, error: 'https form needs "https://host/"' };
    host = m[2].slice(0, slash);
    rest = m[2].slice(slash + 1);
    scheme = 'https';
  } else {
    if (!UNRESERVED.test(scheme)) return { ok: false, error: `custom scheme "${scheme}" is not 1*unreserved` };
    rest = m[2];
  }
  if (!rest.startsWith('miniapp/')) return { ok: false, error: 'missing the "miniapp/" infix' };
  rest = rest.slice('miniapp/'.length);

  let fragment = null;
  const hash = rest.indexOf('#');
  if (hash >= 0) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }
  let query = null;
  const q = rest.indexOf('?');
  if (q >= 0) { query = rest.slice(q + 1); rest = rest.slice(0, q); }

  const slash = rest.indexOf('/');
  const identify = slash >= 0 ? rest.slice(0, slash) : rest;
  const path = slash >= 0 ? rest.slice(slash) : '';

  let id = identify;
  let version = null;
  const semi = identify.indexOf(';');
  if (semi >= 0) {
    id = identify.slice(0, semi);
    const param = identify.slice(semi + 1);
    if (!param.startsWith('version=')) return { ok: false, error: `unknown parameter "${param}"` };
    version = param.slice('version='.length);
    if (!UNRESERVED_OR_EMPTY.test(version)) return { ok: false, error: `version "${version}" is not *unreserved` };
    version = version.toLowerCase();
  }
  if (!UNRESERVED.test(id)) return { ok: false, error: `id "${id}" is not 1*unreserved` };

  return { ok: true, scheme, host, id: id.toLowerCase(), version, path, query, fragment };
}

/** Inverse of parseMiniAppUri for a parsed record. */
export function formatMiniAppUri({ scheme, host, id, version, path = '', query = null, fragment = null }) {
  const prefix = scheme === 'https' ? `https://${host}/` : `${scheme}://`;
  return prefix + 'miniapp/' + id + (version != null ? `;version=${version}` : '') + path
    + (query != null ? `?${query}` : '') + (fragment != null ? `#${fragment}` : '');
}

/**
 * The package-relative page route a URI path names, or null for "use the
 * manifest's first page" (MiniApp Packaging, "Prepare runtime"). The
 * leading "/" is dropped; the page extension may be omitted, as the
 * manifest's `pages` entries do.
 */
export function pageRouteOf(parsed) {
  const p = (parsed.path || '').replace(/^\/+/, '');
  return p === '' ? null : p;
}
