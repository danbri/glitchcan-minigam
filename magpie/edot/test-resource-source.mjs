// test-resource-source.mjs — the unified storage mount: lazy folder listing,
// read/write/remove/stat/mkdir, and the Account model (provider → capabilities,
// OS vs platform, auth requirement). Pure Node.
import { MemoryResourceSource, makeAccount, storeResourceSource, LocalFsResourceSource } from './js/resource-source.js';
import { providersOffering, PROVIDERS } from './js/ontology.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

const fs = new MemoryResourceSource({ id: 'm1', provider: 'opfs' });
fs.write('/notes/todo.txt', enc('buy milk'));
fs.write('/notes/done.txt', enc('shipped'));
fs.write('/photos/2026/a.jpg', enc('JPEGDATA'));
fs.mkdir('/empty');

ok('read returns what was written', dec(fs.read('/notes/todo.txt')) === 'buy milk');
ok('stat reports a file with size + locality', (() => { const s = fs.stat('/notes/todo.txt'); return s.kind === 'file' && s.size === 8 && s.locality === 'local'; })());
ok('list of root shows folders (incl. implicit + empty)', fs.list('/').map((e) => e.name).join(',') === 'empty,notes,photos');
ok('list of a folder shows its files', fs.list('/notes').filter((e) => e.kind === 'file').map((e) => e.name).join(',') === 'done.txt,todo.txt');
ok('nested folders are implied by file paths', fs.list('/photos').map((e) => `${e.kind}:${e.name}`).join(',') === 'folder:2026' && fs.list('/photos/2026')[0].name === 'a.jpg');
ok('remove deletes a file', (() => { fs.remove('/notes/done.txt'); return fs.stat('/notes/done.txt') === null && fs.list('/notes').length === 1; })());
ok('remove on a folder drops everything under it', (() => { fs.remove('/photos'); return fs.stat('/photos') === null && fs.list('/').every((e) => e.name !== 'photos'); })());

// Lazy listing — a huge directory lists by window, never materialising all.
const big = new MemoryResourceSource({ id: 'big', provider: 'opfs' });
for (let i = 0; i < 1000; i++) big.write(`/inbox/msg${String(i).padStart(4, '0')}.eml`, enc('x'));
ok('a 1000-entry folder reports its count', big.count('/inbox') === 1000);
const win = big.list('/inbox', { offset: 500, limit: 5 }).map((e) => e.name);
ok('list returns only the requested window (5 of 1000)', win.length === 5 && win[0] === 'msg0500.eml' && win[4] === 'msg0504.eml');

// Accounts: provider → capabilities, OS vs platform, auth.
const gh = makeAccount({ provider: 'github', sources: { storage: fs } });
ok('a GitHub account is a remote platform requiring auth', gh.isLocal === false && gh.requiresAuth === true);
ok('it offers storage + vcs and yields the storage source', gh.offers.includes('storage') && gh.offers.includes('vcs') && gh.capability('storage') === fs);
ok('it does not offer capabilities it lacks (mail)', gh.capability('mail') === null);

const local = makeAccount({ provider: 'local-fs' });
ok('local files are an OS provider with no login (capability-granted)', local.isLocal === true && local.requiresAuth === false);

// The provider catalogue answers "where could I save this / get mail from".
ok('providersOffering(storage) spans local + platforms', ['local-fs', 'opfs', 'github', 's3', 'webdav', 'solid'].every((p) => providersOffering('storage').includes(p)));
ok('providersOffering(mail) is the mail platforms', providersOffering('mail').sort().join(',') === 'gmail,graph');
ok('every provider declares kind/auth/offers/locality', Object.values(PROVIDERS).every((p) => p.kind && p.auth && Array.isArray(p.offers) && p.locality));

// The unification: a flat blob store (the backup stores/* interface) presented
// as a ResourceSource — so every backup backend becomes a mount.
const blobs = new Map();
const fakeStore = {
  id: 'fake', label: 'Fake',
  async put(k, bytes) { blobs.set(k, bytes); },
  async get(k) { if (!blobs.has(k)) throw new Error('404'); return blobs.get(k); },
  async list() { return [...blobs.entries()].map(([id, b]) => ({ id, size: b.length, modified: 0 })); },
  async remove(k) { blobs.delete(k); },
};
const rs = storeResourceSource(fakeStore, { /* cfg */ }, { id: 'work-github', provider: 'github' });
await rs.write('/edot-backups/2026.enc', enc('cipher'));
await rs.write('/edot-backups/old/2025.enc', enc('older'));
ok('a backup store, wrapped, reads back what it wrote', dec(await rs.read('/edot-backups/2026.enc')) === 'cipher');
ok('the wrapped store derives folders from flat keys', (await rs.list('/edot-backups')).map((e) => `${e.kind}:${e.name}`).sort().join(',') === 'file:2026.enc,folder:old');
ok('the wrapped store windows its listing', (await rs.list('/edot-backups', { offset: 0, limit: 1 })).length === 1);
ok('the wrapped store stats + removes', (await rs.stat('/edot-backups/2026.enc')).kind === 'file' && (await rs.remove('/edot-backups/2026.enc'), (await rs.stat('/edot-backups/2026.enc')) === null));
ok('the wrapped backend is a remote storage mount (provider github)', rs.provider === 'github' && rs.capability === 'storage' && rs.locality === 'remote');

// File System Access local tier (the OS tier). Live folder-picking needs a user
// gesture (not headless), but the not-ready/guard behavior is checkable.
const lf = new LocalFsResourceSource();
ok('LocalFs is a local OS-tier storage mount', lf.provider === 'local-fs' && lf.capability === 'storage' && lf.locality === 'local');
ok('LocalFs starts not-ready and refuses ops before a folder is chosen', lf.ready === false && await lf._root().then(() => false).catch(() => true));
ok('LocalFs.pick fails clearly where the File System Access API is absent', await lf.pick().then(() => false).catch((e) => /unavailable/i.test(e.message)));

console.log(fail ? `\n${fail} RESOURCE-SOURCE FAILURE(S)` : '\nRESOURCE-SOURCE OK');
process.exit(fail ? 1 : 0);
