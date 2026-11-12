import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as zcrc } from 'node:zlib';
import { jpeg, png, id3, pdf, GPS, CAMERA, SCAN } from './meta-fixture.mjs';
import { readMetadata, withoutLocation, metadataTurtle, sniff } from '../src/metadata.mjs';

// ── reading ─────────────────────────────────────────────────────────────
test('JPEG: camera, date, orientation, size and position, in either byte order', () => {
  for (const le of [true, false]) {
    const m = readMetadata(jpeg({ ...CAMERA, le }));
    assert.equal(m.kind, 'image');
    assert.deepEqual(m.fields, { make: 'Acme', model: 'Pocket 3', orientation: 6, taken: '2024-05-01T10:30:00', height: 480, width: 640 });
    assert.deepEqual(m.location, { lat: 51.5075, lon: -0.1275 });
  }
});

test('PNG, MP3 (ID3 2.3 and 2.4, three text encodings) and PDF', () => {
  const p = readMetadata(png({ title: 'Sunset', exif: { gps: GPS, make: 'Acme' } }));
  assert.deepEqual([p.kind, p.fields.width, p.fields.height, p.fields.title, p.fields.make], ['image', 320, 200, 'Sunset', 'Acme']);
  assert.deepEqual(p.location, { lat: 51.5075, lon: -0.1275 });
  for (const ver of [3, 4]) {
    const a = readMetadata(id3(ver, [['TIT2', 'Café song'], ['TPE1', 'Ana', 1], ['TALB', 'Hills', 0], [ver === 4 ? 'TDRC' : 'TYER', '2019']]));
    assert.deepEqual(a.fields, { title: 'Café song', artist: 'Ana', album: 'Hills', year: '2019' }, `v2.${ver}`);
  }
  const d = readMetadata(pdf);
  assert.deepEqual(d.fields, { title: 'Field notes (draft)', author: 'Émile', created: '2024-05-01T10:30:00', pages: 2 });
  assert.equal(readMetadata(new TextEncoder().encode('plain text')).kind, null);
});

// ── location ─────────────────────────────────────────────────────────────
const XMP_BYTES = Buffer.from('ns.adobe.com/xap', 'latin1');
const hasBytes = (hay, needle) => Buffer.from(hay).includes(needle);

test('withoutLocation: no position left, every other field kept, image data untouched, stable', () => {
  for (const le of [true, false]) {
    const src = jpeg({ ...CAMERA, le }, { xmp: true });
    const out = withoutLocation(src);
    const before = readMetadata(src), after = readMetadata(out);
    assert.equal(after.location, null);
    assert.deepEqual(after.fields, before.fields);
    assert.ok(!hasBytes(out, XMP_BYTES), 'the XMP packet is gone');
    assert.ok(Buffer.from(out).subarray(-SCAN.length).equals(SCAN), 'the image data is byte for byte the same');
    assert.deepEqual(withoutLocation(out), out, 'stripping twice is stripping once');
    assert.ok(!src.every((v, i) => v === out[i]) , 'the source is not changed in place');
    assert.deepEqual(readMetadata(src).location, { lat: 51.5075, lon: -0.1275 });
  }
  const p = png({ title: 'Sunset', exif: { gps: GPS, make: 'Acme' }, xmp: true });
  const q = withoutLocation(p);
  assert.equal(readMetadata(q).location, null);
  assert.deepEqual(readMetadata(q).fields, readMetadata(p).fields);
  assert.ok(!hasBytes(q, Buffer.from('XML:com.adobe.xmp')));
  // Every chunk's CRC still holds.
  for (let o = 8; o + 12 <= q.length;) {
    const len = Buffer.from(q).readUInt32BE(o);
    assert.equal(Buffer.from(q).readUInt32BE(o + 8 + len), zcrc(Buffer.from(q.subarray(o + 4, o + 8 + len))), 'CRC');
    o += 12 + len;
  }
  assert.deepEqual(withoutLocation(q), q);
  // Kinds that carry no GPS here come back unchanged.
  assert.deepEqual(withoutLocation(pdf), pdf);
});

// ── crafted EXIF: the gap the Lean spec found, and a search for others ─────
const le16 = (n) => [n & 255, (n >> 8) & 255];
const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const ent = (tag, type, count, value) => [...le16(tag), ...le16(type), ...le32(count), ...le32(value)];
const rat3 = (d, m, s) => [...le32(d), ...le32(1), ...le32(m), ...le32(1), ...le32(s), ...le32(1)];
const inJpeg = (t) => new Uint8Array([0xff, 0xd8, 0xff, 0xe1, ((t.length + 8) >> 8) & 255, (t.length + 8) & 255, ...Buffer.from('Exif\0\0', 'latin1'), ...t, ...SCAN]);

test('the overlap file (PodMetadata.lean overlapTiff): no position before, none after the checked strip', () => {
  // Two GPS pointers in IFD0; the reader takes the last (to a GPS IFD with no position), whose one
  // entry's value lies over the last pointer's tag. Emptying it used to expose the first pointer.
  const t = [0x49, 0x49, ...le16(42), ...le32(8),
    ...le16(2), ...ent(0x8825, 4, 1, 56), ...ent(0x8825, 4, 1, 38), ...le32(0),
    ...le16(1), ...ent(0, 1, 5, 22), ...le32(0),
    ...le16(4), ...ent(1, 2, 2, 0x4e), ...ent(2, 5, 3, 110), ...ent(3, 2, 2, 0x45), ...ent(4, 5, 3, 134), ...le32(0),
    ...rat3(51, 0, 0), ...rat3(1, 0, 0)];
  assert.equal(t.length, 158);
  const x = inJpeg(t);
  assert.equal(readMetadata(x).location, null);
  const out = withoutLocation(x);
  assert.equal(readMetadata(out).location, null, 'the checked strip leaves no position');
  assert.ok(!Buffer.from(out).includes(Buffer.from('Exif\0\0', 'latin1')), 'the crafted EXIF block is dropped whole');
  assert.ok(Buffer.from(out).subarray(-SCAN.length).equals(SCAN), 'the image data is kept');
  assert.deepEqual(withoutLocation(out), out, 'stable');
});

