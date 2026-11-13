import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc } from 'node:zlib';
import { makeStoredZip, crc32 } from '../src/zip-write.mjs';
import { openArchive, listArchive } from '../src/archive.mjs';

test('crc32 matches zlib', () => {
  for (const s of ['', 'a', 'hello world', 'é漢字']) assert.equal(crc32(new TextEncoder().encode(s)), nodeCrc(Buffer.from(s)) >>> 0);
});

test('a stored zip opens with the archive reader, folders, an empty folder and all', async () => {
  const bytes = makeStoredZip([{ name: 'trip/a.txt', data: 'A' }, { name: 'trip/sub/b.txt', data: new Uint8Array([0, 255, 7]) }, { name: 'trip/empty/' }]);
  const arc = await openArchive(bytes);
  assert.equal(arc.kind, 'zip');
  assert.deepEqual(listArchive(arc, 'trip/').map((e) => e.name), ['a.txt', 'empty/', 'sub/']);
  const a = arc.entries.find((e) => e.name === 'trip/a.txt');
  const b = arc.entries.find((e) => e.name === 'trip/sub/b.txt');
  assert.equal(new TextDecoder().decode(await arc.read(a)), 'A');
  assert.deepEqual([...(await arc.read(b))], [0, 255, 7]);
});
