// What a file says about itself: EXIF in JPEG and PNG, PNG text, ID3 in MP3, the PDF Info
// dictionary. Read in the shell, from the file's bytes, and given back as fields and as RDF.
//
// Every reader works only inside the bytes it is given: each offset is checked before it is read,
// counts and strings are capped (READ_LIMITS), and a malformed or truncated file gives fewer
// fields, never an exception and never a read outside the buffer. Nothing here writes, except
// `withoutLocation`, which returns a copy.
//
// Location: a photo's GPS position is the most sensitive thing it carries. `withoutLocation`
// returns a copy of a JPEG or PNG whose GPS entries are emptied and whose XMP packets (which can
// repeat the position) are removed; if a crafted EXIF block still yields a position after that,
// the whole block is dropped (fail closed); otherwise the rest of the EXIF (camera, date, orientation) stays, and
// the image data is untouched, so it still opens. The shell uses it when a file is read through a
// share, so where a photo was taken does not leave with it.

export const READ_LIMITS = Object.freeze({ ifdEntries: 512, ifds: 4, string: 512, segments: 4096, frames: 512 });

const MAX_SCAN = 8 * 1024 * 1024;

/** Which kind of file these bytes are, from their first bytes: jpeg, png, mp3, pdf or null. */
export function sniff(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
  if (b.length >= 5 && String.fromCharCode(...b.subarray(0, 5)) === '%PDF-') return 'pdf';
  return null;
}

const clean = (s) => String(s).replace(/\0+$/, '').replace(/[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim().slice(0, READ_LIMITS.string);
const latin1 = (b) => { let s = ''; for (let i = 0; i < b.length && i < READ_LIMITS.string * 4; i++) s += String.fromCharCode(b[i]); return s; };
const utf8 = (b) => new TextDecoder('utf-8', { fatal: false }).decode(b);

// ── TIFF / EXIF ────────────────────────────────────────────────────────────

/**
 * Read a TIFF structure (the body of an EXIF block): IFD0, the Exif IFD and the GPS IFD.
 * `t` is the TIFF bytes. Returns { fields, location, gps } where `gps` locates the GPS IFD for
 * `withoutLocation`. Unknown or broken parts are skipped.
 */
function readTiff(t) {
  const out = { fields: {}, location: null, gps: null };
  if (t.length < 8) return out;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return out;
  const u16 = (o) => (o + 2 <= t.length ? (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]) : null);
  const u32 = (o) => (o + 4 <= t.length ? (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0 : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0) : null);
  if (u16(2) !== 42) return out;
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const ifd = (off) => {
    const n = u16(off);
    if (n === null || n > READ_LIMITS.ifdEntries) return null;
    const entries = [];
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      if (tag === null || type === null || count === null || !SIZE[type]) continue;
      const bytes = SIZE[type] * count;
      if (bytes > 1024 * 1024) continue;
      const at = bytes <= 4 ? e + 8 : u32(e + 8);
      if (at === null || at + bytes > t.length) continue;
      entries.push({ tag, type, count, at, bytes, entry: e });
    }
    return { off, n, entries };
  };
  const ascii = (x) => clean(latin1(t.subarray(x.at, x.at + Math.min(x.count, READ_LIMITS.string))));
  const short = (x) => u16(x.at);
  const long = (x) => (x.type === 3 ? u16(x.at) : u32(x.at));
  const rationals = (x) => { const v = []; for (let i = 0; i < x.count && i < 4; i++) { const n = u32(x.at + i * 8), d = u32(x.at + i * 8 + 4); v.push(d ? n / d : 0); } return v; };
  const exifDate = (s) => { const m = /^(\d{4}):(\d\d):(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null; };

  const ifd0 = ifd(u32(4) ?? -1);
  if (!ifd0) return out;
  let exifOff = null, gpsOff = null;
  for (const x of ifd0.entries) {
    if (x.tag === 0x010f && x.type === 2) out.fields.make = ascii(x);
    else if (x.tag === 0x0110 && x.type === 2) out.fields.model = ascii(x);
    else if (x.tag === 0x0112 && x.type === 3) out.fields.orientation = short(x);
    else if (x.tag === 0x0132 && x.type === 2) out.fields.modified = exifDate(ascii(x)) ?? undefined;
    else if (x.tag === 0x8769) exifOff = long(x);
    else if (x.tag === 0x8825) { gpsOff = long(x); out.gps = { pointer: x }; }
  }
  if (exifOff !== null) {
    const ex = ifd(exifOff);
    for (const x of ex?.entries || []) {
      if (x.tag === 0x9003 && x.type === 2) out.fields.taken = exifDate(ascii(x)) ?? undefined;
      else if (x.tag === 0xa002 && (x.type === 3 || x.type === 4)) out.fields.width ??= long(x);
      else if (x.tag === 0xa003 && (x.type === 3 || x.type === 4)) out.fields.height ??= long(x);
    }
  }
  if (gpsOff !== null) {
    const g = ifd(gpsOff);
    if (g) {
      out.gps.ifd = g;
      const get = (tag) => g.entries.find((x) => x.tag === tag);
      const ref = (tag) => { const x = get(tag); return x && x.type === 2 ? latin1(t.subarray(x.at, x.at + 1)) : ''; };
      const deg = (tag) => { const x = get(tag); if (!x || x.type !== 5 || x.count < 3) return null; const [d, m, s] = rationals(x); return d + m / 60 + s / 3600; };
      const lat = deg(2), lon = deg(4);
      if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon) && lat <= 90 && lon <= 180) {
        out.location = { lat: Math.round((ref(1) === 'S' ? -lat : lat) * 1e6) / 1e6, lon: Math.round((ref(3) === 'W' ? -lon : lon) * 1e6) / 1e6 };
      }
    }
  }
  for (const k of Object.keys(out.fields)) if (out.fields[k] === undefined || out.fields[k] === null || out.fields[k] === '') delete out.fields[k];
  return out;
}

