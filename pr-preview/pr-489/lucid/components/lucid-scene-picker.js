/**
 * <lucid-scene-picker> - Scene selection component with filtering
 *
 * Loads and displays the scene table of contents with search/filter.
 * Mobile-first with 44px+ touch targets.
 *
 * Usage:
 *   <lucid-scene-picker filter="validated"></lucid-scene-picker>
 *
 * Attributes:
 *   - filter: "all" | "validated" | "broken" | "recent" (default: "all")
 *
 * Events:
 *   - scene-selected: Fired when user selects a scene
 *     detail: { path, title, subtitle, json }
 *   - load-error: Fired when scene fails to load
 *     detail: { path, error }
 */

export class LucidScenePicker extends HTMLElement {
  static get observedAttributes() {
    return ['filter'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._toc = null;
    this._currentScene = null;
    this._flatScenes = [];
    this._activeFilter = 'all';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, sans-serif;
          --bg: #0d1117;
          --bg-panel: #161b22;
          --bg-hover: #21262d;
          --border: #30363d;
          --text: #c9d1d9;
          --text-dim: #8b949e;
          --accent: #58a6ff;
          --success: #238636;
          --warning: #d29922;
          --error: #f85149;
          height: 100%;
          overflow: hidden;
        }

        /* Filter bar - horizontal scroll on mobile */
        .filter-bar {
          display: flex;
          gap: 6px;
          padding: 10px 12px;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
          flex-shrink: 0;
          -webkit-overflow-scrolling: touch;
        }

        .filter-btn {
          flex-shrink: 0;
          padding: 8px 14px;
          min-height: 36px;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text-dim);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .filter-btn:hover {
          background: #30363d;
          color: var(--text);
        }

        .filter-btn.active {
          background: var(--success);
          border-color: var(--success);
          color: #fff;
        }

        .filter-btn .count {
          opacity: 0.7;
          font-size: 11px;
        }

        .picker {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .search {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .search input {
          width: 100%;
          padding: 10px 12px;
          min-height: 44px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          box-sizing: border-box;
        }

        .search input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .search input::placeholder {
          color: var(--text-dim);
        }

        .categories {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 8px;
          -webkit-overflow-scrolling: touch;
        }

        .category {
          margin-bottom: 8px;
        }

        .category-header {
          padding: 12px 14px;
          min-height: 48px;
          font-weight: 600;
          font-size: 14px;
          color: var(--text);
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.15s;
        }

        .category-header:hover {
          background: var(--bg-hover);
        }

        .category-header:focus {
          outline: none;
          border-color: var(--accent);
        }

        .category-header .chevron {
          transition: transform 0.2s;
          font-size: 12px;
          opacity: 0.6;
        }

        .category.collapsed .chevron {
          transform: rotate(-90deg);
        }

        .category.collapsed .scenes {
          display: none;
        }

        .scenes {
          padding: 6px 0 6px 12px;
        }

        /* Scene items - 48px min touch target */
        .scene {
          padding: 12px 14px;
          min-height: 48px;
          margin: 4px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-hover);
          border: 1px solid transparent;
          border-radius: 6px;
          transition: all 0.15s;
        }

        .scene:hover {
          background: #30363d;
          border-color: #484f58;
        }

        .scene:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
        }

        .scene.selected {
          background: rgba(88, 166, 255, 0.15);
          border-color: var(--accent);
        }

        .scene.broken {
          opacity: 0.6;
        }

        .scene.loading {
          pointer-events: none;
          opacity: 0.7;
        }

        /* Status badge */
        .status-badge {
          flex-shrink: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--text-dim);
        }

        .status-badge.valid { background: var(--success); }
        .status-badge.warning { background: var(--warning); }
        .status-badge.broken { background: var(--error); }

        .scene-info {
          flex: 1;
          min-width: 0;
        }

