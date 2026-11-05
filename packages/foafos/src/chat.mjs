// FoafChat — the shell's XMPP connection and the bus room.
//
// The shell holds one XMPP connection and is an occupant of one MUC room
// (XEP-0045), "the bus room". Bus events on the mirror list go into the room
// as groupchat messages, so a person with an ordinary XMPP client (Gajim,
// Dino, Conversations, Profanity) can watch the apps talk; what others say in
// the room comes back onto the bus as `net.xmpp.message`, marked with source
// `net.xmpp`. Nothing said in a room is acted on: its members are nicknames.
// Commands come only by direct message, whose `from` the server stamps, from
// an account `mayCommand` accepts, and they go to `onCommand`. The shell makes
// that ToolGrants; `commandJids` is the old list, which it reads once and retires.
//
// Beside the bus room the connection carries other rooms and direct
// conversations, kept in `conversations` for the Chat window. Those are the
// person's own talk: nothing in them goes on the bus but a summary.
//
// Two places the server can be (config `mode`):
//
//   'builtin'  the Factoidal Lean XMPP server running IN THE PAGE
//              (@factoidal/core xmpp/inpage.mjs, the engine's message carrier):
//              no install, no network, gone when the tab closes. The default.
//              Its account passwords are made fresh at every start and held
//              in memory only. Nobody outside the page can reach it.
//   'server'   any XMPP server with a WebSocket endpoint (RFC 7395), such as
//              `factoidal xmpp-serve --muc` on localhost. The password is kept
//              in FoafSecrets under CHAT_OWNER and reached only through use().
//   'off'
//
// Design and log: docs/foafos-chat-20261103.md.

export const CHAT_OWNER = 'foafos.chat';
const PASSWORD = 'chat.password';

/** Bus topics that go into the room by default: what the apps do, not what they hold. */
const OLD_MIRROR = ['app.spawn', 'app.close', 'audio.*', 'minigame.*', 'wm.mode', 'story.state', 'pods.status', 'chat.say'];
export const DEFAULT_MIRROR = [...OLD_MIRROR, 'app.tools', 'tools.called'];

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'builtin',
  // 'server' mode only:
  url: 'ws://127.0.0.1:5280/xmpp-websocket',
  domain: 'localhost',
  username: '',
  // Both modes:
  room: 'bus',
  roomDomain: '',          // '' = 'rooms.' + domain
  nick: 'foafos',
  mirror: DEFAULT_MIRROR,
  rooms: [],               // other rooms to rejoin, as bare JIDs
  commandJids: [],         // accounts whose direct messages may run commands
});

export const BUILTIN_DOMAIN = 'foafos.local';
const MAX_BODY = 2000;      // characters of one mirrored event
const MAX_KEPT = 500;       // messages kept per conversation
const RETRY_MS = [1000, 2000, 5000, 10000, 30000];
const NS_MUC_USER = 'http://jabber.org/protocol/muc#user';
const NS_ITEMS = 'http://jabber.org/protocol/disco#items';
const RATE = 20;            // mirrored events per second, at most

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const matches = (pattern, topic) => pattern === '*' || pattern === topic ||
  (pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -1)));

function randomPassword() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

