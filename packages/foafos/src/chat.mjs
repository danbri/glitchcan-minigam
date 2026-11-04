// FoafChat — the shell's XMPP connection and the bus room.
//
// The shell holds one XMPP connection and is an occupant of one MUC room
// (XEP-0045), "the bus room". Bus events on the mirror list go into the room
// as groupchat messages, so a person with an ordinary XMPP client (Gajim,
// Dino, Conversations, Profanity) can watch the apps talk; what others say in
// the room comes back onto the bus as `net.xmpp.message`, marked with source
// `net.xmpp`. Nothing said in the room is acted on yet: commands will come in
// through an app-tree node with its own grants, never as raw bus events.
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
export const DEFAULT_MIRROR = ['app.spawn', 'app.close', 'audio.*', 'minigame.*', 'wm.mode', 'story.state', 'pods.status', 'chat.say'];

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
});

export const BUILTIN_DOMAIN = 'foafos.local';
const MAX_BODY = 2000;      // characters of one mirrored event
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
    this.log = [];            // the last 200 room messages, for the Chat window
    this._x = null;
    this._server = null;
    this._unsub = null;
    this._sent = [];
    secrets?.grant?.(CHAT_OWNER, ['secrets']);
    this.cfg = { ...DEFAULT_CONFIG };
    try {
      const saved = JSON.parse(storage?.getItem(key) || 'null');
      if (saved && typeof saved === 'object') this.cfg = { ...DEFAULT_CONFIG, ...saved };
    } catch { /* unreadable: defaults */ }
  }

  config() { return { ...this.cfg, mirror: [...this.cfg.mirror], hasPassword: this.secrets?.names?.(CHAT_OWNER)?.includes?.(PASSWORD) ?? false }; }

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
    this.cfg = next;
    try { this.storage?.setItem(this.key, JSON.stringify(this.cfg)); } catch { /* full or blocked */ }
    if (typeof password === 'string' && password !== '') this.secrets.put(CHAT_OWNER, PASSWORD, password);
    return { ok: true };
  }

  /** The room's bare JID. */
  roomJid() {
    const domain = this.cfg.mode === 'builtin' ? BUILTIN_DOMAIN : this.cfg.domain;
    return `${this.cfg.room}@${this.cfg.roomDomain || 'rooms.' + domain}`;
  }

  _status(state, detail = '') {
    this.state = state;
    this.detail = detail;
    this.bus?.publish('chat.status', { summary: `chat ${state}${detail ? ': ' + detail : ''}`, state, mode: this.cfg.mode, room: this.roomJid() }, { retain: true });
  }

  async start() {
    await this.stop();
    if (this.cfg.mode === 'off') { this._status('off'); return { ok: true }; }
    this._status('connecting');
    try {
      if (this.cfg.mode === 'builtin') {
        if (!this.startBuiltin) throw new Error('this shell has no built-in XMPP server');
        const password = randomPassword();
        const roomDomain = this.cfg.roomDomain || 'rooms.' + BUILTIN_DOMAIN;
        this._server = await this.startBuiltin({ domain: BUILTIN_DOMAIN, roomDomain, accounts: [{ username: 'shell', password }] });
        this._x = await this.connect({ url: 'xmpp-inpage:', WebSocket: this._server.WebSocket, domain: BUILTIN_DOMAIN, username: 'shell', password, resource: 'shell' });
      } else {
        const used = await this.secrets.use(CHAT_OWNER, PASSWORD, (password) =>
          this.connect({ url: this.cfg.url, domain: this.cfg.domain, username: this.cfg.username, password, resource: 'foafos' }));
        if (!used.ok) throw new Error(used.reason === 'missing' ? 'no password is set' : used.reason);
        this._x = used.result;
      }
    } catch (e) {
      await this.stop(true);
      this._status('error', e.message);
      return { ok: false, reason: e.message };
    }
    const room = this.roomJid();
    this._x.onstanza = (el) => this._stanza(el, room);
    this._x.send(`<presence xmlns="jabber:client" to="${esc(room)}/${esc(this.cfg.nick)}"><x xmlns="http://jabber.org/protocol/muc"/></presence>`);
    this._unsub = this.bus.subscribe('*', (e) => this._mirror(e, room));
    this._status('online', `${this._x.jid} in ${room}`);
    return { ok: true };
  }

  async stop(quiet = false) {
    this._unsub?.(); this._unsub = null;
    try { this._x?.close?.(); } catch { /* gone */ }
    this._x = null;
    try { this._server?.close?.(); } catch { /* gone */ }
    this._server = null;
    if (!quiet && this.state !== 'stopped') this._status('stopped');
  }

  /** Say something in the room as the shell (the Chat window's input). */
  say(text) {
    if (!this._x) return { ok: false, reason: 'offline' };
    this._groupchat(String(text).slice(0, MAX_BODY));
    return { ok: true };
  }

  _groupchat(body) {
    this._x.send(`<message xmlns="jabber:client" to="${esc(this.roomJid())}" type="groupchat"><body>${esc(body)}</body></message>`);
  }

  _mirror(e, room) {
    if (!this._x || e.source !== 'local' || e.topic.startsWith('chat.status') || e.topic.startsWith('net.')) return;
    if (!this.cfg.mirror.some((p) => matches(p, e.topic))) return;
    const now = Date.now();
    this._sent = this._sent.filter((t) => now - t < 1000);
    if (this._sent.length >= RATE) return;
    this._sent.push(now);
    let data = '';
    try { data = JSON.stringify(e.data); } catch { data = '"(not serialisable)"'; }
    this._groupchat(`${e.topic} ${data}`.slice(0, MAX_BODY));
  }

  _stanza(el, room) {
    if (el.localName !== 'message' || el.getAttribute('type') !== 'groupchat') return;
    const from = el.getAttribute('from') || '';
    if (!from.startsWith(room + '/')) return;
    const nick = from.slice(room.length + 1);
    const body = [...el.children].find((c) => c.localName === 'body')?.textContent ?? '';
    this.log.push({ ts: Date.now(), nick, body, self: nick === this.cfg.nick });
    if (this.log.length > 200) this.log.shift();
    this.bus.publish('chat.message', { nick, body, self: nick === this.cfg.nick });
    if (nick !== this.cfg.nick) {
      this.bus.publish('net.xmpp.message', { summary: `${nick}: ${body.slice(0, 80)}`, room, nick, body }, { source: 'net.xmpp' });
    }
  }
}
