// edot-project.js — the edot Project bundle: a real .zip that packages a whole
// problem space (documents, data tables, slide decks, places, events) plus a
// manifest, so a scenario can be shipped, opened, and worked on as one file.
//
// The codec is dependency-free and pure (no DOM), so it runs in the browser AND
// under Node for tests. We WRITE STORE-method (uncompressed) entries — valid,
// universally readable .zip — and READ both STORE and DEFLATE (inflating via the
// platform DecompressionStream when present), so projects zipped by other tools
// still open.
//
// Bundle layout:
//   edot-project.json        — the manifest (see schema below)
//   docs/<id>.html           — rich-text documents (Editor)
//   data/<id>.csv            — data tables (Data)
//   slides/<id>.json         — slide decks (Slides)
//   places/<id>.geojson      — saved places (Maps)
//   calendar/<id>.ics        — events (Calendar)
//
// Manifest schema (edot-project.json):
//   { edotProject: 1, name, description, problemSpace, apps: [id…],
//     docs:[{id,title,file}], data:[{id,title,file,format}],
//     slides:[{id,title,file}], places:[{id,title,file}], calendar:[{id,title,file}] }

const MANIFEST = 'edot-project.json';
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- CRC-32 (zip requires it per entry) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- little-endian writers ----
function u16(n) { return [n & 0xff, (n >>> 8) & 0xff]; }
function u32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }
function rd16(b, o) { return b[o] | (b[o + 1] << 8); }
function rd32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

// Build a STORE-method .zip from [{ name, bytes:Uint8Array }]. Returns Uint8Array.
export function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.bytes;
    const crc = crc32(data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    const localHeader = new Uint8Array(local);
    chunks.push(localHeader, nameBytes, data);
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += localHeader.length + nameBytes.length + data.length;
  }
  const cdChunks = [];
  let cdSize = 0;
  for (const c of central) {
    const h = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(c.offset),
    ]);
    cdChunks.push(h, c.nameBytes);
    cdSize += h.length + c.nameBytes.length;
  }
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const all = [...chunks, ...cdChunks, eocd];
  const total = all.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('zip: DEFLATE entry needs DecompressionStream (unavailable)');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Parse a .zip (STORE or DEFLATE) into [{ name, bytes }]. Async (may inflate).
export async function unzip(bytes) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Find End Of Central Directory (scan back; no zip comment in our writer).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) { if (rd32(bytes, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('zip: not a zip file (no EOCD)');
  const count = rd16(bytes, eocd + 10);
  let p = rd32(bytes, eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (rd32(bytes, p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const method = rd16(bytes, p + 10);
    const compSize = rd32(bytes, p + 20);
    const nameLen = rd16(bytes, p + 28);
    const extraLen = rd16(bytes, p + 30);
    const commentLen = rd16(bytes, p + 32);
    const localOff = rd32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // Local header → data start.
    const lNameLen = rd16(bytes, localOff + 26);
    const lExtraLen = rd16(bytes, localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = comp.slice();
    else if (method === 8) data = await inflateRaw(comp);
    else throw new Error(`zip: unsupported method ${method} for ${name}`);
    out.push({ name, bytes: data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---- Project assembly ----

// project: { manifest:{…}, files: { 'docs/x.html': '<html text>', … } }  (text values)
// Returns a .zip as Uint8Array, manifest serialized as edot-project.json.
export function buildProjectZip(project) {
  const manifest = { edotProject: 1, ...project.manifest };
  const files = [{ name: MANIFEST, bytes: enc.encode(JSON.stringify(manifest, null, 2)) }];
  for (const [name, content] of Object.entries(project.files || {})) {
    const bytes = content instanceof Uint8Array ? content : enc.encode(String(content));
    files.push({ name, bytes });
  }
  return zipStore(files);
}

// Returns { manifest, files: { name: textOrBytes }, text(name), json(name) }.
export async function readProjectZip(bytes) {
  const entries = await unzip(bytes);
  const byName = new Map(entries.map((e) => [e.name, e.bytes]));
  const manRaw = byName.get(MANIFEST);
  if (!manRaw) throw new Error('Not an edot project (missing edot-project.json)');
  let manifest;
  try { manifest = JSON.parse(dec.decode(manRaw)); }
  catch { throw new Error('edot project manifest is not valid JSON'); }
  if (!manifest.edotProject) throw new Error('Not an edot project (manifest missing edotProject)');
  const files = {};
  for (const [name, b] of byName) files[name] = b;
  return {
    manifest,
    files,
    text: (name) => { const b = byName.get(name); return b ? dec.decode(b) : null; },
    json: (name) => { const b = byName.get(name); return b ? JSON.parse(dec.decode(b)) : null; },
  };
}

export const MANIFEST_NAME = MANIFEST;
