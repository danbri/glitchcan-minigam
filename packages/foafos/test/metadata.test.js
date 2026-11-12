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
