// carousel.js — keyboard-first thumbnail strip, shared by the avatar and
// room pickers. ←/→ or A/D (and ↑/↓, W/S) move the cursor with wrap,
// space/enter selects, click selects and refocuses the strip. Tiles start
// as a glyph; setThumb(id, dataUrl) swaps in a rendered image later.
export function makeCarousel(el, items, onSelect) {
  let cursor = 0;
  const byId = new Map();
  const updateCursor = () => {
    items.forEach((it, i) => it._tile.classList.toggle('cursor', i === cursor));
    items[cursor]._tile.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };
  const select = (id) => {
    items.forEach(it => it._tile.classList.toggle('selected', it.id === id));
    onSelect(id);
  };
  items.forEach((it, i) => {
    const tile = document.createElement('div');
    tile.className = 'car-tile';
    tile.setAttribute('role', 'option');
    const g = document.createElement('div');
    g.className = 'glyph';
    g.textContent = it.glyph || '▦';
    tile.appendChild(g);
    it._thumbEl = g;
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = it.name;
    tile.appendChild(nm);
    tile.addEventListener('click', () => { cursor = i; updateCursor(); select(it.id); el.focus(); });
    it._tile = tile;
    byId.set(it.id, it);
    el.appendChild(tile);
  });
  el.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    let d = 0;
    if (k === 'arrowleft' || k === 'a' || k === 'arrowup' || k === 'w') d = -1;
    else if (k === 'arrowright' || k === 'd' || k === 'arrowdown' || k === 's') d = 1;
    else if (k === ' ' || k === 'enter') { e.preventDefault(); select(items[cursor].id); return; }
    else return;
    e.preventDefault();
    cursor = (cursor + d + items.length) % items.length;
    updateCursor();
  });
  updateCursor();
  return {
    select,
    setThumb(id, src) {
      const it = byId.get(id);
      if (!it) return;
      if (it._thumbEl.tagName !== 'IMG') {
        const img = document.createElement('img');
        img.alt = it.name;
        it._thumbEl.replaceWith(img);
        it._thumbEl = img;
      }
      it._thumbEl.src = src;
    },
  };
}
