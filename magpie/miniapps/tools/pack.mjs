#!/usr/bin/env node
// Pack a MiniApp source folder into a MiniApp ZIP container (.ma) and record it
// in registry.json, the static "package server" the runner reads.
//
//   node magpie/miniapps/tools/pack.mjs magpie/miniapps/samples/hello
//
// The folder is checked with the same openPackage() the runner uses, so a
// package that this tool writes is one the runner will open.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from '../src/zip.mjs';
import { openPackage } from '../src/package.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (!e.name.startsWith('.')) out.push(p);
  }
  return out;
}

const src = process.argv[2];
if (!src) { console.error('usage: pack.mjs <miniapp source folder>'); process.exit(2); }
const files = await walk(src);
const entries = await Promise.all(files.map(async f => [relative(src, f).split('\\').join('/'), new Uint8Array(await readFile(f))]));
const bytes = await writeZip(entries);

const opened = await openPackage(bytes, { mediaType: 'application/miniapp-pkg+zip' });
const { app_id, version } = opened.manifest;
const name = `${app_id}-${version.name}.ma`;
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist', name), bytes);

const regPath = join(root, 'registry.json');
let reg = { packages: {} };
try { reg = JSON.parse(await readFile(regPath, 'utf8')); } catch { /* first package */ }
const rec = reg.packages[app_id] ||= { versions: {} };
rec.versions[version.name] = { href: `dist/${name}`, code: version.code, bytes: bytes.length };
rec.latest = Object.entries(rec.versions).sort((a, b) => b[1].code - a[1].code)[0][0];
await writeFile(regPath, JSON.stringify(reg, null, 2) + '\n');

console.log(`${name}: ${entries.length} files, ${bytes.length} bytes`);
for (const w of opened.warnings) console.log(`  warning: ${w}`);
