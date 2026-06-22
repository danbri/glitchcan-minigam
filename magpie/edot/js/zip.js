// zip.js — minimal, dependency-free ZIP reader/writer.
//
// DOCX/ODT files are ZIP containers. We use the browser-native
// CompressionStream / DecompressionStream (deflate-raw) so there is no
// vendored deflate implementation and no CDN dependency — it runs fully
// offline on GitHub Pages. Falls back to STORED (uncompressed) entries
// when the streams API is unavailable.

const textEnc = new TextEncoder();
const textDec = new TextDecoder();

// ---- CRC32 (standard polynomial 0xEDB88320) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream unsupported — cannot read compressed ZIP entry');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- Little-endian writers ----
function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

/**
 * Build a ZIP blob from { name: stringOrBytes }.
 * Strings are UTF-8 encoded. Each entry is deflate-raw compressed when the
 * result is smaller, otherwise stored.
 */
export async function zipSync(files) {
  const localParts = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = textEnc.encode(name);
    const raw = typeof content === 'string' ? textEnc.encode(content) : content;
    const crc = crc32(raw);

    let method = 0;        // 0 = stored
    let payload = raw;
    const deflated = await deflateRaw(raw);
    if (deflated && deflated.length < raw.length) {
      method = 8;          // 8 = deflate
      payload = deflated;
    }

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(method),
      ...u16(0), ...u16(0),                 // mod time/date (zeroed)
      ...u32(crc), ...u32(payload.length), ...u32(raw.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    localParts.push(new Uint8Array(local), nameBytes, payload);

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method),
      ...u16(0), ...u16(0), ...u32(crc), ...u32(payload.length), ...u32(raw.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ]);
    central.push(nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralBytes = [];
  let centralSize = 0;
  for (const part of central) {
    const arr = part instanceof Uint8Array ? part : new Uint8Array(part);
    centralBytes.push(arr);
    centralSize += arr.length;
  }

  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(Object.keys(files).length), ...u16(Object.keys(files).length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...localParts, ...centralBytes, eocd], { type: 'application/zip' });
}

/**
 * Parse a ZIP ArrayBuffer into { name: Uint8Array }. Reads the central
 * directory (authoritative) rather than scanning local headers.
 */
export async function unzip(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);

  // Locate End Of Central Directory by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (no EOCD record)');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};

  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = textDec.decode(buf.subarray(p + 46, p + 46 + nameLen));

    // Jump to the local header to find the actual data start.
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const slice = buf.subarray(dataStart, dataStart + compSize);

    out[name] = method === 8 ? await inflateRaw(slice) : slice.slice();
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export const utf8 = {
  encode: (s) => textEnc.encode(s),
  decode: (b) => textDec.decode(b),
};
