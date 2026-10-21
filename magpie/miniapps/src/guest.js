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
        break;
      case 'miniapp.lifecycle':
        (layer === 'logic' ? miniapp.global : miniapp.page)._set(d.state, d.detail || {});
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
  const hello = () => post({ type: 'app.hello', layer });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hello);
  else queueMicrotask(hello);
})();
