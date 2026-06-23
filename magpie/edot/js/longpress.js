// longpress.js — shared "press-and-hold to reveal a readable label" used by
// both the editor toolbar and the data workspace, so the two surfaces behave
// identically. A single floating tooltip is reused. The held element gets a
// transient `_peek` flag so the click handler can skip the action (a safe
// peek). Pure DOM, no deps.

let _tip = null;
function tipEl() {
  if (!_tip) { _tip = document.createElement('div'); _tip.className = 'hold-tip'; document.body.appendChild(_tip); }
  return _tip;
}

export function holdLabel(el, getText, { delay = 420 } = {}) {
  let timer = null;
  const show = () => {
    const t = tipEl();
    t.textContent = typeof getText === 'function' ? getText() : getText;
    el.classList.add('holding');      // grow the held control: clear what you're peeking
    t.classList.add('show');          // show first so width/height are measurable
    const r = el.getBoundingClientRect();
    const m = 8;                      // keep this far from the viewport edge
    const tw = t.offsetWidth, th = t.offsetHeight;
    // Horizontal: centre on the control but never run off either edge (the
    // half-offscreen, left-handed case). translateX(-50%) places by centre.
    const cx = Math.max(m + tw / 2, Math.min(r.left + r.width / 2, window.innerWidth - m - tw / 2));
    // Vertical: float ABOVE the control by default, clear of a thumb pressing
    // up from below; drop below only when there's no room (e.g. a top toolbar).
    const above = r.top - th - 10;
    const top = above >= m ? above : r.bottom + 10;
    t.style.left = `${Math.round(cx)}px`;
    t.style.top = `${Math.round(top)}px`;
  };
  const hide = () => { el.classList.remove('holding'); if (_tip) _tip.classList.remove('show'); };
  const start = () => { el._peek = false; timer = setTimeout(() => { timer = null; el._peek = true; show(); }, delay); };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    hide();
    if (el._peek) setTimeout(() => { el._peek = false; }, 0); // self-heal if no click consumed it
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
}

// True if the element's last interaction was a long-press peek (and clears it).
export function consumedPeek(el) { if (el._peek) { el._peek = false; return true; } return false; }
