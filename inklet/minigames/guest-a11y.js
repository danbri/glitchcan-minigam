/**
 * guest-a11y.js — the accessibility a guest gets for free.
 *
 *     <script src="../guest-a11y.js"></script>
 *
 * Every packaged guest audited 2026-07 had ZERO aria attributes and no
 * live region. A canvas game is opaque to assistive tech by
 * construction: there is nothing in the DOM to read, so a screen-reader
 * user gets an unlabelled box and silence. That is not fixable by
 * sprinkling roles — it needs the game to SAY things — so this module
 * gives every guest one cheap way to say them, and pools the result.
 *
 * What it installs:
 *   · an sr-only `role="status" aria-live="polite"` region
 *   · an sr-only <h1> from the document title, so the frame has a heading
 *   · `aria-label` + `role="img"` on the primary canvas, kept current by
 *     an optional describer, so at least "what is this" is answerable
 *   · `window.__mgA11y.announce(text)` for game events
 *
 * Announcements go to BOTH the local live region and (via postMessage)
 * the host's `#foafos-announcer`. A guest lives in a sandboxed iframe;
 * its live region does work, but the pooled host announcer is the one
 * the player already has focus near, and it survives the guest closing.
 *
 * Announce STATE CHANGES, not frames. "3 gems left, 12 seconds" on a
 * timer is noise; "last gem" is information.
 */
(function () {
  if (window.__mgA11y) return;

  // `position:absolute` with no offsets keeps the element's STATIC
  // position — i.e. after all the content — so a 1px live region parked
  // at the end of a full-height body made body.scrollHeight exceed
  // innerHeight by a few pixels. Measured: every guest was 4px over.
  // Invisible with `overflow:hidden`, but it is a guest that does not fit
  // its own frame, and in a short split pane that is exactly the class of
  // bug that clips a game board. Pin it to the origin: a hidden live
  // region has no business having a place in the layout.
  const SR_ONLY = 'position:absolute;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;' +
                  'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);' +
                  'white-space:nowrap;border:0;';

  let statusEl = null;
  let lastText = '';
  let lastAt = 0;

  function ensure() {
    if (statusEl) return statusEl;
    statusEl = document.createElement('div');
    statusEl.id = 'mg-a11y-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('aria-atomic', 'true');
    statusEl.style.cssText = SR_ONLY;
    document.body.appendChild(statusEl);

    if (!document.querySelector('h1')) {
      const h = document.createElement('h1');
      h.textContent = document.title || 'Minigame';
      h.style.cssText = SR_ONLY;
      document.body.insertBefore(h, document.body.firstChild);
    }
    return statusEl;
  }

  /**
   * Say something once. Repeats within 1.5s are dropped — a game loop
   * that announces every frame is worse than silence, because a screen
   * reader will never finish a sentence.
   */
  function announce(text, { force = false } = {}) {
    if (!text) return;
    const now = Date.now();
    if (!force && text === lastText && now - lastAt < 1500) return;
    lastText = text; lastAt = now;
    ensure().textContent = text;
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'announce', text: String(text).slice(0, 300) }, '*');
      }
    } catch (e) { /* detached */ }
  }

  /**
   * Label the game surface. `describe` is called on demand (and on a
   * slow poll) so the label answers "what is on screen now" rather than
   * "what was on screen when the page loaded".
   */
  function describeCanvas(canvas, describe) {
    const c = canvas || document.querySelector('canvas');
    if (!c) return;
    c.setAttribute('role', 'img');
    if (!c.hasAttribute('aria-label')) {
      c.setAttribute('aria-label', document.title || 'Game view');
    }
    if (typeof describe !== 'function') return;
    const tick = () => {
      try {
        const t = describe();
        if (t) c.setAttribute('aria-label', t);
      } catch (e) { /* a describer must never break the game */ }
    };
    tick();
    setInterval(tick, 2000);
  }

  window.__mgA11y = { announce, describeCanvas, get region() { return ensure(); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure);
  } else {
    ensure();
  }
})();
