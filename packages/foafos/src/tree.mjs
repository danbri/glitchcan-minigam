// <foaf-tree> — the shell's standard tree/tree-table explorer.
//
// Same doctrine as <foaf-table>: apps hand the shell plain data; this
// trusted, uniformly-skinned component presents it with the
// accessibility pooled once — role=tree/treeitem/group, aria-expanded,
// arrow-key navigation (Up/Down walk, Right expands, Left collapses),
// Enter/Space selects. Rows carry an optional badge column and optional
// per-row action buttons, so list-y UI stops being bespoke chip soup.
//
//   tree.data = [
//     { id: 'story', icon: '📖', label: 'Story' },
//     { id: 'widgets', icon: '🧩', label: 'Widgets', badge: '2', children: [
//       { id: 'w1', label: 'Tally · 1', actions: [{ id: 'close', icon: '✕', label: 'Close' }] },
//     ]},
//   ];
//   tree.addEventListener('tree-select', e => e.detail.id);
//   tree.addEventListener('tree-action', e => e.detail);  // { id, action }

export function defineTree() {
  if (typeof customElements === 'undefined' || customElements.get('foaf-tree')) return;

  class FoafTree extends HTMLElement {
    constructor() {
      super();
      this._nodes = [];
      this._open = new Set();
    }

    set data(nodes) {
      this._nodes = nodes || [];
      for (const n of this._nodes) {
        if (n.children && !n.collapsed) this._open.add(n.id);
      }
      this._render();
    }
    get data() { return this._nodes; }

    _render() {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font: 12px/1.5 monospace; color: #eee; }
            ul { list-style: none; margin: 0; padding: 0; }
            ul ul { padding-left: 1.1em; }
            .row {
              display: flex; align-items: center; gap: 0.45em;
              padding: 0.25em 0.4em; border-radius: 5px; cursor: pointer;
            }
            .row:hover { background: rgba(0, 229, 255, 0.12); }
            li:focus { outline: none; }
            li:focus > .row { outline: 2px solid #0ef; outline-offset: -2px; }
            .twist { width: 1em; text-align: center; opacity: 0.6; flex-shrink: 0; }
            .icon { flex-shrink: 0; }
            .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .badge {
              font-size: 0.85em; opacity: 0.75; background: rgba(255,255,255,0.1);
              border-radius: 999px; padding: 0 0.55em; flex-shrink: 0;
            }
            .act {
              all: unset; cursor: pointer; opacity: 0.55; padding: 0 0.25em;
              border-radius: 4px; flex-shrink: 0;
            }
            .act:hover, .act:focus-visible { opacity: 1; outline: 1px solid #0ef; }
          </style>
          <ul role="tree"></ul>`;
        this.shadowRoot.querySelector('[role=tree]').addEventListener('keydown', (e) => this._key(e));
      }
      const root = this.shadowRoot.querySelector('[role=tree]');
      root.setAttribute('aria-label', this.getAttribute('label') || 'tree');
      root.textContent = '';
      this._nodes.forEach(n => root.appendChild(this._item(n)));
      const first = root.querySelector('[role=treeitem]');
      if (first) first.tabIndex = 0;
    }

    _item(node) {
      const li = document.createElement('li');
      li.setAttribute('role', 'treeitem');
      li.dataset.id = node.id;
      li.tabIndex = -1;
      const open = this._open.has(node.id);
      if (node.children) li.setAttribute('aria-expanded', String(open));

      const row = document.createElement('div');
      row.className = 'row';
      const twist = document.createElement('span');
      twist.className = 'twist';
      twist.textContent = node.children ? (open ? '▾' : '▸') : '';
      row.appendChild(twist);
      if (node.icon) {
        const ic = document.createElement('span');
        ic.className = 'icon'; ic.textContent = node.icon; ic.setAttribute('aria-hidden', 'true');
        row.appendChild(ic);
      }
      const lb = document.createElement('span');
      lb.className = 'label'; lb.textContent = node.label;
      row.appendChild(lb);
      if (node.badge) {
        const bd = document.createElement('span');
        bd.className = 'badge'; bd.textContent = node.badge;
        row.appendChild(bd);
      }
      for (const act of node.actions || []) {
        const b = document.createElement('button');
        b.className = 'act'; b.type = 'button';
        b.textContent = act.icon || act.label;
        b.setAttribute('aria-label', `${act.label}: ${node.label}`);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dispatchEvent(new CustomEvent('tree-action',
            { detail: { id: node.id, action: act.id }, bubbles: true, composed: true }));
        });
        row.appendChild(b);
      }
      row.addEventListener('click', () => {
        if (node.children) this._toggle(node.id);
        else this._select(node.id);
      });
      li.appendChild(row);

      if (node.children && open) {
        const group = document.createElement('ul');
        group.setAttribute('role', 'group');
        node.children.forEach(c => group.appendChild(this._item(c)));
        li.appendChild(group);
      }
      return li;
    }

    _select(id) {
      this.dispatchEvent(new CustomEvent('tree-select',
        { detail: { id }, bubbles: true, composed: true }));
    }
    _toggle(id) {
      this._open.has(id) ? this._open.delete(id) : this._open.add(id);
      this._render();
    }

    _key(e) {
      const items = [...this.shadowRoot.querySelectorAll('[role=treeitem]')];
      const cur = this.shadowRoot.activeElement?.closest?.('[role=treeitem]') || items[0];
      const i = items.indexOf(cur);
      const focus = (el) => { if (el) { items.forEach(x => x.tabIndex = -1); el.tabIndex = 0; el.focus(); } };
      const node = this._find(cur?.dataset.id);
      if (e.key === 'ArrowDown') { focus(items[i + 1]); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { focus(items[i - 1]); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && node?.children && !this._open.has(node.id)) { this._toggle(node.id); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && node?.children && this._open.has(node.id)) { this._toggle(node.id); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') {
        node?.children ? this._toggle(node.id) : this._select(node.id);
        e.preventDefault();
      }
    }

    _find(id, nodes = this._nodes) {
      for (const n of nodes) {
        if (n.id === id) return n;
        const hit = n.children && this._find(id, n.children);
        if (hit) return hit;
      }
      return null;
    }
  }

  customElements.define('foaf-tree', FoafTree);
}