/**
 * After emptying, is any position still readable? A crafted block can make emptying expose another
 * GPS IFD (two GPS pointers, one GPS value lying over the other pointer's tag). The checked strip
 * reads the block again and, if the reader still finds a GPS IFD with entries or a position, drops
 * the whole EXIF block: it fails closed (theorem stripChecked_no_location, LWS/PodMetadata.lean).
 */
const stillLocated = (t) => { const again = readTiff(t); return again.location !== null || (again.gps?.ifd?.n ?? 0) > 0; };

/** Empty a GPS IFD in place: every entry's value bytes zeroed, then the entry count set to 0. */
function emptyGps(t, gps, le) {
  if (!gps?.ifd) return;
  for (const x of gps.ifd.entries) t.fill(0, x.at, x.at + x.bytes);
  t.fill(0, gps.ifd.off + 2, gps.ifd.off + 2 + gps.ifd.n * 12);
  if (le) { t[gps.ifd.off] = 0; t[gps.ifd.off + 1] = 0; } else { t[gps.ifd.off] = 0; t[gps.ifd.off + 1] = 0; }
}

// ── JPEG ───────────────────────────────────────────────────────────────────

/** The JPEG's segments up to the image data: [{ marker, start, data, end }]. */
function jpegSegments(b) {
  const segs = [];
  let o = 2;
  while (o + 4 <= b.length && segs.length < READ_LIMITS.segments) {
    if (b[o] !== 0xff) break;
    const marker = b[o + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) { segs.push({ marker, start: o, data: o + 2, end: b.length }); break; }
    const len = (b[o + 2] << 8) | b[o + 3];
    if (len < 2 || o + 2 + len > b.length) break;
    segs.push({ marker, start: o, data: o + 4, end: o + 2 + len });
    o += 2 + len;
  }
  return segs;
}

const EXIF_HEAD = [0x45, 0x78, 0x69, 0x66, 0, 0];       // "Exif\0\0"
const XMP_HEAD = 'http://ns.adobe.com/xap/1.0/\0';
const startsWith = (b, at, head) => head.every((v, i) => b[at + i] === v);

function jpegMeta(b) {
  const out = { kind: 'image', fields: {}, location: null };
  for (const s of jpegSegments(b)) {
    if (s.marker === 0xe1 && startsWith(b, s.data, EXIF_HEAD)) {
      const tiff = readTiff(b.subarray(s.data + 6, s.end));
      Object.assign(out.fields, tiff.fields);
      out.location ??= tiff.location;
    } else if ((s.marker >= 0xc0 && s.marker <= 0xc3) && s.data + 5 <= s.end) {
      out.fields.height = (b[s.data + 1] << 8) | b[s.data + 2];
      out.fields.width = (b[s.data + 3] << 8) | b[s.data + 4];
    }
  }
  return out;
}

