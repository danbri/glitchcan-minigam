// @foafos/guest: an app's side of the foafos-lite guest contract, version 1.
// Contract: docs/foafos-lite-contract.md. Model: factoidal-core L4Factoidal/Foafos/GuestContract.lean.
//
// This module posts messages to the window that frames the app and listens to messages from it,
// and keeps level-0 storage in IndexedDB. It replaces no global, has no network code (a test
// fails the build if the source names any), assumes no URL, port or origin, and does nothing at
// import time. Everything it sends, the app handed it, plus `fl`, `type` and `rid`.

const FL = 1;
const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const H2G = new Set(['welcome', 'lifecycle', 'audio', 'viewport', 'input', 'action', 'store-result', 'call', 'event']);
const NEEDS = { 'store-result': 2, call: 3, event: 3, lifecycle: 1, audio: 1, viewport: 1, input: 1, action: 1 };

/** A path as segments, or null when it breaks the rule (no `.`, `..`, `%`, `\`, empty part). */
export function cleanPath(path, { forList = false } = {}) {
  const segs = Array.isArray(path) ? path.map(String) : String(path ?? '').split('/').filter((s, i, a) => !(s === '' && i === a.length - 1 && a.length > 1));
  if (segs.length === 1 && segs[0] === '') return forList ? [] : null;
  if (!segs.length) return forList ? [] : null;
  return segs.every((s) => SEGMENT.test(s) && s !== '.' && s !== '..') ? segs : null;
}

