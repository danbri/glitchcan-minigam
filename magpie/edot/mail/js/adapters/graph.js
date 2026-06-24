// graph.js — Microsoft Graph mail adapter (https://graph.microsoft.com/v1.0).
//
// Transport reality: works 100% browser-side. Graph is CORS-enabled and uses an
// OAuth 2.0 bearer token from the edot auth module (Microsoft provider) with the
// EXTRA mail scopes `Mail.Read` and `Mail.Send` (add `Mail.ReadWrite` for
// flag/move/delete). No secrets in code; mail-config.js documents the client ID
// and scopes the deployer registers in Azure.
//
// Endpoints used:
//   GET   /me/mailFolders                                    → mailboxes
//   GET   /me/mailFolders/{id}/messages?$top=&$skip=&$search → list
//   GET   /me/messages/{id}?$expand=attachments              → message
//   POST  /me/sendMail  { message, saveToSentItems }         → send
//   POST  /me/messages   { …draft }                          → save draft
//   PATCH /me/messages/{id}  { isRead, flag }                → flags
//   POST  /me/messages/{id}/move  { destinationId }          → move/archive
//   DELETE /me/messages/{id}                                 → delete
//
// Graph returns structured JSON bodies (no raw MIME parse needed).

import { MailAdapter, parseAddress, parseAddressList } from './base.js';

const BASE = 'https://graph.microsoft.com/v1.0';

// Well-known folder names → our normalized role.
const ROLE_BY_NAME = {
  inbox: 'inbox', 'sent items': 'sent', drafts: 'drafts',
  'deleted items': 'trash', 'junk email': 'spam', archive: 'archive',
};

export class GraphAdapter extends MailAdapter {
  constructor(config = {}, opts = {}) {
    super(config, opts);
    this.id = 'graph';
    this.base = config.base || BASE;
  }

  capabilities() {
    return { threads: true, search: true, push: false, flags: true, move: true, send: true };
  }

  _headers() { return this._token ? { Authorization: `Bearer ${this._token}` } : {}; }
  async _auth() {
    if (typeof this.config.getToken === 'function') this._token = await this.config.getToken();
    else this._token = this.config.token || this._token;
    return this._token;
  }

  async listMailboxes() {
    await this._auth();
    const j = await this._json('GET', `${this.base}/me/mailFolders?$top=100`);
    return (j.value || []).map((f) => ({
      id: f.id,
      name: f.displayName,
      role: ROLE_BY_NAME[String(f.displayName).toLowerCase()] || 'custom',
      unread: f.unreadItemCount ?? null,
      total: f.totalItemCount ?? null,
    }));
  }

  async listMessages(mailboxId, { limit = 25, cursor, query } = {}) {
    await this._auth();
    const p = new URLSearchParams({
      $top: String(limit),
      $select: 'id,conversationId,subject,from,toRecipients,bodyPreview,receivedDateTime,isRead,flag,hasAttachments',
      $orderby: 'receivedDateTime desc',
    });
    if (cursor) p.set('$skip', String(cursor));
    if (query) { p.set('$search', `"${query}"`); p.delete('$orderby'); } // $search forbids $orderby
    const path = mailboxId ? `/me/mailFolders/${mailboxId}/messages` : '/me/messages';
    const j = await this._json('GET', `${this.base}${path}?${p}`);
    const messages = (j.value || []).map(summaryOf);
    const next = j['@odata.nextLink'] ? String((Number(cursor) || 0) + limit) : null;
    return { messages, nextCursor: next };
  }

  async getMessage(id) {
    await this._auth();
    const m = await this._json('GET',
      `${this.base}/me/messages/${id}?$expand=attachments($select=id,name,contentType,size)`);
    return fullOf(m);
  }

  // Graph models threads as conversationId; fetch all messages in it.
  async getThread(threadId) {
    await this._auth();
    const p = new URLSearchParams({ $filter: `conversationId eq '${threadId}'`, $top: '50' });
    const j = await this._json('GET', `${this.base}/me/messages?${p}`);
    const messages = await Promise.all((j.value || []).map((m) => this.getMessage(m.id)));
    return { id: threadId, messages };
  }

