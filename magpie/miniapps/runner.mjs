// The runner page: resolve a MiniApp URI, fetch and open the package, run it in a MiniAppHost.
//
//   index.html                                   the sample app
//   index.html?app=org.glitchcan.hello           an app id from registry.json
//   index.html?uri=<MiniApp URI, URL-encoded>     e.g. foafos://miniapp/org.glitchcan.hello;version=1.0.0/pages/detail/detail?n=2
//   &lang=zh-CN                                  the user agent's locale
//   &deny=geolocation,storage                    drop capabilities from the root (to see attenuation)

import { parseMiniAppUri, formatMiniAppUri, pageRouteOf } from './src/addressing.mjs';
import { openPackage } from './src/package.mjs';
import { MiniAppHost } from './src/host.mjs';
import { AppTree } from '../../packages/foafos/src/apptree.mjs';
import { FoafBus } from '../../packages/foafos/src/bus.mjs';
import { FoafStore, localBackend } from '../../packages/foafos/src/store.mjs';

const SCHEME = 'foafos';
const PLATFORM_CODE = 1;
const ROOT_CAPS = ['storage', 'geolocation', 'audio'];
const DEFAULT_APP = 'org.glitchcan.hello';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const bus = new FoafBus();
const tree = new AppTree({ bus });
let store;
try { store = new FoafStore({ bus, backend: localBackend(localStorage) }); } catch { store = new FoafStore({ bus }); }
const deny = (params.get('deny') || '').split(',').filter(Boolean);
const root = tree.spawn({ appId: 'miniapps-root', capabilities: ROOT_CAPS.filter(c => !deny.includes(c)), label: 'MiniApp runner' });
const locales = params.get('lang') ? [params.get('lang')] : [...(navigator.languages || ['en'])];

let host = null;
let current = null;   // the parsed URI of the running app

function logLine(text, kind = '') {
  const li = document.createElement('li');
  li.textContent = text;
  if (kind) li.className = kind;
  const log = $('log');
  log.append(li);
  log.scrollTop = log.scrollHeight;   // not scrollIntoView: that scrolls the page and can push the app frame offscreen
}
bus.subscribe('*', (e) => {
  if (e.topic.startsWith('miniapp.') || e.topic.startsWith('app.') || e.topic.startsWith('store.')) {
    logLine(`${e.topic} · ${e.data.summary || ''}`, e.topic.endsWith('denied') || e.topic.endsWith('refused') || e.topic.endsWith('.error') ? 'bad' : '');
  }
});

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2500);
}

function fail(msg) {
  $('error').textContent = msg;
  $('error').hidden = false;
  logLine(msg, 'bad');
}

async function resolvePackage(parsed) {
  // MiniApp Addressing step 3-4: look up the id (and version) at the package server.
  const reg = await (await fetch('registry.json')).json();
  const rec = reg.packages[parsed.id];
  if (!rec) throw new Error(`no package "${parsed.id}" in registry.json (the Note's 404)`);
  const version = parsed.version || rec.latest;
  const v = rec.versions[version];
  if (!v) throw new Error(`no version "${version}" of "${parsed.id}" (the Note's 404)`);
  const res = await fetch(v.href);
  if (!res.ok) throw new Error(`${v.href}: HTTP ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mediaType: res.headers.get('content-type'), version, href: v.href };
}

function renderInfo(opened, href) {
  const m = opened.manifest;
  $('app-name').textContent = m.name;
  $('app-meta').textContent = `${m.app_id} · version ${m.version.name} (code ${m.version.code}) · ${href} · locale ${opened.locale}`;
  const rows = [
    ...host.granted.map(g => [g.name, g.cap, 'granted', g.reason]),
    ...host.refused.map(r => [r.name, r.cap || '—', 'refused', r.reason]),
  ];
  $('grants').replaceChildren(...rows.map(([n, c, s, why]) => {
    const tr = document.createElement('tr');
    for (const v of [n, c, s, why]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    tr.className = s === 'refused' ? 'bad' : '';
    return tr;
  }));
  $('warnings').replaceChildren(...opened.warnings.map(w => Object.assign(document.createElement('li'), { textContent: w })));
  $('signing').textContent = opened.signing ? `${opened.signing.scheme} block, ${opened.signing.length} bytes (not checked)` : 'unsigned';
  const w = m.window;
  const bar = $('navbar');
  bar.style.background = w.navigation_bar_background_color;
  bar.style.color = w.navigation_bar_text_style === 'white' ? '#fff' : '#000';
  $('nav-title').textContent = w.navigation_bar_title_text || m.short_name || m.name;
  bar.hidden = w.fullscreen || w.navigation_style === 'custom';
}

async function start(uriText) {
  $('error').hidden = true;
  const parsed = parseMiniAppUri(uriText);
  if (!parsed.ok) return fail(`not a MiniApp URI: ${parsed.error}`);
  logLine(`resolve ${uriText}`);
  let pkg;
  try { pkg = await resolvePackage(parsed); } catch (e) { return fail(e.message); }
  let opened;
  try {
    opened = await openPackage(pkg.bytes, { mediaType: pkg.mediaType, strictMediaType: false,
      startRoute: pageRouteOf(parsed), platformCode: PLATFORM_CODE, locales });
  } catch (e) { return fail(`cannot open package: ${e.message}`); }
  current = { ...parsed, version: pkg.version };
  $('stage').replaceChildren();
  host = new MiniAppHost(opened, {
    container: $('stage'), tree, rootId: root.id, store, bus, platformCode: PLATFORM_CODE,
    startPage: opened.startPage, query: parsed.query || '',
    referrerInfo: { href: document.referrer || null },
    onToast: toast,
    onNavigate: (route, query, depth) => {
      $('back').disabled = depth <= 1;
      const uri = formatMiniAppUri({ ...current, path: '/' + route, query: query || null, fragment: null });
      const u = new URL(location.href);
      u.searchParams.set('uri', uri);
      u.searchParams.delete('app');
      history.replaceState(null, '', u);
      $('uri').value = uri;
    },
    onClose: () => { $('back').disabled = true; $('closed').hidden = false; },
  });
  $('closed').hidden = true;
  try { await host.launch(); } catch (e) { return fail(e.message); }
  renderInfo(opened, pkg.href);
  window.__miniapps = { host, tree, bus, store, root };
}

$('back').addEventListener('click', () => host?.navigateBack());
$('hide').addEventListener('click', () => host?.setVisible(false));
$('show').addEventListener('click', () => host?.setVisible(true));
$('close').addEventListener('click', () => host?.close('closed by the user'));
$('go').addEventListener('submit', (e) => {
  e.preventDefault();
  if (host && host.global.state !== 'unloaded') host.close('replaced');
  $('log').replaceChildren();
  start($('uri').value.trim());
});

const initial = params.get('uri')
  || `${SCHEME}://miniapp/${params.get('app') || DEFAULT_APP}`;
$('uri').value = initial;
start(initial);
