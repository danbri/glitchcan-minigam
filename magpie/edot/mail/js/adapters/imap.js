// imap.js — the raw IMAP/SMTP path, the HONEST one.
//
// ⚠️ A browser CANNOT open a raw TCP socket, so it cannot speak IMAP or SMTP
// directly. There is no way around this in a static page. This adapter
// therefore talks to a SMALL WebSocket PROXY over a documented JSON protocol;
// the proxy holds the real IMAP/SMTP connection on the server side. We
// implement the *client half* of that contract here and document the protocol
// in README.md — but we DO NOT build or deploy the proxy. Without a proxy URL,
// this adapter advertises its needs and refuses to pretend.
//
// ── proxy JSON protocol (client → proxy), one object per request ────────────
//   { id, op:'login',  host, port, secure, user, pass }        → { id, ok }
//   { id, op:'list' }                                          → { id, mailboxes:[{name,role,unread,total}] }
//   { id, op:'select', mailbox }                              → { id, exists, uidnext }
//   { id, op:'search', mailbox, query, limit, cursor }         → { id, uids:[…], nextCursor }
//   { id, op:'fetch',  mailbox, uid, what:'headers'|'full' }   → { id, raw }  (raw = RFC822 string)
//   { id, op:'store',  mailbox, uid, add:[…], remove:[…] }     → { id, ok }   (IMAP flags, e.g. \Seen \Flagged)
//   { id, op:'move',   mailbox, uid, dest }                    → { id, ok }
//   { id, op:'expunge',mailbox, uid }                          → { id, ok }
//   { id, op:'append', mailbox, raw }                          → { id, ok }  (save draft)
//   { id, op:'send',   raw, envelope }                         → { id, ok }  (proxy relays via SMTP)
//   The proxy replies with the matching `id`; { id, error } signals failure.
//
// The raw RFC822 that `fetch` returns is parsed by ../mime.js — that's exactly
// the structured-vs-raw boundary mime.js exists for.

import { MailAdapter, parseAddress, parseAddressList } from './base.js';
import { parseMessage } from '../mime.js';
import { buildRfc822 } from './gmail.js';

// IMAP system flags / special-use → our normalized role.
const ROLE = { inbox: 'inbox', sent: 'sent', drafts: 'drafts', trash: 'trash', junk: 'spam', spam: 'spam', archive: 'archive', all: 'archive' };

export class ImapAdapter extends MailAdapter {
  /**
   * @param {object} config  { proxyUrl, host, port, secure, user, pass,
   *                            socketFactory? }  socketFactory lets tests inject
   *                            a fake WebSocket — same spirit as the injectable
   *                            fetch elsewhere.
   */
  constructor(config = {}, opts = {}) {
    super(config, opts);
    this.id = 'imap';
    this.proxyUrl = config.proxyUrl || '';
    this._ws = null;
    this._seq = 0;
    this._pending = new Map();    // id → { resolve, reject }
    this._loggedIn = false;
  }

  capabilities() {
    // The proxy gives us everything; push depends on the proxy implementing IDLE.
    return { threads: false, search: true, push: false, flags: true, move: true, send: true };
  }

  // True only when a proxy is configured. The UI uses this to show an honest
  // "requires a WebSocket proxy" banner instead of a silent failure.
  isAvailable() { return !!this.proxyUrl; }

  // ---- WebSocket plumbing ----
  async _connect() {
    if (this._ws && this._ws.readyState === 1) return;
    if (!this.proxyUrl) throw new Error('imap: no proxyUrl configured — raw IMAP needs a WebSocket proxy (see README)');
    const Factory = this.config.socketFactory || ((url) => new WebSocket(url));
    await new Promise((resolve, reject) => {
      const ws = Factory(this.proxyUrl);
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(new Error('imap: proxy connection failed'));
      ws.onmessage = (ev) => this._onMessage(ev);
      this._ws = ws;
      // Some fake sockets resolve synchronously (open already true).
      if (ws.readyState === 1) resolve();
    });
  }

  _onMessage(ev) {
    let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
    const p = this._pending.get(msg.id);
    if (!p) return;
    this._pending.delete(msg.id);
    if (msg.error) p.reject(Object.assign(new Error(msg.error), { data: msg }));
    else p.resolve(msg);
  }