test('20000 hostile EXIF blocks (several GPS pointers, overlapping offsets): never a position after stripping', () => {
  let seed = 4242;
  const rnd = (n) => (seed = (seed * 1103515245 + 12345) >>> 0) % n;
  let leaksBefore = 0;
  for (let i = 0; i < 20000; i++) {
    const size = 120 + rnd(160);
    const t = new Array(size).fill(0).map(() => rnd(256));
    t.splice(0, 8, 0x49, 0x49, 42, 0, 8, 0, 0, 0);
    // IFD0 at 8 with 1–4 GPS pointers aimed anywhere; GPS-like IFDs sprinkled at random offsets.
    const nPtr = 1 + rnd(4);
    const ifd0 = [...le16(nPtr)];
    for (let k = 0; k < nPtr; k++) ifd0.push(...ent(0x8825, 4, 1, 8 + rnd(size - 20)));
    ifd0.push(...le32(0));
    t.splice(8, ifd0.length, ...ifd0);
    for (let k = 0; k < 3; k++) {
      // A GPS IFD at a random place, its rationals at random places (written as valid degrees), any of
      // which may overlap the pointers, the other IFDs or each other.
      const free = 8 + ifd0.length, latAt = free + rnd(size - free - 24), lonAt = free + rnd(size - free - 24);
      const at = 8 + ifd0.length + rnd(Math.max(1, size - ifd0.length - 60));
      t.splice(latAt, 24, ...rat3(rnd(90), rnd(60), rnd(60)));
      t.splice(lonAt, 24, ...rat3(rnd(180), rnd(60), rnd(60)));
      const g = [...le16(4), ...ent(1, 2, 2, 0x4e), ...ent(2, 5, 3, latAt), ...ent(3, 2, 2, 0x45), ...ent(4, 5, 3, lonAt)];
      t.splice(at, g.length, ...g);
      // and aim pointers at it: sometimes any, mostly the last (the one the reader follows)
      if (rnd(2)) t.splice(8 + 2 + rnd(nPtr) * 12 + 8, 4, ...le32(at));
      if (k === 2 && rnd(10) < 7) t.splice(8 + 2 + (nPtr - 1) * 12 + 8, 4, ...le32(at));
    }
    const x = inJpeg(t.slice(0, size));
    if (readMetadata(x).location) leaksBefore++;
    assert.equal(readMetadata(withoutLocation(x)).location, null, `case ${i}`);
  }
  assert.ok(leaksBefore > 100, `the search does produce positions to strip (${leaksBefore})`);
  console.log(`hostile EXIF: ${leaksBefore} of 20000 had a position; none kept one after stripping`);
});

// ── robustness ───────────────────────────────────────────────────────────
test('broken files: ~3000 truncations and corruptions never throw and never invent a position', () => {
  let seed = 12345;
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const fixtures = [jpeg(CAMERA, { xmp: true }), jpeg({ make: 'NoGps' }), png({ title: 'T', exif: { gps: GPS } }), png({ title: 'x' }), id3(4, [['TIT2', 'x']]), pdf];
  let cases = 0;
  for (const f of fixtures) {
    const hadGps = readMetadata(f).location !== null;
    for (let i = 0; i < 500; i++, cases++) {
      const b = f.slice(0, Math.floor(rand() * (f.length + 1)));
      const flips = Math.floor(rand() * 4);
      for (let k = 0; k < flips && b.length; k++) b[Math.floor(rand() * b.length)] = Math.floor(rand() * 256);
      const t0 = performance.now();
      const m = readMetadata(b);
      const s = withoutLocation(b);
      assert.ok(performance.now() - t0 < 200, 'quick');
      if (!hadGps && flips === 0) assert.equal(m.location, null);
      if (readMetadata(s).location !== null) assert.equal(sniff(s), null, 'a stripped JPEG or PNG has no position');
    }
  }
  assert.ok(cases >= 3000);
});

// ── RDF ──────────────────────────────────────────────────────────────────
test('Turtle: parses, uses schema.org and EXIF terms, keeps the position out unless asked', async () => {
  const { parse } = await import('@factoidal/core');
  const m = readMetadata(jpeg(CAMERA));
  const plain = metadataTurtle('photos/beach "1".jpg', m);
  const ds = await parse(plain, { format: 'turtle', baseIRI: 'https://pod.example/' });
  assert.ok(ds.size >= 7, `triples: ${ds.size}`);
  assert.ok(!/latitude/.test(plain));
  const withPlace = metadataTurtle('beach.jpg', m, { withLocation: true });
  assert.match(withPlace, /schema:latitude 51\.5075/);
  assert.ok((await parse(withPlace, { format: 'turtle', baseIRI: 'https://pod.example/' })).size > ds.size);
  const quoted = metadataTurtle('song.mp3', { kind: 'audio', fields: { title: 'He said "hi"\\ \n' }, location: null });
  assert.ok((await parse(quoted, { format: 'turtle', baseIRI: 'https://pod.example/' })).size >= 2);
});
