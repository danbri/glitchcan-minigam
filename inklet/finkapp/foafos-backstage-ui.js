// The Backstage view: who is in the bus room, which members are bots, and what each
// caller did. One renderer for two places: the Backstage panel in the shell
// (mountBackstage, fed by the shell's own FoafChat) and the page backstage.html
// (an outside XMPP client). The model and the help text are
// packages/foafos/src/backstage.mjs. Everything shown goes through textContent,
// so nothing said in a room can become markup. Design: docs/foafos-backstage-20261106.md.

import { Backstage, helpSections } from '../../packages/foafos/src/backstage.mjs';
import { describeGrant } from '../../packages/foafos/src/tool-grants.mjs';

export const h = (tag, props = {}, ...kids) => {
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

const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');
const KIND = { bot: 'bot', shell: 'shell', member: 'member', viewer: 'Backstage', you: 'this view' };

/** Draw one snapshot. `grants`: a ToolGrants list, or null where it cannot be seen. */
export function renderSnapshot(root, snap, { room = '', grants = null, grantsNote = '' } = {}) {
  root.replaceChildren();
  const here = snap.members.filter((m) => m.present).length;
  root.append(h('p', { class: 'bs-summary', role: 'status' },
    `${room || 'No room'}: ${here} here, ${snap.counts.events} events seen, ${snap.counts.acts} of them actions.`));

  const members = h('table', { class: 'bs-table bs-members' },
    h('caption', {}, 'Members (the kind is a guess from the room)'),
    h('thead', {}, h('tr', {}, ...['', 'Nickname', 'Kind', 'Role', 'Said', 'Events'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, snap.members.length ? snap.members.map((m) => h('tr', { class: `bs-${m.kind}${m.present ? '' : ' bs-gone'}` },
      h('td', { title: m.present ? 'here now' : 'left' }, m.present ? '●' : '○'),
      h('td', {}, m.nick), h('td', {}, KIND[m.kind]), h('td', {}, m.role || ''),
      h('td', {}, String(m.said)), h('td', {}, String(m.events)))) : h('tr', {}, h('td', { colSpan: 6 }, 'Nobody yet.'))));

  const callers = h('table', { class: 'bs-table' },
    h('caption', {}, 'Who acted'),
    h('thead', {}, h('tr', {}, ...['Caller', 'Allowed', 'Refused', 'Last'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, snap.callers.length ? snap.callers.map((c) => h('tr', {},
      h('td', {}, c.who), h('td', {}, String(c.allowed)), h('td', {}, String(c.refused)), h('td', {}, c.lastWhat)))
      : h('tr', {}, h('td', { colSpan: 4 }, 'Nobody has acted since this view started.'))));

  const acts = h('ol', { class: 'bs-acts', 'aria-label': 'Last actions, newest first' },
    snap.acts.length ? snap.acts.slice(0, 50).map((a) => h('li', { class: a.ok ? 'bs-ok' : 'bs-no' },
      h('time', {}, clock(a.ts)), ' ', h('strong', {}, a.ok ? 'ok' : 'refused'), ' ',
      `${a.who || '?'} ${a.what}${a.ok ? '' : ` (${a.reason})`}`, ' ', h('span', { class: 'bs-dim' }, `${a.topic} via ${a.by}`)))
      : h('li', { class: 'bs-dim' }, 'No actions yet.'));

  root.append(members, callers, h('h3', {}, 'Last actions'), acts);

  if (grants) {
    root.append(h('h3', {}, 'Grants in this browser'),
      h('ul', { class: 'bs-grants' }, grants.length ? grants.map((g) => h('li', {}, describeGrant(g))) : h('li', { class: 'bs-dim' }, 'No grants.')));
  } else if (grantsNote) root.append(h('p', { class: 'bs-dim' }, grantsNote));
}

/** The help for one view ('app' or 'page'). */
export function renderHelp(root, surface) {
  root.replaceChildren(h('h3', {}, 'Backstage help'),
    h('dl', { class: 'bs-help' }, helpSections(surface).flatMap(([t, x]) => [h('dt', {}, t), h('dd', {}, x)])));
}

/** A model rebuilt from what FoafChat keeps for the bus room. */
export function modelFromChat(chat) {
  const c = chat.conversations.get(chat.roomJid());
  const b = new Backstage({ self: '' });
  if (!c) return { snap: b.snapshot(), room: chat.roomJid(), joined: false };
  for (const o of c.occupants.values()) b.presence(o.nick, { present: true, role: o.role });
  for (const m of c.messages) {
    if (m.kind === 'event') b.message(m.nick, m.body, { marked: true, ts: m.ts });
    else if (m.kind === 'message' && m.nick) b.message(m.nick, m.body, { ts: m.ts });
  }
  return { snap: b.snapshot(), room: c.jid, joined: c.joined };
}

/** The Backstage panel in the shell. Returns unmount. */
export function mountBackstage(root, { chat, grants }) {
  const bar = h('div', { class: 'bs-bar' });
  const view = h('div', { class: 'bs-view' });
  const help = h('div', { class: 'bs-view', hidden: true });
  let showHelp = false;
  const helpBtn = h('button', { type: 'button', 'aria-pressed': 'false', on: { click: () => {
    showHelp = !showHelp; help.hidden = !showHelp; view.hidden = showHelp;
    helpBtn.setAttribute('aria-pressed', String(showHelp)); helpBtn.textContent = showHelp ? 'Back' : '/help';
  } } }, '/help');
  const state = h('span', { class: 'bs-dim', role: 'status' });
  bar.append(helpBtn, ' ', state);
  root.classList.add('bs-root');
  root.append(bar, view, help);
  renderHelp(help, 'app');

  let queued = false;
  const draw = () => {
    queued = false;
    const { snap, room, joined } = modelFromChat(chat);
    state.textContent = chat.state === 'online'
      ? (joined ? 'Reading this shell\'s bus room.' : 'Connected, not yet in the bus room.')
      : 'Chat is not connected. Connect in Chat, then this fills in.';
    for (const m of snap.members) if (m.nick === chat.conversations.get(room)?.nick) m.kind = 'shell';
    renderSnapshot(view, snap, { room, grants: grants ? grants.list() : null });
  };
  const soon = () => { if (!queued) { queued = true; setTimeout(draw, 250); } };
  const off = [chat.subscribe(soon), grants?.subscribe?.(soon)].filter(Boolean);
  draw();
  return () => off.forEach((u) => u());
}
