// edot-mail.js — <edot-mail>: the responsive three-pane webmail UI.
//
// Light DOM (shares mail.css, like edot's other components), Web Component via
// customElements.define, no global variables. Provider-agnostic: it only ever
// talks to a MailAdapter (js/adapters/base.js), so swapping Gmail ↔ Graph ↔
// JMAP ↔ IMAP changes nothing here.
//
// Panes:
//   1. mailbox list (uses <edot-tree>; collapses to a mobile drawer)
//   2. message list (threaded summaries; unread bold; star; snippet; date)
//   3. reading pane (sanitized HTML; remote content blocked by default; compose)
//
// Security: email HTML never touches the DOM raw — it goes through
// sanitize.js (scripts/handlers stripped, remote resources blocked, links
// seat-belted) and is rendered inside a passive container with no script
// execution. A "Load remote content" button re-runs the sanitizer with
// allowRemote:true on demand.
//
// Headless hook: window.__mail is set in mail.html to { component, adapters,
// mime, sanitize } so tests drive everything without real servers.

import { EdotTree } from '../../js/tree.js';
import { sanitizeHtml, textToSafeHtml, escapeText } from './sanitize.js';
import { formatAddress, parseAddress } from './adapters/base.js';

// Ensure <edot-tree> is registered even if loaded first.
if (typeof customElements !== 'undefined' && !customElements.get('edot-tree')) {
  customElements.define('edot-tree', EdotTree);
}

const ROLE_ICON = {
  inbox: '📥', sent: '📤', drafts: '📝', trash: '🗑', archive: '🗄', spam: '⚠️', custom: '📁',
};

export class EdotMail extends HTMLElement {
  constructor() {
    super();
    this.adapter = null;
    this.account = 'default';
    this.mailboxes = [];
    this.currentMailbox = null;
    this.messages = [];
    this.selected = null;       // index into this.messages
    this.openMessage = null;    // the full Message
    this._allowRemote = false;
  }

