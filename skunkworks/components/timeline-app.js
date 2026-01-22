/**
 * Timeline App - Iframe-isolated application container
 *
 * Each app runs in a sandboxed iframe with controlled capabilities.
 * Supports floating, docked, minimized states with drag behavior.
 */

class TimelineApp extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'src', 'state'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._state = 'docked'; // 'docked', 'floating', 'minimized'
    this._position = { x: 0, y: 0 };
    this._size = { width: 400, height: 300 };
    this._dragState = null;

    // Version history for this app's content
    this._history = [];
    this._historyIndex = -1;
  }

  connectedCallback() {
    this._render();
    this._setupEvents();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'state') {
      this._state = newVal;
      this.dataset.state = newVal;
    }
  }

  _render() {
    const name = this.getAttribute('name') || 'App';
    const src = this.getAttribute('src') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
        }

        .titlebar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          cursor: move;
          user-select: none;
          flex-shrink: 0;
        }

        .title {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: #e6edf3;
        }

        .controls {
          display: flex;
          gap: 4px;
        }

        .controls button {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          color: #7d8590;
          cursor: pointer;
          border-radius: 4px;
          font-size: 12px;
        }

        .controls button:hover {
          background: #30363d;
          color: #e6edf3;
        }

        .content {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: #0d1117;
        }

        .history-indicator {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(22, 27, 34, 0.9);
          border: 1px solid #30363d;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
          color: #7d8590;
          display: none;
        }

        :host([data-has-history]) .history-indicator {
          display: block;
        }
      </style>

      <div class="titlebar">
        <span class="title">${name}</span>
        <div class="controls">
          <button id="history" title="History">⟲</button>
          <button id="minimize" title="Minimize">−</button>
          <button id="float" title="Float">◱</button>
          <button id="close" title="Close">×</button>
        </div>
      </div>

      <div class="content">
        <iframe
          sandbox="allow-scripts allow-same-origin"
          ${src ? `src="${src}"` : ''}
        ></iframe>
        <div class="history-indicator">
          <span id="history-count">0</span> versions
        </div>
      </div>
    `;
  }

  _setupEvents() {
    const titlebar = this.shadowRoot.querySelector('.titlebar');

    // Drag handling
    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      if (this._state === 'docked') return;

      this._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: this._position.x,
        startTop: this._position.y
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._dragState) return;

      const dx = e.clientX - this._dragState.startX;
      const dy = e.clientY - this._dragState.startY;

      this._position.x = this._dragState.startLeft + dx;
      this._position.y = this._dragState.startTop + dy;

      // Clamp to viewport
      this._position.x = Math.max(0, Math.min(window.innerWidth - 100, this._position.x));
      this._position.y = Math.max(0, Math.min(window.innerHeight - 100, this._position.y));

      this.style.left = `${this._position.x}px`;
      this.style.top = `${this._position.y}px`;
    });

    document.addEventListener('mouseup', () => {
      this._dragState = null;
    });

    // Control buttons
    this.shadowRoot.getElementById('minimize').addEventListener('click', () => {
      this.minimize();
    });

    this.shadowRoot.getElementById('float').addEventListener('click', () => {
      this.float();
    });

    this.shadowRoot.getElementById('close').addEventListener('click', () => {
      this.close();
    });

    this.shadowRoot.getElementById('history').addEventListener('click', () => {
      this.showHistory();
    });

    // Message handling from iframe
    window.addEventListener('message', (e) => {
      if (e.source !== this.shadowRoot.querySelector('iframe')?.contentWindow) return;
      this._handleMessage(e.data);
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'snapshot':
        this.saveSnapshot(msg.data);
        break;
      case 'tool-request':
        this.dispatchEvent(new CustomEvent('toolrequest', {
          detail: msg,
          bubbles: true
        }));
        break;
    }
  }

  // Public API

  minimize() {
    this._state = 'minimized';
    this.dataset.state = 'minimized';
    // Position in bottom-left area
    this._position.x = 16;
    this._position.y = window.innerHeight - 280;
    this.style.left = `${this._position.x}px`;
    this.style.top = `${this._position.y}px`;

    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: 'minimized' },
      bubbles: true
    }));
  }

  float() {
    if (this._state === 'floating') {
      // Return to docked
      this._state = 'docked';
      this.dataset.state = 'docked';
      this.style.left = '';
      this.style.top = '';
    } else {
      this._state = 'floating';
      this.dataset.state = 'floating';
      // Center in viewport
      this._position.x = (window.innerWidth - this._size.width) / 2;
      this._position.y = (window.innerHeight - this._size.height) / 2;
      this.style.left = `${this._position.x}px`;
      this.style.top = `${this._position.y}px`;
      this.style.width = `${this._size.width}px`;
      this.style.height = `${this._size.height}px`;
    }

    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { state: this._state },
      bubbles: true
    }));
  }

  close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    this.remove();
  }

  saveSnapshot(data) {
    this._history.push({
      timestamp: Date.now(),
      data: structuredClone(data)
    });
    this._historyIndex = this._history.length - 1;
    this.dataset.hasHistory = 'true';
    this.shadowRoot.getElementById('history-count').textContent = this._history.length;

    this.dispatchEvent(new CustomEvent('snapshot', {
      detail: { index: this._historyIndex, data },
      bubbles: true
    }));
  }

  restoreSnapshot(index) {
    if (index < 0 || index >= this._history.length) return;
    this._historyIndex = index;
    const snapshot = this._history[index];

    // Send to iframe
    const iframe = this.shadowRoot.querySelector('iframe');
    iframe.contentWindow?.postMessage({
      type: 'restore',
      data: snapshot.data
    }, '*');

    this.dispatchEvent(new CustomEvent('restore', {
      detail: snapshot,
      bubbles: true
    }));
  }

  showHistory() {
    // For now, just log - could show a visual history panel
    console.log('App history:', this._history);
    this.dispatchEvent(new CustomEvent('showhistory', {
      detail: { history: this._history },
      bubbles: true
    }));
  }

  // Send message to iframe
  postMessage(msg) {
    const iframe = this.shadowRoot.querySelector('iframe');
    iframe.contentWindow?.postMessage(msg, '*');
  }

  // Load content into iframe
  loadContent(html) {
    const iframe = this.shadowRoot.querySelector('iframe');
    iframe.srcdoc = html;
  }
}

customElements.define('timeline-app', TimelineApp);

export { TimelineApp };
