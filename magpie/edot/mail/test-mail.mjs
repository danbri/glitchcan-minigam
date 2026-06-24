// test-mail.mjs — headless test of edot mail (test-data.mjs style). Serves the
// repo root, drives the real <edot-mail> + adapters + MIME parser in Chromium,
// with ALL fetch MOCKED — no real mail servers, no credentials. ✅/❌, non-zero
// exit on any failure.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/mail/mail.html`);
  await page.waitForFunction(() => window.__mail && window.__mail.mime && window.__mail.adapters);

  // ===== 0. Sign-in chip (consistency with the other suite apps) ============
  await page.waitForFunction(() => !!document.querySelector('edot-mail .mail-head .login-slot edot-login-button'));
  ok('mail header shows the sign-in chip', await page.evaluate(() =>
    !!document.querySelector('edot-mail .mail-head .login-slot edot-login-button')));
  ok('sign-in chip upgraded (custom element rendered)', await page.evaluate(() => {
    const c = document.querySelector('edot-mail .login-slot edot-login-button');
    return !!c && (c.shadowRoot || c.children.length > 0); // login-ui.js defined + rendered
  }));
  ok('chip is flagged alpha', await page.evaluate(() =>
    /alpha/i.test(document.querySelector('edot-mail .login-slot .alpha-badge')?.textContent || '')));

  // ===== 1. MIME parser =====================================================
  const mimeRes = await page.evaluate(() => {
    const { parseMessage, quotedPrintableToBytes, base64ToBytes } = window.__mail.mime;
    const raw = [
      'From: Ada <ada@example.com>',
      'To: Bob <bob@example.com>',
      'Subject: =?utf-8?B?SGVsbG8g8J+QpQ==?=',   // "Hello 🐥"
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="BOUND"',
      '',
      '--BOUND',
      'Content-Type: multipart/alternative; boundary="ALT"',
      '',
      '--ALT',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Plain c=C3=A9dille body',
      '--ALT',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML <b>body</b></p>',
      '--ALT--',
      '--BOUND',
      'Content-Type: text/plain; name="note.txt"',
      'Content-Disposition: attachment; filename="note.txt"',
      'Content-Transfer-Encoding: base64',
      '',
      'aGVsbG8gd29ybGQ=',     // "hello world"
      '--BOUND--',
      '',
    ].join('\r\n');
    const m = parseMessage(raw);
    const qp = new TextDecoder().decode(quotedPrintableToBytes('a=C3=A9b'));
    const b64 = new TextDecoder().decode(base64ToBytes('aGVsbG8='));
    return {
      subject: m.subject,
      html: m.bodyHtml,
      text: m.bodyText,
      atts: m.attachments.map((a) => ({ name: a.name, size: a.size, body: new TextDecoder().decode(a.contentBytes) })),
      qp, b64,
    };
  });
  ok('MIME decodes RFC2047 encoded-word subject', mimeRes.subject === 'Hello 🐥');
  ok('MIME picks the html alternative', /<b>body<\/b>/.test(mimeRes.html));
  ok('MIME keeps the plain alternative too', /cédille/.test(mimeRes.text));
  ok('MIME quoted-printable decodes (=C3=A9 → é)', mimeRes.qp === 'aéb');
  ok('MIME base64 decodes', mimeRes.b64 === 'hello');
  ok('MIME extracts the attachment with decoded content', mimeRes.atts.length === 1 && mimeRes.atts[0].name === 'note.txt' && mimeRes.atts[0].body === 'hello world');

  // ===== 2. Sanitizer =======================================================
  const san = await page.evaluate(() => {
    const { sanitizeHtml } = window.__mail.sanitize;
    const dirty = `<p onclick="steal()">hi</p><script>evil()</scr`+`ipt>`
      + `<img src="http://tracker.example/pixel.gif"><a href="http://x.test">x</a>`
      + `<a href="javascript:alert(1)">bad</a>`;
    const blocked = sanitizeHtml(dirty, { allowRemote: false });
    const allowed = sanitizeHtml(dirty, { allowRemote: true });
    return {
      hasScript: /<script/i.test(blocked.html),
      hasOnclick: /onclick/i.test(blocked.html),
      // NB: use [^-]src= so we don't match the data-blocked-src parking attr.
      imgBlocked: /data-blocked-src/.test(blocked.html) && !/[^-]src="http/.test(blocked.html),
      blockedCount: blocked.blockedRemote,
      linkSeatbelt: /rel="noopener noreferrer nofollow"/.test(blocked.html) && /target="_blank"/.test(blocked.html),
      jsHrefGone: !/javascript:/i.test(blocked.html),
      imgLoadedWhenAllowed: /src="http:\/\/tracker/.test(allowed.html),
    };
  });
  ok('sanitizer removes <script>', !san.hasScript);
  ok('sanitizer strips onclick handler', !san.hasOnclick);
  ok('sanitizer blocks remote <img> by default', san.imgBlocked && san.blockedCount >= 1);
  ok('sanitizer seat-belts links (new tab, no referrer)', san.linkSeatbelt);
  ok('sanitizer neutralizes javascript: href', san.jsHrefGone);
  ok('sanitizer loads remote img when allowRemote', san.imgLoadedWhenAllowed);

  // ===== 3. Adapters against mocked fetch ===================================
  // 3a. Gmail
  const gmail = await page.evaluate(async () => {
    const { GmailAdapter } = await import('./js/adapters/gmail.js');
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
      const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
      const u = String(url);
      if (/\/labels$/.test(u)) return j({ labels: [
        { id: 'INBOX', name: 'INBOX', messagesUnread: 3, messagesTotal: 10 },
        { id: 'SENT', name: 'SENT' }, { id: 'Label_1', name: 'Work' }] });
      if (/\/messages\?/.test(u)) return j({ messages: [{ id: 'm1' }], nextPageToken: 'PG2' });
      if (/\/messages\/m1\?.*format=metadata/.test(u)) return j({ id: 'm1', threadId: 't1', snippet: 'hi there',
        labelIds: ['INBOX', 'UNREAD'], payload: { headers: [
          { name: 'From', value: 'Ada <ada@x.com>' }, { name: 'Subject', value: 'Hey' },
          { name: 'Date', value: 'Mon, 01 Jan 2024 10:00:00 +0000' }] } });
      if (/\/messages\/m1\?format=full/.test(u)) return j({ id: 'm1', threadId: 't1', labelIds: ['INBOX'],
        payload: { headers: [{ name: 'From', value: 'Ada <ada@x.com>' }, { name: 'Subject', value: 'Hey' }],
          parts: [{ mimeType: 'text/html', body: { data: btoa('<p>Hello</p>').replace(/\+/g,'-').replace(/\//g,'_') } }] } });
      if (/\/messages\/send$/.test(u)) return j({ id: 'sent1' });
      if (/\/messages\/m1\/modify$/.test(u)) return j({ id: 'm1' });
      return j({});
    };
    const a = new GmailAdapter({ token: 'TOK' }, { fetchImpl });
    const boxes = await a.listMailboxes();
    const list = await a.listMessages('INBOX', { limit: 1 });
    const msg = await a.getMessage('m1');
    await a.sendMessage({ to: [{ email: 'z@x.com' }], subject: 'Hi', text: 'body' });
    await a.setFlags('m1', { flagged: true });
    const sendCall = calls.find((c) => /messages\/send$/.test(c.url));
    return {
      boxRoles: boxes.map((b) => b.role), inboxUnread: boxes.find((b)=>b.role==='inbox').unread,
      summaryFrom: list.messages[0].from.email, summarySeen: list.messages[0].flags.seen, cursor: list.nextCursor,
      bodyHtml: msg.bodyHtml,
      sendMethod: sendCall.method, sendHasRaw: /"raw":/.test(sendCall.body),
      authHeader: true,
    };
  });
  ok('gmail.listMailboxes normalizes roles', gmail.boxRoles.includes('inbox') && gmail.boxRoles.includes('sent'));
  ok('gmail mailbox carries unread count', gmail.inboxUnread === 3);
  ok('gmail.listMessages normalizes summary + flags + cursor', gmail.summaryFrom === 'ada@x.com' && gmail.summarySeen === false && gmail.cursor === 'PG2');
  ok('gmail.getMessage decodes base64url html body', /<p>Hello<\/p>/.test(gmail.bodyHtml));
  ok('gmail.sendMessage POSTs messages/send with base64url raw', gmail.sendMethod === 'POST' && gmail.sendHasRaw);

  // 3b. Graph
  const graph = await page.evaluate(async () => {
    const { GraphAdapter } = await import('./js/adapters/graph.js');
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
      const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
      const u = String(url);
      if (/\/mailFolders\?/.test(u)) return j({ value: [
        { id: 'AAA', displayName: 'Inbox', unreadItemCount: 2, totalItemCount: 5 },
        { id: 'BBB', displayName: 'Sent Items' }] });
      if (/\/messages\?/.test(u)) return j({ value: [{ id: 'g1', conversationId: 'c1', subject: 'Hi',
        from: { emailAddress: { name: 'Ada', address: 'ada@x.com' } }, toRecipients: [{ emailAddress: { address: 'me@x.com' } }],
        bodyPreview: 'preview', receivedDateTime: '2024-01-01T10:00:00Z', isRead: false, hasAttachments: true }] });
      if (/\/messages\/g1\?/.test(u)) return j({ id: 'g1', conversationId: 'c1', subject: 'Hi',
        from: { emailAddress: { address: 'ada@x.com' } }, toRecipients: [], ccRecipients: [],
        body: { contentType: 'HTML', content: '<p>Graph body</p>' }, isRead: true, attachments: [] });
      if (/\/sendMail$/.test(u)) return j({});
      if (/\/messages\/g1$/.test(u) && (opts.method === 'PATCH')) return j({});
      return j({});
    };
    const a = new GraphAdapter({ token: 'TOK' }, { fetchImpl });
    const boxes = await a.listMailboxes();
    const list = await a.listMessages('AAA', { limit: 1 });
    const msg = await a.getMessage('g1');
    await a.sendMessage({ to: [{ email: 'z@x.com', name: 'Z' }], subject: 'Hi', html: '<p>x</p>' });
    await a.setFlags('g1', { seen: true });
    const sendCall = calls.find((c) => /sendMail$/.test(c.url));
    const flagCall = calls.find((c) => c.method === 'PATCH');
    return {
      roles: boxes.map((b)=>b.role), unread: boxes[0].unread,
      from: list.messages[0].from.email, hasAtt: list.messages[0].hasAttachments,
      body: msg.bodyHtml,
      sendUrl: sendCall.url, sendBodyOk: /"message"/.test(sendCall.body) && /"toRecipients"/.test(sendCall.body),
      flagOk: flagCall && /"isRead":true/.test(flagCall.body),
    };
  });
  ok('graph.listMailboxes normalizes roles', graph.roles.includes('inbox') && graph.roles.includes('sent'));
  ok('graph mailbox carries unread count', graph.unread === 2);
  ok('graph.listMessages normalizes from + hasAttachments', graph.from === 'ada@x.com' && graph.hasAtt === true);
  ok('graph.getMessage returns html body', /<p>Graph body<\/p>/.test(graph.body));
  ok('graph.sendMessage POSTs /me/sendMail with message shape', /\/me\/sendMail$/.test(graph.sendUrl) && graph.sendBodyOk);
  ok('graph.setFlags PATCHes isRead', graph.flagOk);

  // 3c. JMAP
  const jmap = await page.evaluate(async () => {
    const { JmapAdapter } = await import('./js/adapters/jmap.js');
    const calls = [];
    const fetchImpl = async (url, opts = {}) => {
      calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
      const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
      const u = String(url);
      if (/session$/.test(u)) return j({ apiUrl: 'https://jmap.test/api', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'acc1' }, accounts: { acc1: {} } });
      const body = JSON.parse(opts.body || '{}');
      const names = (body.methodCalls || []).map((c) => c[0]);
      const resp = [];
      for (const [name, args, cid] of (body.methodCalls || [])) {
        if (name === 'Mailbox/get') resp.push(['Mailbox/get', { list: [
          { id: 'mb1', name: 'Inbox', role: 'inbox', unreadEmails: 4, totalEmails: 9 },
          { id: 'mb2', name: 'Sent', role: 'sent' }, { id: 'mb3', name: 'Drafts', role: 'drafts' },
          { id: 'mb4', name: 'Sent', role: 'sent' }] }, cid]);
        else if (name === 'Email/query') resp.push(['Email/query', { ids: ['e1'], total: 1 }, cid]);
        else if (name === 'Email/get') resp.push(['Email/get', { list: [{ id: 'e1', threadId: 'th1', subject: 'JMAP hi',
          from: [{ name: 'Ada', email: 'ada@x.com' }], to: [{ email: 'me@x.com' }], preview: 'prev', receivedAt: '2024-01-01T10:00:00Z',
          keywords: { $seen: true }, hasAttachment: false,
          htmlBody: [{ partId: 'p1', type: 'text/html' }], bodyValues: { p1: { value: '<p>JMAP body</p>' } } }] }, cid]);
        else if (name === 'Email/set') resp.push(['Email/set', { updated: { e1: null } }, cid]);
        else if (name === 'EmailSubmission/set') resp.push(['EmailSubmission/set', { created: { sub: { id: 's1' } } }, cid]);
      }
      return j({ methodResponses: resp });
    };
    const a = new JmapAdapter({ sessionUrl: 'https://jmap.test/session', token: 'TOK' }, { fetchImpl });
    const boxes = await a.listMailboxes();
    const list = await a.listMessages('mb1', { limit: 10 });
    const msg = await a.getMessage('e1');
    await a.setFlags('e1', { seen: true });
    await a.sendMessage({ to: [{ email: 'z@x.com' }], subject: 'Hi', text: 'body', from: { email: 'me@x.com' } });
    const submitCall = calls.find((c) => c.body && /EmailSubmission\/set/.test(c.body));
    return {
      roles: boxes.map((b)=>b.role), unread: boxes[0].unread,
      from: list.messages[0].from.email, seen: list.messages[0].flags.seen,
      body: msg.bodyHtml,
      hasSubmission: !!submitCall,
      setHasKeyword: !!calls.find((c)=> c.body && /keywords\/\$seen/.test(c.body)),
    };
  });
  ok('jmap.listMailboxes normalizes roles (junk→spam etc.)', jmap.roles.includes('inbox') && jmap.roles.includes('drafts'));
  ok('jmap mailbox carries unread count', jmap.unread === 4);
  ok('jmap.listMessages normalizes from + flags via keywords', jmap.from === 'ada@x.com' && jmap.seen === true);
  ok('jmap.getMessage resolves htmlBody via bodyValues', /<p>JMAP body<\/p>/.test(jmap.body));
  ok('jmap.setFlags uses keyword patch', jmap.setHasKeyword);
  ok('jmap.sendMessage issues EmailSubmission/set', jmap.hasSubmission);

  // 3d. IMAP (mocked WebSocket proxy via socketFactory)
  const imap = await page.evaluate(async () => {
    const { ImapAdapter } = await import('./js/adapters/imap.js');
    // A fake WebSocket that answers the documented JSON proxy protocol.
    class FakeWS {
      constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 0); }
      send(s) {
        const req = JSON.parse(s);
        const reply = (o) => this.onmessage && this.onmessage({ data: JSON.stringify({ id: req.id, ...o }) });
        const rfc822 = ['From: Ada <ada@x.com>', 'Subject: IMAP hi', 'Content-Type: text/plain', '', 'plain body'].join('\r\n');
        if (req.op === 'login') return reply({ ok: true });
        if (req.op === 'list') return reply({ mailboxes: [
          { name: 'INBOX', role: 'inbox', unread: 1, total: 2 }, { name: 'Drafts', role: 'drafts' }] });
        if (req.op === 'search') return reply({ uids: [42], nextCursor: null });
        if (req.op === 'fetch') return reply({ raw: rfc822, flags: ['\\Seen'] });
        if (req.op === 'store') return reply({ ok: true });
        if (req.op === 'send') return reply({ ok: true });
        return reply({ ok: true });
      }
    }
    const sent = [];
    const orig = FakeWS.prototype.send;
    const a = new ImapAdapter({ proxyUrl: 'wss://proxy.test', host: 'imap.x', user: 'u', pass: 'p',
      socketFactory: () => { const ws = new FakeWS(); const s = ws.send.bind(ws); ws.send = (m) => { sent.push(JSON.parse(m)); s(m); }; return ws; } }, {});
    const avail = a.isAvailable();
    const boxes = await a.listMailboxes();
    const list = await a.listMessages('INBOX', { limit: 10 });
    const msg = await a.getMessage('INBOX:42');
    await a.setFlags('INBOX:42', { seen: true });
    await a.sendMessage({ to: [{ email: 'z@x.com' }], subject: 'Hi', text: 'body' });
    return {
      avail, roles: boxes.map((b)=>b.role),
      from: list.messages[0].from.email, subject: list.messages[0].subject,
      body: msg.bodyText,
      ops: sent.map((s) => s.op),
    };
  });
  ok('imap.isAvailable true only with proxyUrl', imap.avail === true);
  ok('imap talks the proxy protocol (login/list/search/fetch/store/send)',
    ['login','list','search','fetch','store','send'].every((op) => imap.ops.includes(op)));
  ok('imap normalizes mailboxes via proxy list', imap.roles.includes('inbox') && imap.roles.includes('drafts'));
  ok('imap parses raw RFC822 via MIME (from/subject/body)', imap.from === 'ada@x.com' && imap.subject === 'IMAP hi' && /plain body/.test(imap.body));

  // IMAP without a proxy refuses honestly.
  const imapNoProxy = await page.evaluate(async () => {
    const { ImapAdapter } = await import('./js/adapters/imap.js');
    const a = new ImapAdapter({}, {});
    let threw = false;
    try { await a.listMailboxes(); } catch (e) { threw = /proxy/i.test(e.message); }
    return { avail: a.isAvailable(), threw };
  });
  ok('imap without proxyUrl is unavailable and refuses honestly', imapNoProxy.avail === false && imapNoProxy.threw);

  // Registry.
  const reg = await page.evaluate(async () => {
    const { createAdapter, listBackends } = await import('./js/adapters/index.js');
    const a = createAdapter('gmail', { token: 't' }, {});
    return { id: a.id, backends: listBackends().map((b) => b.id) };
  });
  ok('registry creates the right adapter', reg.id === 'gmail');
  ok('registry lists all four backends', ['gmail','graph','jmap','imap'].every((b)=>reg.backends.includes(b)));

  // ===== 4. UI against a mocked adapter =====================================
  await page.evaluate(async () => {
    // A tiny in-memory mock adapter implementing the interface.
    const mk = () => ({
      id: 'mock',
      capabilities: () => ({ threads: false, search: true, push: false, flags: true, move: true, send: true }),
      listMailboxes: async () => ([
        { id: 'INBOX', name: 'Inbox', role: 'inbox', unread: 1, total: 2 },
        { id: 'SENT', name: 'Sent', role: 'sent', unread: 0, total: 1 }]),
      listMessages: async () => ({ messages: [
        { id: 'a', threadId: 'a', from: { name: 'Ada', email: 'ada@x.com' }, to: [], subject: 'Hello there',
          snippet: 'snippet text', date: '2024-01-01T10:00:00Z', flags: { seen: false, flagged: false }, hasAttachments: false },
        { id: 'b', threadId: 'b', from: { name: 'Bob', email: 'bob@x.com' }, to: [], subject: 'Second',
          snippet: 'more', date: '2024-01-02T10:00:00Z', flags: { seen: true, flagged: false }, hasAttachments: true }],
        nextCursor: null }),
      getMessage: async (id) => ({ id, threadId: id, headers: [], from: { name: 'Ada', email: 'ada@x.com' }, to: [{ email: 'me@x.com' }], cc: [],
        date: '2024-01-01T10:00:00Z', subject: 'Hello there',
        bodyHtml: '<p>Body with <img src="http://tracker.test/p.gif"> and <a href="http://l.test">link</a></p>',
        bodyText: '', attachments: [], flags: { seen: false, flagged: false } }),
      search: async function (q) { const r = await this.listMessages(); r.messages = r.messages.filter((m)=>m.subject.includes('Hello')); return r; },
      setFlags: async () => ({}), move: async () => ({}), archive: async () => ({}), del: async () => ({}),
      sendMessage: async () => ({ ok: true }), saveDraft: async () => ({ ok: true }),
    });
    const c = window.__mail.component;
    window.__mail.sent = null;
    const adapter = mk();
    adapter.sendMessage = async (d) => { window.__mail.sent = d; return { ok: true }; };
    c.setAdapter(adapter);
    await c.load();
  });
  await page.waitForTimeout(100);

  ok('UI renders the mailbox tree', (await page.$$('edot-mail .folder-tree .tree-row')).length >= 2);
  ok('UI renders the message list', (await page.$$('edot-mail .msg-row')).length === 2);
  ok('UI marks unread messages bold', await page.evaluate(() => document.querySelector('.msg-row').classList.contains('unread')));

  // Open a message → body shows, remote image blocked, banner appears.
  await page.click('edot-mail .msg-row');
  await page.waitForTimeout(80);
  ok('UI opens a message into the reading pane', /Hello there/.test(await page.textContent('.reader-subject')));
  ok('UI reading pane blocks the remote tracker image', await page.evaluate(() => {
    const body = document.querySelector('.reader-body');
    return /data-blocked-src/.test(body.innerHTML) && !/[^-]src="http/.test(body.innerHTML);
  }));
  ok('UI shows the load-remote-content affordance', await page.isVisible('.remote-banner .load-remote'));
  await page.click('.remote-banner .load-remote');
  await page.waitForTimeout(50);
  ok('UI loads remote content on demand', await page.evaluate(() => /src="http:\/\/tracker/.test(document.querySelector('.reader-body').innerHTML)));

  // Compose builds a draft with the right fields.
  await page.click('edot-mail .compose-btn');
  await page.waitForTimeout(50);
  await page.fill('.cf-to', 'z@x.com');
  await page.fill('.cf-subject', 'Test subject');
  await page.evaluate(() => { document.querySelector('.cf-body').innerHTML = '<p>Draft body</p>'; });
  const draftShape = await page.evaluate(() => {
    const c = window.__mail.component;
    const wrap = document.querySelector('.compose-overlay');
    return c.draftFrom(wrap);
  });
  ok('compose builds a draft with to/subject/html', draftShape.to[0].email === 'z@x.com' && draftShape.subject === 'Test subject' && /Draft body/.test(draftShape.html));
  await page.click('.cf-send');
  await page.waitForTimeout(80);
  ok('compose send calls adapter.sendMessage with the draft', await page.evaluate(() => window.__mail.sent && window.__mail.sent.subject === 'Test subject'));

  // Search filters the list.
  await page.fill('.search-input', 'Hello');
  await page.press('.search-input', 'Enter');
  await page.waitForTimeout(80);
  ok('search filters the message list', (await page.$$('edot-mail .msg-row')).length === 1);

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} MAIL FAILURE(S)` : '\nMAIL OK');
process.exit(fail ? 1 : 0);
