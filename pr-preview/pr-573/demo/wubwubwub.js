/**
 * WubWubWub - Organic AudioLisp Studio
 * Elegant Web Components for audio synthesis with a Lisp-like DSL
 */

// ============================================================================
// PART 1: LISP READER (Recursive Descent Parser)
// ============================================================================

export class LispReader {
  static tokenize(str) {
    return str
      .replace(/\(/g, ' ( ')
      .replace(/\)/g, ' ) ')
      .replace(/;.*$/gm, '')
      .trim()
      .split(/\s+/)
      .filter(x => x.length > 0);
  }

  static readFrom(tokens) {
    if (tokens.length === 0) throw new Error('Unexpected EOF');
    const token = tokens.shift();
    if (token === '(') {
      const list = [];
      while (tokens[0] !== ')') {
        list.push(LispReader.readFrom(tokens));
      }
      tokens.shift();
      return list;
    } else if (token === ')') {
      throw new Error('Unexpected )');
    } else {
      const num = parseFloat(token);
      if (!isNaN(num)) return num;
      if (token.startsWith('"')) return token.slice(1, -1);
      return token;
    }
  }

  static parse(str) {
    const tokens = LispReader.tokenize(str);
    if (tokens.length === 0) return null;
    return LispReader.readFrom(tokens);
  }
}

// ============================================================================
// PART 2: AUDIO ENGINE
// ============================================================================

export class WubAudioEngine extends EventTarget {
  constructor() {
    super();
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser);
    this.buffers = {};
    this.#initBuffers();
  }

  #initBuffers() {
    this.buffers.white = this.#genNoise(2, 'white');
    this.buffers.pink = this.#genNoise(2, 'pink');
    this.buffers.brown = this.#genNoise(2, 'brown');
    this.buffers.perlin = this.#genNoise(2, 'perlin');
  }

  #genNoise(duration, type) {
    const size = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buf.getChannelData(0);

    switch (type) {
      case 'white':
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        break;
      case 'pink': {
        const b = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < size; i++) {
          const w = Math.random() * 2 - 1;
          b[0] = 0.99886 * b[0] + w * 0.0555179;
          b[1] = 0.99332 * b[1] + w * 0.0750759;
          b[2] = 0.969 * b[2] + w * 0.153852;
          b[3] = 0.8665 * b[3] + w * 0.3104856;
          b[4] = 0.55 * b[4] + w * 0.5329522;
          b[5] = -0.7616 * b[5] - w * 0.016898;
          data[i] = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11;
          b[6] = w * 0.115926;
        }
        break;
      }
      case 'brown': {
        let last = 0;
        for (let i = 0; i < size; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          data[i] = last * 8.0;
        }
        break;
      }
      case 'perlin':
        for (let i = 0; i < size; i++) {
          const t = i / this.ctx.sampleRate;
          const v = Math.sin(t * 10) * 0.5 + Math.sin(t * 23) * 0.25 + Math.sin(t * 55) * 0.125;
          data[i] = v + Math.random() * 0.05;
        }
        break;
    }
    return buf;
  }

  async run(code) {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    try {
      const ast = LispReader.parse(code);
      const scope = {};
      this.#eval(ast, scope, this.master);
      this.dispatchEvent(new CustomEvent('play', { detail: { ast } }));
      return { success: true, ast };
    } catch (e) {
      console.error(e);
      this.dispatchEvent(new CustomEvent('error', { detail: { error: e.message } }));
      return { success: false, error: e.message };
    }
  }

  #eval(expr, scope, dest) {
    if (!Array.isArray(expr)) return expr;
    const [op, ...args] = expr;

    if (op === 'params') {
      args.forEach(pair => {
        const key = pair[0];
        let val = pair[1];
        if (String(pair[1]).startsWith(':')) {
          const idx = pair.indexOf(':value');
          if (idx > -1) val = pair[idx + 1];
        }
        scope[key] = val;
      });
      return;
    }

    let node = null;

    if (op === 'sound') {
      node = this.ctx.createGain();
    } else if (op === 'osc') {
      node = this.ctx.createOscillator();
      const p = this.#getProps(args, scope);
      node.type = p.type || 'sine';
      this.#automate(node.frequency, p.freq, scope);
      node.start();
      node.stop(this.ctx.currentTime + 8);
    } else if (op === 'noise') {
      node = this.ctx.createBufferSource();
      const p = this.#getProps(args, scope);
      const type = p.type || 'white';
      node.buffer = this.buffers[type] || this.buffers.white;
      node.loop = true;
      if (p.rate) node.playbackRate.value = p.rate;
      node.start();
      node.stop(this.ctx.currentTime + 8);
    } else if (op === 'gain' || op === 'mix') {
      node = this.ctx.createGain();
      const p = this.#getProps(args, scope);
      const base = p.value !== undefined ? p.value : 1.0;
      node.gain.setValueAtTime(base, this.ctx.currentTime);
      if (p.env) this.#applyEnv(node.gain, p.env, scope);
    } else if (op === 'filter') {
      node = this.ctx.createBiquadFilter();
      const p = this.#getProps(args, scope);
      node.type = p.type || 'lowpass';
      if (p.Q) node.Q.value = p.Q;
      this.#automate(node.frequency, p.freq, scope);
    }

    if (node) {
      node.connect(dest);
      this.#getChildren(args).forEach(child => this.#eval(child, scope, node));
    }
  }

  #getProps(args, scope) {
    const props = {};
    for (let i = 0; i < args.length; i++) {
      const item = args[i];
      if (typeof item === 'string' && item.startsWith(':')) {
        let val = args[i + 1];
        if (typeof val === 'string' && val.startsWith('$')) val = scope[val.slice(1)];
        props[item.slice(1)] = val;
        i++;
      }
    }
    return props;
  }

  #getChildren(args) {
    return args.filter((a, i) => {
      const prev = args[i - 1];
      const isKey = typeof a === 'string' && a.startsWith(':');
      const isVal = typeof prev === 'string' && prev.startsWith(':');
      return !isKey && !isVal;
    });
  }

  #automate(param, val, scope) {
    const t = this.ctx.currentTime;
    if (Array.isArray(val) && val[0] === 'slide') {
      const p = this.#getProps(val.slice(1), scope);
      param.setValueAtTime(p.from, t);
      param.linearRampToValueAtTime(p.to, t + (p.time || 1));
    } else {
      let v = val;
      if (typeof v === 'string' && v.startsWith('$')) v = scope[v.slice(1)];
      if (v !== undefined) param.setValueAtTime(v, t);
    }
  }

  #applyEnv(param, envExpr, scope) {
    const t = this.ctx.currentTime;
    const p = this.#getProps(envExpr.slice(1), scope);
    const a = p.a || 0.01,
      d = p.d || 0.1,
      s = p.s || 0,
      r = p.r || 0.1;
    param.cancelScheduledValues(t);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(1.0, t + a);
    param.linearRampToValueAtTime(s, t + a + d);
    param.linearRampToValueAtTime(0, t + a + d + r);
  }
}

