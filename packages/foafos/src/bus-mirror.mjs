// What of a bus event may leave the page for an XMPP room, and in what form.
// Pure functions, so they are tested with no server. FoafChat calls them for
// every event it mirrors and for /bus. Design: docs/foafos-bus-xmpp-20261105.md.

/** A mirrored stanza carries <x xmlns=MIRROR_NS topic source/>. A marked stanza never goes back on the bus. */
export const MIRROR_NS = 'urn:foafos:bus:0';

/** Topics that never go to a room, whatever the mirror list says. */
const NEVER = ['net.', 'secrets.'];
const NEVER_EXACT = new Set(['chat.status', 'chat.message', 'chat.error']);
export const neverMirrored = (topic) => NEVER_EXACT.has(topic) || NEVER.some((p) => topic.startsWith(p));

const HIDDEN = '[redacted]';
const MAX_DEPTH = 6;
const MAX_ITEMS = 32;
const MAX_STRING = 500;
const MAX_TOPIC = 128;

const SECRET_KEY = /pass(word|phrase|wd)?$|pwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|signing[-_]?key|authori[sz]ation|^auth$|bearer|cookie|credential|capabilit(y|ies)$|^caps?$|jwt|signature|^sig$/i;

const SECRET_TEXT = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g,                 // JWT
  /\b(gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g,
  /[A-Za-z0-9_+=-]{40,}/g,                                                      // long keys, hashes, base64
];
const URL_LOGIN = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;
const URL_SECRET = /([?&#](?:[a-z0-9_-]*(?:token|key|secret|sig|signature|password|pass|auth|code)[a-z0-9_-]*)=)[^&#\s]+/gi;
// U+FFFE and U+FFFF are not legal XML, and a stanza holding one ends the stream.
const NOT_XML = /[￾￿]/g;

/** A string with whatever looks like a credential taken out, and bounded. */
export function scrubText(s) {
  let out = String(s).slice(0, MAX_STRING * 4).replace(NOT_XML, '');
  out = out.replace(URL_LOGIN, '$1' + HIDDEN + '@').replace(URL_SECRET, '$1' + HIDDEN);
  for (const re of SECRET_TEXT) out = out.replace(re, HIDDEN);
  return out.length > MAX_STRING ? out.slice(0, MAX_STRING) + '…' : out;
}

/** A copy of any value, safe for a room: secrets gone, size bounded, no cycles. */
export function redact(value, depth = 0, seen = new Set()) {
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return undefined;
  if (depth >= MAX_DEPTH) return '(deeper data left out)';
  if (seen.has(value)) return '(repeated)';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ITEMS).map((v) => redact(v, depth + 1, seen) ?? null);
      if (value.length > MAX_ITEMS) items.push(`(${value.length - MAX_ITEMS} more)`);
      return items;
    }
    const out = {};
    const keys = Object.keys(value);
    for (const k of keys.slice(0, MAX_ITEMS)) {
      const name = scrubText(k).slice(0, 64);
      if (SECRET_KEY.test(k)) { out[name] = HIDDEN; continue; }
      const v = redact(value[k], depth + 1, seen);
      if (v !== undefined) out[name] = v;
    }
    if (keys.length > MAX_ITEMS) out['(more)'] = keys.length - MAX_ITEMS;
    return out;
  } catch {
    return '(not readable)';
  } finally {
    seen.delete(value);
  }
}

/** A topic or a source, as text that is safe in an attribute and in a body. */
export const cleanName = (s) => scrubText(s).replace(/[^A-Za-z0-9_.:#*-]/g, '_').slice(0, MAX_TOPIC);

/** `<topic> <JSON>`, always whole JSON: a value too long for `max` gives way to a note. */
export function eventBody(topic, data, max) {
  let json;
  try { json = JSON.stringify(data ?? {}); } catch { json = '"(not serialisable)"'; }
  if (topic.length + 1 + json.length <= max) return `${topic} ${json}`;
  const note = { truncated: true };
  if (typeof data?.from === 'string') note.from = data.from;
  if (typeof data?.summary === 'string') note.summary = data.summary.slice(0, 200);
  return `${topic} ${JSON.stringify(note)}`;
}
