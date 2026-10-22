// Guest bootstrap for a MiniApp frame. The host inlines it, as the first
// script, into both frames it makes for a package:
//   logic frame (hidden): runs app.js; exposes miniapp.global (MiniApp Lifecycle "Global")
//   view frame (one per open page): runs the page; exposes miniapp.page ("Page")
// self.__miniappLayer is set to 'logic' or 'view' before this runs.
// Both frames are sandboxed without allow-same-origin, so their origin is
// opaque; this file only talks to `parent`, with the message types listed
// in magpie/miniapps/README.md ("Host protocol").
(() => {
  'use strict';
  const layer = self.__miniappLayer;
  const pending = new Map();
  let rid = 0;
  let init = null;
  const post = (msg) => parent.postMessage(msg, '*');

  function mirror(states, prefix, stateProp) {
    const t = new EventTarget();
    let state = null;
    for (const s of states) t['on' + prefix + s] = null;
    Object.defineProperty(t, stateProp, { get: () => state, enumerable: true });
    t._set = (s, detail) => {
      state = s;
      const ev = new CustomEvent(prefix + s, { detail });
      const h = t['on' + prefix + s];
      if (typeof h === 'function') { try { h.call(t, ev); } catch (e) { reportError(e); } }
      t.dispatchEvent(ev);
    };
    return t;
  }

  const miniapp = {
    layer,
    get appId() { return init?.appId ?? null; },
    get capabilities() { return init ? [...init.capabilities] : []; },
    get manifest() { return init?.manifest ?? null; },
    /** Call a host API. Resolves with its value; rejects with Error(reason). */
    invoke(api, args = {}) {
      const id = ++rid;
      post({ type: 'miniapp.invoke', rid: id, api, args });
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    /** i18n lookup in the package's i18n/<locale>.json; the key when absent. */
    t(key) { return init?.messages?.[key] ?? key; },
  };

  if (layer === 'logic') {
    miniapp.global = mirror(['launched', 'shown', 'hidden', 'error', 'unloaded'], 'global', 'globalState');
    Object.defineProperty(miniapp.global, 'inputObject', { get: () => init?.inputObject ?? null });
    miniapp.postToView = (data) => post({ type: 'miniapp.message', data });
    miniapp.onviewmessage = null;
  } else {
    miniapp.page = mirror(['loaded', 'ready', 'shown', 'hidden', 'unloaded'], 'page', 'pageState');
    Object.defineProperty(miniapp.page, 'pageInputObject', { get: () => init?.pageInputObject ?? null });
    miniapp.navigateTo = (route, query = '') => post({ type: 'miniapp.navigate', op: 'navigateTo', route, query });
    miniapp.redirectTo = (route, query = '') => post({ type: 'miniapp.navigate', op: 'redirectTo', route, query });
    miniapp.navigateBack = () => post({ type: 'miniapp.navigate', op: 'navigateBack' });
    miniapp.postToLogic = (data) => post({ type: 'miniapp.message', data });
    miniapp.onlogicmessage = null;
    // A link to another package page navigates inside the app.
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[data-miniapp-route]');
      if (!a) return;
      e.preventDefault();
      miniapp.navigateTo(a.dataset.miniappRoute, a.dataset.miniappQuery || '');
    });
  }

  // The runner's display preferences, applied to this page: text size, colours, movement.
  // A page that sets its sizes in rem or em follows the text size; colours use system
  // colours (Canvas, CanvasText) so a page that sets none still follows the theme.
  const prefStyle = document.createElement('style');
  function applyPrefs({ scale = 1, theme = 'system', motion = 'system' }) {
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(scale * 100)}%`;
    root.dataset.runnerTheme = theme;
    root.dataset.runnerMotion = motion;
    const rules = [];
    if (theme === 'dark') rules.push(':root{color-scheme:dark}');
    if (theme === 'light') rules.push(':root{color-scheme:light}');
    if (theme === 'contrast') rules.push(':root{color-scheme:dark} *,*::before,*::after{background-color:#000!important;color:#fff!important;border-color:#fff!important;text-shadow:none!important;box-shadow:none!important} a,a *{color:#ff0!important;text-decoration:underline!important} button,input,select,textarea{border:2px solid #fff!important} :focus-visible{outline:3px solid #ff0!important;outline-offset:2px}');
    if (motion === 'reduce') rules.push('*,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;scroll-behavior:auto!important}');
    prefStyle.textContent = rules.join('\n');
    if (!prefStyle.isConnected) (document.head || document.documentElement).append(prefStyle);
  }

  // When a page is shown, put the keyboard focus at its start, unless the page has
  // already placed it. Screen readers then begin at the page heading.
  function focusStart() {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return;
    const target = document.querySelector('[autofocus]') || document.querySelector('main h1, h1, main, [role="main"]');
    if (!target) return;
    if (!target.matches('a[href],button,input,select,textarea,[tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: false });
  }

  const pageTitle = () => (document.title || document.querySelector('h1')?.textContent || '').trim();

  function reportError(err) {
    post({ type: 'miniapp.error', message: String(err?.message ?? err), stack: String(err?.stack ?? '') });
  }
  self.addEventListener('error', (e) => reportError(e.error ?? e.message));
  self.addEventListener('unhandledrejection', (e) => reportError(e.reason));

  self.addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const d = e.data || {};
    switch (d.type) {
      case 'app.init':
        init = d;
        if (layer === 'view' && d.pageInputObject?.dir) document.documentElement.dir = d.pageInputObject.dir;
        if (layer === 'view' && d.prefs) applyPrefs(d.prefs);
        break;
      case 'miniapp.prefs':
        if (layer === 'view') applyPrefs(d.prefs || {});
        break;
      case 'miniapp.lifecycle':
        (layer === 'logic' ? miniapp.global : miniapp.page)._set(d.state, d.detail || {});
        if (layer === 'view' && d.state === 'shown') focusStart();
        if (layer === 'view' && d.state === 'loaded') {
          // First render: two animation frames. Browsers do not run rAF in an offscreen
          // cross-origin frame, so a timer stands in after 250 ms.
          let sent = false;
          const rendered = () => { if (!sent) { sent = true; post({ type: 'miniapp.rendered' }); } };
          requestAnimationFrame(() => requestAnimationFrame(rendered));
          setTimeout(rendered, 250);
        }
        break;
      case 'miniapp.result': {
        const p = pending.get(d.rid);
        if (!p) break;
        pending.delete(d.rid);
        if (d.ok) p.resolve(d.value); else p.reject(new Error(d.error));
        break;
      }
      case 'miniapp.message': {
        const h = layer === 'logic' ? miniapp.onviewmessage : miniapp.onlogicmessage;
        if (typeof h === 'function') { try { h(d.data); } catch (err) { reportError(err); } }
        break;
      }
    }
  });

  self.miniapp = miniapp;
  // Say hello after the frame's own scripts have run, so their handlers are in place
  // before the first lifecycle event arrives.
  const hello = () => post({ type: 'app.hello', layer, title: layer === 'view' ? pageTitle() : '' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hello);
  else queueMicrotask(hello);
})();
