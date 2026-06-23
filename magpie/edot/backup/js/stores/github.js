// stores/github.js — store an encrypted backup as a file in a GitHub repo.
//
// Mirrors magpie/edot/js/git-remote.js: api.github.com is CORS-enabled, so the
// Contents API works directly from the browser with a token. We store opaque
// ciphertext as a base64-encoded file under `edot-backups/<id>.enc`, GET it
// back (decoding base64), list the directory, and DELETE it.
//
// `fetchImpl` is injectable for testing — every network call goes through it.
//
// Common adapter interface (shared by all stores/*.js):
//   put(id, bytes, cfg)            -> {}
//   get(id, cfg)                   -> Uint8Array
//   list(cfg)                      -> [{ id, size, modified }]
//   remove(id, cfg)               -> {}
// cfg shape for GitHub: { repo: 'owner/name', token, dir?, branch?, fetchImpl? }

const API = 'https://api.github.com';
const DEFAULT_DIR = 'edot-backups';
const EXT = '.enc';

export const id = 'github';
export const label = 'GitHub repo';

function client(cfg) {
  const f = cfg.fetchImpl || ((...a) => fetch(...a));
  const [owner, repo] = String(cfg.repo || '').split('/');
  if (!owner || !repo) throw new Error('GitHub: cfg.repo must be "owner/name".');
  const dir = (cfg.dir || DEFAULT_DIR).replace(/^\/+|\/+$/g, '');

  const req = async (method, path, body) => {
    const res = await f(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok) { const e = new Error(json.message || `GitHub ${res.status}`); e.status = res.status; throw e; }
    return json;
  };
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const filePath = (bid) => `${dir}/${safeId(bid)}${EXT}`;
  return { req, owner, repo, dir, enc, filePath, branch: cfg.branch };
}

export async function put(bid, bytes, cfg) {
  const c = client(cfg);
  const path = c.filePath(bid);
  // Contents PUT needs the prior blob sha to overwrite; null if it's new.
  let sha = null;
  try { sha = (await c.req('GET', `/repos/${c.owner}/${c.repo}/contents/${c.enc(path)}`)).sha; }
  catch (e) { if (e.status !== 404) throw e; }
  return c.req('PUT', `/repos/${c.owner}/${c.repo}/contents/${c.enc(path)}`, {
    message: `edot backup ${safeId(bid)}`,
    content: bytesToB64(bytes),
    ...(c.branch ? { branch: c.branch } : {}),
    ...(sha ? { sha } : {}),
  });
}

export async function get(bid, cfg) {
  const c = client(cfg);
  const q = c.branch ? `?ref=${encodeURIComponent(c.branch)}` : '';
  const j = await c.req('GET', `/repos/${c.owner}/${c.repo}/contents/${c.enc(c.filePath(bid))}${q}`);
  if (j.encoding !== 'base64') throw new Error('GitHub: unexpected file encoding.');
  return b64ToBytes(j.content);
}

export async function list(cfg) {
  const c = client(cfg);
  const q = c.branch ? `?ref=${encodeURIComponent(c.branch)}` : '';
  let items;
  try { items = await c.req('GET', `/repos/${c.owner}/${c.repo}/contents/${c.enc(c.dir)}${q}`); }
  catch (e) { if (e.status === 404) return []; throw e; }   // empty dir = no backups yet
  return (Array.isArray(items) ? items : [])
    .filter((it) => it.type === 'file' && it.name.endsWith(EXT))
    .map((it) => ({ id: it.name.slice(0, -EXT.length), size: it.size, modified: null, sha: it.sha }));
}

export async function remove(bid, cfg) {
  const c = client(cfg);
  const path = c.filePath(bid);
  const cur = await c.req('GET', `/repos/${c.owner}/${c.repo}/contents/${c.enc(path)}`);
  return c.req('DELETE', `/repos/${c.owner}/${c.repo}/contents/${c.enc(path)}`, {
    message: `edot backup remove ${safeId(bid)}`, sha: cur.sha,
    ...(c.branch ? { branch: c.branch } : {}),
  });
}

// ---- helpers ----
function safeId(bid) { return String(bid).replace(/[^A-Za-z0-9._-]/g, '_'); }

export function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  return btoa(bin);
}
export function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
