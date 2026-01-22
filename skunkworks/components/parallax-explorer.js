/**
 * Parallax Explorer - Faceted navigation through entity graphs
 *
 * Inspired by Freebase Parallax: filter, pivot, explore.
 * Each step narrows OR pivots to connected entities.
 */

class ParallaxExplorer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._store = null;
    this._currentSet = new Set();
    this._history = [];
    this._suggestions = [];
  }

  connectedCallback() {
    this._render();
  }

  // Inject entity store
  setStore(store) {
    this._store = store;
    this._computeSuggestions();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0d1117;
          color: #e6edf3;
        }

        .breadcrumb {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          overflow-x: auto;
          flex-shrink: 0;
        }

        .crumb {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: #21262d;
          border-radius: 16px;
          font-size: 13px;
          white-space: nowrap;
        }

        .crumb.active {
          background: #58a6ff;
          color: #0d1117;
        }

        .crumb-arrow {
          color: #7d8590;
        }

        .crumb-remove {
          cursor: pointer;
          opacity: 0.6;
        }

        .crumb-remove:hover {
          opacity: 1;
        }

        .actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #30363d;
          flex-wrap: wrap;
        }

        .action-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .action-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #7d8590;
          letter-spacing: 0.5px;
        }

        .action-buttons {
          display: flex;
          gap: 4px;
        }

        button {
          padding: 6px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #e6edf3;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        button:hover {
          background: #30363d;
          border-color: #58a6ff;
        }

        button.primary {
          background: #238636;
          border-color: #238636;
        }

        button.primary:hover {
          background: #2ea043;
        }

        select {
          padding: 6px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #e6edf3;
          font-size: 12px;
        }

        .results {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .results-count {
          font-size: 14px;
          color: #7d8590;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }

        .entity-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .entity-card:hover {
          border-color: #58a6ff;
          transform: translateY(-2px);
        }

        .entity-title {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .entity-facets {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .facet-badge {
          padding: 2px 6px;
          background: #21262d;
          border-radius: 4px;
          font-size: 10px;
          color: #7d8590;
        }

        .suggestions {
          padding: 12px 16px;
          background: #161b22;
          border-top: 1px solid #30363d;
        }

        .suggestions-title {
          font-size: 11px;
          text-transform: uppercase;
          color: #7d8590;
          margin-bottom: 8px;
        }

        .suggestion-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .suggestion-chip {
          padding: 4px 10px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 12px;
          font-size: 12px;
          cursor: pointer;
        }

        .suggestion-chip:hover {
          background: #30363d;
          border-color: #58a6ff;
        }

        .suggestion-chip .count {
          color: #7d8590;
          margin-left: 4px;
        }

        .empty-state {
          text-align: center;
          padding: 48px;
          color: #7d8590;
        }

        .empty-state h3 {
          color: #e6edf3;
          margin-bottom: 8px;
        }
      </style>

      <div class="breadcrumb" id="breadcrumb">
        <span class="crumb active">All Entities</span>
      </div>

      <div class="actions">
        <div class="action-group">
          <span class="action-label">Filter by Facet</span>
          <div class="action-buttons">
            <select id="filter-facet">
              <option value="">Select facet...</option>
              <option value="temporal">Temporal</option>
              <option value="spatial">Spatial</option>
              <option value="social">Social</option>
              <option value="identity">Identity (People)</option>
              <option value="media">Media</option>
              <option value="semantic">Semantic</option>
            </select>
            <input type="text" id="filter-value" placeholder="Value..." style="width: 120px; padding: 6px; background: #21262d; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3;">
            <button id="apply-filter">Filter</button>
          </div>
        </div>

        <div class="action-group">
          <span class="action-label">Pivot via Link</span>
          <div class="action-buttons">
            <select id="pivot-relation">
              <option value="">Select relation...</option>
              <option value="depicts">depicts</option>
              <option value="taken-at">taken-at</option>
              <option value="attended-by">attended-by</option>
              <option value="knows">knows</option>
              <option value="part-of">part-of</option>
              <option value="*">Any link →</option>
              <option value="*-reverse">← Any link (reverse)</option>
            </select>
            <button id="apply-pivot">Pivot</button>
          </div>
        </div>

        <div class="action-group">
          <span class="action-label">Actions</span>
          <div class="action-buttons">
            <button id="back">← Back</button>
            <button id="reset">Reset</button>
          </div>
        </div>
      </div>

      <div class="results">
        <div class="results-header">
          <span class="results-count" id="results-count">0 entities</span>
          <div>
            <button id="view-grid">Grid</button>
            <button id="view-list">List</button>
          </div>
        </div>
        <div class="results-grid" id="results-grid"></div>
      </div>

      <div class="suggestions" id="suggestions">
        <div class="suggestions-title">Suggested next steps</div>
        <div class="suggestion-chips" id="suggestion-chips"></div>
      </div>
    `;

    this._setupEvents();
  }

  _setupEvents() {
    // Filter
    this.shadowRoot.getElementById('apply-filter').addEventListener('click', () => {
      const facet = this.shadowRoot.getElementById('filter-facet').value;
      const value = this.shadowRoot.getElementById('filter-value').value;
      if (facet) this.filter(facet, value);
    });

    // Pivot
    this.shadowRoot.getElementById('apply-pivot').addEventListener('click', () => {
      const relation = this.shadowRoot.getElementById('pivot-relation').value;
      if (relation === '*-reverse') {
        this.pivotFrom(null);
      } else if (relation) {
        this.pivot(relation === '*' ? null : relation);
      }
    });

    // Back
    this.shadowRoot.getElementById('back').addEventListener('click', () => {
      this.back();
    });

    // Reset
    this.shadowRoot.getElementById('reset').addEventListener('click', () => {
      this.reset();
    });
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------

  // Start with all entities (or filtered by facet)
  start(facet = null) {
    if (!this._store) return this;

    if (facet) {
      this._currentSet = new Set(
        this._store.query(facet, () => true).map(e => e.id)
      );
      this._history = [{ action: 'start', facet, count: this._currentSet.size }];
    } else {
      this._currentSet = new Set(this._store.entities.keys());
      this._history = [{ action: 'start', all: true, count: this._currentSet.size }];
    }

    this._updateUI();
    return this;
  }

  // Filter current set by facet field containing value
  filter(facet, value) {
    if (!this._store) return this;

    const q = value.toLowerCase();
    const filtered = new Set();

    for (const id of this._currentSet) {
      const entity = this._store.get(id);
      const facetData = entity?.facets[facet];

      if (facetData) {
        // Simple contains check on JSON stringified data
        const str = JSON.stringify(facetData).toLowerCase();
        if (!value || str.includes(q)) {
          filtered.add(id);
        }
      }
    }

    this._currentSet = filtered;
    this._history.push({
      action: 'filter',
      facet,
      value,
      count: filtered.size
    });

    this._updateUI();
    return this;
  }

  // Pivot to linked entities
  pivot(relation = null) {
    if (!this._store) return this;

    const pivoted = new Set();

    for (const id of this._currentSet) {
      const entity = this._store.get(id);
      for (const link of entity?.links || []) {
        if (!relation || link.relation === relation) {
          pivoted.add(link.target);
        }
      }
    }

    this._currentSet = pivoted;
    this._history.push({
      action: 'pivot',
      relation: relation || '*',
      count: pivoted.size
    });

    this._updateUI();
    return this;
  }

  // Reverse pivot: find entities that link TO current set
  pivotFrom(relation = null) {
    if (!this._store) return this;

    const pivoted = new Set();

    for (const id of this._currentSet) {
      const linkers = this._store.getLinkedFrom(id, relation);
      for (const { entity } of linkers) {
        pivoted.add(entity.id);
      }
    }

    this._currentSet = pivoted;
    this._history.push({
      action: 'pivotFrom',
      relation: relation || '*',
      count: pivoted.size
    });

    this._updateUI();
    return this;
  }

  // Go back one step
  back() {
    if (this._history.length <= 1) return this;

    this._history.pop();

    // Replay history to reconstruct state
    const history = this._history;
    this._history = [];
    this._currentSet = new Set();

    for (const step of history) {
      if (step.action === 'start') {
        if (step.facet) {
          this.start(step.facet);
        } else {
          this.start();
        }
      } else if (step.action === 'filter') {
        this.filter(step.facet, step.value);
      } else if (step.action === 'pivot') {
        this.pivot(step.relation === '*' ? null : step.relation);
      } else if (step.action === 'pivotFrom') {
        this.pivotFrom(step.relation === '*' ? null : step.relation);
      }
    }

    return this;
  }

  // Reset to beginning
  reset() {
    this._currentSet = new Set();
    this._history = [];
    this.start();
    return this;
  }

  // Get current results
  results() {
    return Array.from(this._currentSet)
      .map(id => this._store?.get(id))
      .filter(Boolean);
  }

  // --------------------------------------------------------
  // UI Updates
  // --------------------------------------------------------

  _updateUI() {
    this._updateBreadcrumb();
    this._updateResults();
    this._computeSuggestions();
    this._updateSuggestions();
  }

  _updateBreadcrumb() {
    const container = this.shadowRoot.getElementById('breadcrumb');
    container.innerHTML = '';

    for (let i = 0; i < this._history.length; i++) {
      const step = this._history[i];
      const isLast = i === this._history.length - 1;

      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'crumb-arrow';
        arrow.textContent = '→';
        container.appendChild(arrow);
      }

      const crumb = document.createElement('span');
      crumb.className = `crumb ${isLast ? 'active' : ''}`;
      crumb.innerHTML = `
        ${this._stepLabel(step)}
        <span class="count">(${step.count})</span>
      `;
      container.appendChild(crumb);
    }
  }

  _stepLabel(step) {
    if (step.action === 'start') {
      return step.facet ? `All ${step.facet}` : 'All';
    } else if (step.action === 'filter') {
      return `${step.facet}: ${step.value || '*'}`;
    } else if (step.action === 'pivot') {
      return `→ ${step.relation}`;
    } else if (step.action === 'pivotFrom') {
      return `← ${step.relation}`;
    }
    return step.action;
  }

  _updateResults() {
    const grid = this.shadowRoot.getElementById('results-grid');
    const countEl = this.shadowRoot.getElementById('results-count');

    const entities = this.results();
    countEl.textContent = `${entities.length} entities`;

    if (entities.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No entities found</h3>
          <p>Try adjusting your filters or going back</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = entities.slice(0, 50).map(entity => `
      <div class="entity-card" data-id="${entity.id}">
        <div class="entity-title">${this._entityTitle(entity)}</div>
        <div class="entity-facets">
          ${Object.keys(entity.facets).map(f =>
            `<span class="facet-badge">${f}</span>`
          ).join('')}
        </div>
      </div>
    `).join('');

    // Click handler for cards
    grid.querySelectorAll('.entity-card').forEach(card => {
      card.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('entity-select', {
          detail: { entityId: card.dataset.id },
          bubbles: true
        }));
      });
    });
  }

  _entityTitle(entity) {
    // Try to find a good display name
    if (entity.facets.identity?.name) return entity.facets.identity.name;
    if (entity.facets.temporal?.occurred) {
      return new Date(entity.facets.temporal.occurred).toLocaleDateString();
    }
    if (entity.facets.spatial?.location) return entity.facets.spatial.location;
    return entity.id.slice(0, 20);
  }

  _computeSuggestions() {
    if (!this._store || this._currentSet.size === 0) {
      this._suggestions = [];
      return;
    }

    const suggestions = [];

    // Suggest facets to filter by
    const facetCounts = {};
    for (const id of this._currentSet) {
      const entity = this._store.get(id);
      for (const facet of Object.keys(entity?.facets || {})) {
        facetCounts[facet] = (facetCounts[facet] || 0) + 1;
      }
    }

    for (const [facet, count] of Object.entries(facetCounts)) {
      if (count > 0 && count < this._currentSet.size) {
        suggestions.push({
          type: 'filter',
          label: `Has ${facet}`,
          facet,
          count
        });
      }
    }

    // Suggest relations to pivot
    const relationCounts = {};
    for (const id of this._currentSet) {
      const entity = this._store.get(id);
      for (const link of entity?.links || []) {
        relationCounts[link.relation] = (relationCounts[link.relation] || 0) + 1;
      }
    }

    for (const [relation, count] of Object.entries(relationCounts)) {
      suggestions.push({
        type: 'pivot',
        label: `→ ${relation}`,
        relation,
        count
      });
    }

    this._suggestions = suggestions.slice(0, 8);
  }

  _updateSuggestions() {
    const container = this.shadowRoot.getElementById('suggestion-chips');

    if (this._suggestions.length === 0) {
      container.innerHTML = '<span style="color: #7d8590; font-size: 12px;">No suggestions</span>';
      return;
    }

    container.innerHTML = this._suggestions.map(s => `
      <span class="suggestion-chip" data-type="${s.type}" data-facet="${s.facet || ''}" data-relation="${s.relation || ''}">
        ${s.label}<span class="count">${s.count}</span>
      </span>
    `).join('');

    container.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.dataset.type === 'filter') {
          this.filter(chip.dataset.facet, '');
        } else if (chip.dataset.type === 'pivot') {
          this.pivot(chip.dataset.relation);
        }
      });
    });
  }
}

customElements.define('parallax-explorer', ParallaxExplorer);

export { ParallaxExplorer };
