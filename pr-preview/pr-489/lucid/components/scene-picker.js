/**
 * <lucid-scene-picker> Web Component
 *
 * Browsable picker for Lucid SDF scenes based on toc.json
 *
 * Usage:
 *   <lucid-scene-picker base-url="../scenes/"></lucid-scene-picker>
 *
 * Events:
 *   'scene-select' - Fired when user picks a scene
 *     event.detail = { path: 'prim/sphere.json', title: 'Sphere', ... }
 *
 * Attributes:
 *   base-url - Path to scenes folder (default: '../scenes/')
 *   show-recent - Show recent changes category (default: true)
 */

export class LucidScenePicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.toc = null;
    this.selectedCategory = null;
  }

  connectedCallback() {
    this.render();
    this.loadToc();
  }

  get baseUrl() {
    return this.getAttribute('base-url') || '../scenes/';
  }

  async loadToc() {
    try {
      const response = await fetch(`${this.baseUrl}toc.json`);
      if (!response.ok) throw new Error('Failed to load toc.json');
      this.toc = await response.json();
      this.render();
    } catch (err) {
      console.error('Scene picker error:', err);
      this.shadowRoot.querySelector('.content').innerHTML =
        `<div class="error">Failed to load scene library</div>`;
    }
  }

  selectCategory(categoryId) {
    this.selectedCategory = categoryId;
    this.render();
  }

  selectScene(scene) {
    this.dispatchEvent(new CustomEvent('scene-select', {
      detail: scene,
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const styles = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #ccc;
        background: rgba(15, 15, 20, 0.95);
        border: 1px solid #333;
        border-radius: 8px;
        overflow: hidden;
        max-height: 400px;
        display: flex;
        flex-direction: column;
      }
      .header {
        padding: 12px 16px;
        background: rgba(30, 30, 40, 0.9);
        border-bottom: 1px solid #333;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header .back {
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(60, 60, 80, 0.5);
      }
      .header .back:hover {
        background: rgba(80, 80, 100, 0.5);
      }
      .content {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      .category, .scene {
        padding: 10px 12px;
        margin: 4px 0;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .category {
        background: rgba(40, 40, 55, 0.6);
      }
      .category:hover {
        background: rgba(60, 60, 80, 0.8);
      }
      .scene {
        background: rgba(30, 35, 45, 0.6);
      }
      .scene:hover {
        background: rgba(50, 80, 100, 0.6);
      }
      .title {
        font-weight: 500;
        margin-bottom: 2px;
      }
      .subtitle {
        font-size: 12px;
        color: #888;
      }
      .count {
        font-size: 11px;
        color: #666;
        margin-left: auto;
      }
      .category-row {
        display: flex;
        align-items: center;
      }
      .error {
        padding: 20px;
        text-align: center;
        color: #f88;
      }
      .loading {
        padding: 20px;
        text-align: center;
        color: #888;
      }
    `;

    let content = '<div class="loading">Loading scenes...</div>';

    if (this.toc) {
      if (this.selectedCategory) {
        // Show scenes in selected category
        const cat = this.toc.categories.find(c => c.id === this.selectedCategory);
        if (cat) {
          content = cat.scenes.map(scene => `
            <div class="scene" data-path="${scene.path}">
              <div class="title">${scene.title}</div>
              <div class="subtitle">${scene.subtitle || ''}</div>
            </div>
          `).join('');
        }
      } else {
        // Show categories
        content = this.toc.categories.map(cat => `
          <div class="category" data-id="${cat.id}">
            <div class="category-row">
              <div>
                <div class="title">${cat.title}</div>
                <div class="subtitle">${cat.description || ''}</div>
              </div>
              <span class="count">${cat.scenes.length}</span>
            </div>
          </div>
        `).join('');
      }
    }

    const headerContent = this.selectedCategory && this.toc
      ? `<span class="back">←</span> ${this.toc.categories.find(c => c.id === this.selectedCategory)?.title || 'Scenes'}`
      : '📦 Scene Library';

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="header">${headerContent}</div>
      <div class="content">${content}</div>
    `;

    // Event listeners
    this.shadowRoot.querySelectorAll('.category').forEach(el => {
      el.addEventListener('click', () => this.selectCategory(el.dataset.id));
    });

    this.shadowRoot.querySelectorAll('.scene').forEach(el => {
      el.addEventListener('click', () => {
        const cat = this.toc.categories.find(c => c.id === this.selectedCategory);
        const scene = cat?.scenes.find(s => s.path === el.dataset.path);
        if (scene) this.selectScene(scene);
      });
    });

    const backBtn = this.shadowRoot.querySelector('.back');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCategory = null;
        this.render();
      });
    }
  }
}

customElements.define('lucid-scene-picker', LucidScenePicker);