// ============================================================================
// PART 3: WEB COMPONENTS
// ============================================================================

// Shared styles
const baseStyles = `
  :host {
    --bg: #121214;
    --panel: #1e1e24;
    --border: #2a2a30;
    --accent: #00e5ff;
    --accent-dim: rgba(0, 229, 255, 0.1);
    --text: #e0e0e0;
    --number: #50fa7b;
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  }
`;

// ----------------------------------------------------------------------------
// <wub-oscilloscope> - Waveform visualizer
// ----------------------------------------------------------------------------

export class WubOscilloscope extends HTMLElement {
  #canvas;
  #ctx;
  #analyser;
  #dataArray;
  #animationId;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          display: block;
          background: #000;
          width: 100%;
          height: 80px;
        }
        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      <canvas></canvas>
    `;
    this.#canvas = this.shadowRoot.querySelector('canvas');
    this.#ctx = this.#canvas.getContext('2d');
  }

  setAnalyser(analyser) {
    this.#analyser = analyser;
    this.#dataArray = new Uint8Array(analyser.frequencyBinCount);
    this.#animate();
  }

  #animate() {
    this.#animationId = requestAnimationFrame(() => this.#animate());
    const rect = this.getBoundingClientRect();
    if (this.#canvas.width !== rect.width || this.#canvas.height !== rect.height) {
      this.#canvas.width = rect.width;
      this.#canvas.height = rect.height;
    }

    this.#analyser.getByteTimeDomainData(this.#dataArray);
    this.#ctx.fillStyle = '#000';
    this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#ctx.lineWidth = 2;
    this.#ctx.strokeStyle = '#00e5ff';
    this.#ctx.beginPath();

    const slice = this.#canvas.width / this.#dataArray.length;
    let x = 0;
    for (let i = 0; i < this.#dataArray.length; i++) {
      const v = this.#dataArray[i] / 128.0;
      const y = (v * this.#canvas.height) / 2;
      if (i === 0) this.#ctx.moveTo(x, y);
      else this.#ctx.lineTo(x, y);
      x += slice;
    }
    this.#ctx.stroke();
  }

  disconnectedCallback() {
    if (this.#animationId) cancelAnimationFrame(this.#animationId);
  }
}

// ----------------------------------------------------------------------------
// <wub-preset-chip> - Individual preset button
// ----------------------------------------------------------------------------

export class WubPresetChip extends HTMLElement {
  static get observedAttributes() {
    return ['active', 'name'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#render();
    this.shadowRoot.querySelector('button').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true }));
    });
  }

  attributeChangedCallback() {
    this.#render();
  }

  #render() {
    const active = this.hasAttribute('active');
    const name = this.getAttribute('name') || '';
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        button {
          background: ${active ? 'var(--accent-dim)' : 'var(--panel)'};
          border: 1px solid ${active ? 'var(--accent)' : 'var(--border)'};
          color: ${active ? 'var(--accent)' : 'var(--text)'};
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
          white-space: nowrap;
        }
        button:hover {
          border-color: var(--accent);
        }
      </style>
      <button>${name}</button>
    `;
  }
}

