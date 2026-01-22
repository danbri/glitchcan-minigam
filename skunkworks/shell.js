/**
 * Timeline OS Shell - Main orchestration
 *
 * Coordinates timeline, apps, activity stream, and tool bus.
 */

class TimelineShell {
  constructor() {
    this.timeline = document.getElementById('main-timeline');
    this.workspace = document.getElementById('workspace');
    this.activityLog = document.getElementById('activity-log');
    this.apps = new Map();

    this._setupEventListeners();
    this._setupLauncher();

    this.log('system', 'Timeline OS initialized');
  }

  _setupEventListeners() {
    // Timeline events
    this.timeline.addEventListener('timechange', (e) => {
      this._onTimeChange(e.detail.timestamp);
    });

    this.timeline.addEventListener('eventselect', (e) => {
      this._onEventSelect(e.detail);
    });

    // App events (delegated)
    this.workspace.addEventListener('snapshot', (e) => {
      const app = e.target;
      const name = app.getAttribute('name');
      this.log('user', `Saved snapshot in ${name}`);
      this.timeline.addEvent({
        source: 'user',
        label: `Snapshot: ${name}`,
        data: { appId: app.id, snapshotIndex: e.detail.index }
      });
    });

    this.workspace.addEventListener('toolrequest', (e) => {
      this._handleToolRequest(e.target, e.detail);
    });

    this.workspace.addEventListener('close', (e) => {
      const app = e.target;
      const name = app.getAttribute('name');
      this.apps.delete(app.id);
      this.log('system', `Closed ${name}`);
    });
  }

