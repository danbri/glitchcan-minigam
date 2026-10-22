// MiniAppHost: run one opened MiniApp package under the foafos capability tree.
//
//   logic layer  hidden iframe, sandbox="allow-scripts", runs app.js
//   view layer   one iframe per open page (a page stack), three kinds of page:
//                  package  a page file of the package, built into srcdoc
//                  app      a foafos app (story runner, edot, ...) named by the page
//                           file's foafos-app block, loaded by URL, app-sdk protocol
//                  game     a FINK minigame opened by a story's # MINIGAME:
//   governance   AppTree (grant(child) ⊆ grant(parent)), FoafStore, FoafBus
//                from packages/foafos/src/; each app and game page is a child node
//
// The host is level 0: it plays nothing itself, and every call a guest makes is
// checked against that guest's node when it is made. The runner page (runner.mjs)
// owns the chrome: titles, breadcrumbs, history, announcements, preferences.
// Design and protocol: magpie/miniapps/README.md.

import { GlobalLifecycle, PageLifecycle } from './lifecycle.mjs';
import { pageFile } from './package.mjs';
import { linkedAppOf, sameOriginUrl, skinTokensFor, answerStoryRequest, minigameInit } from './foafos-guests.mjs';

/** MiniApp req_permissions names -> foafos capabilities. Unlisted names are refused. */
export const PERMISSION_MAP = Object.freeze({
  'system.permission.STORAGE': 'storage',
  'system.permission.LOCATION': 'geolocation',
  'system.permission.AUDIO': 'audio',
});
/** foafos capabilities a package may request directly, as "foafos.<capability>". */
export const FOAFOS_CAPS = Object.freeze(['storage', 'audio', 'geolocation', 'story:link', 'story:launch',
  'story:navigate', 'story:observe', 'vars:read', 'vars:write']);

export function capabilityFor(permissionName) {
  if (PERMISSION_MAP[permissionName]) return PERMISSION_MAP[permissionName];
  const m = /^foafos\.(.+)$/.exec(permissionName);
  return m && FOAFOS_CAPS.includes(m[1]) ? m[1] : null;
}

/** Host APIs for package pages: name -> capability needed (null: none). */
export const API_CAPS = Object.freeze({
  'system.getInfo': null,
  'ui.toast': null,
  'storage.get': 'storage',
  'storage.set': 'storage',
  'storage.remove': 'storage',
  'storage.keys': 'storage',
  'location.get': 'geolocation',
});

const MAX_PAGE_STACK = 10;
const MAX_QUOTA = 8 * 1024 * 1024;
const PACKAGE_SANDBOX = 'allow-scripts';
const APP_SANDBOX = 'allow-scripts allow-forms allow-modals allow-downloads';
const GAME_SANDBOX = 'allow-scripts';
const PAGE_SLOW_MS = 12000;
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
  webp: 'image/webp', css: 'text/css', js: 'text/javascript', json: 'application/json',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
  woff2: 'font/woff2', txt: 'text/plain',
};

let guestSource = null;
async function loadGuest() {
  if (!guestSource) guestSource = await (await fetch(new URL('./guest.js', import.meta.url))).text();
  return guestSource;
}

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const dataUrl = (bytes, type) => `data:${type};base64,${b64(bytes)}`;
const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const scriptTag = (src) => `<script src="data:text/javascript;base64,${b64(new TextEncoder().encode(src))}"></script>`;

