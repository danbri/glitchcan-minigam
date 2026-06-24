// data-object.js — a storage-independent identity + serialization wrapper.
//
// Every persisted thing in the suite is (or wraps to) a DataObject: a stable id,
// a type, a SemVer body schema, metadata, the canonical SELF-CONTAINED body, and
// a SHA-256 content fingerprint. Identity is content + id, NEVER storage location
// — IndexedDB is just one cache among equals (a file, a GitHub commit, an
// S3/WebDAV/Solid object, a sync server). See
// docs/research/pre-enterprise-foundations.md §2.
//
// Isomorphic: uses Web Crypto (crypto.subtle / crypto.randomUUID), available in
// browsers and Node 20+, so it can be unit-tested without a browser.

// type -> file extension + media type. Extend as apps adopt the wrapper.
const TYPES = {
  doc:      { ext: 'edoc',  media: 'application/edot-doc+json' },
  data:     { ext: 'edata', media: 'application/edot-data+json' },
  deck:     { ext: 'edeck', media: 'application/edot-deck+json' },
  calendar: { ext: 'ecal',  media: 'application/edot-calendar+json' },
};

export function typeInfo(type) { return TYPES[type] || { ext: 'json', media: 'application/json' }; }

export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Deterministic-free fallback (very old runtimes only).
  return 'id-' + Array.from({ length: 4 }, () => Math.floor(0x100000 * Math.abs(Math.sin(performance.now() + Math.random()))).toString(16)).join('');
}

// Deterministic JSON: object keys sorted recursively so identical content always
// serializes to identical bytes (stable fingerprints). Array order is preserved.
export function canonicalize(value) { return JSON.stringify(sortKeys(value)); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

const enc = new TextEncoder();
export async function fingerprint(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Wrap a body into a DataObject envelope. Does not compute the fingerprint
// (that's async — see finalize()).
export function wrap({ type, schemaVersion = '1.0.0', body, meta = {}, id = makeId() }) {
  return { id, type, schemaVersion, meta: { title: '', ...meta }, body };
}

// Canonical bytes of the WHOLE envelope (what you store / transmit). Excludes the
// fingerprint field itself.
export function serialize(obj) {
  return canonicalize({ id: obj.id, type: obj.type, schemaVersion: obj.schemaVersion, meta: obj.meta, body: obj.body });
}

// Content fingerprint = SHA-256 of the canonical BODY only — so the same content
// fingerprints identically regardless of metadata/timestamps or storage venue.
export function contentFingerprint(obj) { return fingerprint(canonicalize(obj.body)); }

// Stamp the content fingerprint onto the envelope (e.g. before persisting/exporting).
export async function finalize(obj) { return { ...obj, fingerprint: await contentFingerprint(obj) }; }
