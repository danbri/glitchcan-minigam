// Node unit tests for the spec modules. Run: node --test magpie/miniapps/test/unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { parseMiniAppUri, formatMiniAppUri, pageRouteOf } from '../src/addressing.mjs';
import { processManifest, isPackageRelative } from '../src/manifest.mjs';
import { GlobalLifecycle, PageLifecycle } from '../src/lifecycle.mjs';
import { readZip, writeZip, crc32, ZipError, SIGNING_MAGIC } from '../src/zip.mjs';
import { openPackage, PackageError } from '../src/package.mjs';

const here = new URL('.', import.meta.url);

test('addressing: every example URI in the Note parses', () => {
  const examples = [
    'platform://miniapp/foo;version=1.0.1-trial/pages/index?k=v#bar',
    'https://platform.org/miniapp/foo;version=1.0.1-trial/pages/index?k=v#bar',
    'platform://miniapp/foo;version=1.0.1-trial/pages/index?category=book#section-3',
    'platform://miniapp/foo;version=1.0.1/pages/index?k=v#bar',
    'https://platform.org/miniapp/foo;version=1.0.1/pages/index?k=v#bar',
  ];
  for (const u of examples) {
    const p = parseMiniAppUri(u);
    assert.equal(p.ok, true, `${u}: ${p.error}`);
    assert.equal(p.id, 'foo');
    assert.equal(p.path, '/pages/index');
    assert.equal(formatMiniAppUri(p), u);
  }
  const h = parseMiniAppUri('https://platform.org/miniapp/foo;version=1.0.1/pages/index?k=v#bar');
  assert.equal(h.host, 'platform.org');
  assert.equal(h.version, '1.0.1');
  assert.equal(h.query, 'k=v');
  assert.equal(h.fragment, 'bar');
});

test('addressing: id and version are case-insensitive; no version and no path are allowed', () => {
  const p = parseMiniAppUri('foafos://miniapp/Org.Example.App');
  assert.equal(p.ok, true);
  assert.equal(p.id, 'org.example.app');
  assert.equal(p.version, null);
  assert.equal(pageRouteOf(p), null);
  assert.equal(parseMiniAppUri('x://miniapp/a;version=RC1').version, 'rc1');
  assert.equal(pageRouteOf(parseMiniAppUri('x://miniapp/a/pages/d/d?n=1')), 'pages/d/d');
});

test('addressing: malformed URIs are refused', () => {
  for (const u of ['foo', 'x://notminiapp/a', 'x://miniapp/', 'x://miniapp/a;ver=1', 'x://miniapp/a b',
    'https:///miniapp/a', 'bad scheme://miniapp/a', 'x://miniapp/a;version=1 2']) {
    assert.equal(parseMiniAppUri(u).ok, false, u);
  }
});

const SPEC_EXAMPLE = {
  dir: 'ltr', lang: 'en-US', app_id: 'org.example.miniapp', name: 'MiniApp Demo', short_name: 'MiniApp',
  version: { name: '1.0.1', code: 11 }, description: 'A Simple MiniApp Demo',
  icons: [{ label: 'MiniApp Icon', src: 'common/icons/icon.png', sizes: '48x48' }],
  platform_version: { min_code: 1, release_type: 'Beta1', target_code: 2 },
  pages: ['pages/index/index', 'pages/detail/detail'],
  window: { background_color: '#ffffff', fullscreen: false, navigation_bar_text_style: 'black',
    navigation_bar_title_text: 'My MiniApp', navigation_bar_background_color: '#f8f8f8' },
  widgets: [{ name: 'widget', min_code: '2', path: 'widgets/index/index' }],
  req_permissions: [{ name: 'system.permission.LOCATION', reason: 'Show the location' },
    { name: 'system.permission.CAMERA', reason: 'Take photos' }],
  color_scheme: 'light', device_type: ['phone', 'tv', 'car'],
};

test('manifest: the draft\'s example processes with no error and no warning', () => {
  const r = processManifest(SPEC_EXAMPLE);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.manifest.window.orientation, 'portrait');       // a default
  assert.equal(r.manifest.window.navigation_bar_text_style, 'black');
  assert.equal(r.manifest.widgets[0].min_code, 2);                 // string in the example, number in the table
});

test('manifest: required members are fatal, optional ones are dropped with a warning', () => {
  for (const k of ['app_id', 'name', 'version', 'platform_version', 'icons', 'pages']) {
    const j = { ...SPEC_EXAMPLE };
    delete j[k];
    const r = processManifest(j);
    assert.equal(r.manifest, null, k);
    assert.ok(r.errors.some(e => e.startsWith(k)), `${k}: ${r.errors}`);
  }
  const r = processManifest({ ...SPEC_EXAMPLE, dir: 'up', window: { orientation: 'sideways', design_width: -1 },
    req_permissions: [{ reason: 'x' }, { name: 'a', reason: 3 }], extra: 1 });
  assert.ok(r.manifest);
  assert.equal(r.manifest.dir, undefined);
  assert.equal(r.manifest.window.orientation, 'portrait');
  assert.deepEqual(r.manifest.req_permissions, [{ name: 'a' }]);
  assert.equal(r.warnings.length, 6);
});

test('manifest: version.code <= 0 becomes 1; page paths may not escape the package', () => {
  const r = processManifest({ ...SPEC_EXAMPLE, version: { name: 'x', code: 0 }, pages: ['../x', 'https://e.org/a', 'pages/ok'] });
  assert.equal(r.manifest.version.code, 1);
  assert.deepEqual(r.manifest.pages, ['pages/ok']);
  assert.equal(isPackageRelative('/abs'), false);
});

