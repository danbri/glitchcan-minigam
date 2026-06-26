// groups-app.js — <edot-groups>: a MIX-based groupchat client for groupware.
// MIX (XEP-0369/0405) is the modern successor to MUC. Ships in an offline demo
// mode (loopback transport + echo bot) so it works with zero setup; Settings can
// point it at a real XMPP-over-WebSocket server. Other apps post into a channel
// via the `groups.share` capability (used by Calendar to share .ics calendars).
import { getKernel } from '../../js/edot-kernel.js';
import { LoopbackTransport, WebSocketTransport } from './transport.js';
import { joinChannel, leaveChannel, groupMessage, NS } from './xmpp-stanzas.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _id = 0; const mkId = () => `g-${Date.now().toString(36)}-${++_id}`;
const shortJid = (j) => String(j || '').split('/')[0].split('@')[0];

class EdotGroups extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return; this._mounted = true;
    this.kernel = getKernel();
    this.jid = 'you@edot.local';
    this.channels = new Map();   // channelJid -> { name, messages:[], participants:Set }
    this.active = null;
    this.transport = null;
    this.render();
    this.connectDemo();
    try { this.kernel.capabilities.provide('groups.share', (p) => this.shareIntoActive(p)); } catch (_) {}
  }

  async connectDemo() {
    this.transport = new LoopbackTransport({ jid: this.jid });
    this._unsub = this.transport.onStanza((xml) => this._onStanza(xml));
    await this.transport.connect();
    this._setStatus('Demo mode — messages stay on this device. Connect a server in Settings.');
    for (const c of ['general@groups.edot.local', 'random@groups.edot.local']) this.joinChannel(c);
    this.selectChannel('general@groups.edot.local');
  }

  // ---- protocol ----
  joinChannel(channel, nick) {
    if (!this.channels.has(channel)) this.channels.set(channel, { name: shortJid(channel), messages: [], participants: new Set() });
    this.transport.send(joinChannel({ id: mkId(), channel, nick: nick || shortJid(this.jid) }));
    this._renderChannels();
  }
  leaveChannel(channel) {
    this.transport.send(leaveChannel({ id: mkId(), channel }));
    this.channels.delete(channel);
    if (this.active === channel) this.active = null;
    this._renderChannels(); this._renderTimeline(); this._renderParticipants();
  }
  sendMessage(body, payloadXml = '') {
    if (!this.active || !body.trim()) return;
    this.transport.send(groupMessage({ id: mkId(), channel: this.active, from: this.jid, body, payloadXml }));
  }
  // Capability: post a shared object (calendar/feed/doc) into the active channel.
  shareIntoActive({ title, kind, body, payload } = {}) {
    if (!this.active) { this._setStatus('Open a channel first to share into it.'); return false; }
    const summary = body || `📎 Shared ${kind || 'item'}: ${title || ''}`.trim();
    const payloadXml = payload ? `<edot-share xmlns='urn:edot:share' kind='${esc(kind || '')}' title='${esc(title || '')}'>${esc(JSON.stringify(payload))}</edot-share>` : '';
    this.sendMessage(summary, payloadXml);
    return true;
  }

  _onStanza(xml) {
    let el; try { el = new DOMParser().parseFromString(xml, 'application/xml').documentElement; } catch { return; }
    // participant list update (pubsub event on the participants node)
    const items = el.querySelector(`items[node='${NS.NODE_PARTICIPANTS}']`);
    if (items) {
      const channel = el.getAttribute('from');
      const ch = this.channels.get(channel); if (!ch) return;
      ch.participants = new Set([...items.querySelectorAll('participant > jid, jid')].map((n) => n.textContent));
      if (this.active === channel) this._renderParticipants();
      return;
    }
    if (el.nodeName === 'message' && el.getAttribute('type') === 'groupchat') {
      const body = el.querySelector('body'); if (!body) return;
      const channel = (el.getAttribute('from') || '').split('/')[0];
      const ch = this.channels.get(channel) || this.channels.get(this.active); if (!ch) return;
      const share = el.querySelector('edot-share');
      ch.messages.push({
        from: shortJid(el.getAttribute('from')),
        body: body.textContent,
        system: el.getAttribute('from') && !el.getAttribute('from').includes('@'),
        share: share ? { kind: share.getAttribute('kind'), title: share.getAttribute('title') } : null,
        ts: Date.now(),
      });
      if (this.active === channel || this.channels.get(this.active) === ch) this._renderTimeline();
      this._renderChannels();
    }
  }

  selectChannel(channel) {
    this.active = channel;
    this._root.classList.remove('gr-show-channels');
    this._renderChannels(); this._renderTimeline(); this._renderParticipants();
    this.querySelector('.gr-head-name').textContent = '#' + (this.channels.get(channel)?.name || '');
  }

  // ---- UI ----
  render() {
    this.innerHTML = `
      <div class="gr-app">
        <aside class="gr-channels">
          <div class="gr-side-h"><span>Channels</span>
            <button class="gr-icon gr-settings" title="Connect a server" aria-label="Settings">⚙</button></div>
          <div class="gr-channel-list"></div>
          <button class="gr-join" type="button">＋ Join channel</button>
        </aside>
        <main class="gr-main">
          <header class="gr-head">
            <button class="gr-icon gr-burger" title="Channels" aria-label="Channels">☰</button>
            <span class="gr-head-name">#</span>
            <button class="gr-icon gr-people" title="Participants" aria-label="Participants">👥</button>
          </header>
          <div class="gr-status" role="status"></div>
          <div class="gr-timeline"></div>
          <form class="gr-composer">
            <input class="gr-input" type="text" placeholder="Message…" aria-label="Message" autocomplete="off">
            <button class="gr-send" type="submit">Send</button>
          </form>
        </main>
        <aside class="gr-participants"><div class="gr-side-h">Participants</div><div class="gr-people-list"></div></aside>
        <div class="gr-settings-panel" hidden></div>
      </div>`;
    this._root = this.querySelector('.gr-app');
    this.querySelector('.gr-composer').addEventListener('submit', (e) => {
      e.preventDefault(); const inp = this.querySelector('.gr-input');
      this.sendMessage(inp.value); inp.value = ''; inp.focus();
    });
    this.querySelector('.gr-join').addEventListener('click', () => this._joinPrompt());
    this.querySelector('.gr-burger').addEventListener('click', () => this._root.classList.toggle('gr-show-channels'));
    this.querySelector('.gr-people').addEventListener('click', () => this._root.classList.toggle('gr-show-people'));
    this.querySelector('.gr-settings').addEventListener('click', () => this._toggleSettings());
  }

  _setStatus(msg) { const s = this.querySelector('.gr-status'); if (s) s.textContent = msg || ''; }

  _renderChannels() {
    const list = this.querySelector('.gr-channel-list'); if (!list) return;
    list.innerHTML = '';
    for (const [jid, ch] of this.channels) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'gr-channel' + (jid === this.active ? ' active' : '');
      b.innerHTML = `<span class="gr-hash">#</span><span class="gr-ch-name"></span>`;
      b.querySelector('.gr-ch-name').textContent = ch.name;
      b.addEventListener('click', () => this.selectChannel(jid));
      list.appendChild(b);
    }
  }
  _renderTimeline() {
    const tl = this.querySelector('.gr-timeline'); if (!tl) return;
    const ch = this.channels.get(this.active);
    tl.innerHTML = '';
    if (!ch) { tl.innerHTML = '<div class="gr-empty">Pick a channel to start.</div>'; return; }
    for (const m of ch.messages) {
      const row = document.createElement('div');
      row.className = 'gr-msg' + (m.system ? ' system' : '') + (shortJid(m.from) === shortJid(this.jid) ? ' me' : '');
      if (m.system) { row.textContent = m.body; }
      else {
        row.innerHTML = `<div class="gr-msg-from"></div><div class="gr-msg-body"></div>`;
        row.querySelector('.gr-msg-from').textContent = m.from;
        row.querySelector('.gr-msg-body').textContent = m.body;
        if (m.share) { const c = document.createElement('div'); c.className = 'gr-share-card'; c.textContent = `📎 ${m.share.kind || 'item'}: ${m.share.title || ''}`; row.appendChild(c); }
      }
      tl.appendChild(row);
    }
    tl.scrollTop = tl.scrollHeight;
  }
  _renderParticipants() {
    const list = this.querySelector('.gr-people-list'); if (!list) return;
    const ch = this.channels.get(this.active);
    list.innerHTML = '';
    for (const j of (ch ? ch.participants : [])) {
      const d = document.createElement('div'); d.className = 'gr-person'; d.textContent = shortJid(j);
      list.appendChild(d);
    }
  }

  _joinPrompt() {
    const name = (prompt('Join channel (name or full JID):', '') || '').trim();
    if (!name) return;
    const channel = name.includes('@') ? name : `${name}@groups.edot.local`;
    this.joinChannel(channel); this.selectChannel(channel);
  }

  _toggleSettings() {
    const p = this.querySelector('.gr-settings-panel');
    if (!p.hidden) { p.hidden = true; return; }
    p.hidden = false;
    p.innerHTML = `
      <div class="gr-settings-card">
        <h3>Connect an XMPP server</h3>
        <p class="gr-note">MIX over WebSocket (RFC 7395) with a real SCRAM-SHA-1 login (unit-tested). Live federation isn't verified in this build — demo mode stays on this device.</p>
        <label>WebSocket URL<input class="gr-f-url" placeholder="wss://example.org/xmpp-websocket"></label>
        <label>JID<input class="gr-f-jid" placeholder="you@example.org"></label>
        <label>Password<input class="gr-f-pw" type="password"></label>
        <div class="gr-settings-actions">
          <button class="gr-connect" type="button">Connect</button>
          <button class="gr-cancel" type="button">Cancel</button>
        </div>
      </div>`;
    p.querySelector('.gr-cancel').addEventListener('click', () => { p.hidden = true; });
    p.querySelector('.gr-connect').addEventListener('click', async () => {
      const url = p.querySelector('.gr-f-url').value.trim();
      const jid = p.querySelector('.gr-f-jid').value.trim();
      const password = p.querySelector('.gr-f-pw').value;
      if (!url || !jid) { this._setStatus('Enter a WebSocket URL and JID.'); return; }
      try {
        if (this._unsub) this._unsub();
        this.jid = jid;
        this.transport = new WebSocketTransport({ url, jid, password });
        this._unsub = this.transport.onStanza((xml) => this._onStanza(xml));
        await this.transport.connect();
        this._setStatus(`Connected to ${url} (handshake experimental).`);
        p.hidden = true;
      } catch (e) { this._setStatus(`Could not connect: ${e.message}`); }
    });
  }
}

if (!customElements.get('edot-groups')) customElements.define('edot-groups', EdotGroups);
export { EdotGroups };
