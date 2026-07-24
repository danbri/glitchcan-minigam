// <foafos-feed> — a social-style stream of bus events, rendered through
// the widget registry. Newest first, capped, always renderable (the
// generic card is the guaranteed fallback).
//
//   const feed = document.createElement('foafos-feed');
//   feed.bus = bus;                       // required
//   feed.setAttribute('topics', 'wm.*,minigame.*,story.*');
//
// The feed forwards widgets' 'foaf-action' events back onto the bus.

import { widgets } from './widgets.mjs';

const MAX_ITEMS = 200;

export function defineFeed() {
  if (typeof customElements === 'undefined' || customElements.get('foafos-feed')) return;

  class FoafosFeed extends HTMLElement {
    constructor() {
      super();
      this._unsubs = [];
      this.bus = null;
      this.registry = widgets;
    }

    connectedCallback() {
      if (!this._list) {
        this._list = document.createElement('div');
        this._list.setAttribute('role', 'feed');
        this.appendChild(this._list);
        this.addEventListener('foaf-action', (e) => {
          const { topic, data } = e.detail || {};
          if (topic && this.bus) this.bus.publish(topic, data ?? {}, { source: 'widget' });
        });
      }
      this._resubscribe();
    }

    disconnectedCallback() { this._unsubscribe(); }

    static get observedAttributes() { return ['topics']; }
    attributeChangedCallback() { if (this.isConnected) this._resubscribe(); }

    _topics() {
      return (this.getAttribute('topics') || '*').split(',').map(t => t.trim()).filter(Boolean);
    }

    _unsubscribe() { this._unsubs.forEach(u => u()); this._unsubs = []; }

    _resubscribe() {
      this._unsubscribe();
      if (!this.bus) return;
      for (const pattern of this._topics()) {
        this._unsubs.push(this.bus.subscribe(pattern, (ev) => this.push(ev), { replay: true }));
      }
    }

    push(ev) {
      const el = this.registry.materialize(ev);
      this._list.prepend(el);
      while (this._list.children.length > MAX_ITEMS) this._list.lastChild.remove();
    }
  }

  customElements.define('foafos-feed', FoafosFeed);
}
