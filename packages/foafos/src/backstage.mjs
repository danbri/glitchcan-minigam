// Backstage: who is in the bus room, which of them are bots, and what each one did.
//
// One model and one help text for three views: the Backstage panel in the shell
// (inklet/finkapp/foafos-backstage-ui.js), the page on the live site
// (inklet/finkapp/backstage.html, an outside XMPP client), and
// `foafos-stack backstage` on the laptop. Pure: no DOM, no network.
// Design: docs/foafos-backstage-20261106.md.
//
// Everything here comes from the room, and the room is untrusted. A nickname is
// what its owner typed. Only a stanza with the bus marker counts as an event, and
// anyone can add that marker. So the kinds below are guesses, and the views say so.

import { MIRROR_NS } from './bus-mirror.mjs';
import { parseEvent } from './chat.mjs';

export { MIRROR_NS };

/** Topics that say who acted, and on what. All are on the shell's default mirror list. */
export const ACTOR_TOPICS = ['app.action', 'app.action.refused', 'tools.called', 'chat.refused'];

/** Nicknames taken to be bots unless the caller says otherwise. */
export const DEFAULT_BOTS = ['foafbot'];

const KEEP_ACTS = 200;
const KEEP_MEMBERS = 256;

const str = (v, max = 200) => (v == null ? '' : String(v).slice(0, max));

/** What one actor event says: who, what, whether it was allowed, and why not. Null for other topics. */
export function actOf(topic, data = {}) {
  const d = data && typeof data === 'object' ? data : {};
  switch (topic) {
    case 'app.action':
      return { who: str(d.from?.label || 'someone'), what: `${str(d.id)} ${str(d.action)}`.trim(), ok: true, reason: '' };
    case 'app.action.refused':
      return { who: '', what: `${str(d.id)} ${str(d.action)}`.trim(), ok: false, reason: 'no such action' };
    case 'tools.called':
      return { who: str(d.caller || 'someone'), what: `${str(d.app)} ${str(d.tool)}`.trim(), ok: d.ok === true,
        reason: d.ok === true ? '' : str(/: ([a-z-]+)$/.exec(str(d.summary))?.[1] || 'refused') };
    case 'chat.refused':
      return { who: str(d.from || 'someone'), what: '', ok: false, reason: str(d.reason || 'refused') };
    default:
      return null;
  }
}

/**
 * The room as Backstage sees it. Feed it presence and room messages in the order
 * they arrive; read `snapshot()`.
 *
 *   const b = new Backstage({ self: 'backstage-1a2b' });
 *   b.presence('foafbot', { present: true, role: 'participant' });
 *   b.message('foafos', 'app.action {"id":"playlist",...}', { marked: true });
 *   b.snapshot()   // { members, callers, acts, counts }
 */
export class Backstage {
  constructor({ bots = DEFAULT_BOTS, self = '', now = () => Date.now() } = {}) {
    this.bots = new Set(bots.map((b) => String(b).toLowerCase()));
    this.self = self;
    this.now = now;
    this.members = new Map();   // nick -> { nick, present, role, said, events, marked, since, last }
    this.acts = [];             // { ts, topic, by, who, what, ok, reason }
    this.counts = { messages: 0, events: 0, acts: 0 };
  }

  _member(nick) {
    let m = this.members.get(nick);
    if (!m) {
      if (this.members.size >= KEEP_MEMBERS) {
        const gone = [...this.members.values()].find((x) => !x.present);
        if (gone) this.members.delete(gone.nick); else return null;
      }
      m = { nick, present: false, role: '', said: 0, events: 0, marked: false, since: 0, last: 0 };
      this.members.set(nick, m);
    }
    return m;
  }

  /** A room presence for `nick`. */
  presence(nick, { present = true, role = '' } = {}) {
    if (!nick) return;
    const m = this._member(str(nick, 64));
    if (!m) return;
    if (present && !m.present) m.since = this.now();
    m.present = !!present;
    if (role) m.role = str(role, 20);
  }

  /** A groupchat message from `nick`. `marked`: it carried the bus marker. */
  message(nick, body, { marked = false, ts = this.now() } = {}) {
    if (!nick) return;
    const m = this._member(str(nick, 64));
    this.counts.messages++;
    if (m) m.last = ts;
    const event = marked ? parseEvent(String(body ?? '')) : null;
    if (!event) { if (m) m.said++; return; }
    this.counts.events++;
    if (m) { m.events++; m.marked = true; }
    const act = actOf(event.topic, event.data);
    if (!act) return;
    this.counts.acts++;
    this.acts.push({ ts, topic: event.topic, by: str(nick, 64), ...act });
    if (this.acts.length > KEEP_ACTS) this.acts.shift();
  }

  /** A guess from what the room shows: 'you', 'shell', 'bot', 'viewer' (another Backstage) or 'member'. */
  kindOf(m) {
    if (m.nick === this.self) return 'you';
    if (/^backstage-[0-9a-f]{4}$/.test(m.nick)) return 'viewer';
    if (m.marked || /^foafos(-[0-9a-f]{4})?$/i.test(m.nick)) return 'shell';
    if (this.bots.has(m.nick.toLowerCase())) return 'bot';
    return 'member';
  }