// ----------------------------------------------------------------------------
// <wub-preset-bar> - Horizontal scrolling preset selector
// ----------------------------------------------------------------------------

export class WubPresetBar extends HTMLElement {
  #presets = [];
  #activeIndex = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#render();
  }

  set presets(list) {
    this.#presets = list;
    this.#render();
  }

  get activePreset() {
    return this.#presets[this.#activeIndex];
  }

  #render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          display: flex;
          overflow-x: auto;
          gap: 8px;
          padding: 10px;
          background: var(--bg);
          scrollbar-width: none;
        }
        :host::-webkit-scrollbar { display: none; }
      </style>
      <slot></slot>
    `;

    this.innerHTML = '';
    this.#presets.forEach((p, i) => {
      const chip = document.createElement('wub-preset-chip');
      chip.setAttribute('name', p.name);
      if (i === this.#activeIndex) chip.setAttribute('active', '');
      chip.addEventListener('select', () => {
        this.#activeIndex = i;
        this.querySelectorAll('wub-preset-chip').forEach((c, j) => {
          if (j === i) c.setAttribute('active', '');
          else c.removeAttribute('active');
        });
        this.dispatchEvent(
          new CustomEvent('preset-change', {
            detail: { preset: p, index: i },
            bubbles: true,
          })
        );
      });
      this.appendChild(chip);
    });
  }
}

// ----------------------------------------------------------------------------
// <wub-code-editor> - Syntax-aware textarea
// ----------------------------------------------------------------------------

export class WubCodeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        textarea {
          width: 100%;
          height: 100%;
          background: var(--bg);
          color: var(--text);
          border: none;
          padding: 15px;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
        }
      </style>
      <textarea spellcheck="false"></textarea>
    `;

    this.shadowRoot.querySelector('textarea').addEventListener('input', e => {
      this.dispatchEvent(new CustomEvent('code-change', { detail: { code: e.target.value } }));
    });
  }

  get value() {
    return this.shadowRoot.querySelector('textarea')?.value || '';
  }

  set value(code) {
    const ta = this.shadowRoot.querySelector('textarea');
    if (ta) ta.value = code;
  }
}

// ----------------------------------------------------------------------------
// <wub-node-graph> - Visual node representation of AST
// ----------------------------------------------------------------------------