  // The app calls this to wire a backend in (keeps construction injectable).
  setAdapter(adapter, { account } = {}) {
    this.adapter = adapter;
    if (account) this.account = account;
    return this;
  }

  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this._render();
    this._bindKeys();
  }

  // ---- top-level layout ----
  _render() {
    this.innerHTML = `
      <div class="mail-root" role="application" aria-label="Mail">
        <header class="mail-head">
          <button class="icon-btn drawer-btn" aria-label="Folders" title="Folders">☰</button>
          <span class="mail-logo">✉ edot mail</span>
          <form class="search" role="search">
            <input type="search" class="search-input" placeholder="Search mail (/)" aria-label="Search mail">
          </form>
          <button class="btn compose-btn" aria-label="Compose">✏ Compose</button>
          <button class="icon-btn help-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button>
        </header>
        <div class="mail-body">
          <nav class="pane pane-folders" aria-label="Mailboxes">
            <edot-tree class="folder-tree"></edot-tree>
            <p class="backend-note" hidden></p>
          </nav>
          <section class="pane pane-list" aria-label="Messages">
            <div class="list-head"><span class="list-title">Inbox</span><span class="list-count"></span></div>
            <ul class="msg-list" role="listbox" aria-label="Message list" tabindex="0"></ul>
          </section>
          <section class="pane pane-read" aria-label="Reading pane">
            <div class="read-empty">Select a message to read.</div>
          </section>
        </div>
        <div class="scrim" hidden></div>
      </div>`;
    this._root = this.querySelector('.mail-root');
    this._tree = this.querySelector('.folder-tree');
    this._list = this.querySelector('.msg-list');
    this._read = this.querySelector('.pane-read');
    this._listTitle = this.querySelector('.list-title');
    this._listCount = this.querySelector('.list-count');

    this.querySelector('.drawer-btn').addEventListener('click', () => this._toggleDrawer());
    this.querySelector('.scrim').addEventListener('click', () => this._toggleDrawer(false));
    this.querySelector('.compose-btn').addEventListener('click', () => this.compose());
    this.querySelector('.help-btn').addEventListener('click', () => this._showHelp());
    const form = this.querySelector('.search');
    form.addEventListener('submit', (e) => { e.preventDefault(); this.search(form.querySelector('.search-input').value); });
  }

  _toggleDrawer(force) {
    const open = force === undefined ? !this._root.classList.contains('drawer-open') : force;
    this._root.classList.toggle('drawer-open', open);
    this.querySelector('.scrim').hidden = !open;
  }

  // ---- load the account: mailboxes then the inbox ----
  async load() {
    if (!this.adapter) throw new Error('edot-mail: no adapter set');
    const note = this.querySelector('.backend-note');
    if (this.adapter.id === 'imap' && typeof this.adapter.isAvailable === 'function' && !this.adapter.isAvailable()) {
      note.hidden = false;
      note.textContent = 'IMAP requires a WebSocket proxy — a browser cannot open raw TCP. Configure proxyUrl.';
    }
    this.mailboxes = await this.adapter.listMailboxes();
    this._renderFolders();
    const inbox = this.mailboxes.find((m) => m.role === 'inbox') || this.mailboxes[0];
    if (inbox) await this.openMailbox(inbox.id);
    return this;
  }

  _renderFolders() {
    const nodes = this.mailboxes.map((m) => ({
      label: m.name,
      icon: ROLE_ICON[m.role] || ROLE_ICON.custom,
      note: m.unread ? String(m.unread) : '',
      onActivate: () => { this.openMailbox(m.id); this._toggleDrawer(false); },
    }));
    this._tree.setData(nodes);
  }

  // ---- message list for a mailbox ----
  async openMailbox(mailboxId, { query } = {}) {
    this.currentMailbox = mailboxId;
    const box = this.mailboxes.find((m) => m.id === mailboxId);
    this._listTitle.textContent = box ? box.name : 'Messages';
    this._list.innerHTML = '<li class="msg-loading">Loading…</li>';
    const res = await this.adapter.listMessages(mailboxId, { limit: 50, query });
    this.messages = res.messages || [];
    this._nextCursor = res.nextCursor || null;
    this._renderList();
  }

  _renderList() {
    this._list.innerHTML = '';
    this._listCount.textContent = `${this.messages.length}${this._nextCursor ? '+' : ''}`;
    if (!this.messages.length) { this._list.innerHTML = '<li class="msg-empty">No messages.</li>'; return; }
    this.messages.forEach((m, i) => this._list.appendChild(this._row(m, i)));
  }

  _row(m, i) {
    const li = document.createElement('li');
    li.className = 'msg-row' + (m.flags && m.flags.seen ? '' : ' unread');
    li.setAttribute('role', 'option');
    li.tabIndex = -1;
    li.dataset.i = String(i);
    const from = m.from || { name: '', email: '' };
    li.innerHTML = `
      <button class="star ${m.flags && m.flags.flagged ? 'on' : ''}" aria-label="Star" title="Star">${m.flags && m.flags.flagged ? '★' : '☆'}</button>
      <div class="msg-main">
        <div class="msg-top">
          <span class="msg-from">${escapeText(from.name || from.email || '(unknown)')}</span>
          <span class="msg-date">${fmtDate(m.date)}</span>
        </div>
        <div class="msg-subject">${escapeText(m.subject || '(no subject)')}${m.hasAttachments ? ' <span class="clip" aria-label="has attachment">📎</span>' : ''}</div>
        <div class="msg-snippet">${escapeText(m.snippet || '')}</div>
      </div>`;
    li.querySelector('.star').addEventListener('click', (e) => { e.stopPropagation(); this.toggleStar(i); });
    li.addEventListener('click', () => this.openRow(i));
    return li;
  }

  // ---- open and render a message (the security boundary) ----
  async openRow(i) {
    const sum = this.messages[i];
    if (!sum) return;
    this.selected = i;
    this._allowRemote = false;
    [...this._list.children].forEach((c) => c.classList.toggle('active', c.dataset.i === String(i)));
    this._read.innerHTML = '<div class="read-loading">Loading…</div>';
    const msg = await this.adapter.getMessage(sum.id);
    this.openMessage = msg;
    this._renderMessage(msg);
    // Mark read (optimistic) when the backend supports flags.
    if (!sum.flags.seen && this.adapter.capabilities().flags) {
      sum.flags.seen = true;
      this._list.children[i] && this._list.children[i].classList.remove('unread');
      this.adapter.setFlags(sum.id, { seen: true }).catch(() => {});
    }
  }

  _renderMessage(msg) {
    const caps = this.adapter.capabilities();
    const sourceHtml = msg.bodyHtml || textToSafeHtml(msg.bodyText || '');
    const { html, blockedRemote } = sanitizeHtml(sourceHtml, { allowRemote: this._allowRemote });
    const att = (msg.attachments || []).map((a) =>
      `<li class="att"><span class="att-name">${escapeText(a.name)}</span> <span class="att-meta">${escapeText(a.mime)} · ${fmtSize(a.size)}</span></li>`).join('');
    this._read.innerHTML = `
      <article class="reader">
        <header class="reader-head">
          <h2 class="reader-subject">${escapeText(msg.subject || '(no subject)')}</h2>
          <div class="reader-meta">
            <span class="reader-from">${escapeText(formatAddress(msg.from || {}))}</span>
            <span class="reader-date">${fmtDate(msg.date, true)}</span>
          </div>
          <div class="reader-to">to ${escapeText((msg.to || []).map(formatAddress).join(', ') || 'me')}</div>
          <div class="reader-actions">
            ${caps.send ? '<button class="btn act-reply" title="Reply (r)">↩ Reply</button>' : ''}
            ${caps.send ? '<button class="btn act-replyall" title="Reply all (a)">↩ All</button>' : ''}
            ${caps.send ? '<button class="btn act-forward" title="Forward (f)">↪ Forward</button>' : ''}
            ${caps.move ? '<button class="btn act-archive" title="Archive (e)">🗄 Archive</button>' : ''}
            <button class="btn act-delete" title="Delete (#)">🗑 Delete</button>
            <button class="btn act-unread" title="Mark unread (u)">● Unread</button>
          </div>
        </header>
        ${blockedRemote ? `<div class="remote-banner" role="status">🔒 ${blockedRemote} remote resource(s) blocked for privacy. <button class="link load-remote">Load remote content</button></div>` : ''}
        <div class="reader-body" tabindex="0">${html}</div>
        ${att ? `<ul class="reader-atts" aria-label="Attachments">${att}</ul>` : ''}
      </article>`;

    const on = (sel, fn) => { const el = this._read.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('.load-remote', () => { this._allowRemote = true; this._renderMessage(msg); });
    on('.act-reply', () => this.reply(msg, false));
    on('.act-replyall', () => this.reply(msg, true));
    on('.act-forward', () => this.forward(msg));
    on('.act-archive', () => this.archive());
    on('.act-delete', () => this.del());
    on('.act-unread', () => this.markUnread());
  }

  // ---- actions ----
  async toggleStar(i) {
    const m = this.messages[i]; if (!m) return;
    m.flags.flagged = !m.flags.flagged;
    const star = this._list.children[i] && this._list.children[i].querySelector('.star');
    if (star) { star.textContent = m.flags.flagged ? '★' : '☆'; star.classList.toggle('on', m.flags.flagged); }
    if (this.adapter.capabilities().flags) this.adapter.setFlags(m.id, { flagged: m.flags.flagged }).catch(() => {});
  }

  async markUnread() {
    const m = this.messages[this.selected]; if (!m) return;
    m.flags.seen = false;
    this._list.children[this.selected] && this._list.children[this.selected].classList.add('unread');
    if (this.adapter.capabilities().flags) await this.adapter.setFlags(m.id, { seen: false }).catch(() => {});
  }

  async archive() {
    const m = this.messages[this.selected]; if (!m || !this.adapter.capabilities().move) return;
    await this.adapter.archive(m.id).catch(() => {});
    this._removeSelected();
  }

  async del() {
    const m = this.messages[this.selected]; if (!m) return;
    await this.adapter.del(m.id).catch(() => {});
    this._removeSelected();
  }

  _removeSelected() {
    const i = this.selected;
    if (i == null) return;
    this.messages.splice(i, 1);
    this._renderList();
    this._read.innerHTML = '<div class="read-empty">Select a message to read.</div>';
    this.selected = null; this.openMessage = null;
  }

  async search(query) {
    if (!query) return this.openMailbox(this.currentMailbox);
    this._listTitle.textContent = `Search: ${query}`;
    this._list.innerHTML = '<li class="msg-loading">Searching…</li>';
    const res = await this.adapter.search(query, { mailboxId: this.currentMailbox });
    this.messages = res.messages || [];
    this._nextCursor = res.nextCursor || null;
    this._renderList();
  }

  // ---- compose / reply / forward ----
  compose(prefill = {}) {
    const dlg = this._composeDialog(prefill);
    this.appendChild(dlg);
    const first = dlg.querySelector('.cf-to');
    if (first && !first.value) first.focus(); else dlg.querySelector('.cf-body').focus();
    return dlg;
  }

  reply(msg, all) {
    const from = msg.from || {};
    const to = [from];
    const cc = all ? (msg.to || []).filter((a) => a.email !== from.email) : [];
    const quote = `<br><br><blockquote style="margin:0 0 0 .8em;padding-left:.8em;border-left:2px solid #ccc">` +
      `On ${escapeText(fmtDate(msg.date, true))}, ${escapeText(formatAddress(from))} wrote:<br>` +
      `${(msg.bodyHtml ? sanitizeHtml(msg.bodyHtml).html : textToSafeHtml(msg.bodyText || ''))}</blockquote>`;
    this.compose({
      to: to.map(formatAddress).join(', '),
      cc: cc.map(formatAddress).join(', '),
      subject: /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject || ''}`,
      html: quote,
      inReplyTo: getMessageId(msg),
    });
  }

  forward(msg) {
    const header = `---------- Forwarded message ----------<br>` +
      `From: ${escapeText(formatAddress(msg.from || {}))}<br>` +
      `Subject: ${escapeText(msg.subject || '')}<br><br>`;
    const body = msg.bodyHtml ? sanitizeHtml(msg.bodyHtml).html : textToSafeHtml(msg.bodyText || '');
    this.compose({
      subject: /^fwd:/i.test(msg.subject) ? msg.subject : `Fwd: ${msg.subject || ''}`,
      html: `<br><br>${header}${body}`,
    });
  }

  _composeDialog(p) {
    const wrap = document.createElement('div');
    wrap.className = 'compose-overlay';
    wrap.innerHTML = `
      <div class="compose" role="dialog" aria-modal="true" aria-label="Compose message">
        <header class="compose-head"><span>New message</span><button class="icon-btn cf-close" aria-label="Close">✕</button></header>
        <div class="compose-fields">
          <label class="cf-row"><span>To</span><input class="cf-to" type="text" autocomplete="off" value="${escapeText(p.to || '')}"></label>
          <label class="cf-row"><span>Cc</span><input class="cf-cc" type="text" autocomplete="off" value="${escapeText(p.cc || '')}"></label>
          <label class="cf-row"><span>Bcc</span><input class="cf-bcc" type="text" autocomplete="off" value="${escapeText(p.bcc || '')}"></label>
          <label class="cf-row"><span>Subject</span><input class="cf-subject" type="text" value="${escapeText(p.subject || '')}"></label>
        </div>
        <div class="cf-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Message body">${p.html || ''}</div>
        <footer class="compose-foot">
          <button class="btn primary cf-send">Send</button>
          <button class="btn cf-draft">Save draft</button>
          <label class="cf-attach btn">📎 Attach<input type="file" multiple hidden class="cf-files"></label>
          <span class="cf-status" role="status"></span>
        </footer>
      </div>`;
    const close = () => wrap.remove();
    wrap.querySelector('.cf-close').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap._inReplyTo = p.inReplyTo || '';
    wrap._files = [];
    wrap.querySelector('.cf-files').addEventListener('change', (e) => {
      wrap._files = [...e.target.files];
      wrap.querySelector('.cf-status').textContent = wrap._files.length ? `${wrap._files.length} file(s)` : '';
    });
    wrap.querySelector('.cf-send').addEventListener('click', () => this._send(wrap, close));
    wrap.querySelector('.cf-draft').addEventListener('click', () => this._draft(wrap));
    return wrap;
  }

  // Build the normalized draft from the compose form.
  draftFrom(wrap) {
    const val = (s) => wrap.querySelector(s).value.trim();
    const addrs = (s) => val(s).split(',').map((x) => x.trim()).filter(Boolean).map(parseAddress);
    const html = wrap.querySelector('.cf-body').innerHTML;
    return {
      to: addrs('.cf-to'), cc: addrs('.cf-cc'), bcc: addrs('.cf-bcc'),
      subject: val('.cf-subject'),
      html,
      text: wrap.querySelector('.cf-body').innerText,
      inReplyTo: wrap._inReplyTo || '',
      attachments: (wrap._files || []).map((f) => ({ name: f.name, mime: f.type, size: f.size, file: f })),
    };
  }

  async _send(wrap, close) {
    const status = wrap.querySelector('.cf-status');
    const draft = this.draftFrom(wrap);
    if (!draft.to.length) { status.textContent = 'Add a recipient.'; return; }
    status.textContent = 'Sending…';
    try { await this.adapter.sendMessage(draft); status.textContent = 'Sent ✓'; setTimeout(close, 600); }
    catch (e) { status.textContent = `Send failed: ${e.message}`; }
  }

  async _draft(wrap) {
    const status = wrap.querySelector('.cf-status');
    status.textContent = 'Saving…';
    try { await this.adapter.saveDraft(this.draftFrom(wrap)); status.textContent = 'Draft saved ✓'; }
    catch (e) { status.textContent = `Save failed: ${e.message}`; }
  }

  // ---- keyboard shortcuts ----
  _bindKeys() {
    this.addEventListener('keydown', (e) => {
      // Don't hijack typing in inputs / the compose body.
      const t = e.target;
      if (t && (t.matches('input, textarea, [contenteditable="true"]'))) {
        if (e.key === 'Escape') { const ov = this.querySelector('.compose-overlay'); if (ov) ov.remove(); }
        return;
      }
      const k = e.key;
      if (k === 'j') { e.preventDefault(); this._move(1); }
      else if (k === 'k') { e.preventDefault(); this._move(-1); }
      else if (k === 'Enter') { if (this.selected != null) { e.preventDefault(); this.openRow(this.selected); } }
      else if (k === 'r' && this.openMessage) { e.preventDefault(); this.reply(this.openMessage, false); }
      else if (k === 'a' && this.openMessage) { e.preventDefault(); this.reply(this.openMessage, true); }
      else if (k === 'f' && this.openMessage) { e.preventDefault(); this.forward(this.openMessage); }
      else if (k === 'e') { e.preventDefault(); this.archive(); }
      else if (k === '#') { e.preventDefault(); this.del(); }
      else if (k === 'u') { e.preventDefault(); this.markUnread(); }
      else if (k === 'c') { e.preventDefault(); this.compose(); }
      else if (k === '/') { e.preventDefault(); this.querySelector('.search-input').focus(); }
      else if (k === '?') { e.preventDefault(); this._showHelp(); }
      else if (k === 'Escape') { this._toggleDrawer(false); }
    });
  }

  _move(delta) {
    if (!this.messages.length) return;
    let i = this.selected == null ? 0 : this.selected + delta;
    i = Math.max(0, Math.min(this.messages.length - 1, i));
    const row = this._list.children[i];
    if (row) { row.scrollIntoView({ block: 'nearest' }); row.focus(); }
    this.selected = i;
    [...this._list.children].forEach((c) => c.classList.toggle('active', c.dataset.i === String(i)));
  }

  _showHelp() {
    if (this.querySelector('.help-overlay')) return;
    const o = document.createElement('div');
    o.className = 'help-overlay';
    o.innerHTML = `
      <div class="help-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <header><span>Keyboard shortcuts</span><button class="icon-btn help-close" aria-label="Close">✕</button></header>
        <dl class="help-keys">
          <dt>j / k</dt><dd>Next / previous message</dd>
          <dt>Enter</dt><dd>Open message</dd>
          <dt>r / a</dt><dd>Reply / reply all</dd>
          <dt>f</dt><dd>Forward</dd>
          <dt>e</dt><dd>Archive</dd>
          <dt>#</dt><dd>Delete</dd>
          <dt>u</dt><dd>Mark unread</dd>
          <dt>c</dt><dd>Compose</dd>
          <dt>/</dt><dd>Search</dd>
          <dt>?</dt><dd>This help</dd>
        </dl>
      </div>`;
    o.querySelector('.help-close').addEventListener('click', () => o.remove());
    o.addEventListener('click', (e) => { if (e.target === o) o.remove(); });
    this.appendChild(o);
  }
}

// ---- formatting helpers ----
function fmtDate(iso, full) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  if (full) return d.toLocaleString();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short' });
}
function fmtSize(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${u[i]}`;
}
function getMessageId(msg) {
  const h = (msg.headers || []).find((x) => x.name.toLowerCase() === 'message-id');
  return h ? h.value : '';
}

if (typeof customElements !== 'undefined' && !customElements.get('edot-mail')) {
  customElements.define('edot-mail', EdotMail);
}
