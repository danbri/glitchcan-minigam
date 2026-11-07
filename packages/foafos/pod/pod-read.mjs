// Read a Foafos home pod's storage directory without opening it: no lock, no write.
// Used by pod-summary.mjs (a local, read-only CLI). Never used to serve a pod: see README "pod-davmount". No dependencies, so it runs before `npm install`.
//
// Why not the Factoidal API: openLwsStorage (@factoidal/core/lws 0.33.0) has no read-only
// mode. It takes lws.lock, refuses a directory that a running pod holds, and its start
// compacts the journal (a write). So this file reads the format of Factoidal's
// L4Factoidal/LWS/FileLayout.lean itself:
//
//   lws-files.json   the index at record `seq` (format lws-files-1)
//   lws-journal      framed records after it: "LWJ1", length (4 bytes, big-endian),
//                    SHA-256 of the payload (32 bytes), JSON payload
//   bodies/XX/N      one file per body version, N = 16 hex digits, XX = N mod 256
//
// The index alone is out of date while a pod runs, so the journal is replayed here.
//
// SECRETS: the index and the journal hold the notification signing key, subscription
// inbox URLs and access grants. Those objects are counted and dropped inside this file;
// nothing that readPod returns holds them, and an error never quotes file text.

import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

export const INDEX_FILE = 'lws-files.json';
export const JOURNAL_FILE = 'lws-journal';
export const LOCK_FILE = 'lws.lock';
export const BODIES_DIR = 'bodies';
const LAYOUT = new Set([INDEX_FILE, JOURNAL_FILE, LOCK_FILE, BODIES_DIR]);
const FRAME_MAGIC = Buffer.from('LWJ1');
const FRAME_HEADER = 40;
const SEALED_FORMAT = 'lws-snapshot-sealed-1';
const READ_ATTEMPTS = 6;

/** A failure to read a pod. The message never holds text from the pod's files. */
export class PodReadError extends Error {
  constructor(message) { super(message); this.name = 'PodReadError'; }
}

const present = (file) => {
  try { return readFileSync(file); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new PodReadError(`cannot read ${file} (${e.code})`);
  }
};

const parsed = (bytes, what) => {
  // JSON.parse quotes the text around a fault, and this text can hold a key.
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new PodReadError(`${what} is not valid JSON`); }
};

const count = (value) => (Array.isArray(value) ? value.length : 0);
const number = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
const text = (value) => (typeof value === 'string' ? value : '');

/** Only these members of an index entry leave this file. */
const entryOf = (e) => ({
  path: text(e?.path), kind: text(e?.kind), contentType: text(e?.contentType),
  mtime: number(e?.mtime), size: number(e?.size) ?? 0, fnv: number(e?.fnv), body: number(e?.body),
});

/** The counts of the side state: the only things kept from it. */
const sideOf = (notifications, access) => ({
  subscriptions: count(notifications?.subscriptions),
  grants: count(access?.grants),
  accessRequests: count(access?.requests),
});

/** The valid frames of a journal, and the bytes after the last one. */
function framesOf(bytes) {
  const payloads = [];
  let at = 0;
  while (at + FRAME_HEADER <= bytes.length && bytes.subarray(at, at + 4).equals(FRAME_MAGIC)) {
    const length = bytes.readUInt32BE(at + 4);
    const end = at + FRAME_HEADER + length;
    if (end > bytes.length) break;
    const payload = bytes.subarray(at + FRAME_HEADER, end);
    if (!createHash('sha256').update(payload).digest().equals(bytes.subarray(at + 8, at + FRAME_HEADER))) break;
    payloads.push(payload);
    at = end;
  }
  return { payloads, tornBytes: bytes.length - at };
}

/** Index bytes + journal bytes -> the state, or null when they do not fit together. */
function stateOf(indexBytes, journalBytes) {
  const doc = parsed(indexBytes, INDEX_FILE);
  if (doc === null || typeof doc !== 'object') throw new PodReadError(`${INDEX_FILE} is not an index`);
  if (doc.format === SEALED_FORMAT) return { sealed: true, format: SEALED_FORMAT };
  if (doc.format !== 'lws-files-1') throw new PodReadError(`${INDEX_FILE} has a format that this tool does not read`);
  const entries = new Map();
  for (const e of Array.isArray(doc.entries) ? doc.entries : []) entries.set(text(e?.path), entryOf(e));
  const pending = new Set(Array.isArray(doc.pendingRemoves) ? doc.pendingRemoves : []);
  let side = sideOf(doc.notifications, doc.access);
  let seq = number(doc.seq) ?? 0;
  let nextBody = number(doc.nextBody) ?? 0;
  const indexSeq = seq;
  const { payloads, tornBytes } = framesOf(journalBytes);
  let records = 0;
  let unreadBytes = tornBytes;
  for (let i = 0; i < payloads.length; i += 1) {
    let record;
    try { record = JSON.parse(payloads[i].toString('utf8')); } catch {
      // A valid frame that is not JSON: count it and the rest as unread.
      unreadBytes += payloads.slice(i).reduce((sum, p) => sum + p.length + FRAME_HEADER, 0);
      break;
    }
    if (record.seq <= indexSeq) continue;   // the index was compacted past this record
    if (record.seq !== seq + 1) return null;
    for (const op of Array.isArray(record.ops) ? record.ops : []) {
      if (op.put) entries.set(text(op.put.path), entryOf(op.put));
      else if (typeof op.remove === 'string') entries.delete(op.remove);
    }
    if (record.side) side = sideOf(record.side.notifications, record.side.access);
    for (const dead of Array.isArray(record.dead) ? record.dead : []) pending.add(dead);
    seq = record.seq;
    nextBody = number(record.nextBody) ?? nextBody;
    records += 1;
  }
  return {
    sealed: false, format: 'lws-files-1', seq, indexSeq, nextBody, entries, pending, ...side,
    journal: { bytes: journalBytes.length, records, unreadBytes },
  };
}

