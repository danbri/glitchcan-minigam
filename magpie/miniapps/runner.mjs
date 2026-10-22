// The runner page: resolve a MiniApp URI, fetch and open the package, run it in a MiniAppHost,
// and give it accessible chrome.
//
//   index.html                                   the default app (the hello package)
//   index.html?app=org.glitchcan.suite           the suite experiment (inverted; see README)
//   index.html?app=org.glitchcan.hello           an app id from registry.json
//   index.html?uri=<MiniApp URI, URL-encoded>     e.g. foafos://miniapp/org.glitchcan.suite/pages/office/editor
//   &lang=zh-CN                                  the language of the chrome and of the app
//   &deny=geolocation,storage                    drop capabilities from the root (to see attenuation)
//
// What the chrome does beyond the MiniApp drafts (each item is tested in test/ux.mjs):
// browser history = the page stack; page titles and breadcrumbs; announcements in a live
// region; focus moved into each new page; text size, colours and movement for every page;
// a permission sheet with the app's own reasons; loading progress; recovery from slow
// pages, errors and failed downloads; contrast checks on the colours an app supplies.

import { parseMiniAppUri, formatMiniAppUri, pageRouteOf } from './src/addressing.mjs';
import { openPackage } from './src/package.mjs';
import { MiniAppHost, capabilityFor } from './src/host.mjs';
import { strings, pickLocale } from './src/ui-strings.mjs';
import { AppTree } from '../../packages/foafos/src/apptree.mjs';
import { FoafBus } from '../../packages/foafos/src/bus.mjs';
import { FoafStore, localBackend } from '../../packages/foafos/src/store.mjs';

const SCHEME = 'foafos';
const PLATFORM_CODE = 1;
const ROOT_CAPS = ['storage', 'geolocation', 'audio', 'story:link', 'story:launch', 'story:navigate', 'story:observe', 'vars:read', 'vars:write'];
// The hello package. The suite (org.glitchcan.suite) inverts the foafos layer model and
// opens only by name: README, "Correction (2026-10-22)".
const DEFAULT_APP = 'org.glitchcan.hello';
const SCALES = [1, 1.25, 1.5, 2];
const CAP_WORDS = {
  storage: 'Keep its data in this browser',
  geolocation: 'Know your location',
  audio: 'Play sound',
  'story:link': 'Follow links between stories',
  'story:launch': 'Open games from stories',
  'story:navigate': 'Show your place in a story in the address bar',
  'story:observe': 'See the map of open stories',
  'vars:read': 'Read story variables',
  'vars:write': 'Change story variables',
};

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const siteBase = new URL(location.pathname.replace(/magpie\/miniapps\/[^/]*$/, ''), location.origin).href;
const bus = new FoafBus();
const tree = new AppTree({ bus });
let store;
try { store = new FoafStore({ bus, backend: localBackend(localStorage) }); } catch { store = new FoafStore({ bus }); }
const deny = (params.get('deny') || '').split(',').filter(Boolean);
const root = tree.spawn({ appId: 'miniapps-root', capabilities: ROOT_CAPS.filter(c => !deny.includes(c)), label: 'MiniApp runner' });
const locales = params.get('lang') ? [params.get('lang')] : [...(navigator.languages || ['en'])];
const uiLocale = pickLocale(locales);
const t = strings(uiLocale);

const saved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

let prefs = { scale: 1, theme: 'system', motion: 'system', ...saved('miniapps.prefs', {}) };
let host = null;
let current = null;       // the parsed URI of the running app
let opened = null;
let session = 0;
let ignorePops = 0;
let firstShow = true;

// ---------- chrome text in the user's language ----------

document.documentElement.lang = uiLocale;
$('skip').textContent = t('skip');
$('menu-btn').setAttribute('aria-label', t('menu'));
$('crumbs-nav').setAttribute('aria-label', t('pages'));
$('menu-title').textContent = t('menu');
$('lg-text').textContent = t('textSize');
$('lg-theme').textContent = t('theme');
$('lg-motion').textContent = t('motion');
$('lg-perms').textContent = t('permissions');
$('lg-about').textContent = t('about');
$('shortcuts').textContent = t('shortcuts');
$('menu-close-app').textContent = t('closeApp');
$('menu-dev').textContent = t('developer');
$('menu-done').textContent = t('done');
$('perm-none').textContent = t('permNone');
$('perm-allow').textContent = t('permAllow');
$('perm-hint').textContent = t('permChange');
$('reopen').textContent = t('openAgain');
$('problem-details-label').textContent = t('problemDetails');
$('dev-summary').textContent = t('developer');

