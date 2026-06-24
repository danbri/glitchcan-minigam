// gmail.js — Gmail REST API adapter (https://gmail.googleapis.com/gmail/v1).
//
// Transport reality: works 100% browser-side. Google's Gmail API is CORS-
// enabled and authenticated with an OAuth 2.0 bearer token. The token comes
// from the edot auth module (auth/js/oidc.js) using the Google provider with
// the EXTRA mail scope `https://www.googleapis.com/auth/gmail.modify` (read +
// flags/labels + send). No secrets are stored here — the deployer registers a
// client ID and the user grants the scope; mail-config.js documents this.
//
// Endpoints used:
//   GET  users/me/labels                                  → mailboxes
//   GET  users/me/messages?labelIds=&q=&pageToken=        → list ids
//   GET  users/me/messages/{id}?format=metadata|full      → summary / message
//   GET  users/me/threads/{id}?format=full                → thread
//   POST users/me/messages/send  { raw }                  → send (RFC822 base64url)
//   POST users/me/messages/{id}/modify {add/removeLabelIds}→ flags / move / archive
//   POST users/me/messages/{id}/trash                     → delete
//
// Bearer token is injected via config.getToken() (async) so it can refresh.

import { MailAdapter, parseAddress, parseAddressList, formatAddress } from './base.js';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Gmail system label → our normalized mailbox role.
const ROLE_BY_LABEL = {
  INBOX: 'inbox', SENT: 'sent', DRAFT: 'drafts', TRASH: 'trash',
  SPAM: 'spam', IMPORTANT: 'custom', STARRED: 'custom', UNREAD: 'custom',
  CATEGORY_PERSONAL: 'custom',
};

export class GmailAdapter extends MailAdapter {
  constructor(config = {}, opts = {}) {
    super(config, opts);
    this.id = 'gmail';
    this.base = config.base || BASE;
  }

  capabilities() {
    return { threads: true, search: true, push: false, flags: true, move: true, send: true };
  }

  _headers() {
    // token may be a static string (tests) or supplied lazily via getToken().
    const t = this._token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }
  async _auth() { // resolve a fresh token before each call
    if (typeof this.config.getToken === 'function') this._token = await this.config.getToken();
    else this._token = this.config.token || this._token;
    return this._token;
  }

  // ---- mailboxes ----
  async listMailboxes() {
    await this._auth();
    const j = await this._json('GET', `${this.base}/labels`);
    const labels = j.labels || [];
    // Fetch unread/total per label would need N requests; Gmail returns these
    // on the per-label GET. We do a light pass only for the common system ones
    // to keep it cheap, and expose 0/0 otherwise (UI tolerates nulls).
    return labels
      .filter((l) => l.labelListVisibility !== 'labelHide' || ROLE_BY_LABEL[l.id])
      .map((l) => ({
        id: l.id,
        name: prettyLabel(l.name),
        role: ROLE_BY_LABEL[l.id] || 'custom',
        unread: l.messagesUnread ?? null,
        total: l.messagesTotal ?? null,
      }));
  }

  // ---- message list ----
  async listMessages(mailboxId, { limit = 25, cursor, query } = {}) {
    await this._auth();
    const p = new URLSearchParams({ maxResults: String(limit) });
    if (mailboxId) p.set('labelIds', mailboxId);
    if (query) p.set('q', query);
    if (cursor) p.set('pageToken', cursor);
    const list = await this._json('GET', `${this.base}/messages?${p}`);
    const ids = (list.messages || []).map((m) => m.id);
    // Hydrate each summary with format=metadata (subject/from/date headers).
    const messages = await Promise.all(ids.map((id) => this._summary(id)));
    return { messages, nextCursor: list.nextPageToken || null };
  }

  async _summary(id) {
    const wanted = ['From', 'To', 'Subject', 'Date'];
    const p = new URLSearchParams({ format: 'metadata' });
    wanted.forEach((h) => p.append('metadataHeaders', h));
    const m = await this._json('GET', `${this.base}/messages/${id}?${p}`);
    const h = headerMap(m.payload && m.payload.headers);
    return {
      id: m.id,
      threadId: m.threadId,
      from: parseAddress(h.from),
      to: parseAddressList(h.to),
      subject: h.subject || '(no subject)',
      snippet: decodeEntities(m.snippet || ''),
      date: h.date ? new Date(h.date).toISOString() : null,
      flags: flagsFromLabels(m.labelIds || []),
      hasAttachments: hasAttachmentParts(m.payload),
    };
  }

  // ---- single message (full) ----
  async getMessage(id) {
    await this._auth();
    const m = await this._json('GET', `${this.base}/messages/${id}?format=full`);
    return normalizeFull(m);
  }

  async getThread(threadId) {
    await this._auth();
    const t = await this._json('GET', `${this.base}/threads/${threadId}?format=full`);
    return { id: threadId, messages: (t.messages || []).map(normalizeFull) };
  }

  async search(query, { mailboxId } = {}) {
    return this.listMessages(mailboxId, { query });
  }

  // ---- send (RFC822 → base64url raw) ----
  async sendMessage(draft) {
    await this._auth();
    const raw = base64url(buildRfc822(draft));
    return this._json('POST', `${this.base}/messages/send`, { body: { raw } });
  }

  async saveDraft(draft) {
    await this._auth();
    const raw = base64url(buildRfc822(draft));
    return this._json('POST', `${this.base}/drafts`, { body: { message: { raw } } });
  }