  async search(query, { mailboxId } = {}) { return this.listMessages(mailboxId, { query }); }

  async sendMessage(draft) {
    await this._auth();
    return this._json('POST', `${this.base}/me/sendMail`, {
      body: { message: graphMessage(draft), saveToSentItems: true },
    });
  }

  async saveDraft(draft) {
    await this._auth();
    return this._json('POST', `${this.base}/me/messages`, { body: graphMessage(draft) });
  }

  async setFlags(id, flags) {
    await this._auth();
    const body = {};
    if ('seen' in flags) body.isRead = !!flags.seen;
    if ('flagged' in flags) body.flag = { flagStatus: flags.flagged ? 'flagged' : 'notFlagged' };
    return this._json('PATCH', `${this.base}/me/messages/${id}`, { body });
  }

  async move(id, mailboxId) {
    await this._auth();
    return this._json('POST', `${this.base}/me/messages/${id}/move`, { body: { destinationId: mailboxId } });
  }

  async archive(id) { return this.move(id, 'archive'); }

  async del(id) {
    await this._auth();
    // DELETE returns 204 No Content; _json tolerates an empty body.
    return this._json('DELETE', `${this.base}/me/messages/${id}`);
  }
}

// ---- normalizers ----
function recip(r) { return r && r.emailAddress ? { name: r.emailAddress.name || '', email: r.emailAddress.address || '' } : parseAddress(r); }
function recips(list) { return (list || []).map(recip); }

function summaryOf(m) {
  return {
    id: m.id,
    threadId: m.conversationId,
    from: m.from ? recip(m.from) : { name: '', email: '' },
    to: recips(m.toRecipients),
    subject: m.subject || '(no subject)',
    snippet: m.bodyPreview || '',
    date: m.receivedDateTime ? new Date(m.receivedDateTime).toISOString() : null,
    flags: {
      seen: !!m.isRead,
      flagged: !!(m.flag && m.flag.flagStatus === 'flagged'),
      answered: false,
    },
    hasAttachments: !!m.hasAttachments,
  };
}

function fullOf(m) {
  const isHtml = m.body && m.body.contentType && m.body.contentType.toLowerCase() === 'html';
  return {
    id: m.id,
    threadId: m.conversationId,
    headers: (m.internetMessageHeaders || []).map((h) => ({ name: h.name, value: h.value })),
    from: m.from ? recip(m.from) : { name: '', email: '' },
    to: recips(m.toRecipients),
    cc: recips(m.ccRecipients),
    date: m.receivedDateTime ? new Date(m.receivedDateTime).toISOString() : null,
    subject: m.subject || '(no subject)',
    bodyHtml: isHtml ? (m.body.content || '') : '',
    bodyText: isHtml ? '' : (m.body && m.body.content || ''),
    attachments: (m.attachments || []).map((a) => ({
      id: a.id, name: a.name, mime: a.contentType || 'application/octet-stream', size: a.size || 0,
    })),
    flags: {
      seen: !!m.isRead,
      flagged: !!(m.flag && m.flag.flagStatus === 'flagged'),
      answered: false,
    },
  };
}

// Normalized draft → Graph message resource.
function graphMessage(draft) {
  const addr = (a) => (typeof a === 'string'
    ? { emailAddress: parseAddress(a) && { address: parseAddress(a).email, name: parseAddress(a).name } }
    : { emailAddress: { address: a.email, name: a.name || '' } });
  const body = draft.html
    ? { contentType: 'HTML', content: draft.html }
    : { contentType: 'Text', content: draft.text || '' };
  return {
    subject: draft.subject || '',
    body,
    toRecipients: (draft.to || []).map(addr),
    ccRecipients: (draft.cc || []).map(addr),
    bccRecipients: (draft.bcc || []).map(addr),
  };
}
