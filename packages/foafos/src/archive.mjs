// Archives as read-only folders: zip (stored, deflate), tar and tar.gz, read in the shell.
//
// A path like `photos.zip!/2024/beach.jpg` reaches inside an archive, and archives inside archives
// (`a.zip!/b.tar!/c.txt`) up to ARCHIVE_LIMITS.depth. Nothing inside an archive is writable through
// this view. The limits below are what keeps a hostile archive (a "zip bomb", a path that climbs
// out, an entry that lies about its size) from costing more than they allow:
//   - an archive is read only if it is at most `archiveBytes`;
//   - an entry is unpacked only if it says it is at most `entryBytes` and at most `ratio` times its
//     packed size, and unpacking stops (refused) the moment it passes either, whatever it said;
//   - at most `entries` entries are listed, and at most `depth` archives are opened in one path;
//   - an entry whose name is absolute, or has `..` or `.` parts, or a backslash, is left out.
// So reading one path unpacks at most depth × entryBytes bytes, and never writes anything.

export const ARCHIVE_LIMITS = Object.freeze({
  archiveBytes: 8 * 1024 * 1024,
  entryBytes: 8 * 1024 * 1024,
  ratio: 200,
  entries: 10000,
  depth: 3,
});

export class ArchiveError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Is this name one we will show? Relative, no `..` or `.` parts, no backslashes. */
export function safeName(name) {
  if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0')) return null;
  const parts = name.split('/');
  const isDir = name.endsWith('/');
  const kept = parts.filter((p, i) => !(isDir && i === parts.length - 1 && p === ''));
  if (kept.some((p) => p === '' || p === '.' || p === '..')) return null;
  return kept.join('/') + (isDir ? '/' : '');
}

/** What kind of archive these bytes are, by their first bytes; null if none. */
export function archiveKind(bytes) {
  if (bytes.length >= 4 && u32(bytes, 0) === 0x04034b50) return 'zip';
  if (bytes.length >= 4 && u32(bytes, 0) === 0x06054b50) return 'zip';      // an empty zip
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes.length >= 262 && String.fromCharCode(...bytes.subarray(257, 262)) === 'ustar') return 'tar';
  return null;
}

/** Does this name look like an archive we can open? */
export const ARCHIVE_NAME = /\.(zip|tar|tgz|tar\.gz)$/i;

/** Unpack with a DecompressionStream, refusing the moment the output passes `limit`. */
async function inflate(bytes, format, limit) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) { await reader.cancel(); throw new ArchiveError('too-large', 'an entry unpacks to more than the limit'); }
    chunks.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

function zipEntries(b) {
  // The end of central directory record: within the last 64 KiB + 22 bytes.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ArchiveError('bad-archive', 'no zip directory');
  const count = u16(b, eocd + 10);
  let at = u32(b, eocd + 16);
  if (count > ARCHIVE_LIMITS.entries) throw new ArchiveError('too-large', 'too many entries');
  const out = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > b.length || u32(b, at) !== 0x02014b50) throw new ArchiveError('bad-archive', 'a broken zip directory');
    const flags = u16(b, at + 8), method = u16(b, at + 10);
    const csize = u32(b, at + 20), usize = u32(b, at + 24);
    const nl = u16(b, at + 28), xl = u16(b, at + 30), cl = u16(b, at + 32);
    const local = u32(b, at + 42);
    const name = new TextDecoder().decode(b.subarray(at + 46, at + 46 + nl));
    at += 46 + nl + xl + cl;
    if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw new ArchiveError('bad-archive', 'zip64 is not read here');
    const safe = safeName(name);
    if (!safe) continue;
    out.push({ name: safe, dir: safe.endsWith('/'), size: usize, csize, method, encrypted: !!(flags & 1), local });
  }
  return out;
}

