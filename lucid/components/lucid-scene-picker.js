/**
 * <lucid-scene-picker> - Scene selection component
 *
 * Loads and displays the scene table of contents with search/filter.
 *
 * Usage:
 *   <lucid-scene-picker></lucid-scene-picker>
 *
 * Events:
 *   - scene-selected: Fired when user selects a scene
 *     detail: { path, title, subtitle }
 */

export class LucidScenePicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._toc = null;
    this._currentScene = null;
    this._flatScenes = [];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, sans-serif;
          --bg: #161b22;
          --bg-hover: #21262d;
          --border: #30363d;
          --text: #c9d1d9;
          --text-dim: #8b949e;
          --accent: #22d3ee;
        }

        .picker {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          max-height: 400px;
          display: flex;
          flex-direction: column;
        }

        .search {
          padding: 8px;
          border-bottom: 1px solid var(--border);
        }

        .search input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: #0d1117;
          color: var(--text);
          font-size: 14px;
        }

        .search input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .categories {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .category {
          border-bottom: 1px solid var(--border);
        }

        .category:last-child {
          border-bottom: none;
        }

        .category-header {
          padding: 10px 12px;
          font-weight: 600;
          font-size: 13px;
          color: var(--text);
          background: var(--bg-hover);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-header:hover {
          background: #282e36;
        }

        .category-header .chevron {
          transition: transform 0.2s;
        }

        .category.collapsed .chevron {
          transform: rotate(-90deg);
        }

        .category.collapsed .scenes {
          display: none;
        }

        .scenes {
          padding: 4px 0;
        }

        .scene {
          padding: 8px 16px 8px 24px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .scene:hover {
          background: var(--bg-hover);
        }

        .scene.selected {
          background: rgba(34, 211, 238, 0.1);
          border-left: 3px solid var(--accent);
          padding-left: 21px;
        }

        .scene-title {
          font-size: 13px;
          color: var(--text);
        }

        .scene-subtitle {
          font-size: 11px;
          color: var(--text-dim);
        }

        .no-results {
          padding: 20px;
          text-align: center;
          color: var(--text-dim);
          font-size: 13px;
        }

        .count {
          font-size: 11px;
          color: var(--text-dim);
          margin-left: auto;
        }
      </style>

      <div class="picker">
        <div class="search">
          <input type="text" placeholder="Search scenes..." />
        </div>
        <div class="categories"></div>
      </div>
    `;

    this._searchInput = this.shadowRoot.querySelector('.search input');
    this._categoriesEl = this.shadowRoot.querySelector('.categories');

    this._searchInput.addEventListener('input', () => this._filterScenes());
  }

  connectedCallback() {
    this._loadToc();
  }

  get currentScene() {
    return this._currentScene;
  }

  set currentScene(path) {
    this._currentScene = path;
    this._updateSelection();
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
        <div class="no-results">Failed to load scenes</div>
      `;
    }
  }

  _getBasePath() {
    const scriptUrl = import.meta.url;
    return scriptUrl.substring(0, scriptUrl.lastIndexOf('/components'));
  }

  _buildFlatList() {
    this._flatScenes = [];
    for (const category of this._toc.categories || []) {
      for (const scene of category.scenes || []) {
        this._flatScenes.push({
          ...scene,
          categoryId: category.id,
          categoryTitle: category.title
        });
      }
    }
  }

  _render() {
    const filter = this._searchInput.value.toLowerCase().trim();

    if (filter) {
      this._renderFiltered(filter);
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

  _renderFiltered(filter) {
    const matches = this._flatScenes.filter(scene =>
      scene.title?.toLowerCase().includes(filter) ||
      scene.subtitle?.toLowerCase().includes(filter) ||
      scene.path?.toLowerCase().includes(filter)
    );

    this._categoriesEl.innerHTML = '';

    if (matches.length === 0) {
      this._categoriesEl.innerHTML = `
        <div class="no-results">No scenes matching "${filter}"</div>
      `;
      return;
    }

    const scenesEl = document.createElement('div');
    scenesEl.className = 'scenes';

    for (const scene of matches) {
      scenesEl.appendChild(this._createSceneElement(scene));
    }

    this._categoriesEl.appendChild(scenesEl);
    this._updateSelection();
  }

  _createSceneElement(scene) {
    const el = document.createElement('div');
    el.className = 'scene';
    el.dataset.path = scene.path;

    el.innerHTML = `
      <span class="scene-title">${scene.title || scene.path}</span>
      <span class="scene-subtitle">${scene.subtitle || ''}</span>
    `;

    el.addEventListener('click', () => {
      this._currentScene = scene.path;
      this._updateSelection();

      this.dispatchEvent(new CustomEvent('scene-selected', {
        detail: {
          path: scene.path,
          title: scene.title,
          subtitle: scene.subtitle
        }
      }));
    });

    return el;
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