  _setupLauncher() {
    document.getElementById('launcher').addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const appType = e.target.dataset.app;
      this.launchApp(appType);
    });
  }

  _onTimeChange(timestamp) {
    // Notify all apps of time change
    for (const [id, app] of this.apps) {
      app.postMessage({ type: 'timechange', timestamp });
    }
  }

  _onEventSelect(event) {
    this.log('system', `Jumped to: ${event.label}`);

    // If event has associated app state, restore it
    if (event.data?.appId && event.data?.snapshotIndex !== undefined) {
      const app = this.apps.get(event.data.appId);
      if (app) {
        app.restoreSnapshot(event.data.snapshotIndex);
      }
    }
  }

  async _handleToolRequest(app, request) {
    // MCP tool bus - mediate tool calls from sandboxed apps
    this.log('ai', `Tool request: ${request.tool}`);

    // Simulate tool response (in real impl, this calls MCP server)
    const response = await this._executeToolMock(request);

    app.postMessage({
      type: 'tool-response',
      id: request.id,
      result: response
    });

    this.timeline.addEvent({
      source: 'ai',
      label: `Tool: ${request.tool}`,
      data: { request, response }
    });
  }

  async _executeToolMock(request) {
    // Mock tool execution
    await new Promise(r => setTimeout(r, 500));
    return { success: true, data: `Mock response for ${request.tool}` };
  }

  // Public API

  launchApp(type) {
    const appId = `app-${crypto.randomUUID().slice(0, 8)}`;
    const app = document.createElement('timeline-app');
    app.id = appId;

    const configs = {
      editor: {
        name: 'Editor',
        content: this._getEditorContent()
      },
      renderer: {
        name: 'Renderer',
        content: this._getRendererContent()
      },
      chat: {
        name: 'Chat',
        content: this._getChatContent()
      }
    };

    const config = configs[type] || configs.editor;
    app.setAttribute('name', config.name);
    app.loadContent(config.content);

    this.workspace.appendChild(app);
    this.apps.set(appId, app);

    this.log('user', `Opened ${config.name}`);
    this.timeline.addEvent({
      source: 'user',
      label: `Opened ${config.name}`,
      data: { appId }
    });

    return app;
  }

  log(source, message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const icons = { user: '●', ai: '◆', system: '○' };

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.dataset.source = source;
    item.innerHTML = `
      <span class="activity-time">${time}</span>
      <span class="activity-icon">${icons[source] || '○'}</span>
      <span class="activity-text">${message}</span>
    `;

    this.activityLog.prepend(item);

    // Keep only last 50 items
    while (this.activityLog.children.length > 50) {
      this.activityLog.lastChild.remove();
    }
  }

  // App content templates

  _getEditorContent() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #0d1117;
            color: #e6edf3;
            padding: 16px;
            height: 100vh;
          }
          textarea {
            width: 100%;
            height: calc(100% - 40px);
            background: #161b22;
            color: #e6edf3;
            border: 1px solid #30363d;
            border-radius: 4px;
            padding: 12px;
            font-family: inherit;
            font-size: 13px;
            resize: none;
          }
          .toolbar {
            margin-bottom: 8px;
          }
          button {
            background: #238636;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          }
          button:hover { background: #2ea043; }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button id="save">Save Snapshot</button>
        </div>
        <textarea id="editor" placeholder="Start typing..."></textarea>
        <script>
          const editor = document.getElementById('editor');
          document.getElementById('save').addEventListener('click', () => {
            parent.postMessage({
              type: 'snapshot',
              data: { content: editor.value, cursor: editor.selectionStart }
            }, '*');
          });

          window.addEventListener('message', (e) => {
            if (e.data.type === 'restore') {
              editor.value = e.data.data.content || '';
              if (e.data.data.cursor) {
                editor.selectionStart = editor.selectionEnd = e.data.data.cursor;
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  _getRendererContent() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #0d1117;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #7d8590;
            font-family: sans-serif;
          }
          canvas {
            border: 1px solid #30363d;
            border-radius: 4px;
          }
          .placeholder {
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="placeholder">
          <canvas id="canvas" width="300" height="200"></canvas>
          <p style="margin-top: 8px; font-size: 12px;">WebGPU/Lucid renderer placeholder</p>
        </div>
        <script>
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');

          // Simple animated gradient
          let hue = 0;
          function draw() {
            hue = (hue + 0.5) % 360;
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, \`hsl(\${hue}, 70%, 20%)\`);
            grad.addColorStop(1, \`hsl(\${(hue + 60) % 360}, 70%, 30%)\`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw some shapes
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.arc(150 + Math.sin(hue * 0.02) * 50, 100, 40, 0, Math.PI * 2);
            ctx.fill();

            requestAnimationFrame(draw);
          }
          draw();
        </script>
      </body>
      </html>
    `;
  }

  _getChatContent() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
          .message {
            margin-bottom: 12px;
            padding: 8px 12px;
            border-radius: 8px;
            max-width: 80%;
          }
          .message.user {
            background: #238636;
            margin-left: auto;
          }
          .message.ai {
            background: #6e40c9;
          }
          .input-area {
            padding: 12px;
            border-top: 1px solid #30363d;
            display: flex;
            gap: 8px;
          }
          input {
            flex: 1;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 4px;
            padding: 8px 12px;
            color: #e6edf3;
            font-size: 13px;
          }
          button {
            background: #58a6ff;
            color: #0d1117;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="messages" id="messages">
          <div class="message ai">Hello! I'm a chat placeholder. MCP tools would connect here.</div>
        </div>
        <div class="input-area">
          <input type="text" id="input" placeholder="Type a message...">
          <button id="send">Send</button>
        </div>
        <script>
          const messages = document.getElementById('messages');
          const input = document.getElementById('input');

          function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.textContent = text;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
          }

          function send() {
            const text = input.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            input.value = '';

            // Request tool via parent
            parent.postMessage({
              type: 'tool-request',
              id: crypto.randomUUID(),
              tool: 'chat',
              params: { message: text }
            }, '*');

            // Mock response
            setTimeout(() => {
              addMessage('This is a placeholder response. Real MCP integration coming soon!', 'ai');
            }, 800);
          }

          document.getElementById('send').addEventListener('click', send);
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') send();
          });
        </script>
      </body>
      </html>
    `;
  }
}

// Initialize shell when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.shell = new TimelineShell();
});
