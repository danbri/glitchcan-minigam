// The Chat window: rooms, direct messages, and the apps talking beside them.
//
// Shell chrome, not a sandboxed app: a server password typed here goes straight
// into FoafSecrets (chat.configure) and the field is cleared. Everything shown
// comes through textContent, so nothing said in a room can become markup.
// Design and log: docs/foafos-chat-window-20261104.md.

import { describeGrant } from '../../packages/foafos/src/tool-grants.mjs';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k in e && k !== 'list') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid);
  return e;
};

const LOCAL_URL = 'ws://127.0.0.1:5280/xmpp-websocket';
// A public test server, by invitation. No password here: the person enters one.
const SHARED_URL = 'wss://foafos-xmpp.fly.dev/xmpp-websocket';
const SHARED_DOMAIN = 'foafos-xmpp.fly.dev';
const time = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Errors say what happened and what to do about it.
export function explainConnect(reason = '') {
  if (/no password/i.test(reason)) return 'Enter the password to connect. To keep it after a reload, set a passphrase under Session in the menu.';
  if (/not-authorized/.test(reason)) return 'The server refused that account or password. Check both, then connect again.';
  if (/cannot open/.test(reason)) return `Nothing answered at that address. Check that the server is running and allows this page (${location.origin}).`;
  if (/stream:features|host-unknown/.test(reason)) return 'That server does not host this domain. Check the domain in Advanced.';
  if (/timed out/.test(reason)) return 'The server did not answer in time. Check that it is running, then connect again.';
  if (/SCRAM mechanism/.test(reason)) return 'That server does not offer a sign-in method this window can use.';
  return reason || 'Could not connect.';
}
const REFUSED = {
  'bad-url': 'The server address must start with ws:// or wss://.',
  'bad-name': 'The room or nickname has a character it cannot contain.',
  'bad-mirror': 'Check the list of shared activity.',
  'bad-resource': 'A browser name uses letters, digits, dots, dashes and underscores.',
  'bad-jid': 'Allowed accounts must look like name@server, separated by spaces.',
};

const STATE = {
  online: 'Connected', connecting: 'Connecting', reconnecting: 'Reconnecting', error: 'Not connected',
  stopped: 'Not connected', off: 'Chat is off',
};

const glyphFor = (topic) => {
  if (topic.startsWith('tools.') || topic === 'app.tools') return '⌘';
  if (topic === 'app.spawn') return '+';
  if (topic === 'app.close') return '−';
  if (topic.startsWith('audio.')) return '♪';
  if (topic.startsWith('pods.')) return '◇';
  return '·';
};