test('lifecycle: global machine follows the draft and refuses illegal moves', () => {
  const g = new GlobalLifecycle();
  const seen = [];
  g.onglobalshown = () => seen.push('handler shown');
  g.addEventListener('globalhidden', () => seen.push('event hidden'));
  g.to('launched').to('shown').to('hidden').to('shown');
  assert.throws(() => g.to('launched'));
  assert.equal(g.try('launched'), false);
  g.to('error').to('shown').to('unloaded');
  assert.throws(() => g.to('shown'));
  assert.deepEqual(seen, ['handler shown', 'event hidden', 'handler shown', 'handler shown']);
  assert.deepEqual(g.history.map(h => h[0]), ['launched', 'shown', 'hidden', 'shown', 'error', 'shown', 'unloaded']);
});

test('lifecycle: page machine is loaded -> ready -> shown <-> hidden -> unloaded', () => {
  const p = new PageLifecycle('pages/index/index');
  assert.equal(p.pageState, null);
  assert.throws(() => p.to('shown'));
  p.to('loaded').to('ready').to('shown').to('hidden').to('shown').to('unloaded');
  assert.equal(p.pageState, 'unloaded');
});

test('zip: crc32 agrees with zlib', () => {
  const b = new TextEncoder().encode('MiniApp Packaging '.repeat(100));
  assert.equal(crc32(b), zlibCrc32(b));
});

test('zip: round trip, UTF-8 names, deterministic bytes', async () => {
  const entries = [['manifest.json', '{}'], ['pages/首页/index.html', '<p>你好</p>'], ['big.txt', 'a'.repeat(5000)]];
  const a = await writeZip(entries);
  const b = await writeZip(entries);
  assert.deepEqual(a, b);
  const { files, signing } = await readZip(a);
  assert.equal(signing, null);
  assert.equal(new TextDecoder().decode(files.get('pages/首页/index.html')), '<p>你好</p>');
  assert.equal(files.get('big.txt').length, 5000);
});

test('zip: constraint violations are refused', async () => {
  const good = await writeZip([['a.txt', 'hello hello hello hello']]);
  const flip = (off, fn) => { const c = good.slice(); fn(new DataView(c.buffer), off); return c; };
  const cd = new DataView(good.buffer).getUint32(good.length - 22 + 16, true);
  const cases = {
    encrypted: flip(cd + 8, (d, o) => d.setUint16(o, d.getUint16(o, true) | 1, true)),
    method: flip(cd + 10, (d, o) => d.setUint16(o, 12, true)),
    version: flip(cd + 6, (d, o) => d.setUint16(o, 45, true)),
    crc: flip(cd + 16, (d, o) => d.setUint32(o, 1, true)),
    spanned: flip(good.length - 22 + 4, (d, o) => d.setUint16(o, 1, true)),
  };
  for (const [name, bytes] of Object.entries(cases)) {
    await assert.rejects(readZip(bytes), ZipError, name);
  }
  await assert.rejects(readZip(new Uint8Array(100)), ZipError);
});

test('zip: a signing block before the central directory is found and named', async () => {
  const plain = await writeZip([['a.txt', 'x']]);
  const dv = new DataView(plain.buffer);
  const cdOff = dv.getUint32(plain.length - 22 + 16, true);
  const block = new Uint8Array(8 + 8 + 16);   // size, size, magic (an empty RPK block)
  new DataView(block.buffer).setBigUint64(0, 24n, true);
  new DataView(block.buffer).setBigUint64(8, 24n, true);
  block.set(new TextEncoder().encode(SIGNING_MAGIC.rpk), 16);
  const out = new Uint8Array(plain.length + block.length);
  out.set(plain.subarray(0, cdOff));
  out.set(block, cdOff);
  out.set(plain.subarray(cdOff), cdOff + block.length);
  const odv = new DataView(out.buffer);
  odv.setUint32(out.length - 22 + 16, cdOff + block.length, true);
  const { signing } = await readZip(out);
  assert.equal(signing.scheme, 'rpk');
  assert.equal(signing.length, block.length);
});

test('package: the committed sample opens, and its processing steps fail where the draft says', async () => {
  const bytes = new Uint8Array(await readFile(new URL('../dist/org.glitchcan.hello-1.0.0.ma', here)));
  const o = await openPackage(bytes, { mediaType: 'application/miniapp-pkg+zip', locales: ['zh-CN'], startRoute: 'pages/detail/detail' });
  assert.equal(o.manifest.app_id, 'org.glitchcan.hello');
  assert.equal(o.startPage, 'pages/detail/detail');
  assert.equal(o.locale, 'zh-CN');
  assert.equal(o.messages.title, '你好，小程序');
  await assert.rejects(openPackage(bytes, { mediaType: 'application/zip' }), (e) => e instanceof PackageError && e.step === 'retrieve');
  await assert.rejects(openPackage(bytes, { platformCode: 0 }), (e) => e.step === 'prepare');

  const { files } = await readZip(bytes);
  const without = (name) => writeZip([...files].filter(([n]) => n !== name));
  await assert.rejects(openPackage(await without('app.css')), (e) => e.step === 'prepare');
  await assert.rejects(openPackage(await without('manifest.json')), (e) => e.step === 'manifest');
  await assert.rejects(openPackage(await without('pages/detail/detail.html')), (e) => e.step === 'prepare');
});