// ---------- announcements and log ----------

let announceTimer = null;
function announce(text) {
  const el = $('announce');
  el.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.textContent = text; }, 60);   // a change, even for the same words
}
function logLine(text, kind = '') {
  const li = document.createElement('li');
  li.textContent = text;
  if (kind) li.className = kind;
  const log = $('log');
  log.append(li);
  log.scrollTop = log.scrollHeight;   // not scrollIntoView: that scrolls the page and can push the app frame offscreen
}
bus.subscribe('*', (e) => {
  if (/^(miniapp|app|store)\./.test(e.topic)) {
    logLine(`${e.topic} · ${e.data.summary || ''}`, /denied|refused|error|quota/.test(e.topic) ? 'bad' : '');
  }
});

// ---------- preferences ----------

function applyPrefs() {
  const r = document.documentElement;
  r.style.setProperty('--scale', String(prefs.scale));
  if (prefs.theme === 'system') delete r.dataset.theme; else r.dataset.theme = prefs.theme;
  if (prefs.motion === 'reduce') r.dataset.motion = 'reduce'; else delete r.dataset.motion;
  host?.setPrefs(prefs);
  if (opened) paintBar(opened.manifest);
}

function radioGroup(container, name, options, value, onChange) {
  container.replaceChildren(...options.map(([v, label]) => {
    const l = document.createElement('label');
    const i = document.createElement('input');
    i.type = 'radio'; i.name = name; i.value = String(v); i.checked = String(v) === String(value);
    i.addEventListener('change', () => onChange(v));
    l.append(i, document.createTextNode(label));
    return l;
  }));
}
function buildMenu() {
  radioGroup($('opt-scale'), 'scale', SCALES.map(s => [s, `${Math.round(s * 100)}%`]), prefs.scale, (v) => { prefs.scale = v; save('miniapps.prefs', prefs); applyPrefs(); });
  radioGroup($('opt-theme'), 'theme', [['system', t('themeSystem')], ['light', t('themeLight')], ['dark', t('themeDark')], ['contrast', t('themeContrast')]],
    prefs.theme, (v) => { prefs.theme = v; save('miniapps.prefs', prefs); applyPrefs(); });
  radioGroup($('opt-motion'), 'motion', [['system', t('motionSystem')], ['reduce', t('motionReduce')]],
    prefs.motion, (v) => { prefs.motion = v; save('miniapps.prefs', prefs); applyPrefs(); });
  const perms = $('menu-perms');
  perms.replaceChildren();
  if (host) {
    for (const g of host.granted) perms.append(permItem(g.name, g.cap, g.reason, true, false, null));
    for (const r of host.refused) perms.append(permItem(r.name, r.cap, '', false, true, r.reason));
  }
  if (opened) {
    const m = opened.manifest;
    $('about-text').textContent = [m.name, t('version', { v: m.version.name }), m.description || ''].filter(Boolean).join(' · ');
  }
}
function permItem(name, cap, reason, checked, disabled, note) {
  const li = document.createElement('li');
  const l = document.createElement('label');
  const i = document.createElement('input');
  i.type = 'checkbox'; i.value = name; i.checked = checked; i.disabled = disabled;
  const span = document.createElement('span');
  span.textContent = cap ? (CAP_WORDS[cap] || cap) : name;
  const small = document.createElement('small');
  small.textContent = note ? (note === 'no foafos capability for this permission' || note === 'the root does not hold it' ? t('permUnavailable') : note)
    : (reason || t('permNoReason'));
  span.append(small);
  l.append(i, span);
  li.append(l);
  return li;
}
$('menu-btn').addEventListener('click', () => { buildMenu(); $('menu').showModal(); });
$('menu-done').addEventListener('click', () => $('menu').close());
$('menu-dev').addEventListener('click', () => { $('menu').close(); $('dev').hidden = false; $('dev').open = true; $('dev-summary').focus(); });
if (params.has('dev')) { $('dev').hidden = false; $('dev').open = true; }
$('menu-close-app').addEventListener('click', () => { $('menu').close(); host?.close(t('closed', { app: opened?.manifest.name || '' })); });
$('menu').addEventListener('close', () => { if ($('closed').hidden) $('menu-btn').focus(); });