export function mountChat(root, { chat, tools, grants, run }) {
  let current = null;                 // the open conversation's jid
  let view = 'connect';
  let settingsByHand = false;         // the person opened the connect screen themselves
  let showActivity = true;
  let infoTab = 'members';
  let drawn = { jid: null, count: 0, last: 0 };
  const history = [];
  let historyAt = -1;
  const open = new Set();             // event groups the person expanded

  root.classList.add('fc');

  // ── the connect screen ──────────────────────────────────────────────────
  const place = () => {
    const c = chat.config();
    if (c.mode !== 'server') return 'builtin';
    if (c.url === SHARED_URL && c.domain === SHARED_DOMAIN) return 'shared';
    return c.url === LOCAL_URL && c.domain === 'localhost' ? 'computer' : 'other';
  };
  const radio = (value, title, text) => h('label', { class: 'fc-place' },
    h('input', { type: 'radio', name: 'fc-place', value, on: { change: drawForm } }),
    h('span', { class: 'fc-place-text' }, h('strong', {}, title), h('span', {}, text)));
  const fUrl = h('input', { id: 'chat-url', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fDomain = h('input', { id: 'chat-domain', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fUser = h('input', { id: 'chat-username', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fPass = h('input', { id: 'chat-password', type: 'password', autocomplete: 'new-password' });
  const fNick = h('input', { id: 'chat-nick', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fResource = h('input', { id: 'chat-resource', type: 'text', spellcheck: false, autocomplete: 'off', placeholder: 'chrome' });
  const fRoom = h('input', { id: 'chat-room', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fRoomDomain = h('input', { id: 'chat-room-domain', type: 'text', spellcheck: false, autocomplete: 'off' });
  const fMirror = h('textarea', { id: 'chat-mirror', rows: 3, spellcheck: false });
  // These two apply at once, so that switching one off needs no reconnect.
  const fMirrorApps = h('select', { id: 'chat-mirror-apps', on: { change: () => chat.configure({ mirrorApps: fMirrorApps.value }) } },
    h('option', { value: 'off' }, 'Nothing'),
    h('option', { value: 'topics' }, 'Only that they spoke'),
    h('option', { value: 'data' }, 'What they said, with secrets removed'));
  const fInbound = h('input', { id: 'chat-inbound', type: 'checkbox', on: { change: () => chat.configure({ inbound: fInbound.checked }) } });
  const row = (label, input, hint) => h('label', { class: 'fc-field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
  // Who may use the apps from outside this window. An account or a browser agent
  // can do nothing here until it is listed, and what is listed is all it can do.
  const grantList = h('ul', { class: 'fc-grants' });
  const gWho = h('input', { id: 'chat-grant-who', type: 'text', spellcheck: false, autocomplete: 'off', placeholder: 'foafbot@localhost', 'aria-label': 'Account' });
  const gApp = h('select', { id: 'chat-grant-app', 'aria-label': 'App' });
  const gWhat = h('input', { id: 'chat-grant-what', type: 'text', spellcheck: false, autocomplete: 'off', placeholder: 'go_to', 'aria-label': 'Tools it may use as well as looking' });
  const gAll = h('input', { id: 'chat-grant-all', type: 'checkbox' });
  const gError = h('p', { class: 'fc-error', role: 'alert' });
  const appName = (id) => (id === '*' ? 'Every app' : id === 'shell' ? 'Opening apps, activity' : tools.list().find((a) => a.id === id)?.label || id);
  const whoName = (id) => (id === 'browser-agent' ? 'Browser agent' : id);
  function drawGrants() {
    grantList.replaceChildren(...grants.list().map((g) => h('li', {},
      h('span', { class: 'fc-grant-who' }, whoName(g.caller)),
      h('span', {}, `${appName(g.app)}: ${describeGrant(g)}`),
      h('button', { type: 'button', class: 'fc-quiet', 'aria-label': `Take back ${appName(g.app)} from ${whoName(g.caller)}`, on: { click: () => grants.revoke(g.caller, g.app) } }, 'Take back'))));
    if (!grantList.children.length) grantList.append(h('li', { class: 'fc-muted' }, 'Nobody else can use your apps.'));
    const picked = gApp.value;
    gApp.replaceChildren(...['*', ...tools.list().map((a) => a.id), 'shell'].map((id) => h('option', { value: id }, appName(id))));
    if ([...gApp.options].some((o) => o.value === picked)) gApp.value = picked;
  }
  function addGrant() {
    const who = gWho.value.trim();
    const r = grants.grant(who === 'agent' ? 'browser-agent' : who, gApp.value, { level: gAll.checked ? 'all' : 'look', tools: gWhat.value.split(/[\s,]+/).filter(Boolean) });
    gError.textContent = r.ok ? '' : { 'bad-caller': 'Enter an account such as foafbot@localhost, or agent for a browser agent.', 'bad-tool': 'Tool names are single words, such as go_to.' }[r.reason] || `Refused: ${r.reason}`;
    if (r.ok) { gWho.value = ''; gWhat.value = ''; gAll.checked = false; }
  }
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); addGrant(); } };
  gWho.addEventListener('keydown', onEnter);
  gWhat.addEventListener('keydown', onEnter);
  const grantsPanel = h('div', { class: 'fc-field', id: 'chat-grants' },
    h('span', {}, 'Who may use your apps'),
    h('small', {}, 'Accounts that message this shell, and browser agents. Looking changes nothing. Add tools by name, or tick Everything.'),
    grantList,
    h('div', { class: 'fc-grant-add' }, gWho, gApp, gWhat,
      h('label', { class: 'fc-grant-all' }, gAll, 'Everything'),
      h('button', { type: 'button', id: 'chat-grant-add', class: 'fc-primary', on: { click: addGrant } }, 'Allow')),
    gError);
  drawGrants();
  const passRow = row('Password', fPass);
  const userRow = row('Account', fUser);
  const serverRows = h('div', { class: 'fc-server' }, row('Server address', fUrl, 'A WebSocket address, such as wss://example.org/xmpp-websocket'), row('Domain', fDomain));
  const connectError = h('p', { class: 'fc-error', role: 'alert' });
  const connectBtn = h('button', { type: 'submit', class: 'fc-primary' }, 'Connect');
  const backBtn = h('button', { type: 'button', class: 'fc-quiet', on: { click: () => { settingsByHand = false; setView('chat'); } } }, 'Back to chat');
  const offBtn = h('button', { type: 'button', class: 'fc-quiet', on: { click: () => chat.stop() } }, 'Disconnect');
  const form = h('form', { class: 'fc-connect', autocomplete: 'off', on: { submit: connect } },
    h('h2', {}, 'Where should chat connect?'),
    h('div', { class: 'fc-places', role: 'radiogroup', 'aria-label': 'Where to connect' },
      radio('builtin', 'In this page', 'Private to this tab. Nothing to set up.'),
      radio('computer', 'This computer', 'Use a server on this machine, so other chat apps can join.'),
      radio('shared', 'Shared test server', 'Join other shells and chat apps, with an invited account. Everyone there can read the room. Test data only.'),
      radio('other', 'Another server', 'Use any XMPP server that offers a WebSocket.')),
    serverRows, userRow, passRow,
    h('details', { class: 'fc-advanced' }, h('summary', {}, 'Advanced'),
      row('Your nickname', fNick), row('Name for this browser', fResource, 'Optional. Lets others reach this browser alone, as account/name. Use a different name in each browser.'), row('Activity room', fRoom), row('Rooms service', fRoomDomain, 'Leave empty to use rooms.DOMAIN'),
      row('Activity to share', fMirror, 'Topics sent to the activity room, separated by spaces'),
      row('What apps say on the bus', fMirrorApps, 'Everyone in the activity room can read this'),
      h('label', { class: 'fc-field' }, h('span', {}, 'Let allowed accounts send actions to apps'), fInbound,
        h('small', {}, 'Each account also needs a grant that names the action, for example /grant me@localhost playlist pause')),
      grantsPanel),
    connectError,
    h('div', { class: 'fc-actions' }, connectBtn, backBtn, offBtn));
  const places = () => [...form.querySelectorAll('input[name=fc-place]')];

  function fillForm() {
    const c = chat.config();
    const p = place();
    for (const r of places()) r.checked = r.value === p;
    fUrl.value = c.url; fDomain.value = c.domain; fUser.value = c.username || 'foafos';
    fNick.value = c.nick; fResource.value = c.resource || ''; fRoom.value = c.room; fRoomDomain.value = c.roomDomain;
    fMirror.value = c.mirror.join(' ');
    fMirrorApps.value = c.mirrorApps;
    fInbound.checked = c.inbound;
    drawForm();
  }
  function drawForm() {
    const p = places().find((r) => r.checked)?.value || 'builtin';
    serverRows.hidden = p !== 'other';
    userRow.hidden = passRow.hidden = p === 'builtin';
    fPass.placeholder = chat.hasPassword() ? 'Saved until you reload this page' : '';
    if (p === 'computer') { fUrl.value = LOCAL_URL; fDomain.value = 'localhost'; }
    if (p === 'shared') { fUrl.value = SHARED_URL; fDomain.value = SHARED_DOMAIN; }
    connectBtn.textContent = chat.state === 'online' ? 'Reconnect' : 'Connect';
    backBtn.hidden = chat.state !== 'online';
    offBtn.hidden = !['online', 'reconnecting'].includes(chat.state);
  }
  async function connect(e) {
    e.preventDefault();
    connectError.textContent = '';
    const p = places().find((r) => r.checked)?.value || 'builtin';
    const password = fPass.value;
    fPass.value = '';
    // Each shell in a shared room needs a nickname of its own, or the room refuses it.
    if (p === 'shared' && fNick.value.trim() === 'foafos') fNick.value = `foafos-${fResource.value.trim() || Math.random().toString(16).slice(2, 6)}`;
    const r = chat.configure({
      mode: p === 'builtin' ? 'builtin' : 'server', url: fUrl.value.trim(), domain: fDomain.value.trim(),
      username: fUser.value.trim(), nick: fNick.value.trim(), resource: fResource.value.trim(), room: fRoom.value.trim(),
      roomDomain: fRoomDomain.value.trim(), mirror: fMirror.value.split(/\s+/).filter(Boolean),
    }, { password });
    if (!r.ok) { connectError.textContent = REFUSED[r.reason] || `Refused: ${r.reason}`; return; }
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting';
    const started = await chat.start();
    connectBtn.disabled = false;
    if (!started.ok) { connectError.textContent = explainConnect(started.reason); drawForm(); return; }
    current = chat.roomJid();
    settingsByHand = false;
    setView('chat');
  }

  // ── the conversation screen ─────────────────────────────────────────────
  const list = h('nav', { class: 'fc-list', 'aria-label': 'Conversations' });
  const newBox = h('input', { type: 'text', 'aria-label': 'Room name or account', placeholder: 'Room or name@server', spellcheck: false, autocomplete: 'off' });
  const newForm = h('form', { class: 'fc-new', on: { submit: startNew } }, newBox);
  const sideClose = h('button', { type: 'button', class: 'fc-icon fc-close fc-side-close', 'aria-label': 'Close conversations', on: { click: () => togglePanel('side') } }, '×');
  const side = h('aside', { class: 'fc-side' }, sideClose, list, newForm);
  // Wide, each side panel is shown until hidden, and that is remembered. Narrow, each slides over the chat.
  for (const name of ['side', 'info']) {
    try { if (localStorage.getItem(`foafos.chat.hide.${name}`)) root.classList.add(`fc-hide-${name}`); } catch { /* shown */ }
  }
  function togglePanel(name) {
    if (root.getBoundingClientRect().width <= 760) { root.classList.toggle(`fc-show-${name}`); return; }
    const hidden = root.classList.toggle(`fc-hide-${name}`);
    try { localStorage.setItem(`foafos.chat.hide.${name}`, hidden ? '1' : ''); } catch { /* for this visit only */ }
  }
  const title = h('h2', { class: 'fc-title' });
  const status = h('button', { type: 'button', class: 'fc-status', title: 'Connection settings', on: { click: () => { settingsByHand = true; setView('connect'); } } });
  const sideBtn = h('button', { type: 'button', class: 'fc-icon fc-side-toggle', 'aria-label': 'Show conversations', on: { click: () => togglePanel('side') } }, '☰');
  const actToggle = h('label', { class: 'fc-toggle' },
    h('input', { type: 'checkbox', checked: true, on: { change: (e) => { showActivity = e.target.checked; drawLog(true); } } }), 'App activity');
  const infoBtn = h('button', { type: 'button', class: 'fc-icon fc-info-toggle', 'aria-label': 'Show details', on: { click: () => togglePanel('info') } }, 'ⓘ');
  const head = h('header', { class: 'fc-head' }, sideBtn, title, actToggle, status, infoBtn);
  const log = h('ol', { class: 'fc-log', role: 'log', 'aria-label': 'Messages', 'aria-live': 'polite', tabIndex: 0, on: { scroll: onScroll } });
  const jump = h('button', { type: 'button', class: 'fc-jump', hidden: true, on: { click: () => stick(true) } }, 'Jump to latest');
  const input = h('textarea', { id: 'chat-say', rows: 1, 'aria-label': 'Message', placeholder: 'Message, or / for commands', on: { keydown: onKey, input: onInput } });
  const send = h('button', { type: 'submit', class: 'fc-primary' }, 'Send');
  const hints = h('ul', { class: 'fc-hints', hidden: true });
  const composer = h('form', { class: 'fc-composer', on: { submit: (e) => { e.preventDefault(); submit(); } } }, hints, input, send);
  const main = h('section', { class: 'fc-main' }, head, h('div', { class: 'fc-logwrap' }, log, jump), composer);
  const tabM = h('button', { type: 'button', role: 'tab', on: { click: () => { infoTab = 'members'; drawInfo(); } } }, 'Accounts');
  const tabT = h('button', { type: 'button', role: 'tab', on: { click: () => { infoTab = 'tools'; drawInfo(); } } }, 'App tools');
  const infoBody = h('div', { class: 'fc-info-body' });
  const infoClose = h('button', { type: 'button', class: 'fc-icon fc-close', 'aria-label': 'Close details', on: { click: () => togglePanel('info') } }, '×');
  const info = h('aside', { class: 'fc-info' }, h('div', { class: 'fc-info-head' }, h('div', { class: 'fc-tabs', role: 'tablist' }, tabM, tabT), infoClose), infoBody);
  // In a narrow window a panel covers the button that opened it, so a tap beside
  // it or Escape closes it too.
  const closeOverlays = () => root.classList.remove('fc-show-side', 'fc-show-info');
  main.addEventListener('click', (e) => { if (!e.target.closest('.fc-icon')) closeOverlays(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });
  const chatView = h('div', { class: 'fc-chat' }, side, main, info);
  root.append(form, chatView);

  function setView(v) {
    view = v;
    form.hidden = v !== 'connect';
    chatView.hidden = v !== 'chat';
    if (v === 'connect') { fillForm(); (fPass.hidden ? form.querySelector('input:checked') : fPass)?.focus?.(); }
    else { if (!current || !chat.conversations.has(current)) current = chat.roomJid(); drawAll(); input.focus(); }
  }

  function startNew(e) {
    e.preventDefault();
    const v = newBox.value.trim();
    if (!v) return;
    const room = !v.includes('@') || v.endsWith('@' + chat.roomDomain()) || v.split('@')[1].startsWith('rooms.') || v.split('@')[1].startsWith('conference.');
    const r = room ? chat.joinRoom(v) : chat.openDirect(v);
    if (!r.ok) { addNote(r.reason === 'offline' ? 'Connect first.' : 'That is not a room name or an account.'); return; }
    newBox.value = '';
    select(r.jid);
  }

  function select(jid) {
    current = jid;
    root.classList.remove('fc-show-side');
    chat.markRead(jid);
    drawAll();
    input.focus();
  }

  function drawList() {
    const items = [...chat.conversations.values()];
    const group = (name, wanted) => {
      const rows = items.filter(wanted);
      if (!rows.length) return null;
      return h('section', {}, h('h3', {}, name), rows.map((c) => h('button', {
        type: 'button', class: 'fc-conv', 'aria-current': c.jid === current ? 'true' : 'false', title: c.jid,
        on: { click: () => select(c.jid) },
      }, h('span', { class: 'fc-conv-name' }, c.title), c.unread && c.jid !== current ? h('span', { class: 'fc-badge', 'aria-label': `${c.unread} unread` }, String(c.unread)) : null)));
    };
    // Accounts, not people: some of them are bots and AIs.
    list.replaceChildren(...[
      group('System Rooms', (c) => c.kind === 'room' && c.bus),
      group('User Rooms', (c) => c.kind === 'room' && !c.bus),
      group('Accounts', (c) => c.kind === 'direct'),
    ].filter(Boolean));
  }

  function drawHead() {
    const c = chat.conversations.get(current);
    title.textContent = c ? c.title : 'Chat';
    title.title = c?.jid || '';
    actToggle.hidden = !c?.bus;
    status.textContent = STATE[chat.state] || chat.state;
    status.dataset.state = chat.state;
    input.disabled = send.disabled = chat.state !== 'online';
    input.placeholder = chat.state === 'online' ? 'Message, or / for commands' : 'Connect to send messages';
  }

  const avatar = (nick) => h('span', { class: 'fc-avatar', 'aria-hidden': 'true' }, [...nick][0]?.toUpperCase() || '?');

  function messageRow(m, grouped) {
    if (m.kind === 'notice') return h('li', { class: 'fc-notice' }, m.body);
    if (m.kind === 'result') {
      const body = h('div', { class: 'fc-result' }, h('p', {}, m.body));
      if (m.value !== undefined) {
        const text = JSON.stringify(m.value, null, 2);
        body.append(text.length < 200 ? h('pre', {}, text) : h('details', {}, h('summary', {}, 'Show the result'), h('pre', {}, text)));
      }
      return h('li', { class: 'fc-system' }, body);
    }
    const li = h('li', { class: `fc-msg${m.self ? ' fc-self' : ''}${grouped ? ' fc-grouped' : ''}` });
    if (!grouped) li.append(avatar(m.nick), h('div', { class: 'fc-meta' }, h('strong', {}, m.nick), h('time', {}, time(m.ts))));
    const lines = m.body.split('\n');
    if (lines.length > 6) {
      li.append(h('p', { class: 'fc-body' }, lines[0]),
        h('details', { class: 'fc-more' }, h('summary', {}, `Show ${lines.length - 1} more lines`), h('pre', {}, lines.slice(1).join('\n'))));
    } else li.append(h('p', { class: 'fc-body' }, m.body));
    return li;
  }

  function eventRows(events) {
    const key = events[0].id;
    const line = (m) => h('li', { class: 'fc-event' },
      h('span', { class: 'fc-glyph', 'aria-hidden': 'true' }, glyphFor(m.topic)),
      h('details', {}, h('summary', {}, m.data?.summary || m.topic), h('pre', {}, `${m.topic}\n${JSON.stringify(m.data, null, 2)}`)),
      h('time', {}, time(m.ts)));
    if (events.length < 4 || open.has(key)) return events.map(line);
    return [h('li', { class: 'fc-event fc-event-group' }, h('span', { class: 'fc-glyph', 'aria-hidden': 'true' }, '…'),
      h('button', { type: 'button', on: { click: () => { open.add(key); drawLog(true); } } }, `${events.length} app events`),
      h('time', {}, time(events[events.length - 1].ts)))];
  }

  function emptyRow(c) {
    if (c?.bus) return h('li', { class: 'fc-empty' }, h('p', {}, 'Nothing yet. Open or close an app and it shows up here.'));
    return h('li', { class: 'fc-empty' }, h('p', {}, 'No messages yet. Say hello.'));
  }

  function drawLog(force = false) {
    const c = chat.conversations.get(current);
    const msgs = (c?.messages || []).filter((m) => showActivity || m.kind !== 'event');
    const last = msgs.length ? msgs[msgs.length - 1].id : 0;
    if (!force && drawn.jid === current && drawn.last === last && drawn.count === msgs.length) return;
    const stay = !nearEnd();
    const switched = drawn.jid !== current;
    const rows = [];
    let events = [];
    let prev = null;
    const flush = () => { if (events.length) rows.push(...eventRows(events)); events = []; };
    for (const m of msgs) {
      if (m.kind === 'event') { events.push(m); prev = null; continue; }
      flush();
      rows.push(messageRow(m, prev && prev.kind === 'message' && m.kind === 'message' && prev.nick === m.nick && m.ts - prev.ts < 300000));
      prev = m;
    }
    flush();
    log.replaceChildren(...(rows.length ? rows : [emptyRow(c)]));
    drawn = { jid: current, count: msgs.length, last };
    if (switched || !stay) stick(true); else jump.hidden = false;
  }

  const nearEnd = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  function stick(now) { if (now) log.scrollTop = log.scrollHeight; jump.hidden = true; }
  function onScroll() { if (nearEnd()) jump.hidden = true; }

  function drawInfo() {
    tabM.setAttribute('aria-selected', String(infoTab === 'members'));
    tabT.setAttribute('aria-selected', String(infoTab === 'tools'));
    if (infoTab === 'members') {
      const c = chat.conversations.get(current);
      const people = [...(c?.occupants.values() || [])].sort((a, b) => a.nick.localeCompare(b.nick));
      infoBody.replaceChildren(people.length
        ? h('ul', { class: 'fc-people' }, people.map((p) => h('li', {}, avatar(p.nick), h('span', {}, p.nick), p.self ? h('small', {}, 'you') : null)))
        : h('p', { class: 'fc-muted' }, c?.kind === 'direct' ? 'This is a conversation with one account.' : 'Nobody here yet.'));
      return;
    }
    const apps = tools.list();
    infoBody.replaceChildren(apps.length ? h('div', {}, apps.map((a) => h('section', { class: 'fc-app' },
      h('h3', {}, a.label),
      toolGroup(a, 'Look', a.tools.filter((t) => t.readOnly)),
      toolGroup(a, 'Act', a.tools.filter((t) => !t.readOnly))))) : h('p', { class: 'fc-muted' }, 'No app is offering tools. Open Moglob to see its tools here.'));
  }

  function toolGroup(a, name, list) {
    if (!list.length) return null;
    return h('div', {}, h('h4', {}, name), h('ul', { class: 'fc-tools' }, list.map((t) => h('li', {}, h('button', {
      type: 'button', title: t.description, on: { click: () => useTool(a, t) },
    }, t.name)))));
  }

  function useTool(a, t) {
    const example = {};
    for (const k of t.inputSchema?.required || []) example[k] = '';
    const args = Object.keys(example).length ? ` ${JSON.stringify(example)}` : '';
    input.value = `/call ${a.name} ${t.name}${args}`;
    onInput();
    input.focus();
  }

  function drawAll() { drawList(); drawHead(); drawLog(true); drawInfo(); }

  function addNote(body, value) {
    const c = chat.conversations.get(current);
    if (!c) return;
    chat._push(c, { kind: 'result', body, value, self: true });
  }

  async function submit() {
    const text = input.value.trim();
    if (!text || !current) return;
    history.unshift(text); historyAt = -1;
    input.value = ''; onInput();
    if (text.startsWith('/')) {
      const r = await run(text, { conversation: current });
      if (r?.action?.open) select(r.action.open);
      if (r && (r.text || r.value !== undefined)) addNote(r.text, r.value);
      return;
    }
    const r = chat.send(current, text);
    if (!r.ok) addNote('Connect first, then send this again.');
    stick(true);
  }

  const COMMANDS = ['/help', '/where', '/go', '/apps', '/tools', '/call', '/open', '/bus', '/join', '/leave', '/clear'];
  function onInput() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    const v = input.value;
    const show = v.startsWith('/') && !v.includes(' ');
    const found = show ? COMMANDS.filter((c) => c.startsWith(v)) : [];
    hints.hidden = !found.length;
    hints.replaceChildren(...found.map((c) => h('li', {}, h('button', { type: 'button', on: { click: () => { input.value = `${c} `; onInput(); input.focus(); } } }, c))));
  }
  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); return; }
    if (e.key === 'ArrowUp' && !input.value && history.length) { e.preventDefault(); input.value = history[historyAt = 0]; return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && historyAt >= 0) {
      e.preventDefault();
      historyAt = Math.max(-1, Math.min(history.length - 1, historyAt + (e.key === 'ArrowUp' ? 1 : -1)));
      input.value = historyAt < 0 ? '' : history[historyAt];
    }
  }

  const stopChat = chat.subscribe((what) => {
    if (what === 'status') {
      // Opened while the shell was still connecting: show the conversation as soon as it can.
      if (view === 'connect' && chat.state === 'online' && !settingsByHand) { current = chat.roomJid(); setView('chat'); }
      else if (view === 'connect') drawForm();
      else if (chat.state === 'error') { setView('connect'); connectError.textContent = explainConnect(chat.detail); }
      drawHead();
      if (view === 'chat') drawInfo();
      return;
    }
    if (view !== 'chat') return;
    if (what === 'messages') { const c = chat.conversations.get(current); if (c) c.unread = 0; drawLog(); drawList(); }
    else if (what === 'members') drawInfo();
    else drawList();
  });
  const stopTools = tools.subscribe(() => { if (view === 'chat') drawInfo(); drawGrants(); });
  const stopGrants = grants.subscribe(drawGrants);

  setView(chat.state === 'online' || chat.state === 'reconnecting' ? 'chat' : 'connect');
  if (chat.state === 'error') connectError.textContent = explainConnect(chat.detail);
  return () => { stopChat(); stopTools(); stopGrants(); };
}
