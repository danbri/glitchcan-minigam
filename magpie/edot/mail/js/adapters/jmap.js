// jmap.js — JMAP adapter (RFC 8620 core + RFC 8621 mail). This is the
// open-standard, browser-native path: JMAP servers (Fastmail, Stalwart,
// Apache James, Cyrus) speak JSON over HTTPS and are CORS-friendly for
// bearer/basic-auth SPA clients.
//
// Transport reality: works browser-side when the JMAP server sends CORS headers
// (the spec encourages it; Fastmail does). Auth is a bearer token (API token)
// or HTTP Basic. mail-config.js documents the session URL + token placeholders.
//
// Flow:
//   1. GET sessionUrl  → { apiUrl, accountId(s), capabilities }
//   2. POST apiUrl with a methodCalls batch:
//        Mailbox/get            → mailboxes
//        Email/query + Email/get→ list / message  (back-reference #ids)
//        Email/set              → flags (keywords)
//        EmailSubmission/set    → send
//
// We keep the request batches small and explicit so they're easy to mock.

import { MailAdapter } from './base.js';

const CORE = 'urn:ietf:params:jmap:core';
const MAIL = 'urn:ietf:params:jmap:mail';
const SUBMISSION = 'urn:ietf:params:jmap:submission';

// JMAP mailbox "role" values map almost 1:1 to ours; normalize the few diffs.
const ROLE = { inbox: 'inbox', sent: 'sent', drafts: 'drafts', trash: 'trash', junk: 'spam', archive: 'archive' };

export class JmapAdapter extends MailAdapter {
  constructor(config = {}, opts = {}) {
    super(config, opts);
    this.id = 'jmap';
    this.sessionUrl = config.sessionUrl || '';
    this._session = null;
  }