// ---------- the permission sheet ----------

/** Ask once per app version; remember the answer. Resolves the allowed permission names. */
function askPermissions(manifest) {
  const key = `miniapps.perms.${manifest.app_id}`;
  const remembered = saved(key, null);
  if (remembered && remembered.code === manifest.version.code) return Promise.resolve(remembered.allowed);
  const askable = manifest.req_permissions.filter(p => {
    const cap = capabilityFor(p.name);
    return cap && tree.get(root.id).capabilities.includes(cap);
  });
  if (askable.length === 0) return Promise.resolve([]);
  return new Promise((resolve) => {
    $('perm-title').textContent = t('permAsk', { app: manifest.name });
    $('perm-list').replaceChildren(...manifest.req_permissions.map(p => {
      const cap = capabilityFor(p.name);
      const usable = askable.includes(p);
      return permItem(p.name, cap, p.reason, usable, !usable, usable ? null : 'the root does not hold it');
    }));
    // After the sheet, keyboard users start again at the top of the runner (the skip link).
    const finish = (allowed) => { save(key, { code: manifest.version.code, allowed }); $('perm-dialog').close(); $('skip').focus(); resolve(allowed); };
    $('perm-allow').onclick = () => finish([...$('perm-list').querySelectorAll('input:checked')].map(i => i.value));
    $('perm-none').onclick = () => finish([]);
    $('perm-dialog').oncancel = (e) => { e.preventDefault(); finish([]); };
    $('perm-dialog').showModal();
  });
}

// ---------- the app bar: titles, breadcrumbs, colours ----------

function luminance(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return 0;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** The app's bar colours, unless they fail 4.5:1 or the user chose high contrast. */
function paintBar(m) {
  const bar = $('appbar');
  const bg = m.window.navigation_bar_background_color;
  const fg = m.window.navigation_bar_text_style === 'black' ? '#000000' : '#ffffff';
  const ok = prefs.theme !== 'contrast' && contrastRatio(bg, fg) >= 4.5;
  bar.style.setProperty('--bar-bg', ok ? bg : '');
  bar.style.setProperty('--bar-fg', ok ? fg : '');
  if (!ok) { bar.style.removeProperty('--bar-bg'); bar.style.removeProperty('--bar-fg'); }
  bar.dataset.appColours = ok ? 'yes' : 'no';
  bar.hidden = m.window.fullscreen;
}

function renderStack(stack) {
  const top = stack.at(-1);
  if (!top) return;
  const appName = opened.manifest.name;
  $('page-title').textContent = top.title;
  document.title = top.title === appName ? appName : `${top.title} · ${appName}`;
  const back = $('back');
  back.disabled = stack.length <= 1;
  back.setAttribute('aria-label', stack.length > 1 ? t('backTo', { page: stack.at(-2).title }) : t('back'));
  const crumbs = $('crumbs');
  crumbs.replaceChildren(...stack.map((e, i) => {
    const li = document.createElement('li');
    if (i === stack.length - 1) {
      const span = document.createElement('span');
      span.textContent = e.title;
      span.setAttribute('aria-current', 'page');
      li.append(span);
    } else {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.title;
      b.addEventListener('click', () => goBack(stack.length - 1 - i));
      li.append(b);
    }
    return li;
  }));
  $('crumbs-nav').hidden = stack.length <= 1;
}

// ---------- history: the browser's Back is the app's Back ----------

function uriFor(entry) {
  if (!entry || entry.kind === 'game') return null;
  return formatMiniAppUri({ ...current, path: '/' + entry.route, query: entry.query || null, fragment: null });
}
function urlFor(uri) {
  const u = new URL(location.href);
  if (uri) u.searchParams.set('uri', uri);
  u.searchParams.delete('app');
  return u;
}
/** Go back n pages through history, so the browser's own Back stays in step. */
function goBack(n = 1) {
  if (!host || host.pages.length <= 1) return;
  history.go(-Math.min(n, host.pages.length - 1));
}
addEventListener('popstate', (e) => {
  if (ignorePops > 0) { ignorePops--; return; }
  const st = e.state;
  if (!host || !st || st.session !== session) return;
  while (host.pages.length - 1 > st.depth) if (!host.navigateBack()) break;
});
$('back').addEventListener('click', () => goBack(1));
// The skip link lands inside the current page, not on the stage around it.
$('skip').addEventListener('click', (e) => {
  const top = host?.pages.at(-1);
  if (top) { e.preventDefault(); top.frame.focus(); }
});
addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); goBack(1); }
});

