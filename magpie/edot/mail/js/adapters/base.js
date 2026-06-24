// base.js — the ONE backend-adapter interface every provider implements, plus
// the normalized data shapes the UI consumes. The contract here is what makes
// the rest of the app provider-agnostic: whether mail comes from Gmail REST,
// Microsoft Graph, JMAP, or an IMAP WebSocket proxy, every method returns the
// same shape.
//
// Mirrors js/git-remote.js and auth/js/oidc.js: the constructor takes an
// INJECTABLE fetch (`new XAdapter(config, { fetchImpl })`) so each adapter is
// unit-testable in Node against mocked responses with zero real network.
//
// ── normalized shapes (the whole point) ─────────────────────────────────────
//   Mailbox  { id, name, role, unread, total }
//     role ∈ inbox|sent|drafts|trash|archive|spam|custom
//   MessageSummary { id, threadId, from, to, subject, snippet, date,
//                    flags:{seen,flagged,answered}, hasAttachments }
//   Message  { id, threadId, headers, from, to, cc, date, subject,
//              bodyHtml, bodyText, attachments:[{id,name,mime,size}], flags }
//   Draft    { to[], cc[], bcc[], subject, html, text, inReplyTo, attachments[] }
//
// Subclasses MUST override the methods they support and advertise truthfully
// through capabilities(). The defaults here throw `unsupported`, so a UI that
// checks capabilities() first never calls into a hole.

export class MailAdapter {
  /**
   * @param {object} config   provider config (tokens, base URLs, …) — never secrets in code
   * @param {object} [opts]
   * @param {function} [opts.fetchImpl]  injectable fetch (defaults to window.fetch)
   */
  constructor(config = {}, { fetchImpl } = {}) {
    this.config = config;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.id = 'base';
  }

  // What this backend can actually do, so the UI can hide/disable controls.
  capabilities() {
    return { threads: false, search: false, push: false, flags: false, move: false, send: false };
  }

  // ---- the interface (override as supported) ----
  async listMailboxes() { throw unsupported('listMailboxes'); }
  async listMessages(/* mailboxId, { limit, cursor, query } */) { throw unsupported('listMessages'); }
  async getMessage(/* id */) { throw unsupported('getMessage'); }
  async getThread(/* threadId */) { throw unsupported('getThread'); }
  async search(/* query, { mailboxId } */) { throw unsupported('search'); }
  async sendMessage(/* draft */) { throw unsupported('sendMessage'); }
  async saveDraft(/* draft */) { throw unsupported('saveDraft'); }
  async setFlags(/* id, flags */) { throw unsupported('setFlags'); }
  async move(/* id, mailboxId */) { throw unsupported('move'); }
  async del(/* id */) { throw unsupported('del'); }
  async archive(/* id */) { throw unsupported('archive'); }

  // ---- shared helper: a small JSON REST request (git-remote.js style) ----
  // `auth` is added by subclasses via _headers(); errors carry .status/.data.
  async _json(method, url, { headers, body } = {}) {
    const res = await this.fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(this._headers()), ...(headers || {}) },
      body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const e = new Error((json && (json.error?.message || json.error_description || json.message)) || `${this.id} ${res.status}`);
      e.status = res.status; e.data = json; throw e;
    }
    return json;
  }

  // Subclasses with bearer tokens override this.
  _headers() { return {}; }
}

export function unsupported(op) {
  const e = new Error(`Operation not supported by this backend: ${op}`);
  e.code = 'unsupported';
  return e;
}

// ---- normalization helpers shared by adapters ------------------------------
// Best-effort parse of a "Display Name <addr@host>" string into {name,email}.
export function parseAddress(s) {
  if (!s) return { name: '', email: '' };
  if (typeof s === 'object') return { name: s.name || '', email: s.email || s.address || '' };
  const m = String(s).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  const bare = String(s).trim();
  return { name: '', email: bare };
}
export function parseAddressList(s) {
  if (Array.isArray(s)) return s.map(parseAddress);
  if (!s) return [];
  // Split on commas that aren't inside quotes/angle brackets (good enough).
  return splitTopLevel(String(s)).map(parseAddress).filter((a) => a.email || a.name);
}
function splitTopLevel(s) {
  const out = []; let buf = ''; let q = false; let ang = false;
  for (const c of s) {
    if (c === '"') q = !q;
    else if (c === '<') ang = true;
    else if (c === '>') ang = false;
    if (c === ',' && !q && !ang) { out.push(buf); buf = ''; } else buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export function formatAddress({ name, email }) {
  return name ? `${name} <${email}>` : email;
}
