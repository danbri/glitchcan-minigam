// backstage.html: Backstage as an outside XMPP client. It signs in over WebSocket
// (RFC 7395), joins the bus room with its own nickname, and draws what it sees
// with the same model and renderer as the shell's Backstage panel. Read only: it
// sends presence and nothing else. The password goes to XmppWs.connect and is kept
// nowhere. `#help` or `?help` opens the help. Design: docs/foafos-backstage-20261106.md.

import { XmppWs } from '../../packages/foafos/src/xmpp-ws.mjs';
import { Backstage, MIRROR_NS } from '../../packages/foafos/src/backstage.mjs';
import { h, renderSnapshot, renderHelp } from './foafos-backstage-ui.js';

const SERVERS = {
  shared: { label: 'Shared test server', url: 'wss://foafos-xmpp.fly.dev/xmpp-websocket', domain: 'foafos-xmpp.fly.dev' },
  local: { label: 'This computer', url: 'ws://127.0.0.1:5280/xmpp-websocket', domain: 'localhost' },
  other: { label: 'Another server', url: '', domain: '' },
};
const NS_MUC_USER = 'http://jabber.org/protocol/muc#user';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const hex4 = () => Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, '0')).join('');

const root = document.getElementById('backstage');
const params = new URLSearchParams(location.search);
let x = null, model = null, room = '', nick = '', queued = false;

// ── the form ────────────────────────────────────────────────────────────
const server = h('select', { id: 'bs-server' }, Object.entries(SERVERS).map(([k, s]) => h('option', { value: k }, s.label)));
server.value = SERVERS[params.get('server')] ? params.get('server') : 'shared';
const url = h('input', { id: 'bs-url', type: 'url', placeholder: 'wss://host/xmpp-websocket' });
const domain = h('input', { id: 'bs-domain', placeholder: 'example.org' });
const account = h('input', { id: 'bs-account', autocomplete: 'username', value: params.get('as') || '' });
const password = h('input', { id: 'bs-password', type: 'password', autocomplete: 'current-password' });
const roomName = h('input', { id: 'bs-room', value: params.get('room') || 'bus' });
const fill = () => {
  const s = SERVERS[server.value];
  url.value = s.url || url.value; domain.value = s.domain || domain.value;
  url.disabled = domain.disabled = server.value !== 'other';
};
server.addEventListener('change', fill);
fill();

const connectBtn = h('button', { type: 'submit' }, 'Connect');
const leaveBtn = h('button', { type: 'button', hidden: true, on: { click: () => leave('You left the room.') } }, 'Leave');
const helpBtn = h('button', { type: 'button', 'aria-pressed': 'false', on: { click: () => setHelp(!helpShown) } }, '/help');
const state = h('span', { class: 'bs-dim', role: 'status' }, 'Not connected.');
const label = (text, input) => [h('label', { htmlFor: input.id }, text), input];
const form = h('form', { class: 'bs-form', on: { submit: (e) => { e.preventDefault(); join(); } } },
  label('Server', server), label('WebSocket', url), label('Domain', domain), label('Account', account),
  label('Password', password), label('Room', roomName), h('span'), h('span', {}, connectBtn, ' ', leaveBtn));
const view = h('div', { class: 'bs-view' });
const help = h('div', { class: 'bs-view', hidden: true });
renderHelp(help, 'page');
root.append(h('div', { class: 'bs-bar' }, helpBtn, ' ', state), form, view, help);

let helpShown = false;
function setHelp(on) {
  helpShown = on;
  help.hidden = !on; view.hidden = on; form.hidden = on || !!x;
  helpBtn.setAttribute('aria-pressed', String(on));
  helpBtn.textContent = on ? 'Back' : '/help';
}
if (location.hash === '#help' || params.has('help')) setHelp(true);
window.addEventListener('hashchange', () => setHelp(location.hash === '#help'));

// ── the room ────────────────────────────────────────────────────────────
const draw = () => {
  queued = false;
  if (model) renderSnapshot(view, model.snapshot(), { room, grantsNote: 'Grants are kept in each shell\'s browser, so this page cannot see them. Open Backstage in that shell to see them.' });
};
const soon = () => { if (!queued) { queued = true; setTimeout(draw, 200); } };

function onStanza(el) {
  const from = el.getAttribute('from') || '';
  const i = from.indexOf('/');
  if (i < 0 || from.slice(0, i).toLowerCase() !== room) return;
  const who = from.slice(i + 1);
  if (el.localName === 'presence') {
    const type = el.getAttribute('type');
    if (type === 'error') {
      const cond = [...el.children].find((c) => c.localName === 'error')?.firstElementChild?.localName || 'error';
      leave(cond === 'conflict' ? 'That nickname is in use. Connect again.' : `The room refused this page: ${cond}.`);
      return;
    }
    const item = [...el.children].find((c) => c.namespaceURI === NS_MUC_USER)?.querySelector('item');
    model.presence(who, { present: type !== 'unavailable', role: item?.getAttribute('role') || '' });
  } else if (el.localName === 'message' && el.getAttribute('type') === 'groupchat') {
    const body = [...el.children].find((c) => c.localName === 'body')?.textContent;
    if (body == null) return;
    const marked = [...el.children].some((c) => c.namespaceURI === MIRROR_NS);
    model.message(who, body, { marked });
  }
  soon();
}

async function join() {
  if (x) return;
  const s = { url: url.value.trim(), domain: domain.value.trim().toLowerCase() };
  if (!/^wss?:\/\//.test(s.url) || !s.domain || !account.value.trim()) { state.textContent = 'Give a ws:// or wss:// address, a domain and an account.'; return; }
  connectBtn.disabled = true;
  state.textContent = 'Connecting.';
  const pw = password.value;
  password.value = '';
  try {
    x = await XmppWs.connect({ url: s.url, domain: s.domain, username: account.value.trim(), password: pw, resource: `backstage-${hex4()}` });
  } catch (e) {
    x = null; connectBtn.disabled = false;
    state.textContent = `Could not connect: ${e.message}. The server accepts only the page origins it lists (this page is ${location.origin}).`;
    return;
  }
  room = `${roomName.value.trim() || 'bus'}@rooms.${s.domain}`.toLowerCase();
  nick = `backstage-${hex4()}`;
  model = new Backstage({ self: nick });
  x.onstanza = onStanza;
  x.onclose = () => { x = null; leave('The connection closed.'); };
  x.send(`<presence xmlns="jabber:client" to="${esc(room)}/${esc(nick)}"><x xmlns="http://jabber.org/protocol/muc"/></presence>`);
  state.textContent = `In ${room} as ${nick}, signed in as ${x.jid}. Others in the room see this nickname.`;
  leaveBtn.hidden = false; connectBtn.hidden = true; form.hidden = true;
  state.append(' ', leaveBtn);
  soon();
}

function leave(why) {
  const old = x;
  x = null;
  if (old) { old.onclose = null; try { old.close(); } catch { /* gone */ } }
  connectBtn.disabled = false; connectBtn.hidden = false; leaveBtn.hidden = true; form.hidden = helpShown;
  state.textContent = why;
}

window.__backstage = { model: () => model, state: () => state.textContent, room: () => room, nick: () => nick };