function jpegWithoutLocation(src) {
  const segs = jpegSegments(src);
  const parts = [src.subarray(0, 2)];
  let last = 2;
  for (const s of segs) {
    parts.push(src.subarray(last, s.start));
    last = s.start;
    const isXmp = s.marker === 0xe1 && latin1(src.subarray(s.data, s.data + XMP_HEAD.length)) === XMP_HEAD;
    if (isXmp) { last = s.end; continue; }                       // drop the whole XMP packet
    if (s.marker === 0xe1 && startsWith(src, s.data, EXIF_HEAD)) {
      const seg = src.slice(s.start, s.end);
      const tiffAt = s.data + 6 - s.start;
      const t = seg.subarray(tiffAt);
      const info = readTiff(t);
      emptyGps(t, info.gps, t[0] === 0x49);
      if (!stillLocated(t)) parts.push(seg);                       // else the EXIF block is dropped whole
      last = s.end;
    }
  }
  parts.push(src.subarray(last));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ── PNG ────────────────────────────────────────────────────────────────────

function pngChunks(b) {
  const out = [];
  let o = 8;
  while (o + 12 <= b.length && out.length < READ_LIMITS.segments) {
    const len = ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const type = latin1(b.subarray(o + 4, o + 8));
    if (o + 12 + len > b.length) break;
    out.push({ type, start: o, data: o + 8, len, end: o + 12 + len });
    o += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

const PNG_TEXT = { Title: 'title', Author: 'author', Description: 'description', 'Creation Time': 'created', Software: 'software' };

function pngMeta(b) {
  const out = { kind: 'image', fields: {}, location: null };
  for (const c of pngChunks(b)) {
    const d = b.subarray(c.data, c.data + c.len);
    if (c.type === 'IHDR' && c.len >= 8) {
      out.fields.width = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;
      out.fields.height = ((d[4] << 24) | (d[5] << 16) | (d[6] << 8) | d[7]) >>> 0;
    } else if (c.type === 'tEXt' || c.type === 'iTXt') {
      const z = d.indexOf(0);
      if (z < 1) continue;
      const key = latin1(d.subarray(0, z));
      if (!PNG_TEXT[key]) continue;
      let text;
      if (c.type === 'tEXt') text = latin1(d.subarray(z + 1));
      else {
        if (d[z + 1] !== 0) continue;                       // compressed iTXt: not read here
        let p = z + 3;
        const l1 = d.indexOf(0, p); if (l1 < 0) continue;
        const l2 = d.indexOf(0, l1 + 1); if (l2 < 0) continue;
        text = utf8(d.subarray(l2 + 1));
      }
      out.fields[PNG_TEXT[key]] = clean(text);
    } else if (c.type === 'eXIf') {
      const tiff = readTiff(d);
      for (const [k, v] of Object.entries(tiff.fields)) out.fields[k] ??= v;
      out.location ??= tiff.location;
    }
  }
  return out;
}

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function pngWithoutLocation(src) {
  const parts = [src.subarray(0, 8)];
  let last = 8;
  for (const c of pngChunks(src)) {
    parts.push(src.subarray(last, c.start));
    last = c.end;
    const d = src.subarray(c.data, c.data + c.len);
    const key = c.type === 'iTXt' || c.type === 'tEXt' ? latin1(d.subarray(0, Math.max(0, d.indexOf(0)))) : '';
    if (key === 'XML:com.adobe.xmp') continue;                  // drop XMP
    if (c.type === 'eXIf') {
      const chunk = src.slice(c.start, c.end);
      const t = chunk.subarray(8, 8 + c.len);
      emptyGps(t, readTiff(t).gps, t[0] === 0x49);
      if (stillLocated(t)) continue;                               // dropped whole: fail closed
      const crc = crc32(chunk.subarray(4, 8 + c.len));
      chunk[8 + c.len] = crc >>> 24; chunk[9 + c.len] = (crc >>> 16) & 255; chunk[10 + c.len] = (crc >>> 8) & 255; chunk[11 + c.len] = crc & 255;
      parts.push(chunk);
      continue;
    }
    parts.push(src.subarray(c.start, c.end));
  }
  parts.push(src.subarray(last));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ── MP3 (ID3v2) ────────────────────────────────────────────────────────────

function id3Meta(b) {
  const out = { kind: 'audio', fields: {}, location: null };
  if (b.length < 10) return out;
  const ver = b[3];
  const syncsafe = (o) => ((b[o] & 127) << 21) | ((b[o + 1] & 127) << 14) | ((b[o + 2] & 127) << 7) | (b[o + 3] & 127);
  const size = syncsafe(6);
  const end = Math.min(b.length, 10 + size);
  let o = 10;
  if (b[5] & 0x40 && o + 4 <= end) o += ver === 4 ? syncsafe(o) : (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0) + 4;
  const WANT = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TDRC: 'year', TYER: 'year' };
  for (let n = 0; o + 10 <= end && n < READ_LIMITS.frames; n++) {
    const id = latin1(b.subarray(o, o + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const fsize = ver === 4 ? syncsafe(o + 4) : ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) >>> 0;
    const data = o + 10;
    if (fsize < 1 || data + fsize > end) break;
    if (WANT[id]) {
      const enc = b[data];
      const body = b.subarray(data + 1, data + fsize);
      let s;
      if (enc === 0) s = latin1(body);
      else if (enc === 3) s = utf8(body);
      else if (enc === 1 || enc === 2) {
        let le = enc === 1, start = 0;
        if (enc === 1 && body.length >= 2) { le = body[0] === 0xff && body[1] === 0xfe; start = 2; }
        try { s = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(body.subarray(start)); } catch { s = ''; }
      }
      const v = clean(s || '');
      if (v) out.fields[WANT[id]] ??= WANT[id] === 'year' ? v.slice(0, 4) : v;
    }
    o = data + fsize;
  }
  return out;
}

// ── PDF ────────────────────────────────────────────────────────────────────

function pdfString(src, at) {
  // A literal string `( … )` with escapes and nested parentheses, or a hex string `< … >`.
  if (src[at] === '<') {
    const close = src.indexOf('>', at);
    if (close < 0) return null;
    const hex = src.slice(at + 1, close).replace(/\s+/g, '');
    const bytes = (hex.match(/.{1,2}/g) || []).map((h) => parseInt(h.padEnd(2, '0'), 16));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(new Uint8Array(bytes.slice(2)));
    return String.fromCharCode(...bytes);
  }
  if (src[at] !== '(') return null;
  let depth = 0, s = '';
  for (let i = at; i < src.length && s.length < READ_LIMITS.string * 2; i++) {
    const c = src[i];
    if (c === '\\') {
      const n = src[++i];
      const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (map[n] !== undefined) s += map[n];
      else if (/[0-7]/.test(n)) { let oct = n; while (oct.length < 3 && /[0-7]/.test(src[i + 1])) oct += src[++i]; s += String.fromCharCode(parseInt(oct, 8)); }
      continue;
    }
    if (c === '(') { if (depth++ > 0) s += c; continue; }
    if (c === ')') { if (--depth === 0) break; s += c; continue; }
    s += c;
  }
  if (s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) return new TextDecoder('utf-16be').decode(Uint8Array.from(s.slice(2), (ch) => ch.charCodeAt(0) & 255));
  return s;
}

function pdfMeta(b) {
  const out = { kind: 'document', fields: {}, location: null };
  const src = latin1(b.length > MAX_SCAN ? b.subarray(0, MAX_SCAN) : b).slice(0, MAX_SCAN);
  // The Info dictionary: the last `/Info n g R` in a trailer, then that object.
  const infos = [...src.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/g)];
  const ref = infos.at(-1);
  if (ref) {
    const head = new RegExp(`(^|[^0-9])${ref[1]}\\s+${ref[2]}\\s+obj`, 'g');
    let m, objAt = -1;
    while ((m = head.exec(src))) objAt = m.index + m[0].length;
    if (objAt >= 0) {
      const dictEnd = src.indexOf('endobj', objAt);
      const dict = src.slice(objAt, dictEnd < 0 ? objAt + 4096 : Math.min(dictEnd, objAt + 65536));
      for (const [key, field] of [['Title', 'title'], ['Author', 'author'], ['Subject', 'description'], ['CreationDate', 'created']]) {
        const k = dict.search(new RegExp(`/${key}\\s*[(<]`));
        if (k < 0) continue;
        const val = pdfString(dict, dict.indexOf(dict.slice(k).match(/[(<]/)[0], k));
        if (val === null) continue;
        let v = clean(val);
        if (field === 'created') { const d = /^D:(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?/.exec(v); v = d ? `${d[1]}-${d[2] || '01'}-${d[3] || '01'}${d[4] ? `T${d[4]}:${d[5] || '00'}:${d[6] || '00'}` : ''}` : ''; }
        if (v) out.fields[field] = v;
      }
    }
  }
  // Pages: the largest /Count in a /Type /Pages node (the root's), when it is written plainly.
  let pages = 0;
  for (const m of src.matchAll(/\/Type\s*\/Pages\b[^>]{0,400}?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]{0,400}?\/Type\s*\/Pages\b/g)) pages = Math.max(pages, Number(m[1] || m[2]));
  if (pages > 0 && pages < 1e6) out.fields.pages = pages;
  return out;
}

// ── the public face ────────────────────────────────────────────────────────

/** Read what the file says about itself. { kind, fields, location } — never throws. */
export function readMetadata(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    switch (sniff(b)) {
      case 'jpeg': return jpegMeta(b);
      case 'png': return pngMeta(b);
      case 'mp3': return id3Meta(b);
      case 'pdf': return pdfMeta(b);
      default: return { kind: null, fields: {}, location: null };
    }
  } catch {
    return { kind: null, fields: {}, location: null };
  }
}

/**
 * A copy of a JPEG or PNG with no location: GPS entries emptied, XMP packets removed, everything
 * else as it was. Other kinds come back as an unchanged copy (they carry no GPS here).
 */
export function withoutLocation(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    const kind = sniff(b);
    if (kind === 'jpeg') return jpegWithoutLocation(b);
    if (kind === 'png') return pngWithoutLocation(b);
  } catch { /* fall through: a copy, unchanged */ }
  return b.slice();
}

const turtleString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;

/**
 * The fields as Turtle about `<name>` (a relative IRI): schema.org, and the W3C EXIF vocabulary for
 * camera details. Location only if `withLocation`.
 */
export function metadataTurtle(name, meta, { withLocation = false } = {}) {
  const f = meta.fields;
  const type = { image: 'schema:ImageObject', audio: 'schema:AudioObject', document: 'schema:DigitalDocument' }[meta.kind] || 'schema:CreativeWork';
  const props = [];
  const add = (p, v, lit = false) => { if (v !== undefined && v !== null && v !== '') props.push(`${p} ${lit ? v : turtleString(v)}`); };
  add('schema:name', f.title);
  add('schema:description', f.description);
  add('schema:author', f.author);
  add('schema:byArtist', f.artist);
  add('schema:inAlbum', f.album);
  if (/^\d{4}$/.test(f.year || '')) add('schema:datePublished', `"${f.year}"^^xsd:gYear`, true);
  if (f.taken || f.created) add('schema:dateCreated', `"${f.taken || f.created}"^^xsd:${(f.taken || f.created).includes('T') ? 'dateTime' : 'date'}`, true);
  if (Number.isInteger(f.width)) add('schema:width', f.width, true);
  if (Number.isInteger(f.height)) add('schema:height', f.height, true);
  if (Number.isInteger(f.pages)) add('schema:numberOfPages', f.pages, true);
  add('exif:make', f.make);
  add('exif:model', f.model);
  if (Number.isInteger(f.orientation)) add('exif:orientation', f.orientation, true);
  if (withLocation && meta.location) {
    props.push(`schema:contentLocation [ a schema:Place ; schema:geo [ a schema:GeoCoordinates ; schema:latitude ${meta.location.lat} ; schema:longitude ${meta.location.lon} ] ]`);
  }
  const iri = `<${encodeURI(name).replace(/[<>"{}|\\^`]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}>`;
  return [
    '@prefix schema: <https://schema.org/> .',
    '@prefix exif: <http://www.w3.org/2003/12/exif/ns#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
    `${iri} a ${type}${props.length ? ' ;\n  ' + props.join(' ;\n  ') : ''} .`,
    '',
  ].join('\n');
}
