// test-project.mjs — the project bundle codec + templates. Pure (no browser):
// build a template → real .zip → read it back → manifest & files survive, the
// zip is structurally valid, and (when the `unzip` CLI exists) a third-party
// tool agrees it's a well-formed archive.
import { buildProjectZip, readProjectZip, unzip, zipStore } from './js/edot-project.js';
import { TEMPLATES, buildTemplate } from './js/templates.js';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import path from 'node:path';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const run = (cmd, args) => new Promise((res) => execFile(cmd, args, (e, so, se) => res({ e, so, se })));

// 1) STORE zip round-trips arbitrary bytes with correct names.
{
  const z = zipStore([{ name: 'a.txt', bytes: new TextEncoder().encode('hello') }, { name: 'd/b.json', bytes: new TextEncoder().encode('{"x":1}') }]);
  ok('zip starts with PK magic', z[0] === 0x50 && z[1] === 0x4b);
  const back = await unzip(z);
  const a = back.find((e) => e.name === 'a.txt');
  const b = back.find((e) => e.name === 'd/b.json');
  ok('round-trips entry names + bytes', new TextDecoder().decode(a.bytes) === 'hello' && new TextDecoder().decode(b.bytes) === '{"x":1}');
}

// 2) Every built-in template builds, zips, and reads back losslessly.
for (const t of TEMPLATES) {
  const project = buildTemplate(t.id);
  const zip = buildProjectZip(project);
  const read = await readProjectZip(zip);
  ok(`[${t.id}] manifest name survives the round-trip`, read.manifest.name === project.manifest.name && read.manifest.edotProject === 1);
  const fileNames = Object.keys(project.files);
  ok(`[${t.id}] all ${fileNames.length} content files survive`, fileNames.every((n) => read.text(n) === project.files[n]));
  // Declared files in the manifest actually exist in the bundle.
  const declared = [...(project.manifest.docs || []), ...(project.manifest.data || []), ...(project.manifest.slides || [])].map((d) => d.file);
  ok(`[${t.id}] every manifest-declared file is present`, declared.every((f) => read.text(f) != null));
  // Slide decks parse and carry slides.
  for (const s of project.manifest.slides || []) {
    const d = read.json(s.file);
    ok(`[${t.id}] deck ${s.id} parses with slides`, d && Array.isArray(d.slides) && d.slides.length >= 1);
  }
}

// 3) A real `unzip` (if installed) accepts our archive — proves it's not just
//    self-consistent but standards-valid.
{
  const zip = buildProjectZip(buildTemplate('field-survey'));
  const dir = await mkdtemp(path.join(tmpdir(), 'edotproj-'));
  const f = path.join(dir, 'p.zip');
  await writeFile(f, zip);
  const which = await run('which', ['unzip']);
  if (!which.e && which.so.trim()) {
    const r = await run('unzip', ['-l', f]);
    ok('system unzip lists the archive (standards-valid zip)', !r.e && /edot-project\.json/.test(r.so));
    const t = await run('unzip', ['-t', f]);
    ok('system unzip integrity test passes (CRCs correct)', !t.e && /No errors detected|OK/.test(t.so + t.se));
  } else {
    console.log('… (unzip CLI not present — skipping external validation)');
  }
  await rm(dir, { recursive: true, force: true });
}

console.log(fail ? `\n${fail} PROJECT FAILURE(S)` : '\nPROJECT OK');
process.exit(fail ? 1 : 0);
