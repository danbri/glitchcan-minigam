// backup-config.js — per-backend config placeholders for the backup UI.
//
// These are *defaults / shapes only*. Secrets (tokens, passwords) are NEVER
// committed here — the UI collects them at runtime and keeps them in memory
// (optionally localStorage if the user opts in). Treat every value below as a
// placeholder a user overrides in the form.

// Default object path/prefix used by all backends.
export const DEFAULT_PREFIX = 'edot-backups';

export const BACKENDS = {
  github: {
    label: 'GitHub repo',
    // repo: 'owner/name'  — a PRIVATE repo is strongly recommended.
    // token: a fine-grained PAT with Contents read/write on that repo.
    // dir: folder for the encrypted files (history = free versioning).
    fields: { repo: '', token: '', dir: DEFAULT_PREFIX, branch: '' },
    // CORS: api.github.com is CORS-enabled — works from the browser as-is.
    cors: 'GitHub API is CORS-enabled; no extra config needed.',
  },

  s3: {
    label: 'S3-compatible (presigned)',
    // Primary path: presigned URLs (a tiny backend signs PUT/GET/LIST/DELETE).
    // For quick tests you may instead provide direct `urls`.
    fields: { endpoint: '', bucket: '', region: '', prefix: DEFAULT_PREFIX, listUrl: '' },
    // CORS: the bucket must allow your origin + methods. Raw SigV4 from a
    // browser is discouraged (exposes the secret key) — prefer presigned URLs.
    cors: 'Bucket needs a CORS policy allowing your origin and PUT/GET/DELETE. '
        + 'Use presigned URLs (server-side signing) — do not ship AWS secrets to the browser.',
  },

  webdav: {
    label: 'WebDAV',
    // baseUrl: collection URL, e.g. https://host/remote.php/dav/files/me/edot-backups/
    fields: { baseUrl: '', user: '', password: '' },
    cors: 'WebDAV server must send CORS headers for your origin and allow the '
        + 'PROPFIND method (Nextcloud/Apache mod_dav need explicit config).',
  },

  solid: {
    label: 'Solid Pod',
    // container: Pod container URL ending in '/', e.g. https://you.solidpod/edot-backups/
    // token: a bearer access token (TIER-1 SHIM). Production = Solid-OIDC + DPoP
    //        via magpie/edot/auth/ (SOLID-OIDC TODO).
    fields: { container: '', token: '' },
    cors: 'The Pod server must allow your origin (most CSS/ESS servers do). '
        + 'Tier-1 uses a bearer token; production needs Solid-OIDC + DPoP.',
  },
};

/** Shallow clone of a backend's default field set (for fresh form state). */
export function defaultFields(backendId) {
  const b = BACKENDS[backendId];
  return b ? { ...b.fields } : {};
}