  capabilities() {
    return { threads: true, search: true, push: true, flags: true, move: true, send: true };
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.config.token) h.Authorization = `Bearer ${this.config.token}`;
    else if (this.config.basic) h.Authorization = `Basic ${this.config.basic}`;
    return h;
  }

  // Fetch + cache the session resource; gives us apiUrl + primary accountId.
  async session() {
    if (this._session) return this._session;
    if (!this.sessionUrl) throw new Error('jmap: sessionUrl is not configured');
    this._session = await this._json('GET', this.sessionUrl);
    this.accountId = this.config.accountId
      || (this._session.primaryAccounts && this._session.primaryAccounts[MAIL])
      || Object.keys(this._session.accounts || {})[0];
    this.apiUrl = this._session.apiUrl;
    return this._session;
  }

  // POST a JMAP request batch and return the methodResponses array.
  async _request(using, methodCalls) {
    await this.session();
    const r = await this._json('POST', this.apiUrl, { body: { using, methodCalls } });
    return r.methodResponses || [];
  }

  async listMailboxes() {
    const resp = await this._request([CORE, MAIL],
      [['Mailbox/get', { accountId: this.accountId, ids: null }, '0']]);
    const list = (resp[0] && resp[0][1] && resp[0][1].list) || [];
    return list.map((m) => ({
      id: m.id,
      name: m.name,
      role: ROLE[m.role] || 'custom',
      unread: m.unreadEmails ?? null,
      total: m.totalEmails ?? null,
    }));
  }

  async listMessages(mailboxId, { limit = 25, cursor, query } = {}) {
    const filter = {};
    if (mailboxId) filter.inMailbox = mailboxId;
    if (query) filter.text = query;
    const position = Number(cursor) || 0;
    // Email/query returns ids; Email/get hydrates them via a back-reference.
    const resp = await this._request([CORE, MAIL], [
      ['Email/query', {
        accountId: this.accountId, filter,
        sort: [{ property: 'receivedAt', isAscending: false }],
        position, limit,
      }, '0'],
      ['Email/get', {
        accountId: this.accountId,
        '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
        properties: ['id', 'threadId', 'from', 'to', 'subject', 'preview', 'receivedAt', 'keywords', 'hasAttachment'],
      }, '1'],
    ]);
    const got = (resp.find((r) => r[0] === 'Email/get') || [])[1] || {};
    const qres = (resp.find((r) => r[0] === 'Email/query') || [])[1] || {};
    const messages = (got.list || []).map(summaryOf);
    const total = qres.total ?? 0;
    const next = position + limit < total ? String(position + limit) : null;
    return { messages, nextCursor: next };
  }

  async getMessage(id) {
    const resp = await this._request([CORE, MAIL], [
      ['Email/get', {
        accountId: this.accountId, ids: [id],
        properties: ['id', 'threadId', 'from', 'to', 'cc', 'subject', 'receivedAt',
          'keywords', 'htmlBody', 'textBody', 'bodyValues', 'attachments', 'headers'],
        fetchHTMLBodyValues: true, fetchTextBodyValues: true,
      }, '0'],
    ]);
    const m = ((resp[0] && resp[0][1] && resp[0][1].list) || [])[0];
    if (!m) throw new Error('jmap: message not found');
    return fullOf(m);
  }

  async getThread(threadId) {
    const resp = await this._request([CORE, MAIL], [
      ['Email/query', { accountId: this.accountId, filter: { threadId } }, '0'],
      ['Email/get', {
        accountId: this.accountId,
        '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
        properties: ['id', 'threadId', 'from', 'to', 'cc', 'subject', 'receivedAt', 'htmlBody', 'textBody', 'bodyValues'],
        fetchHTMLBodyValues: true, fetchTextBodyValues: true,
      }, '1'],
    ]);
    const got = (resp.find((r) => r[0] === 'Email/get') || [])[1] || {};
    return { id: threadId, messages: (got.list || []).map(fullOf) };
  }

  async search(query, { mailboxId } = {}) { return this.listMessages(mailboxId, { query }); }

  // Flags map to JMAP keywords ($seen, $flagged, $answered).
  async setFlags(id, flags) {
    const patch = {};
    if ('seen' in flags) patch['keywords/$seen'] = flags.seen ? true : null;
    if ('flagged' in flags) patch['keywords/$flagged'] = flags.flagged ? true : null;
    if ('answered' in flags) patch['keywords/$answered'] = flags.answered ? true : null;
    const resp = await this._request([CORE, MAIL],
      [['Email/set', { accountId: this.accountId, update: { [id]: patch } }, '0']]);
    return resp[0] && resp[0][1];
  }

  async move(id, mailboxId) {
    const resp = await this._request([CORE, MAIL],
      [['Email/set', { accountId: this.accountId, update: { [id]: { mailboxIds: { [mailboxId]: true } } } }, '0']]);
    return resp[0] && resp[0][1];
  }

  async archive(id) {
    // Resolve the archive mailbox, then move.
    const boxes = await this.listMailboxes();
    const arch = boxes.find((b) => b.role === 'archive');
    if (!arch) throw new Error('jmap: no archive mailbox');
    return this.move(id, arch.id);
  }

  async del(id) {
    const resp = await this._request([CORE, MAIL],
      [['Email/set', { accountId: this.accountId, destroy: [id] }, '0']]);
    return resp[0] && resp[0][1];
  }

  // Create the Email, then submit it via EmailSubmission/set.
  async sendMessage(draft) {
    const boxes = await this.listMailboxes();
    const drafts = boxes.find((b) => b.role === 'drafts') || boxes[0];
    const sent = boxes.find((b) => b.role === 'sent');
    const emailObj = jmapEmail(draft, drafts.id);
    const resp = await this._request([CORE, MAIL, SUBMISSION], [
      ['Email/set', { accountId: this.accountId, create: { draft: emailObj } }, '0'],
      ['EmailSubmission/set', {
        accountId: this.accountId,
        create: { sub: { emailId: '#draft', envelope: envelopeOf(draft) } },
        onSuccessUpdateEmail: sent ? { '#sub': { [`mailboxIds/${drafts.id}`]: null, [`mailboxIds/${sent.id}`]: true } } : undefined,
      }, '1'],
    ]);
    return resp.find((r) => r[0] === 'EmailSubmission/set');
  }

  async saveDraft(draft) {
    const boxes = await this.listMailboxes();
    const drafts = boxes.find((b) => b.role === 'drafts') || boxes[0];
    const resp = await this._request([CORE, MAIL],
      [['Email/set', { accountId: this.accountId, create: { draft: jmapEmail(draft, drafts.id) } }, '0']]);
    return resp[0] && resp[0][1];
  }
}