async function zipRead(b, e) {
  if (e.encrypted) throw new ArchiveError('not-supported', 'an encrypted entry');
  if (e.size > ARCHIVE_LIMITS.entryBytes) throw new ArchiveError('too-large', 'an entry larger than the limit');
  if (e.size > Math.max(1, e.csize) * ARCHIVE_LIMITS.ratio) throw new ArchiveError('too-large', 'an entry packed too tightly (a zip bomb?)');
  if (u32(b, e.local) !== 0x04034b50) throw new ArchiveError('bad-archive', 'a broken zip entry');
  const start = e.local + 30 + u16(b, e.local + 26) + u16(b, e.local + 28);
  const packed = b.subarray(start, start + e.csize);
  if (e.method === 0) return packed.length > ARCHIVE_LIMITS.entryBytes ? Promise.reject(new ArchiveError('too-large', 'too large')) : packed.slice();
  if (e.method === 8) return inflate(packed, 'deflate-raw', Math.min(ARCHIVE_LIMITS.entryBytes, Math.max(1, e.csize) * ARCHIVE_LIMITS.ratio));
  throw new ArchiveError('not-supported', `zip method ${e.method}`);
}

function tarEntries(b) {
  const out = [];
  const str = (o, n) => { const s = b.subarray(o, o + n); const z = s.indexOf(0); return new TextDecoder().decode(z < 0 ? s : s.subarray(0, z)); };
  for (let at = 0; at + 512 <= b.length;) {
    if (b.subarray(at, at + 512).every((x) => x === 0)) break;
    const size = parseInt(str(at + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(b[at + 156] || 48);
    const prefix = str(at + 345, 155);
    const name = (prefix ? prefix + '/' : '') + str(at, 100);
    const data = at + 512;
    if (!Number.isFinite(size) || size < 0 || data + size > b.length) throw new ArchiveError('bad-archive', 'a broken tar entry');
    if (out.length >= ARCHIVE_LIMITS.entries) throw new ArchiveError('too-large', 'too many entries');
    const safe = safeName(type === '5' && !name.endsWith('/') ? name + '/' : name);
    if (safe && (type === '0' || type === '\0' || type === '5')) out.push({ name: safe, dir: type === '5', size, data });
    at = data + Math.ceil(size / 512) * 512;
  }
  return out;
}

/**
 * Open an archive's bytes: { kind, entries: [{ name, dir, size }], read(entry) → Uint8Array }.
 * A gzip that does not hold a tar is refused.
 */
export async function openArchive(bytes) {
  if (bytes.length > ARCHIVE_LIMITS.archiveBytes) throw new ArchiveError('too-large', 'the archive is larger than the limit');
  let kind = archiveKind(bytes);
  if (kind === 'gzip') {
    bytes = await inflate(bytes, 'gzip', ARCHIVE_LIMITS.archiveBytes * 4);
    kind = archiveKind(bytes) === 'tar' ? 'tar' : null;
  }
  if (kind === 'zip') {
    const b = bytes;
    return { kind, entries: zipEntries(b), read: (e) => zipRead(b, e) };
  }
  if (kind === 'tar') {
    const b = bytes;
    return {
      kind, entries: tarEntries(b),
      read: async (e) => {
        if (e.size > ARCHIVE_LIMITS.entryBytes) throw new ArchiveError('too-large', 'an entry larger than the limit');
        return b.slice(e.data, e.data + e.size);
      },
    };
  }
  throw new ArchiveError('not-archive', 'not an archive this view can open');
}

/**
 * The folder at `dir` ('' or 'a/b/') inside an opened archive: files and folders directly in it,
 * including folders implied by deeper names. [{ name, dir, size }], names relative to `dir`.
 */
export function listArchive(arc, dir = '') {
  const seen = new Map();
  for (const e of arc.entries) {
    if (!e.name.startsWith(dir) || e.name === dir) continue;
    const rest = e.name.slice(dir.length);
    const slash = rest.indexOf('/');
    if (slash >= 0 && slash < rest.length - 1) {
      const sub = rest.slice(0, slash + 1);
      if (!seen.has(sub)) seen.set(sub, { name: sub, dir: true });
    } else if (!seen.has(rest)) seen.set(rest, e.dir ? { name: rest, dir: true } : { name: rest, dir: false, size: e.size });
  }
  return [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Split a pod path at its archive marks: 'a/b.zip!/c.tar!/d.txt' → ['a/b.zip', 'c.tar', 'd.txt']. */
export const archiveParts = (path) => String(path).split('!/');
