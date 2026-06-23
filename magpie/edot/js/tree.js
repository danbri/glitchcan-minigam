// tree.js — <edot-tree>: a reusable, accessible, collapsible disclosure tree for
// deep hierarchies (the "clicky open/closey" widget). Light DOM so it shares the
// page stylesheet, like edot's other components. Folders expand/collapse on click;
// leaves invoke an `onActivate` callback. ARIA tree semantics + roving-focus
// keyboard nav (Up/Down between visible rows, Right/Left expand/collapse,
// Enter/Space activate, Home/End).
//
// Data shape — setData(nodes), where each node is:
//   { label, icon?, note?, expanded?, children?: [node…], onActivate?: () => void }
// A node with `children` renders as a folder; otherwise it's an activatable leaf.

export class EdotTree extends HTMLElement {
  setData(nodes) { this._nodes = nodes || []; this._render(); }

  connectedCallback() { if (!this._built) this._render(); }

  _render() {
    this._built = true;
    this.innerHTML = '';
    const root = document.createElement('ul');
    root.className = 'tree'; root.setAttribute('role', 'tree');
    (this._nodes || []).forEach((n) => root.appendChild(this._node(n, 1)));
    this.appendChild(root);
    this.addEventListener('keydown', (e) => this._onKey(e));
    // Roving focus: exactly one row is tab-focusable at a time.
    const rows = this._allRows();
    rows.forEach((r, i) => { r.tabIndex = i === 0 ? 0 : -1; });
  }

  _node(n, level) {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    const isFolder = Array.isArray(n.children);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tree-row ' + (isFolder ? 'tree-folder' : 'tree-leaf');
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(level));

    if (isFolder) {
      const tw = document.createElement('span'); tw.className = 'tree-twisty';
      tw.textContent = n.expanded ? '▾' : '▸'; tw.setAttribute('aria-hidden', 'true');
      row.appendChild(tw);
    }
    if (n.icon) { const ic = document.createElement('span'); ic.className = 'tree-icon'; ic.textContent = n.icon; ic.setAttribute('aria-hidden', 'true'); row.appendChild(ic); }
    const lab = document.createElement('span'); lab.className = 'tree-label'; lab.textContent = n.label; row.appendChild(lab);
    if (n.note) { const nt = document.createElement('span'); nt.className = 'tree-note'; nt.textContent = n.note; row.appendChild(nt); }
    li.appendChild(row);

    if (isFolder) {
      const group = document.createElement('ul'); group.className = 'tree-group'; group.setAttribute('role', 'group');
      n.children.forEach((c) => group.appendChild(this._node(c, level + 1)));
      row.setAttribute('aria-expanded', String(!!n.expanded));
      group.hidden = !n.expanded;
      li.appendChild(group);
      row.addEventListener('click', () => this._toggle(row, group));
    } else {
      row.addEventListener('click', () => { if (typeof n.onActivate === 'function') n.onActivate(); });
    }
    return li;
  }

  _toggle(row, group) {
    const open = row.getAttribute('aria-expanded') === 'true';
    row.setAttribute('aria-expanded', String(!open));
    group.hidden = open;
    const tw = row.querySelector('.tree-twisty'); if (tw) tw.textContent = open ? '▸' : '▾';
  }

  // All rows, document order; visible rows are those with a laid-out ancestor.
  _allRows() { return [...this.querySelectorAll('.tree-row')]; }
  _visibleRows() { return this._allRows().filter((r) => r.offsetParent !== null); }

  _focus(row) {
    this._allRows().forEach((r) => { r.tabIndex = -1; });
    row.tabIndex = 0; row.focus();
  }

  _onKey(e) {
    const rows = this._visibleRows();
    const i = rows.indexOf(document.activeElement);
    if (i < 0) return;
    const row = rows[i];
    const expanded = row.getAttribute('aria-expanded');
    if (e.key === 'ArrowDown') { e.preventDefault(); this._focus(rows[i + 1] || rows[0]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._focus(rows[i - 1] || rows[rows.length - 1]); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (expanded === 'false') row.click(); else if (rows[i + 1]) this._focus(rows[i + 1]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (expanded === 'true') row.click(); }
    else if (e.key === 'Home') { e.preventDefault(); this._focus(rows[0]); }
    else if (e.key === 'End') { e.preventDefault(); this._focus(rows[rows.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('edot-tree')) {
  customElements.define('edot-tree', EdotTree);
}