function onNavigate(op, entry, stack) {
  const uri = uriFor(entry);
  const depth = stack.length - 1;
  const state = { session, depth };
  if (op === 'push' && depth > 0) history.pushState(state, '', urlFor(uri ?? $('uri').value));
  else if (op === 'push' || op === 'replace' || op === 'update') history.replaceState(state, '', urlFor(uri ?? $('uri').value));
  else if (op === 'pop') {
    // A pop the user did not start with Back (a game finished, a page called navigateBack):
    // take history back to match, without acting on the popstate it causes.
    const hDepth = history.state?.session === session ? history.state.depth : depth;
    if (hDepth > depth) { ignorePops++; history.go(depth - hDepth); }
  }
  if (uri) $('uri').value = uri;
  renderStack(stack);
  if (op === 'pop') announce(t('backAt', { page: entry.title }));
}

function onTitle(entry) {
  renderStack(host.pages);
  if (firstShow) { firstShow = false; announce(t('opened', { app: opened.manifest.name })); return; }
  if (entry === host.pages.at(-1)) {
    announce(t('pageOpened', { page: entry.title }));
    // Keyboard and screen reader users continue inside the new page.
    if (entry.takeFocus) entry.frame.focus();
  }
}

// ---------- progress and problems ----------

function progress(n, appName) {
  const p = $('progress');
  if (n === null) { p.hidden = true; return; }
  p.hidden = false;
  $('progress-text').textContent = n >= 0 ? t('openingPercent', { app: appName, n }) : t('opening', { app: appName });
  const bar = $('progress-bar');
  bar.setAttribute('aria-valuenow', String(Math.max(0, n)));
  bar.firstElementChild.style.width = `${Math.max(5, n)}%`;
}

function problem({ title = t('problemTitle'), text, details = '', actions = [] }) {
  $('problem-title').textContent = title;
  $('problem-text').textContent = text;
  $('problem-details').textContent = details;
  $('problem-details').parentElement.hidden = !details;
  $('problem-actions').replaceChildren(...actions.map(([label, fn]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => { $('problem').hidden = true; fn(); });
    return b;
  }));
  $('problem').hidden = false;
  logLine(`problem: ${text} ${details}`, 'bad');
}

function onProblem(p) {
  const name = opened?.manifest.name || '';
  if (p.kind === 'slow') {
    problem({ text: t('slow', { page: p.entry?.title || p.page }), actions: [[t('reloadPage'), () => host.reloadTop()], [t('back'), () => goBack(1)]] });
  } else if (p.kind === 'error') {
    problem({ text: t('appError', { app: name }), details: `${p.page || 'logic'}: ${p.message}\n${p.stack || ''}`.trim(),
      actions: [[t('reloadPage'), () => host.reloadTop()], [t('done'), () => {}]] });
  } else {
    problem({ text: p.message, actions: host?.pages.length > 1 ? [[t('back'), () => goBack(1)]] : [] });
  }
}

let toastTimer = null;
function onAnnounce(text, kind) {
  announce(text);
  if (kind === 'toast' || kind === 'problem') {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
}

// ---------- open an app ----------

async function fetchWithProgress(href, appName) {
  const res = await fetch(href);
  if (!res.ok) throw Object.assign(new Error(`${href}: HTTP ${res.status}`), { kind: 'net' });
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) { progress(-1, appName); return { bytes: new Uint8Array(await res.arrayBuffer()), mediaType: res.headers.get('content-type') }; }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    progress(Math.min(99, Math.round(got / total * 100)), appName);
  }
  const bytes = new Uint8Array(got);
  let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.length; }
  return { bytes, mediaType: res.headers.get('content-type') };
}

