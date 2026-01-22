/**
 * Timeline Strip - Temporal navigation component
 *
 * The primary navigation for Timeline OS. Shows events over time,
 * allows scrubbing to any point, branching, and time-travel.
 */

class TimelineStrip extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Timeline state
    this._events = [];
    this._cursor = Date.now();
    this._viewStart = Date.now() - (6 * 60 * 60 * 1000); // 6 hours ago
    this._viewEnd = Date.now();
    this._dragging = false;
  }

  connectedCallback() {
    this._render();
    this._setupEvents();

    // Demo: add some fake events
    this._addDemoEvents();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 100%;
        }

        .controls {
          display: flex;
          gap: 4px;
        }

        .controls button {
          width: 32px;
          height: 32px;
          border: 1px solid #30363d;
          background: #161b22;
          color: #e6edf3;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .controls button:hover {
          background: #21262d;
        }

        .track-container {
          flex: 1;
          height: 40px;
          position: relative;
          cursor: crosshair;
        }

        .track {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 4px;
          background: #21262d;
          border-radius: 2px;
          transform: translateY(-50%);
        }

        .event {
          position: absolute;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
          transition: transform 0.1s;
        }

        .event:hover {
          transform: translate(-50%, -50%) scale(1.3);
        }

        .event[data-source="user"] { background: #58a6ff; }
        .event[data-source="ai"] { background: #a371f7; }
        .event[data-source="system"] { background: #7d8590; }

        .cursor {
          position: absolute;
          top: 50%;
          width: 16px;
          height: 16px;
          background: #58a6ff;
          border: 2px solid #e6edf3;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          cursor: grab;
          z-index: 10;
          box-shadow: 0 0 8px rgba(88, 166, 255, 0.5);
        }

        .cursor:active {
          cursor: grabbing;
        }

        .time-labels {
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #7d8590;
          pointer-events: none;
        }

        .now-label {
          color: #e6edf3;
          font-weight: 600;
          margin-left: 12px;
          font-size: 12px;
        }

        .tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #161b22;
          border: 1px solid #30363d;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 100;
        }

        .event:hover .tooltip {
          opacity: 1;
        }
      </style>

      <div class="controls">
        <button id="rewind" title="Rewind">⏮</button>
        <button id="play" title="Play/Pause">▶</button>
        <button id="now" title="Jump to Now">⏭</button>
      </div>

      <div class="track-container">
        <div class="track"></div>
        <div class="time-labels">
          <span class="time-start"></span>
          <span class="time-mid"></span>
          <span class="time-end"></span>
        </div>
        <div class="cursor" id="cursor"></div>
      </div>

      <span class="now-label">Now</span>
    `;
  }

  _setupEvents() {
    const track = this.shadowRoot.querySelector('.track-container');
    const cursor = this.shadowRoot.getElementById('cursor');

    // Cursor dragging
    cursor.addEventListener('mousedown', (e) => {
      this._dragging = true;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this._cursor = this._viewStart + pct * (this._viewEnd - this._viewStart);
      this._updateCursor();
      this._emitTimeChange();
    });

    document.addEventListener('mouseup', () => {
      this._dragging = false;
    });

    // Track click to jump
    track.addEventListener('click', (e) => {
      if (e.target === cursor) return;
      const rect = track.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      this._cursor = this._viewStart + pct * (this._viewEnd - this._viewStart);
      this._updateCursor();
      this._emitTimeChange();
    });

    // Control buttons
    this.shadowRoot.getElementById('now').addEventListener('click', () => {
      this._cursor = Date.now();
      this._viewEnd = Date.now();
      this._viewStart = this._viewEnd - (6 * 60 * 60 * 1000);
      this._updateCursor();
      this._updateLabels();
      this._emitTimeChange();
    });

    this.shadowRoot.getElementById('rewind').addEventListener('click', () => {
      // Jump back 1 hour
      this._cursor -= 60 * 60 * 1000;
      this._updateCursor();
      this._emitTimeChange();
    });

    this._updateLabels();
  }

  _updateCursor() {
    const cursor = this.shadowRoot.getElementById('cursor');
    const pct = (this._cursor - this._viewStart) / (this._viewEnd - this._viewStart);
    cursor.style.left = `${Math.max(0, Math.min(100, pct * 100))}%`;
  }

  _updateLabels() {
    const fmt = (ts) => {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    this.shadowRoot.querySelector('.time-start').textContent = fmt(this._viewStart);
    this.shadowRoot.querySelector('.time-mid').textContent = fmt((this._viewStart + this._viewEnd) / 2);
    this.shadowRoot.querySelector('.time-end').textContent = fmt(this._viewEnd);
  }

  _emitTimeChange() {
    this.dispatchEvent(new CustomEvent('timechange', {
      detail: { timestamp: this._cursor },
      bubbles: true
    }));
  }

  // Public API: Add event to timeline
  addEvent(event) {
    this._events.push({
      id: crypto.randomUUID(),
      timestamp: event.timestamp || Date.now(),
      source: event.source || 'system', // 'user', 'ai', 'system'
      label: event.label || 'Event',
      data: event.data || {}
    });
    this._renderEvents();
    return this._events[this._events.length - 1];
  }

  _renderEvents() {
    // Remove old event dots
    this.shadowRoot.querySelectorAll('.event').forEach(el => el.remove());

    const track = this.shadowRoot.querySelector('.track-container');

    for (const event of this._events) {
      if (event.timestamp < this._viewStart || event.timestamp > this._viewEnd) continue;

      const pct = (event.timestamp - this._viewStart) / (this._viewEnd - this._viewStart);
      const dot = document.createElement('div');
      dot.className = 'event';
      dot.dataset.source = event.source;
      dot.style.left = `${pct * 100}%`;
      dot.innerHTML = `<div class="tooltip">${event.label}</div>`;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._cursor = event.timestamp;
        this._updateCursor();
        this._emitTimeChange();
        this.dispatchEvent(new CustomEvent('eventselect', {
          detail: event,
          bubbles: true
        }));
      });
      track.appendChild(dot);
    }
  }

  _addDemoEvents() {
    const now = Date.now();
    this.addEvent({ timestamp: now - 5 * 60 * 60 * 1000, source: 'user', label: 'Started session' });
    this.addEvent({ timestamp: now - 4 * 60 * 60 * 1000, source: 'user', label: 'Opened editor' });
    this.addEvent({ timestamp: now - 3 * 60 * 60 * 1000, source: 'ai', label: 'Claude: Refactored function' });
    this.addEvent({ timestamp: now - 2 * 60 * 60 * 1000, source: 'user', label: 'Saved document' });
    this.addEvent({ timestamp: now - 1 * 60 * 60 * 1000, source: 'ai', label: 'Claude: Added tests' });
    this.addEvent({ timestamp: now - 30 * 60 * 1000, source: 'system', label: 'Autosave' });
  }
}

customElements.define('timeline-strip', TimelineStrip);

export { TimelineStrip };