  // ---- flags / move / archive / delete ----
  async setFlags(id, flags) {
    await this._auth();
    const add = [], remove = [];
    if ('seen' in flags) (flags.seen ? remove : add).push('UNREAD');
    if ('flagged' in flags) (flags.flagged ? add : remove).push('STARRED');
    return this._json('POST', `${this.base}/messages/${id}/modify`,
      { body: { addLabelIds: add, removeLabelIds: remove } });
  }

  async move(id, mailboxId) {
    await this._auth();
    // Gmail "move" = swap INBOX/label; we add target and remove INBOX.
    return this._json('POST', `${this.base}/messages/${id}/modify`,
      { body: { addLabelIds: [mailboxId], removeLabelIds: ['INBOX'] } });
  }

  async archive(id) {
    await this._auth();
    return this._json('POST', `${this.base}/messages/${id}/modify`,
      { body: { removeLabelIds: ['INBOX'] } });
  }

  async del(id) {
    await this._auth();
    return this._json('POST', `${this.base}/messages/${id}/trash`, { body: {} });
  }
}

// ---- helpers ----
function prettyLabel(name) {
  return ({ INBOX: 'Inbox', SENT: 'Sent', DRAFT: 'Drafts', TRASH: 'Trash', SPAM: 'Spam' }[name])
    || name.replace(/^CATEGORY_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
function headerMap(headers) {
  const m = {};
  for (const h of headers || []) m[h.name.toLowerCase()] = h.value;
  return m;
}
function flagsFromLabels(labelIds) {
  return {
    seen: !labelIds.includes('UNREAD'),
    flagged: labelIds.includes('STARRED'),
    answered: false,
  };
}
function hasAttachmentParts(payload) {
  if (!payload) return false;
  const walk = (p) => {
    if (!p) return false;
    if (p.filename && p.body && p.body.attachmentId) return true;
    return (p.parts || []).some(walk);
  };
  return walk(payload);
}

// Build the normalized full Message from a Gmail format=full payload.
function normalizeFull(m) {
  const h = headerMap(m.payload && m.payload.headers);
  const { html, text, attachments } = extractBodies(m.payload);
  return {
    id: m.id,
    threadId: m.threadId,
    headers: (m.payload && m.payload.headers || []).map((x) => ({ name: x.name, value: x.value })),
    from: parseAddress(h.from),
    to: parseAddressList(h.to),
    cc: parseAddressList(h.cc),
    date: h.date ? new Date(h.date).toISOString() : null,
    subject: h.subject || '(no subject)',
    bodyHtml: html,
    bodyText: text,
    attachments,
    flags: flagsFromLabels(m.labelIds || []),
  };
}

// Recurse the MIME tree Gmail returns (already structured — no raw parse needed)
// and pull html, text, and attachment metadata.
function extractBodies(payload) {
  let html = '', text = '';
  const attachments = [];
  const walk = (p) => {
    if (!p) return;
    const mime = (p.mimeType || '').toLowerCase();
    if (p.parts && p.parts.length) { p.parts.forEach(walk); return; }
    if (p.filename) {
      attachments.push({
        id: p.body && p.body.attachmentId, name: p.filename,
        mime: mime || 'application/octet-stream', size: (p.body && p.body.size) || 0,
      });
      return;
    }
    const data = p.body && p.body.data ? gmailB64(p.body.data) : '';
    if (mime === 'text/html') html = html || data;
    else if (mime === 'text/plain') text = text || data;
  };
  walk(payload);
  return { html, text, attachments };
}

// Gmail uses base64url for body data; decode to a UTF-8 string.
function gmailB64(d) {
  const b64 = String(d).replace(/-/g, '+').replace(/_/g, '/');
  const bin = (typeof atob !== 'undefined') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Build a minimal RFC822 message from a normalized draft. Shared shape with the
// IMAP proxy append path. UTF-8 bodies sent as quoted-printable-safe base64.
export function buildRfc822(draft) {
  const to = (draft.to || []).map(asAddr).join(', ');
  const cc = (draft.cc || []).map(asAddr).join(', ');
  const bcc = (draft.bcc || []).map(asAddr).join(', ');
  const boundary = 'edot_' + Math.random().toString(36).slice(2);
  const headers = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : null,
    bcc ? `Bcc: ${bcc}` : null,
    `Subject: ${encodeHeader(draft.subject || '')}`,
    draft.inReplyTo ? `In-Reply-To: ${draft.inReplyTo}` : null,
    draft.inReplyTo ? `References: ${draft.inReplyTo}` : null,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  const text = draft.text || stripTags(draft.html || '');
  const html = draft.html || '';
  if (!html) {
    headers.push('Content-Type: text/plain; charset=utf-8');
    return headers.join('\r\n') + '\r\n\r\n' + text;
  }
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  return headers.join('\r\n') + '\r\n\r\n' +
    `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n` +
    `--${boundary}--\r\n`;
}
function asAddr(a) { return typeof a === 'string' ? a : formatAddress(a); }
function encodeHeader(s) { return /[^\x00-\x7F]/.test(s) ? `=?utf-8?B?${btoaUtf8(s)}?=` : s; }
function stripTags(h) { return String(h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(); }

// base64url of a (possibly unicode) RFC822 string.
export function base64url(str) {
  return btoaUtf8(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function btoaUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return (typeof btoa !== 'undefined') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
