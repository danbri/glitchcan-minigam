// a11y.js — assistive announcements & transient toasts.
// A single polite live region plus an assertive one keeps screen-reader
// chatter predictable instead of sprinkling aria-live across the DOM.

export class Announcer {
  constructor(doc = document) {
    this.polite = this._region(doc, 'polite');
    this.assertive = this._region(doc, 'assertive');
    this.toastEl = doc.createElement('div');
    this.toastEl.className = 'toast';
    this.toastEl.setAttribute('role', 'status');
    doc.body.appendChild(this.toastEl);
    this._toastTimer = null;
  }

  _region(doc, kind) {
    const el = doc.createElement('div');
    el.className = 'visually-hidden';
    el.setAttribute('aria-live', kind);
    el.setAttribute('aria-atomic', 'true');
    doc.body.appendChild(el);
    return el;
  }

  // Announce to screen readers only. Clearing first forces re-read of
  // identical consecutive messages.
  say(message, { assertive = false } = {}) {
    const region = assertive ? this.assertive : this.polite;
    region.textContent = '';
    // microtask gap so AT registers the change
    requestAnimationFrame(() => { region.textContent = message; });
  }

  // Visible toast + screen-reader announcement together.
  toast(message, { error = false, ms = 2600 } = {}) {
    this.toastEl.textContent = message;
    this.toastEl.classList.toggle('error', error);
    this.toastEl.classList.add('show');
    this.say(message, { assertive: error });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, ms);
  }
}