// ---- normalizers ----
function jaddr(a) { return a && (a.email || a.name) ? { name: a.name || '', email: a.email || '' } : { name: (a && a.name) || '', email: (a && a.email) || '' }; }
function jaddrs(list) { return (list || []).map(jaddr); }
function kw(keywords) {
  const k = keywords || {};
  return { seen: !!k.$seen, flagged: !!k.$flagged, answered: !!k.$answered };
}

function summaryOf(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    from: (m.from && m.from[0]) ? jaddr(m.from[0]) : { name: '', email: '' },
    to: jaddrs(m.to),
    subject: m.subject || '(no subject)',
    snippet: m.preview || '',
    date: m.receivedAt || null,
    flags: kw(m.keywords),
    hasAttachments: !!m.hasAttachment,
  };
}

function bodyFromParts(parts, bodyValues) {
  if (!parts || !parts.length || !bodyValues) return '';
  const part = parts.find((p) => p.partId && bodyValues[p.partId]);
  return part ? (bodyValues[part.partId].value || '') : '';
}

function fullOf(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    headers: (m.headers || []).map((h) => ({ name: h.name, value: h.value })),
    from: (m.from && m.from[0]) ? jaddr(m.from[0]) : { name: '', email: '' },
    to: jaddrs(m.to),
    cc: jaddrs(m.cc),
    date: m.receivedAt || null,
    subject: m.subject || '(no subject)',
    bodyHtml: bodyFromParts(m.htmlBody, m.bodyValues),
    bodyText: bodyFromParts(m.textBody, m.bodyValues),
    attachments: (m.attachments || []).map((a) => ({
      id: a.blobId, name: a.name || 'attachment', mime: a.type || 'application/octet-stream', size: a.size || 0,
    })),
    flags: kw(m.keywords),
  };
}

function jmapEmail(draft, draftMailboxId) {
  const addr = (a) => (typeof a === 'string' ? { email: a } : { name: a.name || null, email: a.email });
  const obj = {
    mailboxIds: { [draftMailboxId]: true },
    keywords: { $draft: true, $seen: true },
    from: draft.from ? [addr(draft.from)] : undefined,
    to: (draft.to || []).map(addr),
    cc: (draft.cc || []).map(addr),
    bcc: (draft.bcc || []).map(addr),
    subject: draft.subject || '',
  };
  if (draft.inReplyTo) obj.inReplyTo = [draft.inReplyTo];
  // Inline body via a bodyValue + bodyStructure reference.
  const partId = 'b1';
  const isHtml = !!draft.html;
  obj.bodyValues = { [partId]: { value: isHtml ? draft.html : (draft.text || ''), isTruncated: false } };
  obj[isHtml ? 'htmlBody' : 'textBody'] = [{ partId, type: isHtml ? 'text/html' : 'text/plain' }];
  return obj;
}
function envelopeOf(draft) {
  const email = (a) => (typeof a === 'string' ? a : a.email);
  return {
    mailFrom: { email: draft.from ? email(draft.from) : '' },
    rcptTo: [...(draft.to || []), ...(draft.cc || []), ...(draft.bcc || [])].map((a) => ({ email: email(a) })),
  };
}