async function resolvePackage(parsed) {
  // MiniApp Addressing steps 3-4: look up the id (and version) at the package server.
  const reg = await (await fetch('registry.json')).json();
  const rec = reg.packages[parsed.id];
  if (!rec) throw Object.assign(new Error(t('notFound', { id: parsed.id })), { kind: 'notfound' });
  const version = parsed.version || rec.latest;
  const v = rec.versions[version];
  if (!v) throw Object.assign(new Error(t('notFound', { id: `${parsed.id};version=${version}` })), { kind: 'notfound' });
  progress(0, rec.name || parsed.id);
  return { ...(await fetchWithProgress(v.href, rec.name || parsed.id)), version, href: v.href };
}

function renderDev(o, href) {
  const m = o.manifest;
  $('app-meta').textContent = `${m.app_id} · version ${m.version.name} (code ${m.version.code}) · ${href} · locale ${o.locale}`;
  const rows = [
    ...host.granted.map(g => [g.name, g.cap, 'granted', g.reason]),
    ...host.refused.map(r => [r.name, r.cap || '—', 'refused', r.reason]),
  ];
  $('grants').replaceChildren(...rows.map(([n, c, s, why]) => {
    const tr = document.createElement('tr');
    for (const v of [n, c, s, why]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    if (s === 'refused') tr.className = 'bad';
    return tr;
  }));
  $('warnings').replaceChildren(...o.warnings.map(w => Object.assign(document.createElement('li'), { textContent: w })));
  $('signing').textContent = o.signing ? `${o.signing.scheme} block, ${o.signing.length} bytes (not checked)` : 'unsigned';
}

async function start(uriText) {
  $('problem').hidden = true;
  $('closed').hidden = true;
  session = Date.now();
  firstShow = true;
  const parsed = parseMiniAppUri(uriText);
  if (!parsed.ok) return problem({ text: `${uriText}: ${parsed.error}` });
  logLine(`resolve ${uriText}`);
  let pkg;
  try { pkg = await resolvePackage(parsed); }
  catch (e) {
    progress(null);
    return problem({ text: e.kind === 'notfound' ? e.message : t('netFail'), details: e.message, actions: [[t('retry'), () => start(uriText)]] });
  }
  try {
    opened = await openPackage(pkg.bytes, { mediaType: pkg.mediaType, strictMediaType: false,
      startRoute: pageRouteOf(parsed), platformCode: PLATFORM_CODE, locales });
  } catch (e) {
    progress(null);
    return problem({ text: t('badPackage'), details: e.message, actions: [[t('retry'), () => start(uriText)]] });
  }
  progress(100, opened.manifest.name);
  current = { ...parsed, version: pkg.version };
  paintBar(opened.manifest);
  $('page-title').textContent = opened.manifest.name;
  const allowed = await askPermissions(opened.manifest);
  $('stage').replaceChildren();
  host = new MiniAppHost(opened, {
    container: $('stage'), tree, rootId: root.id, store, bus, platformCode: PLATFORM_CODE, siteBase,
    startPage: opened.startPage, query: parsed.query || '', prefs, granted: allowed,
    slowMs: Number(params.get('slowms')) || undefined,
    referrerInfo: { href: document.referrer || null },
    onNavigate, onTitle, onProblem, onAnnounce,
    onClose: () => {
      $('back').disabled = true;
      $('closed-text').textContent = t('closed', { app: opened.manifest.name });
      $('closed').hidden = false;
      announce(t('closed', { app: opened.manifest.name }));
      $('reopen').focus();
    },
  });
  try { await host.launch(); } catch (e) { progress(null); return problem({ text: t('badPackage'), details: e.message }); }
  progress(null);
  renderDev(opened, pkg.href);
  window.__miniapps = { host, tree, bus, store, root, prefs: () => ({ ...prefs }), announcer: $('announce') };
}

$('hide').addEventListener('click', () => { host?.setVisible(false); announce(t('paused', { app: opened?.manifest.name || '' })); });
$('show').addEventListener('click', () => { host?.setVisible(true); announce(t('resumed', { app: opened?.manifest.name || '' })); });
$('reopen').addEventListener('click', () => start($('uri').value.trim()));
$('go').addEventListener('submit', (e) => {
  e.preventDefault();
  if (host && host.global.state !== 'unloaded') host.close('replaced');
  $('log').replaceChildren();
  start($('uri').value.trim());
});

applyPrefs();
const initial = params.get('uri') || `${SCHEME}://miniapp/${params.get('app') || DEFAULT_APP}`;
$('uri').value = initial;
start(initial);
