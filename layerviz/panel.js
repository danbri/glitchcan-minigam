/**
 * panel.js — make an overlay info panel draggable by its header, so UI
 * that blocks the visuals can be moved aside. Pointer Events (mouse,
 * touch, pen). A small dead zone keeps plain taps working as clicks
 * (e.g. collapse-on-tap): a press that moves less than the threshold is
 * a click; more is a drag, and the click that follows it is swallowed.
 */
export function makeDraggablePanel(panel, header) {
  let drag = null;
  let moved = 0;
  let swallowClick = false;
  header.style.touchAction = 'none';

  header.addEventListener('pointerdown', e => {
    const r = panel.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    moved = 0;
    try { header.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  });

  header.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved < 6) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const left = Math.min(Math.max(drag.left + dx, 4 - w * 0.8),
      window.innerWidth - 40);
    const top = Math.min(Math.max(drag.top + dy, 0),
      window.innerHeight - 40);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  const end = () => {
    if (drag && moved >= 6) swallowClick = true;
    drag = null;
  };
  header.addEventListener('pointerup', end);
  header.addEventListener('pointercancel', end);

  header.addEventListener('click', e => {
    if (swallowClick) {
      swallowClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}
