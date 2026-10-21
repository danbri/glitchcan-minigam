// ZIP container read and write for MiniApp packages: W3C MiniApp Packaging,
// Discontinued Draft of 2026-08-11, section 3 ("ZIP container") and section 5.2.1
// (the signing block). https://www.w3.org/TR/miniapp-packaging/
//
// Runs in browsers, workers and Node 18+: inflate and deflate use
// DecompressionStream / CompressionStream('deflate-raw'). No ZIP64.
//
// The draft's constraints, checked by readZip:
//   no encryption; CRC-32 on every file; no spanned or split archive;
//   stored (0) or deflate (8) only; UTF-8 file names; version needed <= 2.0.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

export const SIGNING_MAGIC = Object.freeze({ rpk: 'RPK Sig Block 42', pkcs7: 'MIX Sig Block 42' });

let CRC_TABLE = null;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function pipeThrough(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const inflateRaw = (b) => pipeThrough(b, new DecompressionStream('deflate-raw'));
const deflateRaw = (b) => pipeThrough(b, new CompressionStream('deflate-raw'));

const utf8 = new TextDecoder('utf-8', { fatal: true });
const latin1 = new TextDecoder('latin1');

export class ZipError extends Error {}

/**
 * Read a ZIP container. Returns { files: Map<name, Uint8Array>, signing }
 * where `signing` is null or { scheme: 'rpk'|'pkcs7'|'unknown', offset, length, magic }.
 * Throws ZipError on any constraint the draft sets.
 */
export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError('no End of Central Directory record: not a ZIP container');
  const diskNo = dv.getUint16(eocd + 4, true);
  const cdDisk = dv.getUint16(eocd + 6, true);
  const entriesHere = dv.getUint16(eocd + 8, true);
  const entries = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (diskNo !== 0 || cdDisk !== 0 || entriesHere !== entries) throw new ZipError('spanned or split archive: not allowed');
  if (cdOffset === 0xffffffff || entries === 0xffff) throw new ZipError('ZIP64 archive: not supported');
  if (cdOffset + cdSize > eocd) throw new ZipError('central directory runs past the EOCD record');

  const files = new Map();
  let p = cdOffset;
  let endOfData = 0;
  for (let n = 0; n < entries; n++) {
    if (dv.getUint32(p, true) !== SIG_CENTRAL) throw new ZipError(`central directory entry ${n}: bad signature`);
    const needed = dv.getUint16(p + 6, true);
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const rawName = bytes.subarray(p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    let name;
    try { name = utf8.decode(rawName); } catch { throw new ZipError(`entry ${n}: file name is not UTF-8 (${latin1.decode(rawName)})`); }
    if ((flags & 0x0001) || (flags & 0x0040)) throw new ZipError(`${name}: encrypted entries are not allowed`);
    if (method !== 0 && method !== 8) throw new ZipError(`${name}: compression method ${method}; only stored (0) and deflate (8) are allowed`);
    if (needed > 20) throw new ZipError(`${name}: needs ZIP version ${needed / 10}; the limit is 2.0`);
    if (name.startsWith('/') || name.split('/').includes('..')) throw new ZipError(`${name}: path escapes the container`);

    if (dv.getUint32(localOff, true) !== SIG_LOCAL) throw new ZipError(`${name}: bad local header signature`);
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + csize);
    endOfData = Math.max(endOfData, dataStart + csize + ((flags & 0x0008) ? 16 : 0));

    if (name.endsWith('/')) continue; // a folder entry
    const data = method === 0 ? raw.slice() : await inflateRaw(raw);
    if (data.length !== usize) throw new ZipError(`${name}: size ${data.length}, the directory says ${usize}`);
    if (crc32(data) !== crc) throw new ZipError(`${name}: CRC-32 mismatch`);
    if (files.has(name)) throw new ZipError(`${name}: listed twice`);
    files.set(name, data);
  }

  // Signing block: immediately before the central directory, ending in a 16-byte magic.
  let signing = null;
  if (cdOffset > endOfData) {
    const magic = cdOffset >= 16 ? latin1.decode(bytes.subarray(cdOffset - 16, cdOffset)) : '';
    const scheme = magic === SIGNING_MAGIC.rpk ? 'rpk' : magic === SIGNING_MAGIC.pkcs7 ? 'pkcs7' : 'unknown';
    signing = { scheme, offset: endOfData, length: cdOffset - endOfData, magic };
  }
  return { files, signing };
}

/**
 * Write a ZIP container. `entries` is an iterable of [name, Uint8Array|string].
 * Files are deflated unless that makes them larger. Names are written as UTF-8
 * (flag bit 11), with version-needed 2.0 and a fixed 1980-01-01 timestamp so the
 * same input gives the same bytes.
 */
export async function writeZip(entries) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [name, content] of sorted) {
    const data = typeof content === 'string' ? enc.encode(content) : content;
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const deflated = await deflateRaw(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const lh = new Uint8Array(30 + nameBytes.length);
    const l = new DataView(lh.buffer);
    l.setUint32(0, SIG_LOCAL, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint16(8, method, true); l.setUint16(10, 0, true); l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, body.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, nameBytes.length, true); l.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    const ch = new Uint8Array(46 + nameBytes.length);
    const c = new DataView(ch.buffer);
    c.setUint32(0, SIG_CENTRAL, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true); c.setUint16(10, method, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nameBytes.length, true); c.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    locals.push(lh, body);
    centrals.push(ch);
    offset += lh.length + body.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array(22);
  const e = new DataView(eocd.buffer);
  e.setUint32(0, SIG_EOCD, true);
  e.setUint16(8, centrals.length, true); e.setUint16(10, centrals.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, eocd];
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const b of parts) { out.set(b, at); at += b.length; }
  return out;
}
