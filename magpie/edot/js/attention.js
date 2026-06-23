// attention.js — "come back to this tab" indicator. When armed and the page is
// hidden (user switched to another window/tab — e.g. to create a GitHub token),
// it gently blinks the document title and swaps the favicon so the edot tab
// stands out in the tab strip. On return it stops, restores everything, and
// does a soft full-page flash to confirm. Auto-disarms after a timeout so it
// never nags forever. Respects prefers-reduced-motion.

const ATTENTION_ICON =
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="14" fill="#d2935a"/>' +
    '<text x="16" y="23" font-size="20" text-anchor="middle" fill="#1a1a1a">↩</text></svg>');

export class Attention {
  constructor({ timeoutMs = 5 * 60000, message = 'Back to edot' } = {}) {
    this.timeoutMs = timeoutMs;
    this.message = message;
    this._armed = false;
    this._blinking = false;
    this._onVis = () => this._visibility();
  }

  // Begin watching. If already hidden, start blinking immediately.
  // `once`: disarm automatically the first time the user returns (good for a
  // fire-and-forget jump). Otherwise stays armed across round-trips until
  // disarm() or the timeout (good while a dialog waits for a pasted token).
  arm(message, { once = false } = {}) {
    if (message) this.message = message;
    this._once = once;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.disarm(), this.timeoutMs);
    if (!this._armed) {
      this._armed = true;
      document.addEventListener('visibilitychange', this._onVis);
      window.addEventListener('blur', this._onVis);
      window.addEventListener('focus', this._onVis);
    }
    if (document.hidden) this._startBlink();
  }

  disarm() {
    if (!this._armed) return;
    this._armed = false;
    clearTimeout(this._timer);
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('blur', this._onVis);
    window.removeEventListener('focus', this._onVis);
    this._stopBlink();
  }

  _visibility() {
    if (document.hidden) this._startBlink();
    else if (this._blinking) { this._stopBlink(); this._flash(); if (this._once) this.disarm(); }
  }

  _startBlink() {
    if (this._blinking || !this._armed) return;
    this._blinking = true;
    this._origTitle = document.title;
    this._setIcon(ATTENTION_ICON);
    let on = false;
    this._blinkTimer = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 ${this.message}` : this._origTitle;
    }, 1100);
  }

  _stopBlink() {
    if (!this._blinking) return;
    this._blinking = false;
    clearInterval(this._blinkTimer);
    if (this._origTitle != null) document.title = this._origTitle;
    this._setIcon(null);
  }

  _setIcon(href) {
    let link = document.querySelector('link[rel~="icon"]');
    if (!href) {
      if (this._origIcon !== undefined) {
        if (link) { if (this._origIcon === null) link.remove(); else link.href = this._origIcon; }
        this._origIcon = undefined;
      }
      return;
    }
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); this._origIcon = null; }
    else if (this._origIcon === undefined) this._origIcon = link.href;
    link.href = href;
  }

  // Soft full-page tint that fades out — confirms "you're back here".
  _flash() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;background:#d2935a;opacity:0;transition:opacity .28s ease';
    document.body.appendChild(o);
    requestAnimationFrame(() => {
      o.style.opacity = '0.13';
      setTimeout(() => { o.style.opacity = '0'; setTimeout(() => o.remove(), 320); }, 240);
    });
  }
}