  snapshot() {
    const order = { bot: 0, shell: 1, member: 2, viewer: 3, you: 4 };
    const members = [...this.members.values()]
      .map((m) => ({ ...m, kind: this.kindOf(m) }))
      .sort((a, b) => (b.present - a.present) || (order[a.kind] - order[b.kind]) || a.nick.localeCompare(b.nick));
    const byWho = new Map();
    for (const a of this.acts) {
      const key = a.who || '(unknown)';
      const c = byWho.get(key) || { who: key, allowed: 0, refused: 0, last: 0, lastWhat: '' };
      if (a.ok) c.allowed++; else c.refused++;
      c.last = a.ts; c.lastWhat = a.ok ? a.what : `${a.what} refused: ${a.reason}`.trim();
      byWho.set(key, c);
    }
    const callers = [...byWho.values()].sort((a, b) => b.last - a.last);
    return { members, callers, acts: [...this.acts].reverse(), counts: { ...this.counts } };
  }
}

/** Is this element the bus marker? For views that hold DOM or ElementTree children. */
export const isMarker = (ns) => ns === MIRROR_NS;

const pad = (s, n) => String(s).padEnd(n);
const clock = (ts) => (ts ? new Date(ts).toISOString().slice(11, 19) : '--:--:--');

/** The snapshot as plain text lines, for the command line. */
export function describe(snap, { room = '' } = {}) {
  const lines = [];
  const here = snap.members.filter((m) => m.present);
  lines.push(`Room ${room || '(unknown)'}: ${here.length} here, ${snap.counts.events} events seen, ${snap.counts.acts} of them actions.`);
  lines.push('');
  lines.push('Members (kind is a guess from the room):');
  if (!snap.members.length) lines.push('  nobody');
  for (const m of snap.members) {
    lines.push(`  ${m.present ? '●' : '○'} ${pad(m.nick, 22)} ${pad(m.kind, 7)} ${m.role ? pad(m.role, 12) : pad('', 12)} said ${m.said}, events ${m.events}`);
  }
  lines.push('');
  lines.push('Who acted (from app.action, tools.called and chat.refused):');
  if (!snap.callers.length) lines.push('  nobody yet');
  for (const c of snap.callers) lines.push(`  ${pad(c.who, 30)} allowed ${c.allowed}, refused ${c.refused}. Last: ${c.lastWhat}`);
  lines.push('');
  lines.push('Last actions:');
  if (!snap.acts.length) lines.push('  none yet');
  for (const a of snap.acts.slice(0, 20)) {
    lines.push(`  ${clock(a.ts)} ${a.ok ? 'ok     ' : 'refused'} ${pad(a.who || '?', 26)} ${a.what}${a.ok ? '' : ` (${a.reason})`}  [${a.topic} via ${a.by}]`);
  }
  return lines;
}

// ── /help: one text for the three views ─────────────────────────────────

const COMMON = [
  ['What it is', 'Backstage shows the bus room: who is in it, which members are bots or shells, and what each caller did. It only reads. It cannot grant, revoke, start or stop.'],
  ['Members', 'Everyone in the room now (●) and earlier (○). The kind is a guess: "shell" sent marked bus events or has the nickname foafos; "bot" has a bot nickname (foafbot); backstage- and four hex digits is another Backstage ("viewer"); the rest are "member". Nicknames are what their owners typed. A member that left can stay listed until the server restarts (rooms keep ghosts).'],
  ['Who acted', 'From the events app.action, app.action.refused, tools.called and chat.refused, which the shell puts in the room. They name the account that the server stamped on the direct message, not a nickname.'],
  ['What it cannot see', 'Rooms keep no history, so a view sees only what happens after it joins. A shell whose mirror list leaves out these topics shows no actions. Bot refusals are in the bot log only (foafos-stack backstage shows them). Anyone can add the bus marker to a room message, so an event can be forged; it changes nothing in any shell.'],
  ['Where it runs', 'In the shell: the Backstage app (?app=backstage). On the web: https://danbri.github.io/glitchcan-minigam/inklet/finkapp/backstage.html. On the laptop: foafos-stack backstage.'],
  ['Design', 'https://github.com/danbri/glitchcan-minigam/blob/master/docs/foafos-backstage-20261106.md'],
];

const BY_SURFACE = {
  app: [
    ['In this shell', 'It reads this shell\'s own Chat connection and bus room, so connect in Chat first. It also lists the grants in this browser (Chat, Advanced, "Who may use your apps"). It does not join the room again.'],
  ],
  page: [
    ['On this page', 'It signs in as an ordinary XMPP client, over WebSocket (RFC 7395), and joins the room with its own nickname, so others see it. The password is used once and kept nowhere. It cannot see any shell\'s grants: they are in that shell\'s browser.'],
    ['Servers', 'Shared test server: wss://foafos-xmpp.fly.dev/xmpp-websocket, room bus@rooms.foafos-xmpp.fly.dev. This computer: ws://127.0.0.1:5280/xmpp-websocket, room bus@rooms.localhost. A server accepts only the page origins it lists.'],
  ],
  cli: [
    ['On the laptop', 'foafos-stack backstage [local|proto|shared] [--as ACCOUNT] [--room NAME] [--wait SECONDS] [--watch] [--json]. It shows the laptop side first: whether foafbot runs, its model, its /tell file and its last refusals. Then it joins the room with xmpp-chat.py for --wait seconds (default 8) and prints what it saw. --watch prints each action as it happens until Ctrl-C.'],
    ['Accounts', 'It signs in as --as (default me) from the accounts file of that server, with the nickname backstage- and four hex digits.'],
  ],
};

/** [[title, text], ...] for one view: 'app', 'page' or 'cli'. */
export function helpSections(surface) {
  return [...COMMON.slice(0, 4), ...(BY_SURFACE[surface] || []), ...COMMON.slice(4)];
}

/** The help as plain text. */
export function helpText(surface) {
  return ['Backstage help', '', ...helpSections(surface).flatMap(([t, x]) => [`${t}:`, `  ${x}`, ''])].join('\n');
}
