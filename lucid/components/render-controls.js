/**
 * <lucid-render-controls> Web Component
 *
 * Controls panel for adjusting raymarcher render settings
 *
 * Usage:
 *   <lucid-render-controls></lucid-render-controls>
 *
 * Events:
 *   'settings-change' - Fired when any setting changes
 *     event.detail = { maxSteps: 100, keyIntensity: 0.7, ... }
 *
 * Methods:
 *   getSettings() - Returns current settings object
 *   setSettings(obj) - Updates settings from object
 */

export class LucidRenderControls extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Default settings
    this.settings = {
      maxSteps: 100,
      hitThreshold: 0.001,
      maxDistance: 50.0,
      normalEpsilon: 0.002,
      keyIntensity: 0.7,
      fillIntensity: 0.3,
      rimIntensity: 0.15,
      ambient: 0.15,
      bgColor: [0.1, 0.1, 0.15]
    };
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  getSettings() {
    return { ...this.settings };
  }

  setSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    this.render();
  }

  emitChange() {
    this.dispatchEvent(new CustomEvent('settings-change', {
      detail: this.getSettings(),
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const s = this.settings;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          color: #ccc;
          background: rgba(15, 15, 20, 0.95);
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px;
          max-width: 280px;
        }
        .header {
          font-weight: 500;
          margin-bottom: 12px;
          color: #888;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .presets {
          display: flex;
          gap: 4px;
        }
        .preset {
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid #444;
          background: rgba(40, 40, 50, 0.8);
          color: #aaa;
          cursor: pointer;
          font-size: 10px;
        }
        .preset:hover {
          background: rgba(60, 60, 80, 0.8);
          border-color: #666;
        }
        .section {
          margin-bottom: 12px;
        }
        .section-title {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .row {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
        }
        .label {
          flex: 1;
          color: #888;
        }
        .value {
          width: 50px;
          text-align: right;
          color: #aaa;
          font-family: monospace;
          font-size: 11px;
        }
        input[type="range"] {
          width: 100px;
          margin: 0 8px;
          accent-color: #4a9eff;
        }
        .color-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        input[type="color"] {
          width: 40px;
          height: 24px;
          border: 1px solid #444;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
        }
      </style>

      <div class="header">
        ⚙️ Render
        <div class="presets">
          <button class="preset" data-preset="fast">Fast</button>
          <button class="preset" data-preset="quality">Quality</button>
          <button class="preset" data-preset="ultra">Ultra</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Quality</div>
        <div class="row">
          <span class="label">Steps</span>
          <input type="range" id="maxSteps" min="20" max="200" value="${s.maxSteps}" aria-label="Maximum ray-march steps" title="Maximum ray-march steps per pixel">
          <span class="value">${s.maxSteps}</span>
        </div>
        <div class="row">
          <span class="label">Threshold</span>
          <input type="range" id="hitThreshold" min="-4" max="-1" step="0.1" value="${Math.log10(s.hitThreshold)}" aria-label="Surface hit threshold in metres" title="Surface hit threshold (metres) — smaller is sharper but slower">
          <span class="value">${s.hitThreshold.toFixed(4)} m</span>
        </div>
        <div class="row">
          <span class="label">Max dist.</span>
          <input type="range" id="maxDistance" min="10" max="200" value="${s.maxDistance}" aria-label="Maximum ray distance in metres" title="Maximum ray distance (metres)">
          <span class="value">${s.maxDistance} m</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Lighting</div>
        <div class="row">
          <span class="label">Key</span>
          <input type="range" id="keyIntensity" min="0" max="1" step="0.05" value="${s.keyIntensity}" aria-label="Key light intensity" title="Key light intensity (0–1)">
          <span class="value">${s.keyIntensity.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="label">Fill</span>
          <input type="range" id="fillIntensity" min="0" max="1" step="0.05" value="${s.fillIntensity}" aria-label="Fill light intensity" title="Fill light intensity (0–1)">
          <span class="value">${s.fillIntensity.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="label">Rim</span>
          <input type="range" id="rimIntensity" min="0" max="0.5" step="0.01" value="${s.rimIntensity}" aria-label="Rim light intensity" title="Rim light intensity (0–0.5)">
          <span class="value">${s.rimIntensity.toFixed(2)}</span>
        </div>
        <div class="row">
          <span class="label">Ambient</span>
          <input type="range" id="ambient" min="0" max="0.5" step="0.01" value="${s.ambient}" aria-label="Ambient light intensity" title="Ambient light intensity (0–0.5)">
          <span class="value">${s.ambient.toFixed(2)}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Background</div>
        <div class="color-row">
          <input type="color" id="bgColor" value="${this.rgbToHex(s.bgColor)}">
          <span class="value">${this.rgbToHex(s.bgColor)}</span>
        </div>
      </div>
    `;
  }

  setupListeners() {
    // Range sliders
    const sliders = ['maxSteps', 'hitThreshold', 'maxDistance', 'keyIntensity', 'fillIntensity', 'rimIntensity', 'ambient'];

    sliders.forEach(id => {
      const input = this.shadowRoot.getElementById(id);
      if (input) {
        input.addEventListener('input', (e) => {
          let value = parseFloat(e.target.value);

          // Special handling for threshold (logarithmic)
          if (id === 'hitThreshold') {
            value = Math.pow(10, value);
          }

          this.settings[id] = id === 'maxSteps' ? Math.round(value) : value;

          // Update display value
          const valueEl = e.target.parentElement.querySelector('.value');
          if (valueEl) {
            if (id === 'maxSteps') {
              valueEl.textContent = Math.round(this.settings[id]);
            } else if (id === 'maxDistance') {
              valueEl.textContent = Math.round(this.settings[id]) + ' m';
            } else if (id === 'hitThreshold') {
              valueEl.textContent = this.settings[id].toFixed(4) + ' m';
            } else {
              valueEl.textContent = this.settings[id].toFixed(2);
            }
          }

          this.emitChange();
        });
      }
    });

    // Background color
    const bgInput = this.shadowRoot.getElementById('bgColor');
    if (bgInput) {
      bgInput.addEventListener('input', (e) => {
        this.settings.bgColor = this.hexToRgb(e.target.value);
        const valueEl = e.target.parentElement.querySelector('.value');
        if (valueEl) valueEl.textContent = e.target.value;
        this.emitChange();
      });
    }

    // Presets
    this.shadowRoot.querySelectorAll('.preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyPreset(btn.dataset.preset);
      });
    });
  }

  applyPreset(preset) {
    const presets = {
      fast: {
        maxSteps: 50,
        hitThreshold: 0.002,
        maxDistance: 30.0,
        normalEpsilon: 0.004
      },
      quality: {
        maxSteps: 100,
        hitThreshold: 0.001,
        maxDistance: 50.0,
        normalEpsilon: 0.002
      },
      ultra: {
        maxSteps: 200,
        hitThreshold: 0.0005,
        maxDistance: 100.0,
        normalEpsilon: 0.001
      }
    };

    if (presets[preset]) {
      Object.assign(this.settings, presets[preset]);
      this.render();
      this.setupListeners();
      this.emitChange();
    }
  }

  rgbToHex(rgb) {
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.1, 0.1, 0.15];
  }
}

customElements.define('lucid-render-controls', LucidRenderControls);
