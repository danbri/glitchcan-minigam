import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { AGI_LIMITS, globToRegExp, checkManifest, outputPathFor, triggered, checkModule, sha256, frameInput, runHandler } from '../src/agi.mjs';
import { good, loop, greedy, sneaky, liar } from './agi-fixture.mjs';

// The browser runs WORKER_SOURCE in a Worker; here the same source runs in a worker_threads Worker.
const nodeWorker = (source) => {
  const w = new Worker(`const { parentPort } = require('node:worker_threads');
    globalThis.postMessage = (m) => parentPort.postMessage(m);
    parentPort.on('message', (d) => onmessage({ data: d }));\n${source}`, { eval: true });
  const api = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
  w.on('message', (d) => api.onmessage?.({ data: d }));
  w.on('error', (e) => api.onerror?.(e));
  return api;
};
const bytes = (s) => new TextEncoder().encode(s);
const text = (b) => new TextDecoder().decode(b);

test('globs: * within a folder, ** across, ? one character', () => {
  const re = globToRegExp('notes/**/*.md');
  for (const p of ['notes/a.md', 'notes/x/y/b.md']) assert.ok(re.test(p), p);
  for (const p of ['notes/a.txt', 'other/a.md', 'notes.md']) assert.ok(!re.test(p), p);
  assert.ok(globToRegExp('posts/*.md').test('posts/a.md'));
  assert.ok(!globToRegExp('posts/*.md').test('posts/x/a.md'));
  assert.ok(globToRegExp('a?.txt').test('ab.txt') && !globToRegExp('a?.txt').test('a/.txt'));
});

const md = checkManifest('md2html', { match: 'notes/**/*.md', outputDir: 'site/', output: 'site/{dir}{name}.html' });

test('manifests: refused when they would read or write agi-bin/, or have no output folder', () => {
  assert.throws(() => checkManifest('Bad Name', { match: 'a', outputDir: 'o/', output: 'o/x' }), /name/);
  assert.throws(() => checkManifest('x', { match: 'agi-bin/*.wasm', outputDir: 'o/', output: 'o/x' }), /match/);
  assert.throws(() => checkManifest('x', { match: 'a/*', outputDir: 'agi-bin/', output: 'agi-bin/x' }), /outputDir/);
  assert.throws(() => checkManifest('x', { match: 'a/*', outputDir: '../', output: 'x' }), /outputDir/);
  assert.throws(() => checkManifest('x', { match: 'a/*', outputDir: 'o', output: 'o/x' }), /outputDir/);
});

test('outputs: under the output folder, never agi-bin/, never one of its own inputs, never climbing out', () => {
  assert.equal(outputPathFor(md, 'notes/trip/day1.md'), 'site/notes/trip/day1.html');
  const escape = checkManifest('e', { match: 'n/*.md', outputDir: 'site/', output: 'site/../../{name}.html' });
  assert.equal(outputPathFor(escape, 'n/a.md'), null);
  const intoBin = checkManifest('b', { match: 'n/*.md', outputDir: 'site/', output: 'agi-bin/{name}.wasm' });
  assert.equal(outputPathFor(intoBin, 'n/a.md'), null);
  const outside = checkManifest('o', { match: 'n/*.md', outputDir: 'site/', output: 'elsewhere/{name}.html' });
  assert.equal(outputPathFor(outside, 'n/a.md'), null);
  const onItself = checkManifest('s', { match: 'site/**', outputDir: 'site/', output: 'site/{name}.md' });
  assert.equal(outputPathFor(onItself, 'site/a.md'), null, 'it would write a file it reads');
});

test('triggers: a write sets off matching handlers; a handler\'s own write, or anything in agi-bin/, sets off none', () => {
  assert.deepEqual(triggered([md], 'notes/a.md').map((h) => h.name), ['md2html']);
  assert.deepEqual(triggered([md], 'notes/a.md', { byHandler: true }), []);
  assert.deepEqual(triggered([md], 'agi-bin/md2html.json'), []);
  assert.deepEqual(triggered([md], 'site/notes/a.html'), []);
});

test('modules: only env.memory may be imported, and alloc and run must be there', () => {
  assert.equal(checkModule(good), null);
  assert.equal(checkModule(sneaky), 'imports');
  assert.equal(checkModule(new Uint8Array([0, 1, 2])), 'not-wasm');
  assert.equal(checkModule(new Uint8Array(AGI_LIMITS.wasmBytes + 1)), 'too-large');
});

test('running: the output comes back; the same input gives the same output', async () => {
  const input = frameInput(md, [{ path: 'notes/a.md', bytes: bytes('hello') }]);
  const a = await runHandler(nodeWorker, good, input);
  const b = await runHandler(nodeWorker, good, input);
  assert.equal(a.ok, true);
  assert.equal(text(a.bytes), 'NOTES/A.MD\0HELLO');
  assert.deepEqual(a.bytes, b.bytes);
  assert.equal((await sha256(good)).length, 64);
});

test('hostile handlers: a loop is stopped, a memory grab traps, a lying length is refused', async () => {
  const quick = { ...AGI_LIMITS, timeMs: 300 };
  const t0 = performance.now();
  assert.deepEqual(await runHandler(nodeWorker, loop, bytes('x'), quick), { ok: false, reason: 'timeout' });
  assert.ok(performance.now() - t0 < 2000, 'stopped on time');
  assert.equal((await runHandler(nodeWorker, greedy, bytes('x'))).reason, 'trap');
  assert.equal((await runHandler(nodeWorker, liar, bytes('x'))).reason, 'too-large');
  assert.equal((await runHandler(nodeWorker, good, new Uint8Array(AGI_LIMITS.inputBytes + 1))).reason, 'too-large');
});

