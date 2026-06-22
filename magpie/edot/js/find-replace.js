// find-replace.js — find & replace over the editable surface.
//
// Matches are located as DOM Ranges and shown with the CSS Custom Highlight
// API (no DOM mutation, so it never disturbs the document model). Where that
// API is unavailable the current match still scrolls into view and is
// selected. Replace operates on live Ranges and routes through the editor's
// change pipeline so autosave and stats stay in sync.

const HAS_HIGHLIGHT = typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && CSS.highlights;

export class FindReplace {
  constructor(editor, announce) {
    this.editor = editor;
    this.announce = announce;
    this.matches = [];
    this.index = -1;
    this._build();
  }

  _build() {
    const bar = document.createElement('div');
    bar.className = 'find-bar';
    bar.setAttribute('role', 'search');
    bar.setAttribute('aria-label', 'Find and replace');
    bar.hidden = true;
    bar.innerHTML = `
      <div class="find-row">
        <input type="text" class="find-input" id="find-input" placeholder="Find" aria-label="Find" autocomplete="off">
        <span class="find-count" id="find-count" aria-live="polite">0/0</span>
        <button type="button" class="icon-btn" data-act="prev" aria-label="Previous match" title="Previous (Shift+Enter)">↑</button>
        <button type="button" class="icon-btn" data-act="next" aria-label="Next match" title="Next (Enter)">↓</button>
        <label class="find-case"><input type="checkbox" id="find-case"> Aa</label>
        <button type="button" class="icon-btn" data-act="close" aria-label="Close find" title="Close (Esc)">✕</button>
      </div>
      <div class="find-row find-replace-row">
        <input type="text" class="find-input" id="replace-input" placeholder="Replace with" aria-label="Replace with" autocomplete="off">
        <button type="button" class="tbtn" data-act="replace">Replace</button>
        <button type="button" class="tbtn" data-act="replaceAll">All</button>
      </div>`;
    document.body.appendChild(bar);
    this.bar = bar;
    this.findInput = bar.querySelector('#find-input');
    this.replaceInput = bar.querySelector('#replace-input');
    this.caseBox = bar.querySelector('#find-case');
    this.countEl = bar.querySelector('#find-count');
    this.replaceRow = bar.querySelector('.find-replace-row');

    this.findInput.addEventListener('input', () => this.search());
    this.caseBox.addEventListener('change', () => this.search());
    this.findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? this.prev() : this.next(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.replaceOne(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    bar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      ({ prev: () => this.prev(), next: () => this.next(), close: () => this.close(),
         replace: () => this.replaceOne(), replaceAll: () => this.replaceAll() }[act.dataset.act] || (() => {}))();
    });
  }

  open(withReplace = false) {
    this.bar.hidden = false;
    this.replaceRow.hidden = !withReplace;
    const sel = window.getSelection();
    const seed = sel && !sel.isCollapsed ? sel.toString().slice(0, 200) : '';
    if (seed) this.findInput.value = seed;
    this.findInput.focus();
    this.findInput.select();
    this.search();
  }

  close() {
    this.bar.hidden = true;
    this._clearHighlights();
    this.editor.focus();
  }

  _clearHighlights() {
    if (HAS_HIGHLIGHT) { CSS.highlights.delete('edot-find'); CSS.highlights.delete('edot-find-current'); }
  }

  // Collect fresh Ranges for the query (recomputed each op so edits can't
  // leave stale ranges behind).
  _collect() {
    const q = this.findInput.value;
    const ranges = [];
    if (!q) return ranges;
    const cs = this.caseBox.checked;
    const needle = cs ? q : q.toLowerCase();
    const walker = document.createTreeWalker(this.editor.el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const hay = cs ? node.nodeValue : node.nodeValue.toLowerCase();
      let from = 0, at;
      while ((at = hay.indexOf(needle, from)) !== -1) {
        const r = document.createRange();
        r.setStart(node, at);
        r.setEnd(node, at + q.length);
        ranges.push(r);
        from = at + Math.max(1, q.length);
      }
    }
    return ranges;
  }

  search(keepIndex = false) {
    this.matches = this._collect();
    if (!keepIndex) this.index = this.matches.length ? 0 : -1;
    this._render();
  }

  _render() {
    this._clearHighlights();
    if (HAS_HIGHLIGHT && this.matches.length) {
      CSS.highlights.set('edot-find', new Highlight(...this.matches));
      if (this.index >= 0) CSS.highlights.set('edot-find-current', new Highlight(this.matches[this.index]));
    }
    const n = this.matches.length;
    this.countEl.textContent = n ? `${this.index + 1}/${n}` : '0/0';
    if (this.index >= 0 && this.matches[this.index]) {
      const r = this.matches[this.index];
      const el = r.startContainer.parentElement;
      el && el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (!HAS_HIGHLIGHT) {
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r.cloneRange());
      }
    }
  }

  next() { if (this.matches.length) { this.index = (this.index + 1) % this.matches.length; this._render(); } }
  prev() { if (this.matches.length) { this.index = (this.index - 1 + this.matches.length) % this.matches.length; this._render(); } }

  replaceOne() {
    this.search(true);
    if (this.index < 0 || !this.matches[this.index]) { this.announce('No match to replace'); return; }
    const r = this.matches[this.index];
    r.deleteContents();
    if (this.replaceInput.value) r.insertNode(document.createTextNode(this.replaceInput.value));
    this.editor.onChange();
    this.search(true);
    if (this.index >= this.matches.length) this.index = this.matches.length - 1;
    this._render();
    this.next();
  }

  replaceAll() {
    const all = this._collect();
    if (!all.length) { this.announce('Nothing to replace'); return; }
    const rep = this.replaceInput.value;
    // Replace from last to first so earlier ranges stay valid.
    for (let i = all.length - 1; i >= 0; i--) {
      const r = all[i];
      r.deleteContents();
      if (rep) r.insertNode(document.createTextNode(rep));
    }
    this.editor.onChange();
    this.announce(`Replaced ${all.length} ${all.length === 1 ? 'match' : 'matches'}`);
    this.search();
  }
}
