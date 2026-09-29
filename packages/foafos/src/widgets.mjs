// The foafos widget contract.
//
// A widget is a custom element that renders one item (usually a bus event)
// and satisfies:
//
//   set item(obj)     — the record to render; re-render on set
//   emits 'foaf-action' CustomEvents (bubbling, composed) with
//     detail: { topic, data } — the shell forwards these to the bus
//
// The registry maps an item KIND (its bus topic, or a media type for
// typed content blocks) to an element tag. Longest 'prefix.*' wins;
// unresolved kinds fall back to the generic card, so a feed can always
// render everything it is shown.

export class WidgetRegistry {
  constructor() {
    this._byKind = new Map();
    this.fallback = 'foaf-card';
  }

  register(kind, tagName) { this._byKind.set(kind, tagName); }

  resolve(kind) {
    if (this._byKind.has(kind)) return this._byKind.get(kind);
    let best = null;
    for (const [k, tag] of this._byKind) {
      if (k.endsWith('.*') && kind.startsWith(k.slice(0, -1))) {
        if (!best || k.length > best.k.length) best = { k, tag };
      }
    }
    return best?.tag ?? this.fallback;
  }

  // item → a ready element (browser only)
  materialize(item) {
    const tag = this.resolve(item.topic ?? item.mediaType ?? '');
    const el = document.createElement(customElements.get(tag) ? tag : this.fallback);
    el.item = item;
    return el;
  }
}

export const widgets = new WidgetRegistry();

// The generic card: renders any bus event as a social-feed entry —
// icon, topic, relative time, summary line, expandable raw data.
export function defineBaseCards() {
  if (typeof customElements === 'undefined' || customElements.get('foaf-card')) return;

  const ICONS = [
    ['story.', '📖'], ['minigame.', '🎮'], ['wm.', '🪟'],
    ['session.', '👤'], ['audio.', '🔊'], ['net.', '📡'],
  ];

  class FoafCard extends HTMLElement {
    set item(ev) {
      this._item = ev;
      this._render();
    }
    get item() { return this._item; }

    _summary(ev) {
      const d = ev.data || {};
      return d.summary || d.text || d.title || d.name ||
        Object.entries(d).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' · ') ||
        '—';
    }

    _render() {
      const ev = this._item;
      if (!ev) return;
      // feed children are articles with accessible names (role=feed contract)
      this.setAttribute('role', 'article');
      this.setAttribute('aria-label', `${ev.topic} at ${new Date(ev.ts).toLocaleTimeString()}: ${this._summary(ev)}`);
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; }
            .card {
              border: 1px solid rgba(255,255,255,0.18);
              border-left: 3px solid var(--foaf-accent, #00e5ff);
              border-radius: 6px;
              padding: 0.45em 0.6em;
              margin: 0.35em 0;
              background: rgba(255,255,255,0.04);
              font-size: 0.85em;
              line-height: 1.35;
            }
            .head { display: flex; gap: 0.4em; align-items: baseline; opacity: 0.75; font-size: 0.85em; }
            .topic { font-weight: bold; letter-spacing: 0.02em; }
            .when { margin-left: auto; white-space: nowrap; }
            .summary { margin-top: 0.15em; word-break: break-word; }
            details { margin-top: 0.2em; opacity: 0.7; }
            pre { white-space: pre-wrap; word-break: break-all; font-size: 0.85em; margin: 0.2em 0 0; }
          </style>
          <div class="card">
            <div class="head"><span class="icon"></span><span class="topic"></span><span class="when"></span></div>
            <div class="summary"></div>
            <details><summary>data</summary><pre></pre></details>
          </div>`;
      }
      const $ = (s) => this.shadowRoot.querySelector(s);
      $('.icon').textContent = ICONS.find(([p]) => ev.topic.startsWith(p))?.[1] ?? '•';
      $('.topic').textContent = ev.topic;
      $('.when').textContent = new Date(ev.ts).toLocaleTimeString();
      $('.summary').textContent = this._summary(ev);
      $('pre').textContent = JSON.stringify(ev.data ?? {}, null, 1);
    }
  }

  customElements.define('foaf-card', FoafCard);
}

// The activity card: one thing someone said or did, as a social stream
// shows it (owner, September 2026: "a generic Activity Stream like
// Facebook / FriendFeed had"). Renders `activity.<app>` events:
//   { who, text, image?, app?, verb? }
// `image` is a data: URL the shell has already checked (a face, a still);
// without one the card shows the speaker's initial. Registered for
// `activity.*`, so any feed that subscribes to it shows people, not topics.
export function defineActivityCard() {
  if (typeof customElements === 'undefined' || customElements.get('foaf-activity')) return;

  class FoafActivity extends HTMLElement {
    set item(ev) { this._item = ev; this._render(); }
    get item() { return this._item; }

    _render() {
      const ev = this._item;
      if (!ev) return;
      const d = ev.data || {};
      const who = String(d.who || d.app || 'Someone');
      const text = String(d.text || d.summary || '');
      this.setAttribute('role', 'article');
      this.setAttribute('aria-label', `${who}${d.app && d.app !== who ? ` (${d.app})` : ''}: ${text}`);
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; }
            .row { display: flex; gap: 0.55em; align-items: flex-start; margin: 0.35em 0;
                   padding: 0.45em 0.55em; border-radius: 10px;
                   background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); }
            .face { flex: none; width: 2.6em; height: 2.6em; border-radius: 50%; overflow: hidden;
                    display: grid; place-items: center; background: #223; color: #cde;
                    font-weight: bold; border: 1px solid rgba(255,255,255,0.25); }
            .face img { width: 100%; height: 100%; object-fit: cover; }
            :host([live]) .face { width: 4.2em; height: 4.2em; border-radius: 12px; }
            .body { min-width: 0; font-size: 0.88em; line-height: 1.35; }
            .who { font-weight: bold; }
            .meta { opacity: 0.6; font-size: 0.85em; margin-left: 0.35em; font-weight: normal; }
            .text { word-break: break-word; }
          </style>
          <div class="row"><div class="face" aria-hidden="true"></div>
            <div class="body"><div class="who"></div><div class="text" part="text"></div></div></div>`;
      }
      const $ = (s) => this.shadowRoot.querySelector(s);
      const face = $('.face');
      face.textContent = '';
      this.liveCanvas = null;
      if (d.live && !d.image) {
        // a live face: the shell draws the app's frames here (liveCanvas)
        const cv = document.createElement('canvas');
        cv.width = 96; cv.height = 96;
        cv.style.width = '100%'; cv.style.height = '100%';
        face.appendChild(cv);
        this.liveCanvas = cv;
      } else if (typeof d.image === 'string' && d.image.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = d.image;
        face.appendChild(img);
      } else {
        face.textContent = who.trim().charAt(0).toUpperCase() || '•';
      }
      const whoEl = $('.who');
      whoEl.textContent = who;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${d.app && d.app !== who ? `${d.app} · ` : ''}${new Date(ev.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      whoEl.appendChild(meta);
      $('.text').textContent = text;
    }
  }

  customElements.define('foaf-activity', FoafActivity);
  widgets.register('activity.*', 'foaf-activity');
}
