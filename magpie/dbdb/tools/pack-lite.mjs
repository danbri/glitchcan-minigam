#!/usr/bin/env node
/* pack-lite.mjs — derive the LOW-POWER pack: every element in
   splats/pack/*.compressed.ply thinned to half its Gaussians and
   written to splats/pack/lite/ under the same names. splatpack.html
   picks the lite pack on mobile user agents (?pack=full / ?pack=lite
   override).

   splat-transform's own --decimate needs a WebGPU device (none in
   this container), so the thinning is done here on the PLAIN ply:
   decompress -> keep every 2nd vertex record -> recompress. Format
   conversions in splat-transform are CPU-only and work headless.

   Usage: node magpie/dbdb/tools/pack-lite.mjs [keep-divisor]  (default 2)
*/
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PACK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../splats/pack');
const OUT = path.join(PACK, 'lite');
const DIV = Math.max(2, parseInt(process.argv[2] || '2', 10));
fs.mkdirSync(OUT, { recursive: true });

const st = args => execFileSync('npx', ['-y', '@playcanvas/splat-transform', '-w', ...args],
  { stdio: 'pipe' });

function thinPly(src, dst, div) {
  const buf = fs.readFileSync(src);
  const headEnd = buf.indexOf('end_header\n') + 'end_header\n'.length;
  const header = buf.toString('utf8', 0, headEnd);
  const count = parseInt(header.match(/element vertex (\d+)/)[1], 10);
  const props = (header.match(/property float /g) || []).length;
  const stride = props * 4;
  const keep = Math.floor(count / div);
  const out = Buffer.alloc(keep * stride);
  for (let i = 0; i < keep; i++)
    buf.copy(out, i * stride, headEnd + i * div * stride, headEnd + i * div * stride + stride);
  const newHeader = header.replace(/element vertex \d+/, 'element vertex ' + keep);
  fs.writeFileSync(dst, Buffer.concat([Buffer.from(newHeader), out]));
  return { count, keep };
}

const files = fs.readdirSync(PACK).filter(f => f.endsWith('.compressed.ply'));
for (const f of files) {
  const src = path.join(PACK, f), dst = path.join(OUT, f);
  const full = path.join(OUT, f.replace('.compressed.ply', '.full.tmp.ply'));
  const half = path.join(OUT, f.replace('.compressed.ply', '.half.tmp.ply'));
  st([src, full]);
  const { count, keep } = thinPly(full, half, DIV);
  st([half, dst]);
  fs.unlinkSync(full); fs.unlinkSync(half);
  const a = fs.statSync(src).size, b = fs.statSync(dst).size;
  console.log(f.padEnd(28), count + ' → ' + keep + ' splats  ',
    (a / 1024 | 0) + 'K → ' + (b / 1024 | 0) + 'K');
}
console.log('lite pack →', OUT);