/**
 * The state of the pod in `dir` at one moment. A running pod replaces the index and then
 * empties the journal, so the index is read twice around the journal; a change between
 * the reads means read again.
 * @returns {object} `{sealed: true, format}`, or `{sealed: false, format, seq, indexSeq,
 *   nextBody, entries: Map, pending: Set, subscriptions, grants, accessRequests, journal}`
 */
export function readPod(dir) {
  const root = resolve(dir);
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt += 1) {
    const before = present(join(root, INDEX_FILE));
    if (before === null) {
      const snapshot = present(join(root, 'lws-state.json')) !== null;
      throw new PodReadError(snapshot
        ? `${root} is a snapshot storage (lws-state.json): this tool reads only a storage kept in files`
        : `${root} has no ${INDEX_FILE}: not a pod directory`);
    }
    const journal = present(join(root, JOURNAL_FILE)) ?? Buffer.alloc(0);
    const after = present(join(root, INDEX_FILE));
    if (after === null || !before.equals(after)) continue;
    const state = stateOf(before, journal);
    if (state !== null) return state;
  }
  throw new PodReadError(`${root} changed on each of ${READ_ATTEMPTS} reads`);
}

/** The path, relative to the pod directory, of body number `n`. */
export function bodyName(n) {
  const name = n.toString(16).padStart(16, '0');
  return join(BODIES_DIR, name.slice(-2), name);
}

/** Every file under bodies/: `{name, number, size, mtime}`; `number` is null for a stray. */
export function scanBodies(dir) {
  const root = join(resolve(dir), BODIES_DIR);
  const found = [];
  let shards;
  try { shards = readdirSync(root); } catch { return found; }
  for (const shard of shards.sort()) {
    let names;
    try { names = readdirSync(join(root, shard)); } catch { continue; }
    for (const file of names.sort()) {
      let info;
      try { info = lstatSync(join(root, shard, file)); } catch { continue; }
      if (!info.isFile()) continue;
      found.push({ name: join(BODIES_DIR, shard, file), number: /^[0-9a-f]{16}$/.test(file) ? parseInt(file, 16) : null,
        size: info.size, mtime: Math.floor(info.mtimeMs / 1000) });
    }
  }
  return found;
}

/** Facts about lws.lock. The lock also holds a process token; it does not leave this file. */
export function readLock(dir) {
  const bytes = present(join(resolve(dir), LOCK_FILE));
  if (bytes === null) return { present: false };
  let doc = null;
  try { doc = JSON.parse(bytes.toString('utf8')); } catch { /* present, and nothing more is known */ }
  const pid = number(doc?.pid);
  let alive = null;
  if (pid !== null && pid > 0) {
    try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
  }
  return { present: true, pid, alive,
    command: /^[\w-]{1,40}$/.test(text(doc?.command)) ? doc.command : null,
    started: /^[\dT:.Z-]{1,40}$/.test(text(doc?.started)) ? doc.started : null };
}

/** Names at the top of the pod directory that are not part of the layout. */
export function otherFiles(dir) {
  try { return readdirSync(resolve(dir)).filter((n) => !LAYOUT.has(n)).sort(); } catch { return []; }
}

/** The container that holds `path`: '/a/b' and '/a/b/' -> '/a/'; '/' -> null. */
export function parentOf(path) {
  if (path === '/') return null;
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.slice(0, trimmed.lastIndexOf('/') + 1);
}

/** Container path -> sorted child paths. A container that no entry names is still a parent. */
export function childrenOf(paths) {
  const tree = new Map([['/', new Set()]]);
  for (const path of paths) {
    for (let child = path, parent = parentOf(child); parent !== null && parent !== ''; child = parent, parent = parentOf(child)) {
      if (!tree.has(parent)) tree.set(parent, new Set());
      tree.get(parent).add(child);
    }
  }
  return new Map([...tree].map(([parent, set]) => [parent, [...set].sort()]));
}

/** A path's last name, percent-decoded for people. */
export function nameOf(path) {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  const last = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  try { return decodeURIComponent(last); } catch { return last; }
}
