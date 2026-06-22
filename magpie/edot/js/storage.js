// storage.js — debounced localStorage autosave for the working document.
// One slot keeps the in-progress doc so a refresh never loses work; the
// editor still owns explicit file open/save for real persistence.

const KEY = 'edot.doc.v1';

export class Storage {
  constructor(delay = 600) {
    this.delay = delay;
    this._timer = null;
    this.available = (() => {
      try { localStorage.setItem('edot.probe', '1'); localStorage.removeItem('edot.probe'); return true; }
      catch (_) { return false; }
    })();
  }

  load() {
    if (!this.available) return null;
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  // Debounced; resolves the autosave race when typing fast.
  save(doc) {
    if (!this.available) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...doc, savedAt: Date.now() }));
      } catch (_) { /* quota or blocked — non-fatal */ }
    }, this.delay);
  }

  clear() {
    if (!this.available) return;
    try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
  }
}
