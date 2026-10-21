// MiniAppHost: run one opened MiniApp package under the foafos capability tree.
//
//   logic layer  hidden iframe, sandbox="allow-scripts", runs app.js
//   view layer   one iframe per open page (a page stack), same sandbox
//   governance   AppTree (grant(child) ⊆ grant(parent)), FoafStore, FoafBus
//                from packages/foafos/src/
//
// The host is level 0: it plays nothing itself, and every API a guest calls
// is checked against the node's capabilities when it is called.
// Design, protocol and the choices made where the drafts are silent:
// magpie/miniapps/README.md.

import { GlobalLifecycle, PageLifecycle } from './lifecycle.mjs';
import { pageFile } from './package.mjs';

/** MiniApp req_permissions names -> foafos capabilities. Unlisted names are refused. */
export const PERMISSION_MAP = Object.freeze({
  'system.permission.STORAGE': 'storage',
  'system.permission.LOCATION': 'geolocation',
  'system.permission.AUDIO': 'audio',
});

/** Host APIs: name -> capability needed (null: none). */
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
const SANDBOX = 'allow-scripts';
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
   * @param opts     { container, tree, rootId, store, bus, platformCode, query, referrerInfo,
   *                   backgroundUnloadMs, onNavigate(route, query), onToast(text), onClose() }
   */
  constructor(opened, opts) {
    this.pkg = opened;
    this.manifest = opened.manifest;
    this.o = { backgroundUnloadMs: 5 * 60 * 1000, platformCode: 1, ...opts };
    this.bus = opts.bus;
    this.tree = opts.tree;
    this.store = opts.store;
    this.appKey = 'miniapp.' + this.manifest.app_id;
    this.global = new GlobalLifecycle();
    this.pages = [];             // [{ route, query, frame, life }]
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
    const entry = { t: Date.now(), scope, state, ...detail };
    this.log.push(entry);
    this.bus?.publish(`miniapp.${scope}.${state}`, { summary: `${this.manifest.name}: ${scope} ${state}`, appId: this.manifest.app_id, ...detail });
  }

  /** Decide the grant: requested permissions, mapped, bounded by the parent node. */
  _grant() {
    const parentCaps = this.tree.get(this.o.rootId)?.capabilities || [];
    const want = [];
    for (const p of this.manifest.req_permissions) {
      const cap = PERMISSION_MAP[p.name];
      if (!cap) this.refused.push({ name: p.name, reason: 'no foafos capability for this permission' });
      else if (!parentCaps.includes(cap)) this.refused.push({ name: p.name, cap, reason: 'the root does not hold it' });
      else { want.push(cap); this.granted.push({ name: p.name, cap, reason: p.reason || '' }); }
    }
    const node = this.tree.spawn({ appId: this.appKey, parentId: this.o.rootId, capabilities: want,
      label: this.manifest.name, surface: 'miniapp' });
    if (node.refused) throw new Error(`spawn refused: ${node.reason} ${node.excess || ''}`);
    this.node = node;
    this.store?.grant(this.appKey, want);
    this.tree.setOnClose(node.id, () => this._teardown());
  }

  can(cap) { return this.tree.can(this.node.id, cap); }

  async launch() {
    await loadGuest();
    this._grant();
    window.addEventListener('message', this._onMessage);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.logicFrame = this._frame(this._logicDoc(), true);
    // The logic frame's app.hello moves the app to "launched", then the start page opens.
  }

  _frame(srcdoc, hidden) {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', SANDBOX);
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.className = hidden ? 'miniapp-logic' : 'miniapp-page';
    if (hidden) { f.hidden = true; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; }
    f.title = hidden ? `${this.manifest.name} logic layer` : this.manifest.name;
    f.srcdoc = srcdoc;
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

  /** Build the view document for a page route: inline CSS and scripts, data: URLs for media. */
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
      if (src === null) { scripts.push(s.textContent); s.remove(); continue; }
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
    // a[href] to a page in the package becomes an in-app link.
    for (const a of doc.querySelectorAll('a[href]')) {
      const p = resolvePackagePath(file, a.getAttribute('href'));
      const r = p && p.replace(/\.html?$/, '');
      if (r && this.manifest.pages.includes(r)) {
        a.dataset.miniappRoute = r;
        a.dataset.miniappQuery = (a.getAttribute('href').split('?')[1] || '').split('#')[0];
      }
    }
    // Convention: pages/x/x.css and pages/x/x.js beside pages/x/x.html are included if not linked.
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
    return '<!doctype html>' + doc.documentElement.outerHTML.replace('</head>', this._bootScripts('view') + '</head>')
      .replace(/<\/body>(?![\s\S]*<\/body>)/, scripts.map(scriptTag).join('') + '</body>');
  }

  _openPage(route, query = '', { replace = false } = {}) {
    const top = this.pages.at(-1);
    if (!replace && this.pages.length >= MAX_PAGE_STACK) {
      this._note('page', 'refused', { route, reason: `page stack is full (${MAX_PAGE_STACK})` });
      return;
    }
    if (replace && top) this._closePage(this.pages.pop());
    else if (top) { this._pageTo(top, 'hidden'); top.frame.hidden = true; }
    const life = new PageLifecycle(route);
    for (const s of ['loaded', 'ready', 'shown', 'hidden', 'unloaded']) {
      life.addEventListener('page' + s, (ev) => this._note('page', s, { route, ...ev.detail }));
    }
    const frame = this._frame(this._pageDoc(route), false);
    const entry = { route, query, frame, life };
    life.addEventListener('pageshown', () => this.o.onNavigate?.(route, query, this.pages.length));
    this.pages.push(entry);
  }

  _closePage(entry) {
    entry.life.try('unloaded', { route: entry.route });
    this._send(entry.frame, { type: 'miniapp.lifecycle', state: 'unloaded', detail: { route: entry.route } });
    entry.frame.remove();
  }

  navigateBack() {
    if (this.pages.length <= 1) return false;
    this._closePage(this.pages.pop());
    const top = this.pages.at(-1);
    top.frame.hidden = false;
    this._pageTo(top, 'shown');
    return true;
  }

  _send(frame, msg) { frame?.contentWindow?.postMessage(msg, '*'); }

  _pageTo(entry, state) {
    if (entry.life.try(state, { route: entry.route })) {
      this._send(entry.frame, { type: 'miniapp.lifecycle', state, detail: { route: entry.route } });
    }
  }

  _globalTo(state, detail = {}) {
    if (this.global.try(state, detail)) {
      this._send(this.logicFrame, { type: 'miniapp.lifecycle', state, detail });
    }
  }

  /** The user switched away (false) or back (true). Hidden for backgroundUnloadMs unloads the app. */
  setVisible(visible) {
    const top = this.pages.at(-1);
    clearTimeout(this._unloadTimer);
    if (visible) {
      this._globalTo('shown');
      if (top) this._pageTo(top, 'shown');
    } else {
      if (top) this._pageTo(top, 'hidden');
      this._globalTo('hidden');
      if (this.o.backgroundUnloadMs > 0) this._unloadTimer = setTimeout(() => this.close('background timeout'), this.o.backgroundUnloadMs);
    }
  }

  /** End the session: every page unloaded (top first), then the app, then the tree node. */
  close(reason = 'closed') {
    if (this.global.state === 'unloaded' || !this.node) return;
    this._closeReason = reason;
    this.tree.close(this.node.id);       // calls _teardown through onClose
  }

  _teardown() {
    clearTimeout(this._unloadTimer);
    while (this.pages.length) this._closePage(this.pages.pop());
    this._globalTo('unloaded', { reason: this._closeReason || 'closed' });
    window.removeEventListener('message', this._onMessage);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.store?.revoke(this.appKey);
    setTimeout(() => this.logicFrame?.remove(), 0);
    this.o.onClose?.();
  }

  _message(e) {
    const d = e.data || {};
    const fromLogic = e.source === this.logicFrame?.contentWindow;
    const page = fromLogic ? null : this.pages.find(p => e.source === p.frame.contentWindow);
    if (!fromLogic && !page) return;
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
          reply({ type: 'app.init', layer: 'view', appId: m.app_id, capabilities: [...this.node.capabilities],
            manifest: pub, messages: this.pkg.messages,
            pageInputObject: { pageInputQuery: Object.fromEntries(new URLSearchParams(page.query)), route: page.route, dir: m.dir || 'auto' } });
          this._pageTo(page, 'loaded');
        }
        break;
      case 'miniapp.rendered':
        if (page && page.life.state === 'loaded') {
          this._pageTo(page, 'ready');
          if (page === this.pages.at(-1) && this.global.state === 'shown') this._pageTo(page, 'shown');
        }
        break;
      case 'miniapp.navigate':
        if (!page) break;
        if (d.op === 'navigateBack') { this.navigateBack(); break; }
        if (!m.pages.includes(d.route)) { this._note('page', 'refused', { route: d.route, reason: 'not in manifest pages' }); break; }
        this._openPage(d.route, String(d.query || ''), { replace: d.op === 'redirectTo' });
        break;
      case 'miniapp.message':
        // The bridge between the layers: logic -> top page, page -> logic.
        if (fromLogic) this._send(this.pages.at(-1)?.frame, { type: 'miniapp.message', data: d.data });
        else this._send(this.logicFrame, { type: 'miniapp.message', data: d.data });
        break;
      case 'miniapp.error': {
        const before = this.global.state;
        this._globalTo('error', { message: d.message, layer: fromLogic ? 'logic' : `view ${page.route}` });
        if (before === 'shown' || before === 'hidden') this._globalTo(before);
        break;
      }
      case 'miniapp.invoke':
        this._invoke(d.api, d.args || {}).then(
          (value) => reply({ type: 'miniapp.result', rid: d.rid, ok: true, value }),
          (err) => reply({ type: 'miniapp.result', rid: d.rid, ok: false, error: String(err?.message || err) }));
        break;
    }
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
          capabilities: [...this.node.capabilities] };
      case 'ui.toast': this.o.onToast?.(String(args.text ?? '')); return true;
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
          (e) => reject(new Error(e.message)), { timeout: 10000, maximumAge: 60000 }));
    }
    throw new Error(`unknown-api: ${api}`);
  }
}
