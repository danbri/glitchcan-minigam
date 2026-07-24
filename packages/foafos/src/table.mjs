// <foaf-table> — the shell's standard table explorer.
//
// Apps compute; standard widgets present. An untrusted guest hands the
// shell {title, columns, rows} over the bus and the SHELL renders it in
// this trusted, uniformly-skinned, accessibility-pooled component:
// real <table> semantics, a <caption>, scoped sortable column headers
// (buttons with aria-sort), keyboard-operable throughout. Every app that
// adopts it gets the same a11y and the same look for free — instead of
// each app growing its own divs-pretending-to-be-a-grid.
//
//   const t = document.createElement('foaf-table');
//   t.data = { title: 'Birds', columns: ['name','count'], rows: [...] };
//
// (A <foaf-tree> explorer should follow the same pattern.)

export function defineTable() {
  if (typeof customElements === 'undefined' || customElements.get('foaf-table')) return;

  class FoafTable extends HTMLElement {
    set data(d) {
      this._data = { title: '', columns: [], rows: [], ...d };
      this._sort = null;   // { col, dir }
      this._render();
    }
    get data() { return this._data; }

    _render() {
      const { title, columns, rows } = this._data;
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; overflow: auto; font: 13px/1.4 monospace; color: #eee; }
            table { border-collapse: collapse; width: 100%; }
            caption { text-align: left; padding: 0.4em 0.5em; color: #0ef; font-weight: bold; }
            th, td { border: 1px solid rgba(255,255,255,0.18); padding: 0.3em 0.6em; text-align: left; }
            th { position: sticky; top: 0; background: #101018; padding: 0; }
            th button {
              all: unset; display: block; width: 100%; box-sizing: border-box;
              padding: 0.35em 0.6em; cursor: pointer; color: inherit; font: inherit;
            }
            th button:focus-visible { outline: 2px solid #0ef; outline-offset: -2px; }
            th button::after { content: ' ↕'; opacity: 0.35; }
            th[aria-sort="ascending"] button::after { content: ' ↑'; opacity: 1; }
            th[aria-sort="descending"] button::after { content: ' ↓'; opacity: 1; }
            tbody tr:nth-child(even) { background: rgba(255,255,255,0.04); }
          </style>
          <table><caption></caption><thead><tr></tr></thead><tbody></tbody></table>`;
      }
      const $ = (s) => this.shadowRoot.querySelector(s);
      $('caption').textContent = `${title || 'table'} · ${rows.length} row${rows.length === 1 ? '' : 's'}`;

      const head = $('thead tr');
      head.textContent = '';
      columns.forEach((col, i) => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        th.setAttribute('aria-sort', this._sort?.col === i
          ? (this._sort.dir === 1 ? 'ascending' : 'descending') : 'none');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(col);
        btn.setAttribute('aria-label', `Sort by ${col}`);
        btn.addEventListener('click', () => {
          this._sort = { col: i, dir: this._sort?.col === i ? -(this._sort.dir || 1) : 1 };
          this._render();
        });
        th.appendChild(btn);
        head.appendChild(th);
      });

      let view = [...rows];
      if (this._sort) {
        const { col, dir } = this._sort;
        view.sort((a, b) => {
          const x = a[col], y = b[col];
          const nx = Number(x), ny = Number(y);
          const cmp = (!Number.isNaN(nx) && !Number.isNaN(ny)) ? nx - ny
            : String(x).localeCompare(String(y));
          return dir * cmp;
        });
      }
      const body = $('tbody');
      body.textContent = '';
      for (const row of view.slice(0, 500)) {
        const tr = document.createElement('tr');
        for (const cell of row) {
          const td = document.createElement('td');
          td.textContent = String(cell ?? '');
          tr.appendChild(td);
        }
        body.appendChild(tr);
      }
    }
  }

  customElements.define('foaf-table', FoafTable);
}