export class WubNodeGraph extends HTMLElement {
  #ast = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          display: block;
          width: 100%;
          height: 100%;
          overflow: auto;
          background: radial-gradient(#333 1px, transparent 1px);
          background-size: 20px 20px;
          background-color: #0f0f12;
          position: relative;
        }
        .container {
          position: relative;
          padding: 40px;
          min-height: 100%;
        }
        svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }
        .node {
          position: absolute;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 6px;
          min-width: 140px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          font-size: 11px;
          z-index: 2;
        }
        .node-head {
          background: #2a2a30;
          padding: 6px 10px;
          font-weight: bold;
          color: var(--accent);
          border-bottom: 1px solid var(--border);
          text-transform: uppercase;
          border-radius: 6px 6px 0 0;
        }
        .node-body { padding: 8px 10px; }
        .prop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          color: #888;
        }
        .prop span:last-child { color: var(--number); }
      </style>
      <div class="container">
        <svg></svg>
        <div class="nodes"></div>
      </div>
    `;
  }

  render(ast) {
    this.#ast = ast;
    const nodesEl = this.shadowRoot.querySelector('.nodes');
    const svgEl = this.shadowRoot.querySelector('svg');
    nodesEl.innerHTML = '';
    svgEl.innerHTML = '';

    if (!ast) return;

    const levels = {};
    const nodeElements = {};

    const mapTree = (node, depth, parentId) => {
      if (!Array.isArray(node)) return;
      const id = 'n' + Math.random().toString(36).substr(2, 5);
      if (!levels[depth]) levels[depth] = 0;

      const op = node[0];
      const args = node.slice(1);
      const props = this.#getProps(args);

      const el = document.createElement('div');
      el.className = 'node';
      el.id = id;

      const x = depth * 180 + 20;
      const y = levels[depth] * 120 + 20;
      levels[depth]++;

      el.style.left = x + 'px';
      el.style.top = y + 'px';

      let html = `<div class="node-head">${op}</div><div class="node-body">`;
      for (const [k, v] of Object.entries(props)) {
        const display = Array.isArray(v) ? `(${v[0]}...)` : v;
        html += `<div class="prop"><span>:${k}</span><span>${display}</span></div>`;
      }
      html += '</div>';
      el.innerHTML = html;
      nodesEl.appendChild(el);
      nodeElements[id] = el;

      if (parentId) {
        requestAnimationFrame(() => this.#drawLine(svgEl, nodeElements[parentId], el));
      }

      this.#getChildren(args).forEach(c => mapTree(c, depth + 1, id));
    };

    mapTree(ast, 0, null);
  }

  #getProps(args) {
    const props = {};
    for (let i = 0; i < args.length; i++) {
      const item = args[i];
      if (typeof item === 'string' && item.startsWith(':')) {
        props[item.slice(1)] = args[i + 1];
        i++;
      }
    }
    return props;
  }

  #getChildren(args) {
    return args.filter((a, i) => {
      const prev = args[i - 1];
      const isKey = typeof a === 'string' && a.startsWith(':');
      const isVal = typeof prev === 'string' && prev.startsWith(':');
      return !isKey && !isVal;
    });
  }

  #drawLine(svg, n1, n2) {
    if (!n1 || !n2) return;
    const container = this.shadowRoot.querySelector('.container');
    const cRect = container.getBoundingClientRect();
    const r1 = n1.getBoundingClientRect();
    const r2 = n2.getBoundingClientRect();

    const x1 = r1.left - cRect.left + r1.width;
    const y1 = r1.top - cRect.top + r1.height / 2;
    const x2 = r2.left - cRect.left;
    const y2 = r2.top - cRect.top + r2.height / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#444');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }
}

// ----------------------------------------------------------------------------
// <wub-studio> - Main container orchestrating all components
// ----------------------------------------------------------------------------

export class WubStudio extends HTMLElement {
  #engine;
  #currentTab = 'code';

  static PRESETS = [
    {
      name: 'Cold Wind',
      code: `(sound "Wind"
  (filter :type "bandpass" :Q 2 :freq (slide :from 300 :to 800 :time 4)
    (gain :env (adsr :a 2 :d 2)
      (noise :type "pink"))))`,
    },
    {
      name: 'Thunder',
      code: `(sound "Thunder"
  (filter :type "lowpass" :freq 400
    (gain :env (adsr :a 0.5 :d 3)
      (noise :type "brown" :rate 0.4))))`,
    },
    {
      name: 'Campfire',
      code: `(sound "Fire"
  (filter :type "highpass" :freq 600 :Q 5
    (gain :env (adsr :a 0.1 :d 3)
      (noise :type "brown" :rate 1.8))))`,
    },
    {
      name: 'Sci-Fi Droid',
      code: `(sound "Droid"
  (mix
    (filter :type "highpass" :freq 500
      (gain :env (adsr :a 0.1 :d 0.5)
        (noise :type "perlin" :rate 2.5)))
    (gain :env (adsr :a 0.05 :d 0.2)
      (osc :type "square" :freq 110))))`,
    },
    {
      name: 'Laser',
      code: `(gain :env (adsr :a 0.01 :d 0.2)
  (osc :type "sawtooth" :freq (slide :from 880 :to 220 :time 0.2)))`,
    },
    {
      name: 'Water Drop',
      code: `(mix
  (gain :env (adsr :d 0.2)
     (osc :type "sine" :freq (slide :from 800 :to 400 :time 0.1)))
  (filter :type "lowpass" :freq 300
     (gain :env (adsr :d 0.3) (noise :type "brown"))))`,
    },
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#engine = new WubAudioEngine();
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        ${baseStyles}
        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg);
          color: var(--text);
          overflow: hidden;
        }
        .header {
          flex: 0 0 auto;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
        }
        .tabs {
          display: flex;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
        }
        .tab {
          flex: 1;
          padding: 12px;
          text-align: center;
          background: none;
          border: none;
          color: #666;
          font-family: inherit;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .workspace {
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        .view {
          position: absolute;
          inset: 0;
          display: none;
        }
        .view.active { display: block; }
        .footer {
          flex: 0 0 auto;
          background: var(--panel);
          border-top: 1px solid var(--border);
          padding: 10px;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .play-btn {
          flex: 1;
          background: var(--accent);
          color: #000;
          border: none;
          padding: 12px;
          font-family: inherit;
          font-weight: bold;
          font-size: 14px;
          border-radius: 4px;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.15s;
        }
        .play-btn:active {
          transform: translateY(1px);
          opacity: 0.9;
        }
        .status {
          font-size: 11px;
          color: #666;
          min-width: 60px;
          text-align: right;
          transition: color 0.3s;
        }
        .status.playing { color: #50fa7b; }
        .status.error { color: #ff5555; }
      </style>

      <div class="header">
        <wub-oscilloscope></wub-oscilloscope>
        <wub-preset-bar></wub-preset-bar>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="code">SOURCE (LISP)</button>
        <button class="tab" data-tab="graph">NODE GRAPH</button>
      </div>

      <div class="workspace">
        <div class="view active" data-view="code">
          <wub-code-editor></wub-code-editor>
        </div>
        <div class="view" data-view="graph">
          <wub-node-graph></wub-node-graph>
        </div>
      </div>

      <div class="footer">
        <button class="play-btn">Run Program</button>
        <div class="status">Ready</div>
      </div>
    `;

    this.#setup();
  }

  #setup() {
    const scope = this.shadowRoot.querySelector('wub-oscilloscope');
    const presetBar = this.shadowRoot.querySelector('wub-preset-bar');
    const editor = this.shadowRoot.querySelector('wub-code-editor');
    const graph = this.shadowRoot.querySelector('wub-node-graph');
    const playBtn = this.shadowRoot.querySelector('.play-btn');
    const status = this.shadowRoot.querySelector('.status');
    const tabs = this.shadowRoot.querySelectorAll('.tab');

    // Connect oscilloscope to analyser
    scope.setAnalyser(this.#engine.analyser);

    // Setup presets
    presetBar.presets = WubStudio.PRESETS;
    editor.value = WubStudio.PRESETS[0].code;

    presetBar.addEventListener('preset-change', async e => {
      editor.value = e.detail.preset.code;
      if (this.#engine.ctx.state === 'suspended') await this.#engine.ctx.resume();
      this.#run();
    });

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
        this.shadowRoot.querySelectorAll('.view').forEach(v => {
          v.classList.toggle('active', v.dataset.view === targetTab);
        });
        if (targetTab === 'graph') {
          try {
            const ast = LispReader.parse(editor.value);
            graph.render(ast);
          } catch (e) {
            /* ignore parse errors */
          }
        }
      });
    });

    // Run button
    playBtn.addEventListener('click', () => this.#run());

    // Engine events
    this.#engine.addEventListener('play', e => {
      status.textContent = 'Playing';
      status.className = 'status playing';
      graph.render(e.detail.ast);
      setTimeout(() => {
        status.textContent = 'Ready';
        status.className = 'status';
      }, 1500);
    });

    this.#engine.addEventListener('error', e => {
      status.textContent = e.detail.error;
      status.className = 'status error';
      setTimeout(() => {
        status.textContent = 'Ready';
        status.className = 'status';
      }, 2000);
    });
  }

  async #run() {
    const editor = this.shadowRoot.querySelector('wub-code-editor');
    await this.#engine.run(editor.value);
  }
}

// ============================================================================
// PART 4: REGISTER COMPONENTS
// ============================================================================

export function registerComponents() {
  customElements.define('wub-oscilloscope', WubOscilloscope);
  customElements.define('wub-preset-chip', WubPresetChip);
  customElements.define('wub-preset-bar', WubPresetBar);
  customElements.define('wub-code-editor', WubCodeEditor);
  customElements.define('wub-node-graph', WubNodeGraph);
  customElements.define('wub-studio', WubStudio);
}

// Auto-register if not imported as module
if (typeof window !== 'undefined' && !window.__WUB_COMPONENTS_REGISTERED__) {
  window.__WUB_COMPONENTS_REGISTERED__ = true;
  registerComponents();
}