test('folder input: count, then each name and its bytes', () => {
  const h = checkManifest('feed', { kind: 'folder', match: 'posts/*.md', outputDir: 'site/', output: 'site/feed.xml' });
  const f = frameInput(h, [{ path: 'posts/a.md', bytes: bytes('A') }, { path: 'posts/b.md', bytes: bytes('BB') }]);
  const dv = new DataView(f.buffer);
  assert.equal(dv.getUint32(0, true), 2);
  assert.equal(dv.getUint32(4, true), 10);
  assert.equal(text(f.subarray(8, 18)), 'posts/a.md');
  assert.equal(dv.getUint32(18, true), 1);
  assert.equal(outputPathFor(h, 'posts/a.md'), 'site/feed.xml');
});

// ── the example handlers, built by agi/build.sh ──────────────────────────
import { readFileSync } from 'node:fs';
const md2html = new Uint8Array(readFileSync(new URL('../agi/md2html.wasm', import.meta.url)));
const feed = new Uint8Array(readFileSync(new URL('../agi/feed.wasm', import.meta.url)));
const page = async (src, path = 'notes/a.md') => {
  const r = await runHandler(nodeWorker, md2html, frameInput(md, [{ path, bytes: bytes(src) }]));
  assert.equal(r.ok, true, r.reason);
  return text(r.bytes);
};

test('md2html: headings, paragraphs, emphasis, code, links, lists, quotes', async () => {
  assert.equal(checkModule(md2html), null);
  const h = await page('# Trip\n\nA *small* **boat** and `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n> said\n\n[site](https://example.org/a?b=1)\n\n```\nlet x = 1 < 2;\n```\n');
  assert.match(h, /<title>Trip<\/title>/);
  assert.match(h, /<h1>Trip<\/h1>/);
  assert.match(h, /<p>A <em>small<\/em> <strong>boat<\/strong> and <code>code<\/code>\.<\/p>/);
  assert.match(h, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assert.match(h, /<ol>\n<li>first<\/li>\n<li>second<\/li>\n<\/ol>/);
  assert.match(h, /<blockquote>\n<p>said<\/p>\n<\/blockquote>/);
  assert.match(h, /<a href="https:\/\/example\.org\/a\?b=1">site<\/a>/);
  assert.match(h, /<pre><code>let x = 1 &lt; 2;\n<\/code><\/pre>/);
});

test('md2html is safe: raw HTML is shown as text, unsafe links keep only their words', async () => {
  const h = await page('<script>alert(1)</script>\n\n[click](javascript:alert(1)) [x](data:text/html,hi) <img src=x onerror=y>\n\n# "Quotes" & <tags>');
  assert.ok(!/<script/i.test(h) && !/<img/i.test(h));
  assert.ok(!/javascript:/i.test(h.replace(/&[a-z]+;/g, '')) || !/href="javascript/i.test(h));
  assert.ok(!/href="(javascript|data):/i.test(h));
  assert.match(h, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(h, /<title>&quot;Quotes&quot; &amp; &lt;tags&gt;<\/title>/);
});

test('feed: newest first by file name, titles from headings, links to the pages, dates from names', async () => {
  const fh = checkManifest('feed', { kind: 'folder', match: 'posts/*.md', outputDir: 'site/', output: 'site/feed.xml' });
  const r = await runHandler(nodeWorker, feed, frameInput(fh, [
    { path: 'posts/2024-05-01-lake.md', bytes: bytes('# By the lake\nwords') },
    { path: 'posts/2024-06-02-hills.md', bytes: bytes('# Into the <hills>\n') },
    { path: 'posts/undated.md', bytes: bytes('no heading here') },
  ]));
  assert.equal(r.ok, true);
  const x = text(r.bytes);
  const titles = [...x.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Posts', 'undated', 'Into the &lt;hills&gt;', 'By the lake']);
  assert.match(x, /<link href="posts\/2024-06-02-hills\.html"\/>/);
  assert.match(x, /<updated>2024-06-02T00:00:00Z<\/updated>/);
  assert.equal((x.match(/<updated>/g) || []).length, 2, 'no date is made up for an undated post');
});

test('2000 random and hostile inputs: md2html never traps and never lets a tag or a script link through', async () => {
  let seed = 99;
  const rnd = (n) => (seed = (seed * 1103515245 + 12345) >>> 0) % n;
  const pieces = ['<script>', '</p>', '[a](javascript:x)', '[b](JaVaScRiPt:y)', '```', '**', '*', '`', '#', '- ', '1. ', '> ', '\n', '\n\n', '"', '&', '<img onerror=1>', '[c](', ')', ']', 'é', '\u0000', '\r\n'];
  for (let i = 0; i < 2000; i++) {
    let s = '';
    for (let k = rnd(40); k > 0; k--) s += rnd(3) ? pieces[rnd(pieces.length)] : String.fromCharCode(32 + rnd(95));
    const r = await runHandler(nodeWorker, md2html, frameInput(md, [{ path: 'n/x.md', bytes: bytes(s) }]));
    assert.equal(r.ok, true, `case ${i}: ${r.reason}`);
    const h = text(r.bytes);
    assert.ok(!/<script|<img/i.test(h), `case ${i}: a tag got through`);
    assert.ok(!/href="\s*(javascript|data):/i.test(h), `case ${i}: an unsafe link got through`);
  }
});
