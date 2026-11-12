// @foafos/host-lite: the host side of the foafos-lite guest contract, version 1, for one app.
// Contract: docs/foafos-lite-contract.md. Model: factoidal-core L4Factoidal/Foafos/GuestContract.lean.
//
// It talks to one app frame, grants at most the level asked for (and at most `offer`), sends
// lifecycle in the contract's order, answers each request exactly once, keeps storage to the app's
// own folder in a store it is given, and sends events only for topics subscribed to and granted.
// It has no network code, no servers and no sign-in, and replaces no global.

const FL = 1;
const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const segOk = (s) => typeof s === 'string' && SEGMENT.test(s) && s !== '.' && s !== '..';

/** An in-memory folder store: { get, put, delete, keys } over string keys. */
export function memoryStore() {
  const m = new Map();
  return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); }, keys: async () => [...m.keys()] };
}

/**
 * Host the app in `frame` (an iframe element, or anything with contentWindow), listening on
 * `window: w`. Options:
 *   offer   the most this host grants (0..3)
 *   folder  the app's folder name in `store` (its keys are folder + '/' + path)
 *   store   { get, put, delete, keys }; none: no storage is offered (level 2 is not granted)
 *   topics  the topics the person lets this app hear (level 3)
 *   onActions(items), onReady(), onTools(items), onPublish(topic, data), onPaused(), onHello(hello)
 * Returns a host with pause(), resume(), end(), audio(level, muted), viewport(v), input(map),
 * action(id), callTool(name, args) and emit(topic, data).
 */
export function hostApp(frame, { offer = 1, folder = 'app', store = null, topics = [], window: w = globalThis.window,
  onActions, onReady, onTools, onPublish, onPaused, onHello, viewport = null, audio = { level: 1, muted: false } } = {}) {
  const maxOffer = Math.max(0, Math.min(3, offer | 0, store ? 3 : 1));
  let granted = 0, said = null, life = null, menu = new Set(), subs = new Set(), tools = [], seq = 0;
  const calls = new Map();
  const target = () => frame.contentWindow;
  const send = (msg) => { try { target()?.postMessage({ fl: FL, ...msg }, '*'); } catch { /* gone */ } };
  const key = (segs) => `${folder}/${segs.join('/')}`;

  async function answer(d) {
    const reply = (r) => send({ type: 'store-result', rid: d.rid, ...r });
    if (life === 'ending') return reply({ ok: false, reason: 'offline' });
    const list = d.op === 'list';
    const segs = Array.isArray(d.path) ? d.path : null;
    if (!segs || (!segs.length && !list) || !segs.every(segOk)) return reply({ ok: false, reason: 'denied' });
    try {
      if (d.op === 'get') { const v = await store.get(key(segs)); return reply(v ? { ok: true, body: v.body, contentType: v.contentType, etag: v.etag } : { ok: false, reason: 'not-found' }); }
      if (d.op === 'put') {
        const cur = await store.get(key(segs));
        if (d.etag && cur?.etag !== d.etag) return reply({ ok: false, reason: 'conflict' });
        const etag = `"${++seq}"`;
        await store.put(key(segs), { body: d.body, contentType: d.contentType || 'text/plain', etag });
        return reply({ ok: true, etag });
      }
      if (d.op === 'delete') { await store.delete(key(segs)); return reply({ ok: true }); }
      if (list) {
        const pre = segs.length ? key(segs) + '/' : `${folder}/`, seen = new Set();
        for (const k of await store.keys()) if (k.startsWith(pre)) { const rest = k.slice(pre.length), i = rest.indexOf('/'); seen.add(i < 0 ? rest : rest.slice(0, i + 1)); }
        return reply({ ok: true, items: [...seen].sort().map((p) => ({ path: p, container: p.endsWith('/') })) });
      }
      return reply({ ok: false, reason: 'denied' });
    } catch { return reply({ ok: false, reason: 'offline' }); }
  }

  function onMessage(e) {
    if (e.source !== target()) return;
    const d = e.data;
    if (!d || d.fl !== FL || typeof d.type !== 'string') return;
    if (d.type === 'hello') {
      if (said) return;                                                // a second hello: ignored
      said = d;
      granted = Math.max(0, Math.min(d.level | 0, maxOffer));
      menu = new Set((d.actions || []).map((a) => a.id));
      onHello?.(d);
      if (granted < 1) return;                                         // nothing granted: no welcome (the app falls to level 0)
      life = 'running';
      send({ type: 'welcome', level: granted, lifecycle: life, audio, viewport: viewport ?? measure() });
      if (d.actions?.length) onActions?.(d.actions);
      return;
    }
    if (!granted) return;
    const need = { ready: 1, actions: 1, paused: 1, store: 2, tools: 3, 'tool-result': 3, subscribe: 3, publish: 3 }[d.type];
    if (!need || need > granted) return;                               // unknown, or above the level: ignored
    if (d.type === 'ready') return onReady?.();
    if (d.type === 'actions') { menu = new Set((d.items || []).map((a) => a.id)); return onActions?.(d.items || []); }
    if (d.type === 'paused') return onPaused?.();
    if (d.type === 'store') return void answer(d);
    if (d.type === 'tools') { tools = d.items || []; return onTools?.(tools); }
    if (d.type === 'tool-result') { const c = calls.get(d.rid); if (!c) return; calls.delete(d.rid); return c(d.ok ? { ok: true, result: d.result } : { ok: false, error: d.error }); }
    if (d.type === 'subscribe') { subs = new Set((d.topics || []).map(String)); return; }
    if (d.type === 'publish') return onPublish?.(String(d.topic), d.data);
  }
  function measure() {
    const r = frame.getBoundingClientRect?.() || { width: 0, height: 0 };
    return { width: Math.round(r.width), height: Math.round(r.height), safe: { top: 0, right: 0, bottom: 0, left: 0 }, mode: 'window' };
  }
  const lifecycle = (state) => {
    if (!granted || life === 'ending' || life === state) return false;
    life = state;
    send({ type: 'lifecycle', state });
    if (state === 'ending') for (const c of calls.values()) c({ ok: false, error: 'ending' });
    return true;
  };
  w.addEventListener('message', onMessage);

  return {
    get level() { return granted; },
    get state() { return life; },
    get menu() { return [...menu]; },
    get tools() { return tools; },
    pause: () => lifecycle('paused'),
    resume: () => lifecycle('running'),
    end: () => lifecycle('ending'),
    audio: (level, muted = false) => { if (granted && life !== 'ending') send({ type: 'audio', level: Math.max(0, Math.min(1, +level || 0)), muted: !!muted }); },
    viewport: (v) => { if (granted && life !== 'ending') send({ type: 'viewport', ...(v ?? measure()) }); },
    input: (map) => { if (granted && life !== 'ending') send({ type: 'input', map }); },
    action: (id) => { if (granted && life !== 'ending' && menu.has(id)) send({ type: 'action', id }); },
    /** Level 3: call one of the app's tools; resolves once, with its tool-result. */
    callTool(name, args = {}) {
      if (granted < 3 || life === 'ending') return Promise.resolve({ ok: false, error: 'not offered' });
      const rid = `h${++seq}`;
      return new Promise((resolve) => { calls.set(rid, resolve); send({ type: 'call', rid, name, args }); });
    },
    /** Level 3: an event for the app, only if it subscribed and the person granted the topic. */
    emit(topic, data) {
      if (granted < 3 || life === 'ending' || !subs.has(topic) || !topics.includes(topic)) return false;
      send({ type: 'event', topic, data });
      return true;
    },
    detach() { w.removeEventListener('message', onMessage); },
  };
}
