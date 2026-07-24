// <foafos-guest> — a sandboxed widget process, and the scoped bus view
// it talks through.
//
// The guest is an `<iframe sandbox="allow-scripts">`: opaque origin, no
// shared globals, no ambient storage. Its ONLY power is the message
// protocol below, and its only bus access is a ScopedBus: publish
// limited to granted topic patterns, inbound events limited to granted
// patterns, source forcibly stamped `guest:<name>`. Denied publishes are
// dropped and announced ('sys.guest.denied') — visible, not silent.
//
// Guest protocol (host ⇄ iframe postMessage):
//   host → guest: { type:'init', name, config, grants }
//   guest → host: { type:'ready' }
//                 { type:'bus-publish', topic, data }
//   host → guest: { type:'bus-event', event }        (granted topics only)
//
// Two instances of the same widget are two processes with disjoint
// state — the "two spreadsheets" requirement.

import { FoafBus } from './bus.mjs';

// A filtered view of a bus. Grants are topic patterns (exact, 'prefix.*',
// or '*'). Never hand a guest the raw bus.
export function scopeBus(bus, { name, publish = [], subscribe = [] }) {
  const unsubs = [];
  const allowed = (patterns, topic) => patterns.some(p => FoafBus.match(p, topic));
  return {
    publish(topic, data = {}) {
      if (!allowed(publish, topic)) {
        bus.publish('sys.guest.denied', { guest: name, topic, summary: `${name} denied publish to ${topic}` });
        return null;
      }
      return bus.publish(topic, data, { source: `guest:${name}` });
    },
    subscribe(pattern, handler) {
      const un = bus.subscribe(pattern, (e) => {
        if (allowed(subscribe, e.topic)) handler(e);
      });
      unsubs.push(un);
      return un;
    },
    close() { unsubs.forEach(u => u()); unsubs.length = 0; },
  };
}

export function defineGuest() {
  if (typeof customElements === 'undefined' || customElements.get('foafos-guest')) return;

  class FoafosGuest extends HTMLElement {
    constructor() {
      super();
      this.bus = null;                       // set by the shell before connect
      this.grants = { publish: [], subscribe: [] };
      this.config = {};
      this._scoped = null;
      this._onMessage = null;
    }

    connectedCallback() {
      if (this._frame) return;
      const name = this.getAttribute('name') || `g-${Math.random().toString(36).slice(2, 8)}`;
      this._name = name;
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.src = this.getAttribute('src');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      this._frame = frame;

      this._scoped = scopeBus(this.bus, { name, ...this.grants });
      // granted inbound events flow to the guest (its own echoes excluded)
      this._scoped.subscribe('*', (e) => {
        if (e.source !== `guest:${name}`) {
          frame.contentWindow?.postMessage({ type: 'bus-event', event: e }, '*');
        }
      });

      this._onMessage = (e) => {
        if (e.source !== frame.contentWindow) return;
        const d = e.data;
        if (!d || typeof d.type !== 'string') return;
        if (d.type === 'ready') {
          frame.contentWindow.postMessage(
            { type: 'init', name, config: this.config, grants: this.grants }, '*');
          this.bus.publish('sys.guest.ready', { guest: name, summary: `${name} ready` });
        } else if (d.type === 'bus-publish') {
          this._scoped.publish(String(d.topic || ''), d.data);
        }
      };
      window.addEventListener('message', this._onMessage);
      this.appendChild(frame);
    }

    disconnectedCallback() {
      window.removeEventListener('message', this._onMessage);
      this._scoped?.close();
      this._frame?.remove();
      this._frame = null;
      this.bus?.publish('sys.guest.closed', { guest: this._name });
    }
  }

  customElements.define('foafos-guest', FoafosGuest);
}
