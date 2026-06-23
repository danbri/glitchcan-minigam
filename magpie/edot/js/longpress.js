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
    const r = el.getBoundingClientRect();
    t.style.left = `${Math.round(r.left + r.width / 2)}px`;
    t.style.top = `${Math.round(r.bottom + 8)}px`;
    t.classList.add('show');
  };
  const hide = () => { if (_tip) _tip.classList.remove('show'); };
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