  // Send one request object and await its matching reply.
  _rpc(payload) {
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._ws.send(JSON.stringify({ id, ...payload }));
    });
  }

  async _login() {
    await this._connect();
    if (this._loggedIn) return;
    await this._rpc({
      op: 'login',
      host: this.config.host, port: this.config.port,
      secure: this.config.secure !== false,
      user: this.config.user, pass: this.config.pass,
    });
    this._loggedIn = true;
  }

  // ---- interface ----
  async listMailboxes() {
    await this._login();
    const r = await this._rpc({ op: 'list' });
    return (r.mailboxes || []).map((m) => ({
      id: m.name, name: prettyBox(m.name),
      role: ROLE[String(m.role || m.name).toLowerCase()] || 'custom',
      unread: m.unread ?? null, total: m.total ?? null,
    }));
  }

  async listMessages(mailboxId, { limit = 25, cursor, query } = {}) {
    await this._login();
    const r = await this._rpc({ op: 'search', mailbox: mailboxId, query: query || '', limit, cursor });
    const uids = r.uids || [];
    // Fetch headers for each uid and normalize via the MIME parser.
    const messages = await Promise.all(uids.map(async (uid) => {
      const f = await this._rpc({ op: 'fetch', mailbox: mailboxId, uid, what: 'headers' });
      const m = parseMessage(f.raw || '');
      return {
        id: `${mailboxId}:${uid}`, threadId: `${mailboxId}:${uid}`,
        from: parseAddress(m.from), to: parseAddressList(m.to),
        subject: m.subject || '(no subject)',
        snippet: (m.bodyText || '').slice(0, 140),
        date: m.date ? new Date(m.date).toISOString() : null,
        flags: flagsOf(f.flags), hasAttachments: (m.attachments || []).length > 0,
      };
    }));
    return { messages, nextCursor: r.nextCursor || null };
  }

  async getMessage(id) {
    await this._login();
    const { mailbox, uid } = splitId(id);
    const f = await this._rpc({ op: 'fetch', mailbox, uid, what: 'full' });
    const m = parseMessage(f.raw || '');
    return {
      id, threadId: id, headers: m.headers,
      from: parseAddress(m.from), to: parseAddressList(m.to), cc: parseAddressList(m.cc),
      date: m.date ? new Date(m.date).toISOString() : null,
      subject: m.subject || '(no subject)',
      bodyHtml: m.bodyHtml || '', bodyText: m.bodyText || '',
      attachments: (m.attachments || []).map((a, i) => ({
        id: `${id}:att${i}`, name: a.name, mime: a.mime, size: a.size,
      })),
      flags: flagsOf(f.flags),
    };
  }

  async search(query, { mailboxId } = {}) { return this.listMessages(mailboxId || 'INBOX', { query }); }

  async setFlags(id, flags) {
    await this._login();
    const { mailbox, uid } = splitId(id);
    const add = [], remove = [];
    if ('seen' in flags) (flags.seen ? add : remove).push('\\Seen');
    if ('flagged' in flags) (flags.flagged ? add : remove).push('\\Flagged');
    if ('answered' in flags) (flags.answered ? add : remove).push('\\Answered');
    return this._rpc({ op: 'store', mailbox, uid, add, remove });
  }

  async move(id, mailboxId) {
    await this._login();
    const { mailbox, uid } = splitId(id);
    return this._rpc({ op: 'move', mailbox, uid, dest: mailboxId });
  }

  async archive(id) {
    const boxes = await this.listMailboxes();
    const arch = boxes.find((b) => b.role === 'archive');
    if (!arch) throw new Error('imap: no archive mailbox');
    return this.move(id, arch.id);
  }

  async del(id) {
    await this._login();
    const { mailbox, uid } = splitId(id);
    return this._rpc({ op: 'expunge', mailbox, uid });
  }

  async sendMessage(draft) {
    await this._login();
    return this._rpc({ op: 'send', raw: buildRfc822(draft), envelope: envelopeOf(draft) });
  }

  async saveDraft(draft) {
    await this._login();
    const boxes = await this.listMailboxes();
    const drafts = boxes.find((b) => b.role === 'drafts') || boxes[0];
    return this._rpc({ op: 'append', mailbox: drafts.id, raw: buildRfc822(draft) });
  }
}

// ---- helpers ----
function splitId(id) { const i = String(id).lastIndexOf(':'); return { mailbox: id.slice(0, i), uid: Number(id.slice(i + 1)) }; }
function prettyBox(name) { return String(name).replace(/^INBOX[./]/i, '').replace(/[./]/g, ' › '); }
function flagsOf(flags) {
  const f = (flags || []).map((x) => String(x).toLowerCase());
  return { seen: f.includes('\\seen'), flagged: f.includes('\\flagged'), answered: f.includes('\\answered') };
}
function envelopeOf(draft) {
  const email = (a) => (typeof a === 'string' ? a : a.email);
  return {
    from: draft.from ? email(draft.from) : '',
    to: [...(draft.to || []), ...(draft.cc || []), ...(draft.bcc || [])].map(email),
  };
}