        .scene-title {
          font-size: 14px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .scene-subtitle {
          font-size: 12px;
          color: var(--text-dim);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .no-results {
          padding: 30px 20px;
          text-align: center;
          color: var(--text-dim);
          font-size: 14px;
        }

        .no-results .icon {
          font-size: 32px;
          margin-bottom: 10px;
        }

        .count {
          font-size: 12px;
          color: var(--text-dim);
          margin-left: auto;
        }

        .error-toast {
          position: absolute;
          bottom: 10px;
          left: 10px;
          right: 10px;
          padding: 10px 14px;
          background: var(--error);
          color: white;
          border-radius: 6px;
          font-size: 13px;
          z-index: 100;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>

      <div class="filter-bar">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="validated">Working</button>
        <button class="filter-btn" data-filter="recent">Recent</button>
        <button class="filter-btn" data-filter="broken">Broken</button>
      </div>

      <div class="picker">
        <div class="search">
          <input type="text" placeholder="Search scenes..." aria-label="Search scenes" />
        </div>
        <div class="categories" role="listbox" aria-label="Scene list"></div>
      </div>
    `;

    this._filterBar = this.shadowRoot.querySelector('.filter-bar');
    this._searchInput = this.shadowRoot.querySelector('.search input');
    this._categoriesEl = this.shadowRoot.querySelector('.categories');

    this._setupEventListeners();
  }

  _setupEventListeners() {
    this._searchInput.addEventListener('input', () => this._filterScenes());

    this._filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (btn) {
        this._activeFilter = btn.dataset.filter;
        this._updateFilterButtons();
        this._render();
      }
    });
  }

  connectedCallback() {
    this._loadToc();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'filter' && newValue !== oldValue) {
      this._activeFilter = newValue || 'all';
      this._updateFilterButtons();
      this._render();
    }
  }

  get currentScene() {
    return this._currentScene;
  }

  set currentScene(path) {
    this._currentScene = path;
    this._updateSelection();
  }

  get filter() {
    return this._activeFilter;
  }

  set filter(value) {
    this.setAttribute('filter', value);
  }

  _updateFilterButtons() {
    for (const btn of this._filterBar.querySelectorAll('.filter-btn')) {
      btn.classList.toggle('active', btn.dataset.filter === this._activeFilter);
    }
  }

  async _loadToc() {
    try {
      const basePath = this._getBasePath();
      const response = await fetch(`${basePath}/scenes/toc.json`);
      if (!response.ok) throw new Error('Failed to load TOC');

      this._toc = await response.json();
      this._buildFlatList();
      this._render();

    } catch (error) {
      console.error('Failed to load scene TOC:', error);
      this._categoriesEl.innerHTML = `
        <div class="no-results">
          <div class="icon">⚠️</div>
          <div>Failed to load scenes</div>
        </div>
      `;
    }
  }

  _getBasePath() {
    const scriptUrl = import.meta.url;
    return scriptUrl.substring(0, scriptUrl.lastIndexOf('/components'));
  }

  _buildFlatList() {
    this._flatScenes = [];
    const seenPaths = new Set();

    for (const category of this._toc.categories || []) {
      for (const scene of category.scenes || []) {
        // Skip duplicates (same scene may appear in multiple categories like "recent")
        if (seenPaths.has(scene.path)) continue;
        seenPaths.add(scene.path);

        this._flatScenes.push({
          ...scene,
          categoryId: category.id,
          categoryTitle: category.title,
          // TODO: Load validation status from audit system
          status: scene.status || 'unknown'
        });
      }
    }
  }

  _getFilteredScenes() {
    const search = this._searchInput.value.toLowerCase().trim();
    let scenes = [...this._flatScenes];

    // Apply filter
    switch (this._activeFilter) {
      case 'validated':
        scenes = scenes.filter(s => s.status !== 'broken');
        break;
      case 'broken':
        scenes = scenes.filter(s => s.status === 'broken');
        break;
      case 'recent':
        const recentCat = this._toc?.categories?.find(c => c.id === 'recent');
        if (recentCat) {
          const recentPaths = new Set(recentCat.scenes.map(s => s.path));
          scenes = scenes.filter(s => recentPaths.has(s.path));
        } else {
          scenes = [];
        }
        break;
    }

    // Apply search
    if (search) {
      scenes = scenes.filter(s =>
        s.title?.toLowerCase().includes(search) ||
        s.subtitle?.toLowerCase().includes(search) ||
        s.path?.toLowerCase().includes(search)
      );
    }

    return scenes;
  }

  _render() {
    const search = this._searchInput.value.toLowerCase().trim();
    const filtered = this._getFilteredScenes();

    if (filtered.length === 0) {
      this._categoriesEl.innerHTML = `
        <div class="no-results">
          <div class="icon">🔍</div>
          <div>No scenes match your filter</div>
        </div>
      `;
      return;
    }

    if (search || this._activeFilter !== 'all') {
      this._renderFiltered(filtered);
    } else {
      this._renderCategories();
    }
  }

  _renderCategories() {
    this._categoriesEl.innerHTML = '';

    for (const category of this._toc.categories || []) {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'category';
      categoryEl.dataset.id = category.id;

      const sceneCount = category.scenes?.length || 0;

      categoryEl.innerHTML = `
        <div class="category-header">
          <span class="chevron">▼</span>
          <span>${category.title}</span>
          <span class="count">${sceneCount}</span>
        </div>
        <div class="scenes"></div>
      `;

      const header = categoryEl.querySelector('.category-header');
      header.addEventListener('click', () => {
        categoryEl.classList.toggle('collapsed');
      });

      const scenesEl = categoryEl.querySelector('.scenes');
      for (const scene of category.scenes || []) {
        scenesEl.appendChild(this._createSceneElement(scene));
      }

      this._categoriesEl.appendChild(categoryEl);
    }

    this._updateSelection();
  }

  _renderFiltered(scenes) {
    this._categoriesEl.innerHTML = '';

    const scenesEl = document.createElement('div');
    scenesEl.className = 'scenes';
    scenesEl.style.padding = '0'; // No indent for flat list

    for (const scene of scenes) {
      scenesEl.appendChild(this._createSceneElement(scene));
    }

    this._categoriesEl.appendChild(scenesEl);
    this._updateSelection();
  }

  _createSceneElement(scene) {
    const el = document.createElement('div');
    el.className = `scene ${scene.status === 'broken' ? 'broken' : ''}`;
    el.dataset.path = scene.path;
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'option');

    el.innerHTML = `
      <div class="status-badge ${scene.status || 'unknown'}" title="${scene.status || 'Unknown'}"></div>
      <div class="scene-info">
        <div class="scene-title">${this._escapeHtml(scene.title || scene.path)}</div>
        ${scene.subtitle ? `<div class="scene-subtitle">${this._escapeHtml(scene.subtitle)}</div>` : ''}
      </div>
    `;

    el.addEventListener('click', () => this._selectScene(scene, el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._selectScene(scene, el);
      }
    });

    return el;
  }

  async _selectScene(scene, el) {
    this._currentScene = scene.path;
    this._updateSelection();

    // Show loading state
    el.classList.add('loading');

    try {
      const basePath = this._getBasePath();
      const response = await fetch(`${basePath}/scenes/${scene.path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      this.dispatchEvent(new CustomEvent('scene-selected', {
        bubbles: true,
        detail: {
          path: scene.path,
          title: scene.title,
          subtitle: scene.subtitle,
          json
        }
      }));

    } catch (error) {
      console.error(`Failed to load scene ${scene.path}:`, error);

      this.dispatchEvent(new CustomEvent('load-error', {
        bubbles: true,
        detail: { path: scene.path, error }
      }));

      // Visual feedback - flash red border
      el.style.borderColor = 'var(--error)';
      setTimeout(() => {
        el.style.borderColor = '';
      }, 2000);
    } finally {
      el.classList.remove('loading');
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _updateSelection() {
    const scenes = this.shadowRoot.querySelectorAll('.scene');
    for (const el of scenes) {
      el.classList.toggle('selected', el.dataset.path === this._currentScene);
    }
  }

  _filterScenes() {
    this._render();
  }

  // Navigate to next/previous scene
  nextScene() {
    const idx = this._flatScenes.findIndex(s => s.path === this._currentScene);
    if (idx < this._flatScenes.length - 1) {
      const next = this._flatScenes[idx + 1];
      this._currentScene = next.path;
      this._updateSelection();
      return next;
    }
    return null;
  }

  prevScene() {
    const idx = this._flatScenes.findIndex(s => s.path === this._currentScene);
    if (idx > 0) {
      const prev = this._flatScenes[idx - 1];
      this._currentScene = prev.path;
      this._updateSelection();
      return prev;
    }
    return null;
  }
}

customElements.define('lucid-scene-picker', LucidScenePicker);
