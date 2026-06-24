// edot-kernel.js — the shared substrate the suite's apps coordinate through.
//
// Today the apps are separate pages that talk via ad-hoc BroadcastChannel('edot')
// handoffs + localStorage + a shared object index. This formalises that into one
// small, documented kernel, so the SAME code path works whether apps are in
// separate tabs (cross-tab transport) or co-located in one workspace host (direct
// in-process calls). See docs/research/pre-enterprise-foundations.md and the
// "composable host" decision.
//
// Three parts, all isomorphic (no DOM) and transport/storage-injectable, so the
// whole thing unit-tests in pure Node:
//
//   bus          — typed publish/subscribe. Subscribers in THIS context always
//                  get direct delivery; if a cross-tab transport is attached (a
//                  BroadcastChannel-shaped { postMessage, onmessage, close }), the
//                  same publish also reaches sibling pages.
//   index        — an ObjectIndex (metadata: WHAT objects exist). Reused as-is.
//   capabilities — apps PROVIDE typed capabilities ("editor.insertTable",
//                  "slides.fromTable"); anything INVOKEs one by id. A provider in
//                  THIS context runs directly (co-located panes: a function call,
//                  no serialize); otherwise the call is published on the bus for a
//                  sibling tab that provides it.

import { ObjectIndex } from './object-index.js';

export class Bus {
  constructor(transport = null) {
    this._subs = new Map();             // type -> Set<fn>
    this._transport = null;
    if (transport) this.attach(transport);
  }

  // Attach a BroadcastChannel-shaped transport. Inbound messages are delivered to
  // local subscribers but never re-posted (no echo loop).
  attach(transport) {
    this._transport = transport;
    const onMsg = (e) => this._dispatch(e && e.data, true);
    if (typeof transport.addEventListener === 'function') transport.addEventListener('message', onMsg);
    else transport.onmessage = onMsg;
    return this;
  }

  // Subscribe to a message type (or '*' for all). Returns an unsubscribe fn.
  subscribe(type, fn) {
    if (typeof fn !== 'function') throw new Error('subscribe needs a handler function');
    let set = this._subs.get(type);
    if (!set) { set = new Set(); this._subs.set(type, set); }
    set.add(fn);
    return () => { set.delete(fn); };
  }

  // Publish to local subscribers and (unless crossTab:false) the transport.
  publish(type, payload, { crossTab = true } = {}) {
    if (!type) throw new Error('publish needs a type');
    this._dispatch({ type, payload }, false);
    if (crossTab && this._transport) {
      try { this._transport.postMessage({ type, payload }); } catch { /* closed / unserialisable */ }
    }
    return this;
  }

  _dispatch(msg, _fromTransport) {
    if (!msg || !msg.type) return;
    // Snapshot handler sets so a handler that (un)subscribes can't perturb the loop.
    const exact = this._subs.get(msg.type);
    if (exact) for (const fn of [...exact]) { try { fn(msg.payload, msg); } catch { /* handler error is isolated */ } }
    const star = this._subs.get('*');
    if (star) for (const fn of [...star]) { try { fn(msg.payload, msg); } catch { /* */ } }
  }

  close() {
    if (this._transport && typeof this._transport.close === 'function') {
      try { this._transport.close(); } catch { /* */ }
    }
    this._transport = null;
  }
}

const INVOKE = 'cap:invoke';
const REGISTERED = 'cap:registered';

export class Capabilities {
  constructor(bus = null) {
    this._providers = new Map();        // id -> fn
    this._meta = new Map();             // id -> { id, ...meta }
    this._bus = bus;
    // A capability invoked on a sibling tab arrives here over the bus; run it if
    // we are the provider, otherwise ignore (another tab will handle it).
    if (bus) {
      bus.subscribe(INVOKE, (m) => {
        const id = m && m.id;
        const fn = id && this._providers.get(id);
        if (fn) { try { fn(m.payload); } catch { /* */ } }
      });
    }
  }

  // Register a capability this context can perform. Returns an unprovide fn.
  provide(id, fn, meta = {}) {
    if (!id || typeof fn !== 'function') throw new Error('provide needs an id and a function');
    this._providers.set(id, fn);
    this._meta.set(id, { id, ...meta });
    if (this._bus) this._bus.publish(REGISTERED, { id, meta: this._meta.get(id) });
    return () => { this._providers.delete(id); this._meta.delete(id); };
  }

  has(id) { return this._providers.has(id); }
  list() { return [...this._meta.values()]; }

  // Invoke a capability. If provided in THIS context, call it directly and return
  // its result (co-located panes: no serialize). Otherwise publish over the bus
  // for a sibling tab to handle (returns undefined). Throws only if neither a
  // local provider nor a bus exists.
  invoke(id, payload) {
    const fn = this._providers.get(id);
    if (fn) return fn(payload);
    if (this._bus) { this._bus.publish(INVOKE, { id, payload }); return undefined; }
    throw new Error(`no provider for capability: ${id}`);
  }
}

export class Kernel {
  constructor({ transport = null, storage = null } = {}) {
    this.bus = new Bus(transport);
    this.index = new ObjectIndex(storage);
    this.capabilities = new Capabilities(this.bus);
  }
}

// Browser singleton — one kernel per page, wired to a BroadcastChannel('edot-kernel')
// and localStorage. Lazily created and safe where BroadcastChannel is unavailable.
let _kernel = null;
export function getKernel() {
  if (_kernel) return _kernel;
  let transport = null;
  try { if (typeof BroadcastChannel !== 'undefined') transport = new BroadcastChannel('edot-kernel'); } catch { /* */ }
  const storage = (typeof localStorage !== 'undefined') ? localStorage : null;
  _kernel = new Kernel({ transport, storage });
  return _kernel;
}
