// place-input.js — <edot-place-input>: an accessible place autocomplete that
// returns names PLUS Wikidata QIDs.
//
// Lazy at two levels: a host page loads this module on demand, and the element
// itself only import()s the places facade when the user actually starts typing —
// so dropping <edot-place-input> on a page (a calendar event's location, a mail
// signature, a doc reference) costs ~nothing until someone uses it.
//
// Implements the WAI-ARIA combobox/listbox pattern (role=combobox on the input,
// aria-expanded, aria-controls, aria-activedescendant; role=listbox/option on the
// menu). On choose it fires `place-selected` with the normalized Place as detail:
//   { name, wikidataId, lat, lon, kind, description, source(s) }
// Coordinates are filled lazily on selection (Wikidata P625) when the chosen hit
// had a QID but no coords.
//
// Attributes: sources="wikidata,local-seed" · limit="8" · placeholder="…"
// Property:   .config = { geonames: { username } }   (per-source options)
// Property:   .selectedPlace  (the last chosen Place, or null)
// Styling:    css/place-input.css (scoped to the element).

let _seq = 0;

export class EdotPlaceInput extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this._debounce = 200;
    this._selected = null;
    this._config = this._config || {};
    this._active = -1;
    this._results = [];

    const limit = Number(this.getAttribute('limit')) || 8;
    this._limit = limit;
    const sourcesAttr = this.getAttribute('sources');
    this._sources = sourcesAttr ? sourcesAttr.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const listId = `pl-list-${++_seq}`;
    this.innerHTML = `
      <input class="pl-input" type="text" role="combobox" aria-autocomplete="list"
             aria-expanded="false" aria-controls="${listId}" autocomplete="off"
             placeholder="${(this.getAttribute('placeholder') || 'Search for a place…').replace(/"/g, '&quot;')}">
      <ul class="pl-list" id="${listId}" role="listbox" hidden></ul>`;
    this.input = this.querySelector('.pl-input');
    this.list = this.querySelector('.pl-list');
    if (this._pendingValue != null) { this.input.value = this._pendingValue; this._pendingValue = null; }

    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));
    this.input.addEventListener('blur', () => setTimeout(() => this._close(), 120)); // allow option click
    this.list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) { e.preventDefault(); this._select(this._results[Number(li.dataset.i)]); }
    });
  }

  get selectedPlace() { return this._selected; }
  set config(c) { this._config = c || {}; }
  get config() { return this._config; }

  // Proxy the inner field's text, so a host can read/seed it like a plain input
  // (the calendar reads location.value). Tolerates being set before upgrade.
  get value() { return this.input ? this.input.value : (this._pendingValue || ''); }
  set value(v) { if (this.input) this.input.value = v == null ? '' : v; else this._pendingValue = v; }

  _facade() { return (this.__facade ||= import('./places.js')); }

  _onInput() {
    this._selected = null;
    clearTimeout(this._t);
    this._t = setTimeout(() => this._run(this.input.value), this._debounce);
  }

  async _run(q) {
    this._abort?.abort();
    if (!q.trim()) { this._close(); return; }
    const ac = new AbortController();
    this._abort = ac;
    let results;
    try {
      const { searchPlaces } = await this._facade();
      // Paint each source's results as they arrive (offline/cached first), so the
      // dropdown never waits on a slow API; ignore updates from a superseded call.
      const onUpdate = (partial) => { if (!ac.signal.aborted) { this._results = partial; this._render(partial); } };
      results = await searchPlaces(q, { sources: this._sources, limit: this._limit, signal: ac.signal, config: this._config, onUpdate });
    } catch (_) { this._close(); return; }
    if (ac.signal.aborted) return; // a newer keystroke superseded this one
    this._results = results;
    this._render(results);
  }

  _render(results) {
    if (!results.length) { this._close(); return; }
    this.list.innerHTML = results.map((p, i) => {
      const qid = p.wikidataId ? `<span class="pl-qid" title="Wikidata id">${p.wikidataId}</span>` : '';
      const desc = p.description ? `<span class="pl-desc">${esc(p.description)}</span>` : '';
      return `<li role="option" id="pl-opt-${_seq}-${i}" data-i="${i}" aria-selected="false">
        <span class="pl-name">${esc(p.name)}</span>${desc}${qid}</li>`;
    }).join('');
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this._active = -1;
    this.input.removeAttribute('aria-activedescendant');
  }

  _close() {
    this.list.hidden = true;
    this.list.innerHTML = '';
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this._active = -1;
  }

  _move(delta) {
    if (this.list.hidden || !this._results.length) return;
    const n = this._results.length;
    this._active = (this._active + delta + n) % n;
    [...this.list.children].forEach((li, i) => {
      const on = i === this._active;
      li.setAttribute('aria-selected', String(on));
      li.classList.toggle('active', on);
    });
    const el = this.list.children[this._active];
    if (el) { this.input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
  }

  _onKeydown(e) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this._move(1); break;
      case 'ArrowUp': e.preventDefault(); this._move(-1); break;
      case 'Enter':
        if (!this.list.hidden && this._active >= 0) { e.preventDefault(); this._select(this._results[this._active]); }
        break;
      case 'Escape': if (!this.list.hidden) { e.preventDefault(); this._close(); } break;
      default: break;
    }
  }

  async _select(place) {
    if (!place) return;
    this._selected = place;
    this.input.value = place.name;
    this._close();
    // Fill coordinates lazily if we only had a QID (Wikidata search has no coords).
    if (place.lat == null && place.wikidataId) {
      try {
        const { coordsFor } = await this._facade();
        const c = await coordsFor(place.wikidataId);
        if (c) { place.lat = c.lat; place.lon = c.lon; }
      } catch (_) { /* coords are best-effort */ }
    }
    this.dispatchEvent(new CustomEvent('place-selected', { detail: place, bubbles: true }));
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

customElements.define('edot-place-input', EdotPlaceInput);
