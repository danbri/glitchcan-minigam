import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { makeZip, makeTar } from './zip-fixture.mjs';
import { openArchive, listArchive, safeName, ARCHIVE_LIMITS } from '../src/archive.mjs';

const text = (u8) => new TextDecoder().decode(u8);

test('zip: folders listed (including implied ones), stored and deflated entries read back', async () => {
  const arc = await openArchive(makeZip([
    { name: 'readme.txt', data: 'hello', method: 0 },
    { name: 'docs/a.md', data: '# A\n' + 'text '.repeat(200) },
    { name: 'docs/deep/b.txt', data: 'bee' },
  ]));
  assert.equal(arc.kind, 'zip');
  assert.deepEqual(listArchive(arc, ''), [{ name: 'docs/', dir: true }, { name: 'readme.txt', dir: false, size: 5 }]);
  assert.deepEqual(listArchive(arc, 'docs/').map((e) => e.name), ['a.md', 'deep/']);
  assert.equal(text(await arc.read(arc.entries.find((e) => e.name === 'readme.txt'))), 'hello');
  assert.match(text(await arc.read(arc.entries.find((e) => e.name === 'docs/a.md'))), /^# A\ntext text/);
});

test('tar and tar.gz', async () => {
  const tar = makeTar([{ name: 'pics/', dir: true }, { name: 'pics/cat.txt', data: 'meow' }, { name: 'notes.txt', data: 'n' }]);
  for (const bytes of [tar, new Uint8Array(gzipSync(tar))]) {
    const arc = await openArchive(bytes);
    assert.equal(arc.kind, 'tar');
    assert.deepEqual(listArchive(arc, '').map((e) => e.name), ['notes.txt', 'pics/']);
    assert.equal(text(await arc.read(arc.entries.find((e) => e.name === 'pics/cat.txt'))), 'meow');
  }
});

test('names that climb out, or are absolute, are left out', async () => {
  for (const bad of ['../evil.txt', '/etc/passwd', 'a/../../b', 'a\\b', 'a//b', './x']) assert.equal(safeName(bad), null, bad);
  const arc = await openArchive(makeZip([{ name: '../evil.txt', data: 'x' }, { name: '/abs.txt', data: 'y' }, { name: 'ok.txt', data: 'z' }]));
  assert.deepEqual(arc.entries.map((e) => e.name), ['ok.txt']);
});

test('zip bombs: too large, too tightly packed, and lying about size are all refused', async () => {
  const big = Buffer.alloc(ARCHIVE_LIMITS.entryBytes + 1);              // over the entry limit
  let arc = await openArchive(makeZip([{ name: 'big.bin', data: big }]));
  await assert.rejects(arc.read(arc.entries[0]), (e) => e.reason === 'too-large');
  const dense = Buffer.alloc(4 * 1024 * 1024);                            // 4 MiB of zeros packs to ~4 KiB: ratio over 200
  arc = await openArchive(makeZip([{ name: 'dense.bin', data: dense }]));
  await assert.rejects(arc.read(arc.entries[0]), (e) => e.reason === 'too-large');
  // Says it is 10 bytes; unpacking stops at 200 × its packed size, whatever it said.
  arc = await openArchive(makeZip([{ name: 'liar.bin', data: dense, declare: 10 }]));
  await assert.rejects(arc.read(arc.entries[0]), (e) => e.reason === 'too-large');
});

test('an archive inside an archive opens too', async () => {
  const inner = makeZip([{ name: 'inside.txt', data: 'deep' }]);
  const outer = await openArchive(makeZip([{ name: 'inner.zip', data: Buffer.from(inner), method: 0 }]));
  const nested = await openArchive(await outer.read(outer.entries[0]));
  assert.equal(text(await nested.read(nested.entries[0])), 'deep');
  await assert.rejects(openArchive(new TextEncoder().encode('just text')), (e) => e.reason === 'not-archive');
});