/** Resolve `ref` (from an attribute) against the package file `from`. Null if outside the package. */
export function resolvePackagePath(from, ref) {
  if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('#')) return null;
  const clean = ref.split(/[?#]/)[0];
  const parts = clean.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const seg of clean.replace(/^\/+/, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(seg);
  }
  return parts.join('/');
}

export class MiniAppHost {
  /**
   * @param opened   the result of openPackage()
   * @param opts     { container, tree, rootId, store, bus, platformCode, startPage, query, referrerInfo,
   *                   siteBase, prefs, backgroundUnloadMs, granted (permission names the user allowed, or null for all),
   *                   onNavigate(op, entry, stack), onTitle(entry), onAnnounce(text, kind), onProblem(problem),
   *                   onToast(text), onClose(reason) }
   */
  constructor(opened, opts) {
    this.pkg = opened;
    this.manifest = opened.manifest;
    this.o = { backgroundUnloadMs: 5 * 60 * 1000, platformCode: 1, siteBase: location.href, ...opts };
    this.prefs = { scale: 1, theme: 'system', motion: 'system', ...(opts.prefs || {}) };
    this.bus = opts.bus;
    this.tree = opts.tree;
    this.store = opts.store;
    this.appKey = 'miniapp.' + this.manifest.app_id;
    this.global = new GlobalLifecycle();
    this.pages = [];             // entries, bottom first
    this.log = [];
    this.node = null;
    this.granted = [];
    this.refused = [];
    this.logicFrame = null;
    this._unloadTimer = null;
    this._onMessage = (e) => this._message(e);
    this._onVisibility = () => this.setVisible(document.visibilityState === 'visible');
    for (const s of ['launched', 'shown', 'hidden', 'error', 'unloaded']) {
      this.global.addEventListener('global' + s, (ev) => this._note('global', s, ev.detail));
    }
  }

  _note(scope, state, detail = {}) {
    this.log.push({ t: Date.now(), scope, state, ...detail });
    this.bus?.publish(`miniapp.${scope}.${state}`, { summary: `${this.manifest.name}: ${scope} ${state}${detail.route ? ' ' + detail.route : ''}`,
      appId: this.manifest.app_id, ...detail });
  }

  /** Decide the grant: requested permissions the user allowed, mapped, bounded by the parent node. */
  _grant() {
    const parentCaps = this.tree.get(this.o.rootId)?.capabilities || [];
    const allowed = this.o.granted ? new Set(this.o.granted) : null;
    const want = [];
    for (const p of this.manifest.req_permissions) {
      const cap = capabilityFor(p.name);
      if (!cap) this.refused.push({ name: p.name, reason: 'no foafos capability for this permission' });
      else if (!parentCaps.includes(cap)) this.refused.push({ name: p.name, cap, reason: 'the root does not hold it' });
      else if (allowed && !allowed.has(p.name)) this.refused.push({ name: p.name, cap, reason: 'not allowed by the user' });
      else { if (!want.includes(cap)) want.push(cap); this.granted.push({ name: p.name, cap, reason: p.reason || '' }); }
    }
    const node = this.tree.spawn({ appId: this.appKey, parentId: this.o.rootId, capabilities: want,
      label: this.manifest.name, surface: 'miniapp' });
    if (node.refused) throw new Error(`spawn refused: ${node.reason} ${node.excess || ''}`);
    this.node = node;
    this.store?.grant(this.appKey, want);
    this.tree.setOnClose(node.id, () => this._teardown());
  }

  can(cap, nodeId = this.node.id) { return this.tree.can(nodeId, cap); }

  async launch() {
    await loadGuest();
    this._grant();
    window.addEventListener('message', this._onMessage);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.logicFrame = this._frame({ srcdoc: this._logicDoc(), hidden: true, sandbox: PACKAGE_SANDBOX, title: `${this.manifest.name} logic layer` });
  }

  _frame({ srcdoc = null, src = null, hidden = false, sandbox, title, allow = '' }) {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', sandbox);
    f.setAttribute('referrerpolicy', 'no-referrer');
    if (allow) f.setAttribute('allow', allow);
    f.className = hidden ? 'miniapp-logic' : 'miniapp-page';
    if (hidden) { f.hidden = true; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; }
    f.title = title;
    this._styleFrame(f);
    if (srcdoc !== null) f.srcdoc = srcdoc; else f.src = src;
    this.o.container.appendChild(f);
    return f;
  }

  _bootScripts(layer) {
    return scriptTag(`self.__miniappLayer=${JSON.stringify(layer)};`) + scriptTag(guestSource);
  }

  _logicDoc() {
    const app = new TextDecoder().decode(this.pkg.files.get('app.js'));
    return `<!doctype html><meta charset="utf-8">${this._bootScripts('logic')}${scriptTag(app)}`;
  }

  /** Build the view document for a package page: inline CSS and scripts, data: URLs for media. */
  _pageDoc(route) {
    const files = this.pkg.files;
    const file = pageFile(files, route);
    const html = new TextDecoder().decode(files.get(file));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = (p) => new TextDecoder().decode(files.get(p));
    const styleEl = (css) => { const s = doc.createElement('style'); s.textContent = css; return s; };

    for (const link of doc.querySelectorAll('link[rel~="stylesheet"][href]')) {
      const p = resolvePackagePath(file, link.getAttribute('href'));
      link.replaceWith(p && files.has(p) ? styleEl(text(p)) : doc.createComment(` ${link.getAttribute('href')}: not in package `));
    }
    const scripts = [];
    for (const s of doc.querySelectorAll('script')) {
      const src = s.getAttribute('src');
      if (src === null) { if (!s.type || /javascript|module/.test(s.type)) scripts.push(s.textContent); s.remove(); continue; }
      const p = resolvePackagePath(file, src);
      if (p && files.has(p)) scripts.push(text(p));
      s.remove();
    }
    for (const [sel, attr] of [['img', 'src'], ['source', 'src'], ['audio', 'src'], ['video', 'src'], ['video', 'poster'], ['image', 'href']]) {
      for (const el of doc.querySelectorAll(`${sel}[${attr}]`)) {
        const p = resolvePackagePath(file, el.getAttribute(attr));
        if (p && files.has(p)) el.setAttribute(attr, dataUrl(files.get(p), MIME[extOf(p)] || 'application/octet-stream'));
      }
    }
    for (const a of doc.querySelectorAll('a[href]')) {
      const p = resolvePackagePath(file, a.getAttribute('href'));
      const r = p && p.replace(/\.html?$/, '');
      if (r && this.manifest.pages.includes(r)) {
        a.dataset.miniappRoute = r;
        a.dataset.miniappQuery = (a.getAttribute('href').split('?')[1] || '').split('#')[0];
      }
    }
    const base = file.replace(/\.html?$/, '');
    const head = doc.head;
    head.prepend(styleEl(text('app.css')));
    if (files.has(base + '.css') && !html.includes(base.split('/').pop() + '.css')) head.append(styleEl(text(base + '.css')));
    if (files.has(base + '.js') && !html.includes(base.split('/').pop() + '.js')) scripts.push(text(base + '.js'));

    const w = this.manifest.window;
    doc.documentElement.lang = this.pkg.locale;
    if (this.manifest.dir) doc.documentElement.dir = this.manifest.dir;
    head.prepend(styleEl(`html{background:${w.background_color};color-scheme:${this.manifest.color_scheme === 'dark' ? 'dark' : this.manifest.color_scheme === 'light' ? 'light' : 'light dark'}}`));
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.prepend(meta);
    return { title: doc.title || doc.querySelector('h1')?.textContent?.trim() || route,
      srcdoc: '<!doctype html>' + doc.documentElement.outerHTML.replace('</head>', this._bootScripts('view') + '</head>')
        .replace(/<\/body>(?![\s\S]*<\/body>)/, scripts.map(scriptTag).join('') + '</body>') };
  }

  // ---- the page stack ----

  /** Open a manifest page route on top of the stack (or in place of the top one). */
  _openPage(route, query = '', { replace = false } = {}) {
    if (!replace && this.pages.length >= MAX_PAGE_STACK) {
      this._note('page', 'refused', { route, reason: `page stack is full (${MAX_PAGE_STACK})` });
      this.o.onAnnounce?.(`page stack is full`, 'problem');
      return null;
    }
    const html = new TextDecoder().decode(this.pkg.files.get(pageFile(this.pkg.files, route)));
    let linked = null;
    try { linked = linkedAppOf(html); } catch (e) {
      this.o.onProblem?.({ kind: 'page', page: route, message: `bad foafos-app block: ${e.message}` });
      return null;
    }
    const kind = !linked ? 'package' : linked.protocol === 'minigame' ? 'game' : 'app';
    const entry = { route, query, kind, linked, title: route, sessions: 0, linkDepth: 0 };
    if (linked) {
      const ok = this._prepareApp(entry);
      if (!ok) return null;
    } else {
      const built = this._pageDoc(route);
      entry.title = built.title;
      entry.srcdoc = built.srcdoc;
    }
    this._push(entry, replace);
    return entry;
  }

  /** An app page: spawn its child node (attenuated) and choose its URL. */
  _prepareApp(entry) {
    const L = entry.linked;
    let url;
    try { url = sameOriginUrl(L.url, this.o.siteBase); } catch (e) {
      this.o.onProblem?.({ kind: 'page', page: entry.route, message: e.message });
      return false;
    }
    const parentCaps = this.node.capabilities;
    const caps = L.capabilities.filter((c) => parentCaps.includes(c));
    const missing = L.capabilities.filter((c) => !parentCaps.includes(c));
    const node = this.tree.spawn({ appId: L.id, parentId: this.node.id, capabilities: caps, label: L.name, surface: 'window' });
    if (node.refused) { this.o.onProblem?.({ kind: 'page', page: entry.route, message: `spawn refused: ${node.reason}` }); return false; }
    entry.node = node;
    entry.missing = missing;
    entry.title = L.name;
    if (this.store) {
      this.store.grant(L.id, caps);
      if (L.quotaBytes) this.store.setQuota(L.id, Math.min(L.quotaBytes, MAX_QUOTA));
    }
    let story = L.story;
    const q = new URLSearchParams(entry.query);
    if (L.storyFromQuery && q.get('story')) {
      try { story = sameOriginUrl(q.get('story'), this.o.siteBase).pathname; } catch { /* keep the default story */ }
    }
    entry.story = story;
    if (L.titleFromQuery && q.get('title')) entry.title = q.get('title').slice(0, 80);
    entry.allow = caps.includes('audio') ? 'autoplay; fullscreen' : 'fullscreen';
    if (L.protocol === 'minigame') {
      // A game as a page of its own: no story waits for it, and its arguments come from the page.
      for (const [k, v] of Object.entries(L.args)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      entry.game = L.id;
      entry.init = minigameInit({ args: L.args, recent: [] });
      entry.allow = 'autoplay; fullscreen; gamepad';
      fetch(new URL('manifest.json', url)).then((r) => r.ok ? r.json() : null)
        .then((m) => { entry.writes = new Set(m?.variables?.write || []); }).catch(() => { entry.writes = new Set(); });
    }
    entry.src = url.href;
    return true;
  }

  _push(entry, replace) {
    const top = this.pages.at(-1);
    if (replace && top) this._closeEntry(this.pages.pop());
    else if (top) { this._entryTo(top, 'hidden'); top.frame.hidden = true; }
    entry.life = new PageLifecycle(entry.route);
    for (const s of ['loaded', 'ready', 'shown', 'hidden', 'unloaded']) {
      entry.life.addEventListener('page' + s, (ev) => this._note('page', s, { route: entry.route, ...ev.detail }));
    }
    const sandbox = entry.kind === 'package' ? PACKAGE_SANDBOX : entry.kind === 'app' ? APP_SANDBOX : GAME_SANDBOX;
    entry.frame = this._frame({ srcdoc: entry.srcdoc ?? null, src: entry.src ?? null, sandbox, title: entry.title, allow: entry.allow || '' });
    this._styleFrame(entry.frame, entry);
    if (entry.kind !== 'package') {
      // Foreign guests say nothing about their first render: the load event stands in for it.
      entry.frame.addEventListener('load', () => this._foreignLoaded(entry));
    }
    entry.slowTimer = setTimeout(() => {
      if (entry.life.state !== 'shown' && entry.life.state !== 'unloaded') {
        this.o.onProblem?.({ kind: 'slow', page: entry.route, entry });
      }
    }, this.o.slowMs || PAGE_SLOW_MS);
    this.pages.push(entry);
    this.o.onNavigate?.(replace ? 'replace' : 'push', entry, this.pages);
  }

  _closeEntry(entry) {
    clearTimeout(entry.slowTimer);
    if (entry.kind === 'package') this._send(entry.frame, { type: 'miniapp.lifecycle', state: 'unloaded', detail: { route: entry.route } });
    if (entry.kind === 'app') this._send(entry.frame, { type: 'app.terminate', reason: 'page closed' });
    if (entry.kind === 'game') this._send(entry.frame, { type: 'terminate', reason: 'page closed' });
    entry.life.try('unloaded', { route: entry.route });
    if (entry.node) this.tree.close(entry.node.id);
    entry.frame.remove();
  }

  /** Go back one page. A game page that is left this way counts as not completed. */
  navigateBack() {
    if (this.pages.length <= 1) return false;
    const leaving = this.pages.pop();
    this._closeEntry(leaving);
    const top = this.pages.at(-1);
    if (leaving.kind === 'game' && leaving.storyEntry === top) {
      this._send(top.frame, { type: 'story.event', event: 'minigame.complete',
        detail: { game: leaving.game, success: false, score: 0, variables: {}, quit: true } });
    }
    top.frame.hidden = false;
    this._entryTo(top, 'shown');
    this.o.onNavigate?.('pop', top, this.pages);
    return true;
  }

  /** Load the top page again, in place (after an error or a slow load). */
  reloadTop() {
    const top = this.pages.at(-1);
    if (!top) return;
    if (top.kind === 'game') { this.navigateBack(); return; }
    this._openPage(top.route, top.query, { replace: true });
  }

  /** Go back to the page at `depth` (0 is the first page). */
  popTo(depth) {
    while (this.pages.length > depth + 1) if (!this.navigateBack()) break;
  }

  _send(frame, msg) { frame?.contentWindow?.postMessage(msg, '*'); }

  /** Move a page's lifecycle and tell its guest in that guest's own words. */
  _entryTo(entry, state) {
    if (!entry.life.try(state, { route: entry.route })) return;
    // The first page of a session does not take the focus: the reader starts at the top
    // of the runner (skip link first). Every page shown after a navigation does.
    let focus = false;
    if (state === 'shown') { clearTimeout(entry.slowTimer); focus = this._shownBefore === true; this._shownBefore = true; entry.takeFocus = focus; }
    if (entry.kind === 'package') this._send(entry.frame, { type: 'miniapp.lifecycle', state, detail: { route: entry.route, focus } });
    else if (entry.kind === 'app' && (state === 'hidden' || state === 'shown')) this._send(entry.frame, { type: state === 'hidden' ? 'app.suspend' : 'app.resume' });
    else if (entry.kind === 'game' && (state === 'hidden' || state === 'shown')) this._send(entry.frame, { type: state === 'hidden' ? 'pause' : 'resume' });
    if (state === 'shown') this.o.onTitle?.(entry);
  }

  _foreignLoaded(entry) {
    if (entry.kind === 'game') this._send(entry.frame, entry.init);   // again after a redirect
    if (entry.life.state === 'initial') this._entryTo(entry, 'loaded');
    if (entry.life.state === 'loaded') {
      this._entryTo(entry, 'ready');
      if (entry === this.pages.at(-1) && this.global.state === 'shown') this._entryTo(entry, 'shown');
    }
  }

  /** Open a minigame for the story page `storyEntry` (from story.launch). */
  _openGame(storyEntry, game, args, recent) {
    if (this.pages.length >= MAX_PAGE_STACK) throw new Error('page-stack-full');
    const q = new URLSearchParams(args).toString();
    const url = sameOriginUrl(`inklet/minigames/${game}/index.html${q ? '?' + q : ''}`, this.o.siteBase);
    const node = this.tree.spawn({ appId: `game:${game}`, parentId: storyEntry.node.id, capabilities: [], label: game, surface: 'stage' });
    if (node.refused) throw new Error(node.reason);
    const entry = { route: `game:${game}`, query: q, kind: 'game', game, storyEntry, node, title: game,
      src: url.href, allow: 'autoplay; fullscreen; gamepad', init: minigameInit({ args, recent }) };
    this._push(entry, false);
    fetch(new URL(`inklet/minigames/${game}/manifest.json`, this.o.siteBase)).then((r) => r.ok ? r.json() : null).then((m) => {
      entry.writes = new Set(m?.variables?.write || []);
      if (m?.title || m?.name) { entry.title = m.title || m.name; entry.frame.title = entry.title; if (entry === this.pages.at(-1)) this.o.onTitle?.(entry); }
    }).catch(() => { entry.writes = new Set(); });
    return game;
  }

  _gameComplete(entry, result = {}) {
    const idx = this.pages.indexOf(entry);
    if (idx < 0) return;
    if (!entry.storyEntry) {
      // A game opened as a page: it stays open; the result is announced.
      this.o.onAnnounce?.(`${entry.title}: ${result.success ? 'completed' : 'ended'}${result.score != null ? `, score ${result.score}` : ''}`, 'toast');
      this._note('page', 'game-complete', { route: entry.route, success: !!result.success, score: Number(result.score) || 0 });
      return;
    }
    const story = entry.storyEntry;
    const variables = {};
    for (const [k, v] of Object.entries(result.variables || {})) if (entry.writes?.has(k)) variables[k] = v;
    // Close the game and everything above it, then hand the result to the story.
    while (this.pages.length > idx) this._closeEntry(this.pages.pop());
    const top = this.pages.at(-1);
    top.frame.hidden = false;
    this._entryTo(top, 'shown');
    this.o.onNavigate?.('pop', top, this.pages);
    if (top === story) {
      this._send(story.frame, { type: 'story.event', event: 'minigame.complete',
        detail: { game: entry.game, success: !!result.success, score: Number(result.score) || 0, variables } });
    }
    this.o.onAnnounce?.(`${entry.title}: ${result.success ? 'completed' : 'ended'}`, 'status');
  }

  // ---- visibility and closing ----

  /** The user switched away (false) or back (true). Hidden for backgroundUnloadMs unloads the app. */
  setVisible(visible) {
    const top = this.pages.at(-1);
    clearTimeout(this._unloadTimer);
    if (visible) {
      this._globalTo('shown');
      if (top) this._entryTo(top, 'shown');
    } else {
      if (top) this._entryTo(top, 'hidden');
      this._globalTo('hidden');
      if (this.o.backgroundUnloadMs > 0) this._unloadTimer = setTimeout(() => this.close('background timeout'), this.o.backgroundUnloadMs);
    }
  }

  _globalTo(state, detail = {}) {
    if (this.global.try(state, detail)) this._send(this.logicFrame, { type: 'miniapp.lifecycle', state, detail });
  }

  /** End the session: every page unloaded (top first), then the app, then the tree node. */
  close(reason = 'closed') {
    if (this.global.state === 'unloaded' || !this.node) return;
    this._closeReason = reason;
    this.tree.close(this.node.id);       // calls _teardown through onClose
  }

  _teardown() {
    clearTimeout(this._unloadTimer);
    while (this.pages.length) this._closeEntry(this.pages.pop());
    this._globalTo('unloaded', { reason: this._closeReason || 'closed' });
    window.removeEventListener('message', this._onMessage);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.store?.revoke(this.appKey);
    setTimeout(() => this.logicFrame?.remove(), 0);
    this.o.onClose?.(this._closeReason || 'closed');
  }

  // ---- display preferences ----

  /** Text size, colours and movement: package pages apply them; app pages get skin tokens and zoom. */
  setPrefs(prefs) {
    this.prefs = { ...this.prefs, ...prefs };
    for (const e of this.pages) {
      this._styleFrame(e.frame, e);
      if (e.kind === 'package') this._send(e.frame, { type: 'miniapp.prefs', prefs: this.prefs });
      if (e.kind === 'app') {
        const { skin, tokens } = this._skin(e);
        this._send(e.frame, { type: 'bus-event', event: { topic: 'ui.skin', data: { skin, tokens }, ts: Date.now(), source: 'local' } });
      }
    }
  }

  _skin(entry = null) {
    return skinTokensFor(this.prefs, matchMedia('(prefers-color-scheme: dark)').matches, { size: entry?.linked?.textSize === 'skin' });
  }

  _styleFrame(f, entry = null) {
    const p = this.prefs;
    // An iframe's prefers-color-scheme follows the color-scheme of its element.
    f.style.colorScheme = p.theme === 'dark' || p.theme === 'contrast' ? 'dark' : p.theme === 'light' ? 'light' : 'normal';
    const scalesItself = !entry || entry.kind === 'package' || entry.linked?.textSize === 'skin';
    f.style.zoom = scalesItself || p.scale === 1 ? '' : String(p.scale);
    f.style.filter = entry && entry.kind !== 'package' && entry.linked?.colours !== 'skin' && p.theme === 'contrast' ? 'contrast(1.4)' : '';
  }

  // ---- messages ----

  _message(e) {
    const d = e.data || {};
    if (e.source === this.logicFrame?.contentWindow) return this._fromPackage(e, d, null);
    const entry = this.pages.find((p) => e.source === p.frame.contentWindow);
    if (!entry) return;
    if (entry.kind === 'package') return this._fromPackage(e, d, entry);
    if (entry.kind === 'app') return this._fromApp(e, d, entry);
    if (entry.kind === 'game') return this._fromGame(e, d, entry);
  }

  _fromPackage(e, d, page) {
    const fromLogic = page === null;
    const reply = (msg) => e.source.postMessage(msg, '*');
    const m = this.manifest;
    const pub = { app_id: m.app_id, name: m.name, version: m.version };
    switch (d.type) {
      case 'app.hello':
        if (fromLogic) {
          const inputObject = { pagePath: this.o.startPage || this.pkg.startPage, referrerInfo: this.o.referrerInfo || {},
            lang: this.pkg.locale, dir: m.dir || 'auto' };
          reply({ type: 'app.init', layer: 'logic', appId: m.app_id, capabilities: [...this.node.capabilities],
            manifest: pub, messages: this.pkg.messages, inputObject });
          this._globalTo('launched', { pagePath: inputObject.pagePath });
          if (document.visibilityState !== 'hidden') this._globalTo('shown');
          this._openPage(inputObject.pagePath, this.o.query || '');
        } else {
          if (d.title) { page.title = d.title; page.frame.title = d.title; }
          reply({ type: 'app.init', layer: 'view', appId: m.app_id, capabilities: [...this.node.capabilities],
            manifest: pub, messages: this.pkg.messages, prefs: this.prefs,
            pageInputObject: { pageInputQuery: Object.fromEntries(new URLSearchParams(page.query)), route: page.route, dir: m.dir || 'auto' } });
          this._entryTo(page, 'loaded');
        }
        break;
      case 'miniapp.rendered':
        if (page && page.life.state === 'loaded') {
          this._entryTo(page, 'ready');
          if (page === this.pages.at(-1) && this.global.state === 'shown') this._entryTo(page, 'shown');
        }
        break;
      case 'miniapp.navigate':
        if (!page) break;
        if (d.op === 'navigateBack') { this.navigateBack(); break; }
        if (!m.pages.includes(d.route)) { this._note('page', 'refused', { route: d.route, reason: 'not in manifest pages' }); break; }
        this._openPage(d.route, String(d.query || ''), { replace: d.op === 'redirectTo' });
        break;
      case 'miniapp.message':
        if (fromLogic) { const top = this.pages.at(-1); if (top?.kind === 'package') this._send(top.frame, { type: 'miniapp.message', data: d.data }); }
        else this._send(this.logicFrame, { type: 'miniapp.message', data: d.data, from: page.route });
        break;
      case 'miniapp.error': {
        const before = this.global.state;
        const where = fromLogic ? 'logic' : `view ${page.route}`;
        this._globalTo('error', { message: d.message, layer: where });
        if (before === 'shown' || before === 'hidden') this._globalTo(before);
        this.o.onProblem?.({ kind: 'error', page: page?.route || null, entry: page, message: d.message, stack: d.stack });
        break;
      }
      case 'miniapp.invoke':
        this._invoke(d.api, d.args || {}).then(
          (value) => reply({ type: 'miniapp.result', rid: d.rid, ok: true, value }),
          (err) => reply({ type: 'miniapp.result', rid: d.rid, ok: false, error: String(err?.message || err) }));
        break;
    }
  }

  /** app-sdk guests: the FINK story runner, edot, sheets, files. */
  _fromApp(e, d, entry) {
    const reply = (msg) => e.source.postMessage(msg, '*');
    const id = entry.linked.id;
    const node = entry.node;
    switch (d.type) {
      case 'app.hello': {
        const { skin, tokens } = this._skin(entry);
        const store = this.store && this.tree.can(node.id, 'storage') ? (this.store.snapshot(id) || {}) : {};
        reply({ type: 'app.init', appId: id, capabilities: [...node.capabilities], store,
          config: { surface: 'window', name: entry.linked.name,
            bus: { publish: [`app.${id}.*`], subscribe: ['ui.skin', 'audio.volume'] },
            story: entry.story, boot: false, mediaBase: null, skin, skinTokens: tokens } });
        this._entryTo(entry, 'loaded');
        break;
      }
      case 'store.set': case 'store.remove': case 'store.clear': {
        if (!this.store) break;
        const r = d.type === 'store.set' ? this.store.set(id, String(d.key), d.value)
          : d.type === 'store.remove' ? this.store.remove(id, String(d.key)) : this.store.clear(id);
        if (!r.ok) {
          reply({ type: 'store.refused', op: d.type.slice(6), key: d.key, reason: r.reason });
          if (r.reason === 'quota') this.o.onAnnounce?.(`${entry.title}: storage is full`, 'problem');
        }
        break;
      }
      case 'story.request': {
        const fields = answerStoryRequest(d.verb, d.detail || {}, {
          can: (cap) => this.tree.can(node.id, cap),
          page: entry,
          siteOrigin: this.o.siteBase,
          openGame: (game, args, recent) => this._openGame(entry, game, args, recent),
          onStory: (path) => this._replaceQuery(entry, { story: path }),
          subtree: () => this.tree.descendants(node.id).map((n) => ({ id: n.id, appId: n.appId, label: n.label })),
        });
        if (!fields.ok && fields.reason === 'denied') this.bus?.publish('miniapp.denied', { summary: `${entry.title} may not use ${d.verb}`, verb: d.verb });
        reply({ type: 'story.result', rid: d.rid, ...fields });
        break;
      }
      case 'verb':
        reply({ type: 'verb.result', rid: d.rid, ok: false, reason: 'unknown-verb' });
        break;
      case 'verbs.list':
        reply({ type: 'verbs.result', rid: d.rid, verbs: [] });
        break;
      case 'secrets.put': case 'secrets.forget':
        reply({ type: 'secrets.result', rid: d.rid, ok: false, reason: 'denied' });
        break;
      case 'secrets.names':
        reply({ type: 'secrets.names.result', rid: d.rid, names: [] });
        break;
      case 'bus-publish':
        if (typeof d.topic === 'string' && d.topic.startsWith(`app.${id}.`)) this.bus?.publish(d.topic, d.data || {}, { source: `app.${id}` });
        break;
      case 'announce':
        if (typeof d.text === 'string') this.o.onAnnounce?.(d.text.slice(0, 200), 'status');
        break;
    }
  }

  /** Minigames: init, pause, resume, terminate; ready, complete, announce, error. */
  _fromGame(e, d, entry) {
    switch (d.type) {
      case 'ready':
        this._send(entry.frame, entry.init);
        break;
      case 'complete':
        this._gameComplete(entry, d.result || {});
        break;
      case 'announce':
        if (typeof d.text === 'string') this.o.onAnnounce?.(d.text.slice(0, 200), 'status');
        break;
      case 'error':
        this.o.onProblem?.({ kind: 'error', page: entry.route, entry, message: String(d.message || d.code || 'game error') });
        break;
    }
  }

  /** Change the query of an open page (a story link moved to another story): keeps the address bar a deep link. */
  _replaceQuery(entry, values) {
    const q = new URLSearchParams(entry.query);
    for (const [k, v] of Object.entries(values)) q.set(k, v);
    entry.query = q.toString();
    this.o.onNavigate?.('update', entry, this.pages);
  }

  async _invoke(api, args) {
    if (!(api in API_CAPS)) throw new Error(`unknown-api: ${api}`);
    const cap = API_CAPS[api];
    if (cap && !this.can(cap)) {
      this.bus?.publish('miniapp.denied', { summary: `${this.manifest.name} may not call ${api} (needs ${cap})`, api, cap });
      throw new Error(`denied: ${api} needs ${cap}`);
    }
    const key = this.appKey;
    switch (api) {
      case 'system.getInfo':
        return { runner: 'glitchcan miniapps', platformCode: this.o.platformCode, locale: this.pkg.locale,
          colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          capabilities: [...this.node.capabilities], prefs: { ...this.prefs } };
      case 'ui.toast': this.o.onAnnounce?.(String(args.text ?? '').slice(0, 200), 'toast'); return true;
      case 'storage.get': return this.store.snapshot(key)?.[String(args.key)] ?? null;
      case 'storage.keys': return Object.keys(this.store.snapshot(key) || {});
      case 'storage.set': {
        const r = this.store.set(key, String(args.key), String(args.value));
        if (!r.ok) throw new Error(r.reason);
        return true;
      }
      case 'storage.remove': { const r = this.store.remove(key, String(args.key)); if (!r.ok) throw new Error(r.reason); return true; }
      case 'location.get':
        return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
          (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
          (err) => reject(new Error(err.message)), { timeout: 10000, maximumAge: 60000 }));
    }
    throw new Error(`unknown-api: ${api}`);
  }
}
