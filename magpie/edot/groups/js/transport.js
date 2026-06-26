// transport.js — pluggable XMPP stanza transports for the Groups client.
//
//   LoopbackTransport   — an in-memory fake "server": reflects your groupchat
//                         messages and runs a friendly echo bot, so the whole UI
//                         works offline and is testable headlessly.
//   WebSocketTransport  — real XMPP-over-WebSocket (RFC 7395). Connects and
//                         streams stanzas to/from a server. The SASL/bind
//                         handshake is intentionally minimal and UNVERIFIED here
//                         (no server/credentials in this environment) — it's the
//                         path to make live, but the demo runs on loopback.
//
// Both expose: connect(), send(xml), onStanza(cb), close().

import { groupMessage, NS } from './xmpp-stanzas.js';
import { XmppHandshake } from './xmpp-handshake.js';

let _seq = 0;
const nextId = () => `lb-${Date.now().toString(36)}-${++_seq}`;

function parse(xml) {
  return new DOMParser().parseFromString(xml, 'application/xml').documentElement;
}

export class LoopbackTransport {
  constructor({ jid = 'you@edot.local', seed = true } = {}) {
    this.jid = jid;
    this._handlers = [];
    this._participants = new Map(); // channel -> Set of jids
    this._seed = seed;
    this.connected = false;
  }
  onStanza(cb) { this._handlers.push(cb); return () => { this._handlers = this._handlers.filter((h) => h !== cb); }; }
  _emit(xml) { for (const h of this._handlers) h(xml); }
  async connect() { this.connected = true; return true; }
  close() { this.connected = false; }

  send(xml) {
    let el; try { el = parse(xml); } catch { return; }
    const join = el.querySelector(`client-join, join`);
    if (join) {
      const channel = el.querySelector('client-join')?.getAttribute('channel') || join.getAttribute('channel');
      this._join(channel);
      return;
    }
    if (el.querySelector('client-leave')) {
      const channel = el.querySelector('client-leave').getAttribute('channel');
      const set = this._participants.get(channel); if (set) set.delete(this.jid);
      this._announceParticipants(channel);
      return;
    }
    if (el.nodeName === 'message' && el.getAttribute('type') === 'groupchat') {
      const channel = el.getAttribute('to');
      const body = el.querySelector('body')?.textContent || '';
      const payload = el.querySelector('body')?.nextElementSibling;
      const payloadXml = payload ? new XMLSerializer().serializeToString(payload) : '';
      // Reflect the sender's own message back from the channel (as MIX does).
      this._later(() => this._emit(groupMessage({ id: nextId(), channel, from: `${this.jid}/${channel}`, body, payloadXml })));
      // A friendly echo bot replies (demo only).
      if (!/^\//.test(body)) this._later(() => this._emit(groupMessage({ id: nextId(), channel, from: `echobot@${channel}`, body: `echo: ${body}` })), 120);
    }
  }

  _join(channel) {
    if (!this._participants.has(channel)) this._participants.set(channel, new Set(this._seed ? [`echobot@${channel}`, `ada@${channel}`] : []));
    this._participants.get(channel).add(this.jid);
    this._later(() => {
      this._emit(groupMessage({ id: nextId(), channel, from: channel, body: `— joined ${channel} —` }));
      this._announceParticipants(channel);
    });
  }
  _announceParticipants(channel) {
    const jids = [...(this._participants.get(channel) || [])];
    const items = jids.map((j) => `<item id='${j}'><participant xmlns='${NS.CORE}'><jid>${j}</jid></participant></item>`).join('');
    this._emit(`<message from='${channel}' type='groupchat'><event xmlns='http://jabber.org/protocol/pubsub#event'><items node='${NS.NODE_PARTICIPANTS}'>${items}</items></event></message>`);
  }
  _later(fn, ms = 30) { setTimeout(fn, ms); }
}

export class WebSocketTransport {
  constructor({ url, jid, password, domain }) {
    this.url = url; this.jid = jid; this.password = password;
    this.domain = domain || (jid && jid.split('@')[1]) || '';
    this._handlers = [];
    this.connected = false;
  }
  onStanza(cb) { this._handlers.push(cb); return () => { this._handlers = this._handlers.filter((h) => h !== cb); }; }
  _emit(xml) { for (const h of this._handlers) h(xml); }
  async connect() {
    // Drive the real RFC 7395 + SASL (SCRAM-SHA-1) + bind login. The handshake is
    // the unit-tested state machine; here we just pump bytes through the socket.
    this._hs = new XmppHandshake({ jid: this.jid, password: this.password, domain: this.domain });
    this._ready = false;
    await new Promise((res, rej) => {
      this.ws = new WebSocket(this.url, 'xmpp');
      const sendAll = (arr) => { for (const x of arr || []) this.ws.send(x); };
      this.ws.onopen = () => { this.connected = true; sendAll(this._hs.start()); };
      this.ws.onerror = () => rej(new Error('WebSocket error'));
      this.ws.onclose = () => { this.connected = false; };
      this.ws.onmessage = async (ev) => {
        const data = typeof ev.data === 'string' ? ev.data : '';
        if (this._ready) { this._emit(data); return; }
        const r = await this._hs.receive(data);
        sendAll(r.out);
        if (r.event === 'ready') { this._ready = true; this.boundJid = r.jid; res(true); }
        else if (r.event === 'failure') { rej(new Error(`login failed: ${r.error}`)); }
      };
    });
  }
  send(xml) { if (this.ws && this.ws.readyState === 1) this.ws.send(xml); }
  close() { try { this.ws && this.ws.send("<close xmlns='urn:ietf:params:xml:ns:xmpp-framing'/>"); this.ws && this.ws.close(); } catch (_) {} }
}
