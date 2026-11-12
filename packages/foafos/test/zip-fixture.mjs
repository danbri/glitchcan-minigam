// Zip and tar writers for test fixtures (not a test file).
import { deflateRawSync, crc32 } from 'node:zlib';

// A small zip writer for fixtures. `declare` lets a test lie about an entry's size.
export function makeZip(files) {
  const locals = [], cds = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const raw = Buffer.from(f.data ?? '');
    const packed = f.method === 0 ? raw : deflateRawSync(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(f.method ?? 8, 8);
    lh.writeUInt32LE(crc32 ? crc32(raw) : 0, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(f.declare ?? raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(f.method ?? 8, 10);
    cd.writeUInt32LE(crc32 ? crc32(raw) : 0, 16); cd.writeUInt32LE(packed.length, 20); cd.writeUInt32LE(f.declare ?? raw.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(off, 42);
    locals.push(lh, name, packed); cds.push(cd, name);
    off += 30 + name.length + packed.length;
  }
  const cdBuf = Buffer.concat(cds);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...locals, cdBuf, end]));
}

export function makeTar(files) {
  const blocks = [];
  for (const f of files) {
    const h = Buffer.alloc(512);
    h.write(f.name, 0, 100); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    const data = Buffer.from(f.data ?? '');
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136);
    h.write(f.dir ? '5' : '0', 156); h.write('ustar\0', 257); h.write('00', 263);
    h.fill(' ', 148, 156);
    let sum = 0; for (const x of h) sum += x;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return new Uint8Array(Buffer.concat(blocks));
}