export class FoafChat {
  /**
   * @param bus          the shell's FoafBus
   * @param secrets      FoafSecrets (the 'server' password, under CHAT_OWNER)
   * @param storage      localStorage-shaped, for the config (never a password)
   * @param connect      (opts) => XmppWs, i.e. XmppWs.connect
   * @param startBuiltin async ({domain, roomDomain, accounts}) => { WebSocket, close() }:
   *                     starts the in-page server; the shell supplies it (it
   *                     loads @factoidal/core), so this module loads no engine
   */
  constructor({ bus, secrets, storage = null, key = 'foafos.chat', connect, startBuiltin = null } = {}) {
    this.bus = bus;
    this.secrets = secrets;
    this.storage = storage;
    this.key = key;
    this.connect = connect;
    this.startBuiltin = startBuiltin;
    this.state = 'stopped';
    this.detail = '';
    this.log = [];            // the last 200 bus room messages
    this.conversations = new Map();
    this.onCommand = null;    // async (text, {from}) => string, from an allowed account
    this._listeners = new Set();
    this._x = null;
    this._server = null;
    this._unsub = null;
    this._sent = [];
    this._seq = 0;
    this._retry = 0;
    this._retryTimer = null;
    this._wanted = false;     // the person wants this connected
    this.mayCommand = null;   // (jid) => boolean; null: the commandJids list
    secrets?.grant?.(CHAT_OWNER, ['secrets']);
    this.cfg = { ...DEFAULT_CONFIG };
    try {
      const saved = JSON.parse(storage?.getItem(key) || 'null');
      if (saved && typeof saved === 'object') this.cfg = { ...DEFAULT_CONFIG, ...saved };
      if (this.cfg.mirror.join(' ') === OLD_MIRROR.join(' ')) this.cfg.mirror = DEFAULT_MIRROR;
    } catch { /* unreadable: defaults */ }
  }

  config() { return { ...this.cfg, mirror: [...this.cfg.mirror], hasPassword: this.hasPassword() }; }
  hasPassword() { return this.secrets?.names?.(CHAT_OWNER)?.includes?.(PASSWORD) ?? false; }

  /** Is this topic on the mirror list? */
  mirrors(topic) { return this.cfg.mirror.some((p) => matches(p, topic)); }

  /** Be told when anything the Chat window shows has changed. */
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _changed(what) { for (const fn of this._listeners) { try { fn(what); } catch { /* a listener's problem */ } } }