/** IndexedDB under one database, `foafos-guest`: the level-0 (and level-1) store. */
export function indexedDbStore(idb = globalThis.indexedDB) {
  let db;
  const open = () => (db ??= new Promise((ok, no) => {
    const r = idb.open('foafos-guest', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = async (mode, fn) => { const d = await open(); return new Promise((ok, no) => { const t = d.transaction('files', mode); const q = fn(t.objectStore('files')); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
  return {
    get: async (key) => tx('readonly', (s) => s.get(key)),
    put: async (key, value) => { await tx('readwrite', (s) => s.put(value, key)); },
    delete: async (key) => { await tx('readwrite', (s) => s.delete(key)); },
    keys: async () => tx('readonly', (s) => s.getAllKeys()),
  };
}

/** An in-memory store with the same shape, for tests or for an app that wants nothing kept. */
export function memoryStore() {
  const m = new Map();
  return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, keys: async () => [...m.keys()] };
}

/**
 * Join a host, or find there is none. Resolves to a guest whose `level` is the level granted
 * (0 when there is no host). Options:
 *   level   the most the app will use (0..3); `hello` asks for it
 *   name    the app's name; actions: its first menu [{ id, label, checked? }]
 *   hosts   origins the app trusts as hosts; with them, nothing is sent to any other
 *   local   the level-0 store (default IndexedDB); window, timeoutMs: for tests
 */
export function connect({ level = 1, name = '', actions = [], hosts = null, local = null, window: w = globalThis.window, timeoutMs = 500 } = {}) {
  const asked = Math.max(0, Math.min(3, level | 0));
  const listeners = new Map();
  const pending = new Map();          // rid -> resolve
  let granted = null, origin = null, ended = false, seq = 0, menu = new Set(actions.map((a) => a.id));
  let tools = null, owedPaused = false;
  const store = local ?? (typeof globalThis.indexedDB !== 'undefined' ? indexedDbStore() : memoryStore());
  const framed = !!w && w.parent && w.parent !== w;
  const emit = (type, msg) => { for (const fn of listeners.get(type) || []) { try { fn(msg); } catch (e) { console.error(e); } } };
  const send = (msg) => { if (granted > 0 && origin !== null && !ended) w.parent.postMessage({ fl: FL, ...msg }, origin); };
  const rid = () => `g${++seq}`;
  // After `ending` nothing is sent, so a request then fails at once rather than waiting forever.
  const request = (msg) => (ended ? Promise.resolve({ ok: false, reason: 'offline' })
    : new Promise((resolve) => { const r = rid(); pending.set(r, resolve); send({ ...msg, rid: r }); }));

  const guest = {
    get level() { return granted ?? 0; },
    get standalone() { return !granted; },
    /** Listen for lifecycle, audio, viewport, input, action, call or event. Returns a function that stops listening. */
    on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); },
    /** The app has drawn its first frame. */
    ready() { if (guest.level >= 1) send({ type: 'ready' }); },
    /** Replace the app's menu of actions. Labels must not carry app data (the contract, level 1). */
    setActions(items) { menu = new Set(items.map((a) => a.id)); if (guest.level >= 1) send({ type: 'actions', items: items.map(({ id, label, checked }) => ({ id: String(id), label: String(label), ...(typeof checked === 'boolean' ? { checked } : {}) })) }); },
    /** Answer a `lifecycle paused`, once timers and sound are stopped. */
    paused() { if (owedPaused && guest.level >= 1) { owedPaused = false; send({ type: 'paused' }); } },
    /** Storage in the app's own folder: the host's at level 2 and up, otherwise local. */
    store: {
      get: (path) => storeOp('get', path),
      put: (path, body, { etag, contentType } = {}) => storeOp('put', path, { body, etag, contentType }),
      list: (path = '') => storeOp('list', path),
      delete: (path, { etag } = {}) => storeOp('delete', path, { etag }),
    },
    /** Level 3: offer tools. handler(name, args) answers each call once. */
    tools(items, handler) { if (guest.level < 3) return false; tools = handler; send({ type: 'tools', items }); return true; },
    subscribe(topics) { if (guest.level < 3) return false; send({ type: 'subscribe', topics: [...topics].map(String) }); return true; },
    publish(topic, data) { if (guest.level < 3) return false; send({ type: 'publish', topic: String(topic), data }); return true; },
  };

  async function storeOp(op, path, extra = {}) {
    const segs = cleanPath(path, { forList: op === 'list' });
    if (!segs) return { ok: false, reason: 'denied' };
    if (guest.level >= 2) return request({ type: 'store', op, path: segs, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) });
    return localOp(op, segs, extra);
  }
  async function localOp(op, segs, { body, contentType } = {}) {
    const key = segs.join('/');
    if (op === 'get') { const v = await store.get(key); return v ? { ok: true, body: v.body, contentType: v.contentType } : { ok: false, reason: 'not-found' }; }
    if (op === 'put') { await store.put(key, { body, contentType: contentType || 'text/plain' }); return { ok: true }; }
    if (op === 'delete') { await store.delete(key); return { ok: true }; }
    const pre = key ? key + '/' : '', seen = new Set();
    for (const k of await store.keys()) if (k.startsWith(pre)) { const rest = k.slice(pre.length), i = rest.indexOf('/'); seen.add(i < 0 ? rest : rest.slice(0, i + 1)); }
    return { ok: true, items: [...seen].sort().map((p) => ({ path: p, container: p.endsWith('/') })) };
  }

  function onMessage(e) {
    if (!framed || e.source !== w.parent) return;
    const d = e.data;
    if (!d || d.fl !== FL || !H2G.has(d.type)) return;
    if (hosts && !hosts.includes(e.origin)) return;
    if (d.type === 'welcome') {
      if (granted !== null) return;                                   // only the first, and only in time
      const lv = d.level | 0;
      if (lv > asked || lv < 1) return;                                // above what was asked: ignored
      granted = lv; origin = e.origin || '*';
      settle(); emit('welcome', d);
      if (d.lifecycle) onLifecycle(d.lifecycle);
      for (const k of ['audio', 'viewport', 'input']) if (d[k]) emit(k, d[k]);
      return;
    }
    if (!granted || (origin !== '*' && e.origin !== origin)) return;
    if ((NEEDS[d.type] || 9) > granted) return;                        // above the level: ignored
    if (d.type === 'lifecycle') return onLifecycle(d.state);
    if (d.type === 'action') { if (menu.has(d.id)) emit('action', { id: d.id }); return; }
    if (d.type === 'store-result') { const r = pending.get(d.rid); if (!r) return; pending.delete(d.rid); const { fl, type, rid: _r, ...rest } = d; r(rest); return; }
    if (d.type === 'call') {
      Promise.resolve().then(() => (tools ? tools(d.name, d.args) : Promise.reject(new Error('no such tool'))))
        .then((result) => send({ type: 'tool-result', rid: d.rid, ok: true, result }), (err) => send({ type: 'tool-result', rid: d.rid, ok: false, error: String(err?.message || err) }));
      return;
    }
    emit(d.type, d.type === 'event' ? { topic: d.topic, data: d.data } : d);
  }
  function onLifecycle(state) {
    if (state === 'paused') owedPaused = true;
    if (state === 'running') owedPaused = false;
    emit('lifecycle', { state });
    if (state === 'ending') {                                          // outstanding requests fail; nothing more is sent
      for (const r of pending.values()) r({ ok: false, reason: 'offline' });
      pending.clear();
      ended = true;
    }
  }

  let settle = () => {};
  if (!framed || asked === 0) return Promise.resolve(guest);
  w.addEventListener('message', onMessage);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { if (granted === null) granted = 0; resolve(guest); }, timeoutMs);
    settle = () => { clearTimeout(timer); resolve(guest); };
    const hello = { fl: FL, type: 'hello', level: asked, name: String(name), actions: actions.map(({ id, label, checked }) => ({ id: String(id), label: String(label), ...(typeof checked === 'boolean' ? { checked } : {}) })) };
    for (const target of hosts && hosts.length ? hosts : ['*']) w.parent.postMessage(hello, target);
  });
}
