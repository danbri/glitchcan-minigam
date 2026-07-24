// FoafBus — the shell's local event spine.
//
// Everything that happens in a foafos shell — a story beat, a window mode
// change, a minigame completing, a network notification arriving — is an
// event on this bus. Widgets subscribe; transports feed it from outside.
//
// Topics are dot-paths ('wm.mode', 'minigame.complete', 'net.atom.entry').
// Patterns: exact topic, 'prefix.*' (matches any depth below), or '*'.
//
// Cross-tab: bridge(channelName) mirrors local events over a
// BroadcastChannel, so two tabs of the same shell share one nervous system.

export class FoafBus {
  constructor() {
    this._subs = new Map();      // pattern → Set<handler>
    this._retained = new Map();  // topic → last retained event
    this._bc = null;
    this._seq = 0;
  }

  static match(pattern, topic) {
    if (pattern === '*' || pattern === topic) return true;
    if (pattern.endsWith('.*')) return topic.startsWith(pattern.slice(0, -1));
    return false;
  }

  // publish → the event object (so callers can log/store it)
  publish(topic, data = {}, { retain = false, source = 'local' } = {}) {
    const event = {
      id: `${Date.now().toString(36)}-${(this._seq++).toString(36)}`,
      topic,
      ts: Date.now(),
      source,
      data,
    };
    if (retain) this._retained.set(topic, event);
    this._dispatch(event);
    if (this._bc && source === 'local') {
      try { this._bc.postMessage(event); } catch { /* non-cloneable data stays local */ }
    }
    return event;
  }

  // subscribe → unsubscribe function
  subscribe(pattern, handler, { replay = false } = {}) {
    if (!this._subs.has(pattern)) this._subs.set(pattern, new Set());
    this._subs.get(pattern).add(handler);
    if (replay) for (const e of this.retained(pattern)) handler(e);
    return () => { this._subs.get(pattern)?.delete(handler); };
  }

  retained(pattern = '*') {
    return [...this._retained.values()].filter(e => FoafBus.match(pattern, e.topic));
  }

  _dispatch(event) {
    for (const [pattern, handlers] of this._subs) {
      if (!FoafBus.match(pattern, event.topic)) continue;
      for (const h of [...handlers]) {
        try { h(event); } catch (err) { console.error('[FoafBus] handler failed:', err); }
      }
    }
  }

  // Mirror events across same-origin tabs. Returns false where
  // BroadcastChannel doesn't exist.
  bridge(channelName) {
    if (typeof BroadcastChannel === 'undefined') return false;
    this._bc = new BroadcastChannel(channelName);
    this._bc.onmessage = (e) => {
      const ev = e.data;
      if (ev && typeof ev.topic === 'string') this._dispatch({ ...ev, source: 'tab' });
    };
    return true;
  }

  close() {
    this._bc?.close();
    this._bc = null;
    this._subs.clear();
  }
}