  /** Change the config (and, for 'server', the password). Restart to apply. */
  configure(partial = {}, { password } = {}) {
    const next = { ...this.cfg };
    for (const k of Object.keys(DEFAULT_CONFIG)) if (partial[k] !== undefined) next[k] = partial[k];
    if (!['builtin', 'server', 'off'].includes(next.mode)) return { ok: false, reason: 'bad-mode' };
    if (next.mode === 'server') {
      let u;
      try { u = new URL(next.url); } catch { return { ok: false, reason: 'bad-url' }; }
      if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return { ok: false, reason: 'bad-url' };
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(next.room) || !/^[^\s/@<>'"&]{1,64}$/.test(next.nick)) return { ok: false, reason: 'bad-name' };
    if (!Array.isArray(next.mirror) || next.mirror.some((t) => typeof t !== 'string')) return { ok: false, reason: 'bad-mirror' };
    if (!Array.isArray(next.commandJids) || next.commandJids.some((j) => !/^[^\s@/]+@[^\s@/]+$/.test(j))) return { ok: false, reason: 'bad-jid' };
    this.cfg = next;
    this._save();
    if (typeof password === 'string' && password !== '') this.secrets.put(CHAT_OWNER, PASSWORD, password);
    return { ok: true };
  }

  _save() { try { this.storage?.setItem(this.key, JSON.stringify(this.cfg)); } catch { /* full or blocked */ } }

  domain() { return this.cfg.mode === 'builtin' ? BUILTIN_DOMAIN : this.cfg.domain; }
  roomDomain() { return this.cfg.roomDomain || 'rooms.' + this.domain(); }

  /** The bus room's bare JID. */
  roomJid() { return `${this.cfg.room}@${this.roomDomain()}`; }

  _status(state, detail = '') {
    this.state = state;
    this.detail = detail;
    this.bus?.publish('chat.status', { summary: `chat ${state}${detail ? ': ' + detail : ''}`, state, mode: this.cfg.mode, room: this.roomJid() });
    this._changed('status');
  }

  async start() {
    this._wanted = true;
    clearTimeout(this._retryTimer);
    await this._teardown();
    if (this.cfg.mode === 'off') { this._status('off'); return { ok: true }; }
    this._status('connecting');
    let failure = null;
    try {
      if (this.cfg.mode === 'builtin') {
        if (!this.startBuiltin) throw new Error('this shell has no built-in XMPP server');
        const password = randomPassword();
        this._server = await this.startBuiltin({ domain: BUILTIN_DOMAIN, roomDomain: this.roomDomain(), accounts: [{ username: 'shell', password }] });
        this._x = await this.connect({ url: 'xmpp-inpage:', WebSocket: this._server.WebSocket, domain: BUILTIN_DOMAIN, username: 'shell', password, resource: 'shell' });
      } else {
        // secrets.use() keeps a failure's message from the caller, in case it
        // holds the secret. An XmppError is ours and never does, so keep that one.
        const used = await this.secrets.use(CHAT_OWNER, PASSWORD, async (password) => {
          try {
            return await this.connect({ url: this.cfg.url, domain: this.cfg.domain, username: this.cfg.username, password, resource: 'foafos' });
          } catch (e) {
            if (e?.constructor?.name === 'XmppError') failure = e.message;
            throw e;
          }
        });
        if (!used.ok) throw new Error(used.reason === 'missing' ? 'no password is set' : failure || used.reason);
        this._x = used.result;
      }
    } catch (e) {
      await this._teardown();
      this._wanted = false;
      this._status('error', e.message);
      return { ok: false, reason: e.message };
    }
    this._retry = 0;
    const x = this._x;
    x.onstanza = (el) => this._stanza(el);
    x.onclose = () => { if (this._x === x) this._lost(); };
    const room = this.roomJid();
    // The bus room moves with the server: the old one is gone from here.
    for (const [jid, c] of this.conversations) if (c.bus && jid !== room) this.conversations.delete(jid);
    this._conversation(room, 'room', { title: this.cfg.room, nick: this.cfg.nick, bus: true });
    this._enter(room, this.cfg.nick);
    for (const jid of this.cfg.rooms) { this._conversation(jid, 'room', { nick: this.cfg.nick }); this._enter(jid, this.cfg.nick); }
    this._unsub = this.bus.subscribe('*', (e) => this._mirror(e, room));
    this._status('online', `${x.jid} in ${room}`);
    return { ok: true };
  }

  /** The connection ended on its own: try again, with growing gaps. */
  async _lost() {
    await this._teardown();
    for (const c of this.conversations.values()) { c.joined = false; c.occupants.clear(); }
    if (!this._wanted) return;
    const wait = RETRY_MS[Math.min(this._retry++, RETRY_MS.length - 1)];
    this._status('reconnecting', `trying again in ${Math.round(wait / 1000)}s`);
    this._retryTimer = setTimeout(async () => {
      const r = await this.start();
      // A refused password will not get better by trying again. Anything else might.
      if (!r.ok && !/authorized|password/i.test(r.reason)) { this._wanted = true; this._lost(); }
    }, wait);
  }

  async _teardown() {
    this._unsub?.(); this._unsub = null;
    const x = this._x;
    this._x = null;
    if (x) x.onclose = null;
    try { x?.close?.(); } catch { /* gone */ }
    try { this._server?.close?.(); } catch { /* gone */ }
    this._server = null;
  }

  async stop(quiet = false) {
    this._wanted = false;
    clearTimeout(this._retryTimer);
    await this._teardown();
    for (const c of this.conversations.values()) { c.joined = false; c.occupants.clear(); }
    if (!quiet && this.state !== 'stopped') this._status('stopped');
  }

  // ── conversations ──────────────────────────────────────────────────────
  _conversation(jid, kind, extra = {}) {
    let c = this.conversations.get(jid);
    if (!c) {
      c = { jid, kind, title: jid.split('@')[0], messages: [], occupants: new Map(), unread: 0, joined: false, nick: this.cfg.nick, bus: false, error: '' };
      this.conversations.set(jid, c);
    }
    Object.assign(c, extra);
    return c;
  }

  _push(c, m) {
    c.messages.push({ id: ++this._seq, ts: Date.now(), ...m });
    if (c.messages.length > MAX_KEPT) c.messages.shift();
    if (!m.self && m.kind !== 'event') c.unread++;
    this._changed('messages');
  }

  _enter(jid, nick) {
    this._x?.send(`<presence xmlns="jabber:client" to="${esc(jid)}/${esc(nick)}"><x xmlns="http://jabber.org/protocol/muc"/></presence>`);
  }

  /** Join a room: a name in the room service, or a full room JID. */
  joinRoom(name) {
    if (!this._x) return { ok: false, reason: 'offline' };
    const n = String(name).trim();
    if (!/^[^\s/<>'"&]{1,128}$/.test(n)) return { ok: false, reason: 'bad-name' };
    const jid = n.includes('@') ? n : `${n}@${this.roomDomain()}`;
    this._conversation(jid, 'room');
    this._enter(jid, this.cfg.nick);
    if (jid !== this.roomJid() && !this.cfg.rooms.includes(jid)) { this.cfg.rooms = [...this.cfg.rooms, jid]; this._save(); }
    this._changed('list');
    return { ok: true, jid };
  }

  leaveRoom(jid) {
    const c = this.conversations.get(jid);
    if (!c || c.kind !== 'room' || c.bus) return { ok: false };
    this._x?.send(`<presence xmlns="jabber:client" to="${esc(jid)}/${esc(c.nick)}" type="unavailable"/>`);
    this.cfg.rooms = this.cfg.rooms.filter((r) => r !== jid);
    this._save();
    this.conversations.delete(jid);
    this._changed('list');
    return { ok: true };
  }

  /** Start talking with one account. */
  openDirect(jid) {
    const j = String(jid).trim();
    if (!/^[^\s@/<>'"&]+@[^\s@/<>'"&]+$/.test(j)) return { ok: false, reason: 'bad-jid' };
    this._conversation(j, 'direct');
    this._changed('list');
    return { ok: true, jid: j };
  }

  /** The rooms the server lists. */
  async listRooms() {
    if (!this._x) return [];
    const r = await this._x.iq(`<iq xmlns="jabber:client" type="get" id="c${++this._seq}" to="${esc(this.roomDomain())}"><query xmlns="${NS_ITEMS}"/></iq>`);
    return [...r.getElementsByTagNameNS(NS_ITEMS, 'item')].map((i) => ({ jid: i.getAttribute('jid'), name: i.getAttribute('name') || i.getAttribute('jid') }));
  }

  markRead(jid) { const c = this.conversations.get(jid); if (c && c.unread) { c.unread = 0; this._changed('list'); } }
  clear(jid) { const c = this.conversations.get(jid); if (c) { c.messages = []; this._changed('messages'); } }

  /** Say something in the bus room as the shell. */
  say(text) {
    if (!this._x) return { ok: false, reason: 'offline' };
    this._groupchat(this.roomJid(), String(text).slice(0, MAX_BODY));
    return { ok: true };
  }

  /** Send to a room or an account. */
  send(jid, text) {
    if (!this._x) return { ok: false, reason: 'offline' };
    const c = this.conversations.get(jid);
    if (!c) return { ok: false, reason: 'no-conversation' };
    const body = String(text).slice(0, MAX_BODY);
    if (c.kind === 'room') { this._groupchat(jid, body); return { ok: true }; }
    this._direct(jid, body);
    this._push(c, { kind: 'message', nick: this.cfg.username || 'you', body, self: true });
    return { ok: true };
  }

  _groupchat(jid, body) {
    this._x.send(`<message xmlns="jabber:client" to="${esc(jid)}" type="groupchat"><body>${esc(body)}</body></message>`);
  }

  _direct(jid, body) {
    this._x.send(`<message xmlns="jabber:client" to="${esc(jid)}" type="chat"><body>${esc(body)}</body></message>`);
  }

  _mirror(e, room) {
    if (!this._x || e.source !== 'local' || e.topic.startsWith('chat.status') || e.topic.startsWith('net.')) return;
    if (!this.mirrors(e.topic)) return;
    const now = Date.now();
    this._sent = this._sent.filter((t) => now - t < 1000);
    if (this._sent.length >= RATE) return;
    this._sent.push(now);
    let data = '';
    try { data = JSON.stringify(e.data); } catch { data = '"(not serialisable)"'; }
    this._groupchat(room, `${e.topic} ${data}`.slice(0, MAX_BODY));
  }

  _stanza(el) {
    if (el.localName === 'presence') this._presence(el);
    else if (el.localName === 'message') this._message(el);
  }

  _presence(el) {
    const from = el.getAttribute('from') || '';
    const [bare, nick] = splitJid(from);
    const c = this.conversations.get(bare);
    if (!c || c.kind !== 'room' || !nick) return;
    const type = el.getAttribute('type');
    if (type === 'error') {
      c.error = errorCondition(el);
      this._push(c, { kind: 'notice', body: `Could not join this room: ${c.error}.` });
      return;
    }
    const x = [...el.children].find((k) => k.namespaceURI === NS_MUC_USER);
    const self = !!x && [...x.children].some((k) => k.localName === 'status' && k.getAttribute('code') === '110');
    if (type === 'unavailable') c.occupants.delete(nick);
    else {
      const role = x ? [...x.children].find((k) => k.localName === 'item')?.getAttribute('role') : null;
      c.occupants.set(nick, { nick, role: role || 'participant', self });
      if (self) { c.joined = true; c.nick = nick; c.error = ''; }
    }
    this._changed('members');
  }

  _message(el) {
    const type = el.getAttribute('type');
    const from = el.getAttribute('from') || '';
    const [bare, resource] = splitJid(from);
    const body = [...el.children].find((c) => c.localName === 'body')?.textContent ?? '';
    if (type === 'error') {
      const c = this.conversations.get(bare);
      if (c) this._push(c, { kind: 'notice', body: `That message was not delivered: ${errorCondition(el)}.` });
      return;
    }
    if (!body) return;
    if (type === 'groupchat') this._roomMessage(bare, resource, body);
    else if (!resource || !this.conversations.get(bare) || this.conversations.get(bare).kind === 'direct') this._directMessage(bare, body);
    else this._push(this.conversations.get(bare), { kind: 'message', nick: resource, body, private: true });
  }

  _roomMessage(jid, nick, body) {
    const c = this.conversations.get(jid);
    if (!c || !nick) return;
    const self = nick === c.nick;
    const event = c.bus ? parseEvent(body) : null;
    this._push(c, event ? { kind: 'event', nick, self, ...event } : { kind: 'message', nick, body, self });
    if (!c.bus) return;
    this.log.push({ ts: Date.now(), nick, body, self });
    if (this.log.length > 200) this.log.shift();
    this.bus.publish('chat.message', { nick, body, self });
    if (!self) this.bus.publish('net.xmpp.message', { summary: `${nick}: ${body.slice(0, 80)}`, room: jid, nick, body }, { source: 'net.xmpp' });
  }

  async _directMessage(jid, body) {
    const c = this._conversation(jid, 'direct');
    this._push(c, { kind: 'message', nick: jid.split('@')[0], body, self: false });
    const may = this.mayCommand ? this.mayCommand(jid) : this.cfg.commandJids.includes(jid);
    if (!body.startsWith('/') || !this.onCommand || !may) return;
    let reply;
    try { reply = await this.onCommand(body, { from: jid }); } catch (e) { reply = `That failed: ${e.message}`; }
    if (!reply || !this._x) return;
    const out = String(reply).slice(0, 8000);
    this._direct(jid, out);
    this._push(c, { kind: 'message', nick: this.cfg.username || 'foafos', body: out, self: true });
  }
}

function splitJid(j) {
  const i = j.indexOf('/');
  return i < 0 ? [j, ''] : [j.slice(0, i), j.slice(i + 1)];
}

function errorCondition(el) {
  const e = [...el.children].find((c) => c.localName === 'error');
  return e?.firstElementChild?.localName || 'unknown error';
}

/** `<topic> <JSON>`, as _mirror writes it, or null. */
function parseEvent(body) {
  const m = /^([a-z][a-z0-9_-]*(?:\.[a-zA-Z0-9_*-]+)+) ([\s\S]*)$/.exec(body);
  if (!m) return null;
  try { const data = JSON.parse(m[2]); return { topic: m[1], data, body }; } catch { return null; }
}
