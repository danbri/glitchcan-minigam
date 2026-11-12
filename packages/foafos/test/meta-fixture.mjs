// Fixture writers for metadata tests: TIFF/EXIF, JPEG, PNG, ID3, PDF (not a test file).
import { crc32 as zcrc } from 'node:zlib';

// ── fixture writers ─────────────────────────────────────────────────────
// A little-endian or big-endian TIFF with IFD0, an Exif IFD and a GPS IFD.
export function tiff({ le = true, make, model, orientation, taken, gps } = {}) {
  const parts = []; // { tag, type, count, value: Buffer }
  const enc = (n, size) => { const b = Buffer.alloc(size); if (size === 2) (le ? b.writeUInt16LE(n) : b.writeUInt16BE(n)); else (le ? b.writeUInt32LE(n) : b.writeUInt32BE(n)); return b; };
  const asc = (s) => Buffer.from(s + '\0', 'latin1');
  const rat = (vals) => Buffer.concat(vals.flatMap(([n, d]) => [enc(n, 4), enc(d, 4)]));
  const ifd0 = [], exif = [], g = [];
  if (make) ifd0.push({ tag: 0x010f, type: 2, value: asc(make) });
  if (model) ifd0.push({ tag: 0x0110, type: 2, value: asc(model) });
  if (orientation) ifd0.push({ tag: 0x0112, type: 3, value: enc(orientation, 2), count: 1 });
  if (taken) exif.push({ tag: 0x9003, type: 2, value: asc(taken) });
  if (gps) {
    g.push({ tag: 1, type: 2, value: asc(gps.latRef) }, { tag: 2, type: 5, value: rat(gps.lat), count: 3 });
    g.push({ tag: 3, type: 2, value: asc(gps.lonRef) }, { tag: 4, type: 5, value: rat(gps.lon), count: 3 });
  }
  // Layout: header(8) | IFD0 | Exif IFD | GPS IFD | values
  const ifdSize = (n) => 2 + n * 12 + 4;
  const n0 = ifd0.length + (exif.length ? 1 : 0) + (g.length ? 1 : 0);
  const off0 = 8, offE = off0 + ifdSize(n0), offG = offE + (exif.length ? ifdSize(exif.length) : 0);
  let valAt = offG + (g.length ? ifdSize(g.length) : 0);
  const values = [];
  const writeIfd = (entries, extra) => {
    const all = [...entries, ...extra];
    const bufs = [enc(all.length, 2)];
    for (const e of all) {
      const count = e.count ?? e.value.length;
      let field;
      if (e.value.length <= 4) { field = Buffer.alloc(4); e.value.copy(field); }
      else { field = enc(valAt, 4); values.push(e.value); valAt += e.value.length; }
      bufs.push(enc(e.tag, 2), enc(e.type, 2), enc(count, 4), field);
    }
    bufs.push(enc(0, 4));
    return Buffer.concat(bufs);
  };
  const ptrs = [];
  if (exif.length) ptrs.push({ tag: 0x8769, type: 4, value: enc(offE, 4), count: 1 });
  if (g.length) ptrs.push({ tag: 0x8825, type: 4, value: enc(offG, 4), count: 1 });
  const head = Buffer.concat([Buffer.from(le ? 'II' : 'MM'), enc(42, 2), enc(off0, 4)]);
  const b0 = writeIfd(ifd0, ptrs);
  const bE = exif.length ? writeIfd(exif, []) : Buffer.alloc(0);
  const bG = g.length ? writeIfd(g, []) : Buffer.alloc(0);
  return Buffer.concat([head, b0, bE, bG, ...values]);
}
const seg = (marker, body) => { const h = Buffer.alloc(4); h[0] = 0xff; h[1] = marker; h.writeUInt16BE(body.length + 2, 2); return Buffer.concat([h, body]); };
export const SCAN = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0x78, 0xff, 0xd9]);  // stands in for image data
export function jpeg(opts = {}, { xmp = false, w = 640, h = 480 } = {}) {
  const sof = Buffer.from([8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]);
  return new Uint8Array(Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff(opts)])),
    ...(xmp ? [seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>51,30.5N</exif:GPSLatitude></x:xmpmeta>', 'latin1'))] : []),
    seg(0xc0, sof), SCAN,
  ]));
}
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(zcrc(td)); return Buffer.concat([len, td, c]); };
export function png({ title, exif, xmp = false } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(320, 0); ihdr.writeUInt32BE(200, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    ...(title ? [chunk('tEXt', Buffer.from(`Title\0${title}`, 'latin1'))] : []),
    ...(exif ? [chunk('eXIf', tiff(exif))] : []),
    ...(xmp ? [chunk('iTXt', Buffer.from('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>GPS</x:xmpmeta>', 'latin1'))] : []),
    chunk('IDAT', Buffer.from([1, 2, 3, 4])), chunk('IEND', Buffer.alloc(0)),
  ]));
}
export function id3(ver, frames) {
  const ss = (n) => Buffer.from([(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]);
  const body = Buffer.concat(frames.map(([id, text, enc = 3]) => {
    const data = Buffer.concat([Buffer.from([enc]), enc === 1 ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]) : Buffer.from(text, enc === 0 ? 'latin1' : 'utf8')]);
    const size = ver === 4 ? ss(data.length) : (() => { const b = Buffer.alloc(4); b.writeUInt32BE(data.length); return b; })();
    return Buffer.concat([Buffer.from(id, 'latin1'), size, Buffer.alloc(2), data]);
  }));
  return new Uint8Array(Buffer.concat([Buffer.from('ID3'), Buffer.from([ver, 0, 0]), ss(body.length), body, Buffer.from([0xff, 0xfb, 0x90, 0x00])]));
}
export const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n'
  + '5 0 obj << /Title (Field notes \\(draft\\)) /Author <FEFF00C9006D0069006C0065> /CreationDate (D:20240501103000Z) >> endobj\n'
  + 'trailer << /Root 1 0 R /Info 5 0 R >>\n%%EOF\n');

export const GPS = { latRef: 'N', lat: [[51, 1], [30, 1], [27, 1]], lonRef: 'W', lon: [[0, 1], [7, 1], [39, 1]] };
export const CAMERA = { make: 'Acme', model: 'Pocket 3', orientation: 6, taken: '2024:05:01 10:30:00', gps: GPS };

