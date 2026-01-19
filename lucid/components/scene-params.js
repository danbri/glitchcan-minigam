/**
 * <lucid-scene-params> Web Component
 *
 * Controls for scene-specific parameters and time animation
 *
 * Usage:
 *   <lucid-scene-params></lucid-scene-params>
 *
 * Methods:
 *   setSceneParams(params) - Set scene parameters from loaded JSON
 *   getParamValues() - Returns current param values
 *   isPaused() - Returns whether animation is paused
 *   getTimeScale() - Returns time multiplier
 *
 * Events:
 *   'param-change' - Fired when any param changes
 *     event.detail = { name: 'param', value: 0.5 }
 *   'time-control' - Fired when time controls change
 *     event.detail = { paused: false, scale: 1.0, reset: false }
 */

export class LucidSceneParams extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Scene parameters from loaded scene
    this.sceneParams = {};
    this.paramValues = {};

    // Time control state
    this.paused = false;
    this.timeScale = 1.0;
  }

  connectedCallback() {
    this.render();
  }

  setSceneParams(params) {
    this.sceneParams = params || {};
    // Initialize values from defaults
    this.paramValues = {};
    for (const [name, param] of Object.entries(this.sceneParams)) {
      if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3' || param.type === 'direction3') {
        this.paramValues[name] = param.value || [0, 0, 0];
      } else {
        this.paramValues[name] = param.value !== undefined ? param.value : 0;
      }
    }
    this.render();
  }

  getParamValues() {
    return { ...this.paramValues };
  }

  isPaused() {
    return this.paused;
  }

  getTimeScale() {
    return this.timeScale;
  }

  emitParamChange(name, value) {
    this.dispatchEvent(new CustomEvent('param-change', {
      detail: { name, value },
      bubbles: true,
      composed: true
    }));
  }

  emitTimeControl(reset = false) {
    this.dispatchEvent(new CustomEvent('time-control', {
      detail: {
        paused: this.paused,
        scale: this.timeScale,
        reset
      },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const paramEntries = Object.entries(this.sceneParams);
    const hasParams = paramEntries.length > 0;

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
        .time-controls {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        button {
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #444;
          background: rgba(40, 40, 50, 0.8);
          color: #aaa;
          cursor: pointer;
          font-size: 12px;
        }
        button:hover {
          background: rgba(60, 60, 80, 0.8);
          border-color: #666;
        }
        button.active {
          background: rgba(74, 158, 255, 0.3);
          border-color: #4a9eff;
          color: #4a9eff;
        }
        .no-params {
          color: #555;
          font-style: italic;
          padding: 8px 0;
        }
        .color-input {
          width: 40px;
          height: 24px;
          border: 1px solid #444;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
        }
      </style>

      <div class="header">🎬 Animation</div>

      <div class="section">
        <div class="section-title">Time Control</div>
        <div class="time-controls">
          <button id="playPause" class="${this.paused ? '' : 'active'}">${this.paused ? '▶' : '⏸'}</button>
          <button id="reset">⏹</button>
          <input type="range" id="timeScale" min="0" max="3" step="0.1" value="${this.timeScale}">
          <span class="value">${this.timeScale.toFixed(1)}x</span>
        </div>
      </div>

      ${hasParams ? `
        <div class="section">
          <div class="section-title">Scene Parameters</div>
          ${paramEntries.map(([name, param]) => this.renderParam(name, param)).join('')}
        </div>
      ` : `
        <div class="no-params">No scene parameters</div>
      `}
    `;

    this.setupListeners();
  }

  renderParam(name, param) {
    const value = this.paramValues[name];
    const displayName = param.label || name;

    if (param.type === 'color3') {
      const hex = this.rgbToHex(value);
      return `
        <div class="row">
          <span class="label">${displayName}</span>
          <input type="color" class="color-input" data-name="${name}" value="${hex}">
          <span class="value">${hex}</span>
        </div>
      `;
    }

    // Scalar parameter
    const min = param.min !== undefined ? param.min : 0;
    const max = param.max !== undefined ? param.max : 1;
    const step = param.step !== undefined ? param.step : (max - min) / 100;

    return `
      <div class="row">
        <span class="label">${displayName}</span>
        <input type="range" data-name="${name}" min="${min}" max="${max}" step="${step}" value="${value}">
        <span class="value">${typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
    `;
  }

  setupListeners() {
    // Play/Pause
    const playPauseBtn = this.shadowRoot.getElementById('playPause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        this.paused = !this.paused;
        this.render();
        this.emitTimeControl();
      });
    }

    // Reset
    const resetBtn = this.shadowRoot.getElementById('reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.emitTimeControl(true);
      });
    }

    // Time scale
    const timeScaleInput = this.shadowRoot.getElementById('timeScale');
    if (timeScaleInput) {
      timeScaleInput.addEventListener('input', (e) => {
        this.timeScale = parseFloat(e.target.value);
        const valueEl = e.target.parentElement.querySelector('.value');
        if (valueEl) valueEl.textContent = this.timeScale.toFixed(1) + 'x';
        this.emitTimeControl();
      });
    }

    // Scene param sliders
    this.shadowRoot.querySelectorAll('input[type="range"][data-name]').forEach(input => {
      input.addEventListener('input', (e) => {
        const name = e.target.dataset.name;
        const value = parseFloat(e.target.value);
        this.paramValues[name] = value;

        const valueEl = e.target.parentElement.querySelector('.value');
        if (valueEl) valueEl.textContent = value.toFixed(2);

        this.emitParamChange(name, value);
      });
    });

    // Color inputs
    this.shadowRoot.querySelectorAll('input[type="color"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const name = e.target.dataset.name;
        const rgb = this.hexToRgb(e.target.value);
        this.paramValues[name] = rgb;

        const valueEl = e.target.parentElement.querySelector('.value');
        if (valueEl) valueEl.textContent = e.target.value;

        this.emitParamChange(name, rgb);
      });
    });
  }

  rgbToHex(rgb) {
    if (!rgb || rgb.length < 3) return '#808080';
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
    return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.5, 0.5, 0.5];
  }
}

customElements.define('lucid-scene-params', LucidSceneParams);
