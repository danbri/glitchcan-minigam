// Chat commands: asking the shell what is going on, and calling app tools, by
// typing. The Chat window uses all of them. A direct message from an account
// holding a grant uses the remote set, and each thing it asks for is checked
// against that account's grants. See docs/foafos-caller-grants-20261105.md.
//
// A room cannot carry commands: its members are known by nickname only, and
// anyone can take a nickname. A direct message has a `from` the server stamps.
// /tell sends an app one of the actions its manifest offers. From an account it
// needs the owner's switch and a grant naming that action. See
// docs/foafos-bus-xmpp-20261105.md.

import { PERSON, SHELL_APP, accountCaller, describeGrant } from './tool-grants.mjs';

const HELP = [
  ['/help', 'Show this list'],
  ['/where', 'Say where you are in the open world'],
  ['/go PLACE', 'Go to a place in the open world, for example /go tower of london'],
  ['/apps', 'List the apps that offer tools'],
  ['/tools APP', 'List the tools of an app'],
  ['/call APP TOOL {json}', 'Call a tool, for example /call moglob get_view'],
  ['/tell APP ACTION {json}', 'Send an action to a running app, for example /tell playlist pause'],
  ['/open APP', 'Open an app'],
  ['/bus [COUNT]', 'Show recent activity'],
  ['/grants', 'List who may use what (this window only)'],
  ['/grant ACCOUNT APP look|all|TOOL...', 'Let an account use an app, for example /grant foafbot@localhost moglob go_to (this window only)'],
  ['/revoke ACCOUNT [APP]', 'Take that back (this window only)'],
  ['/join ROOM', 'Join a room (this window only)'],
  ['/leave', 'Leave this room (this window only)'],
  ['/clear', 'Clear this conversation (this window only)'],
];
const REMOTE = new Set(['help', 'where', 'go', 'apps', 'tools', 'call', 'tell', 'open', 'bus']);
const MAX_ARGS = 2048;
const MAX_ARG = 512;
const ARG_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
// What an action takes is a flat list of plain values.
const plainArgs = (a) => a && typeof a === 'object' && !Array.isArray(a) && Object.entries(a).every(([k, v]) =>
  ARG_NAME.test(k) && ['string', 'number', 'boolean'].includes(typeof v) && String(v).length <= MAX_ARG);
const WHY = {
  'no-app': 'That app is not offering tools. Open it first, or use /apps.',
  'no-tool': 'That app has no such tool. Use /tools to list them.',
  'bad-args': 'Those arguments do not fit the tool.',
  'not-granted': 'This account may not do that. Someone at the Chat window can allow it with /grant.',
  revoked: 'Permission was taken back while this ran, so there is no result. The app may still finish it.',
  timeout: 'The app did not answer in time.',
  closed: 'The app closed before it answered.',
  replaced: 'The app reloaded before it answered.',
  'too-large': 'Those arguments are too large.',
  'inbound-off': 'Actions from accounts are switched off. Someone at the Chat window can switch them on under Advanced.',
};

export function explainToolFailure(r) {
  return [WHY[r.reason] || `Refused: ${r.reason}.`, r.error].filter(Boolean).join(' ');
}

// Moglob and Drift share these tools, so one sentence works in either. Each
// answers in its own terms, so these read only what both say.
const worldOf = (tools) => tools.list().find((a) => ['get_view', 'go_to'].every((n) => a.tools.some((t) => t.name === n))) || null;
const NO_WORLD = 'No world is open. Open one with /open moglob or /open drift.';
const placeIn = (v) => v?.found?.name || v?.place_title || v?.place || v?.site || null;

// `agent` is the short name for the browser agent in /grant and /revoke.
const callerName = (who) => (who === 'agent' ? 'browser-agent' : who);

const say = (text) => ({ text });
const data = (text, value) => ({ text, value });

export function createChatCommands({ chat, tools, grants = tools?.grants, bus, openApp = null, findApp = () => null, deliver = null, keep = 100 } = {}) {
  const recent = [];
  bus?.subscribe?.('*', (e) => {
    const seen = chat?.publicEvent?.(e);
    if (!seen) return;
    recent.push({ ts: Date.now(), topic: seen.topic, summary: seen.data?.summary || seen.data?.from || '' });
    if (recent.length > keep) recent.shift();
  });

  /**
   * Run one line. Resolves to null if it is not a command, else
   * {text, value?, action?}. `remote` is {from} for a direct message.
   */
  return async function run(line, { remote = null, conversation = null } = {}) {
    const text = String(line).trim();
    if (!text.startsWith('/')) return null;
    const m = /^\/([a-z]+)(?:\s+([\s\S]*))?$/i.exec(text);
    const name = m?.[1]?.toLowerCase();
    const rest = (m?.[2] || '').trim();
    if (!name) return say('That is not a command. Use /help.');
    if (remote && !REMOTE.has(name)) return say(`/${name} works only in the Chat window.`);
    const caller = remote ? accountCaller(remote.from) : PERSON;
    const mayShell = (tool, readOnly) => grants.allows(caller, SHELL_APP, { name: tool, readOnly });

    switch (name) {
      case 'help':
        return say(HELP.filter(([c]) => !remote || REMOTE.has(c.slice(1).split(' ')[0])).map(([c, d]) => `${c}: ${d}`).join('\n'));
      case 'where': {
        const w = worldOf(tools);
        if (!w) return say(NO_WORLD);
        const describes = w.tools.some((t) => t.name === 'describe_view');
        const r = await tools.call(w.id, describes ? 'describe_view' : 'get_view', {}, { caller });
        if (!r.ok) return say(explainToolFailure(r));
        const text = typeof r.value === 'string' ? r.value : r.value?.text || r.value?.description || placeIn(r.value);
        return data(text ? `${w.label}: ${text}` : `Here is the view in ${w.label}.`, r.value);
      }
      case 'go': {
        const w = worldOf(tools);
        if (!w) return say(NO_WORLD);
        if (!rest) return say('Where to? Use /go PLACE.');
        const r = await tools.call(w.id, 'go_to', { place: rest }, { caller });
        if (!r.ok) return say(explainToolFailure(r));
        return data(`Going to ${placeIn(r.value) || rest} in ${w.label}.`, r.value);
      }
      case 'apps': {
        const list = tools.list();
        if (!list.length) return say('No app is offering tools. Open Moglob with /open moglob.');
        return say(list.map((a) => `${a.name}: ${a.tools.length} tools`).join('\n'));
      }
      case 'tools': {
        const p = rest ? tools.find(rest) : tools.list().length === 1 ? tools.find(tools.list()[0].id) : null;
        if (!p) return say(rest ? WHY['no-app'] : 'Which app? Use /tools APP.');
        return say(p.tools.map((t) => `${t.name}${t.readOnly ? '' : ' (changes something)'}: ${t.description.split('\n')[0].slice(0, 100)}`).join('\n'));
      }
      case 'call': {
        const c = /^(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/.exec(rest);
        if (!c) return say('Use /call APP TOOL {json}.');
        let args = {};
        if (c[3]) { try { args = JSON.parse(c[3]); } catch { return say('Those arguments are not valid JSON.'); } }
        const r = await tools.call(c[1], c[2], args, { caller });
        if (!r.ok) return say(explainToolFailure(r));
        return data(`${c[2]} done`, r.value);
      }
      case 'tell': {
        const refuse = (reason, app = null, action = null) => {
          if (remote) bus?.publish?.('chat.refused', { summary: `${remote.from} refused: ${reason}`, from: remote.from, reason, app, action });
          return say(WHY[reason] || `Refused: ${reason}.`);
        };
        if (remote && chat?.config?.().inbound !== true) return refuse('inbound-off');
        const c = /^(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/.exec(rest);
        if (!c) return say('Use /tell APP ACTION {json}.');
        const app = findApp(c[1]);
        if (!grants.allowsAction(caller, { id: app?.id ?? c[1], slug: app?.id ?? c[1] }, c[2])) return refuse('not-granted', c[1], c[2]);
        if (!app || !deliver) return say('There is no app by that name.');
        if ((c[3] || '').length > MAX_ARGS) return refuse('too-large', app.id, c[2]);
        let args = {};
        if (c[3]) { try { args = JSON.parse(c[3]); } catch { return say('Those arguments are not valid JSON.'); } }
        if (!plainArgs(args)) return refuse('bad-args', app.id, c[2]);
        const sent = deliver(app.id, c[2], args, remote ? { kind: 'account', label: remote.from } : { kind: 'person', label: 'you' });
        return say(sent ? `Sent ${c[2]} to ${app.name}.` : `${app.name} is not running, or it has no action ${c[2]}.`);
      }
      case 'open': {
        if (!mayShell('open', false)) return say(WHY['not-granted']);
        const app = findApp(rest);
        if (!app || !openApp) return say('There is no app by that name.');
        const opened = await openApp(app.id);
        return say(opened ? `Opening ${app.name}.` : `${app.name} did not open: it may not be part of this installation. Try ?root=all.`);
      }
      case 'grants': {
        const all = grants.list();
        if (!all.length) return say('Nobody else may use anything. You always can, here in this window.');
        return say(all.map((g) => `${g.caller}, ${g.app === '*' ? 'every app' : g.app}: ${describeGrant(g)}`).join('\n'));
      }
      case 'grant': {
        const [who, app, ...what] = rest.split(/\s+/);
        if (!who || !app || !what.length) return say('Use /grant ACCOUNT APP look, /grant ACCOUNT APP all, or /grant ACCOUNT APP TOOL...');
        const known = app === '*' || app === 'shell' ? app : tools.find(app)?.id ?? app;
        const r = grants.grant(callerName(who), known, { level: what.includes('all') ? 'all' : 'look', tools: what.filter((w) => w !== 'all' && w !== 'look') });
        return say(r.ok ? `${who} may use ${app}: ${describeGrant(r.grant)}.` : `Refused: ${r.reason}.`);
      }
      case 'revoke': {
        const [who, app] = rest.split(/\s+/);
        if (!who) return say('Use /revoke ACCOUNT, or /revoke ACCOUNT APP.');
        const known = !app || app === '*' || app === 'shell' ? app ?? null : tools.find(app)?.id ?? app;
        const r = grants.revoke(callerName(who), known);
        return say(r.removed ? `Taken back from ${who}.` : `${who} held no such grant.`);
      }
      case 'bus': {
        if (!mayShell('bus', true)) return say(WHY['not-granted']);
        const n = Math.max(1, Math.min(50, Number(rest) || 10));
        const last = recent.slice(-n);
        return say(last.length ? last.map((r) => `${r.topic}: ${r.summary}`).join('\n') : 'Nothing has happened yet.');
      }
      case 'join': {
        if (!rest) return say('Which room? Use /join NAME.');
        const r = chat.joinRoom(rest);
        return r.ok ? { text: `Joining ${r.jid}.`, action: { open: r.jid } } : say(r.reason === 'offline' ? 'Connect first.' : 'That is not a room name.');
      }
      case 'leave': {
        if (!conversation) return say('Open a room first.');
        const r = chat.leaveRoom(conversation);
        return say(r.ok ? 'You left the room.' : 'This is not a room you can leave.');
      }
      case 'clear':
        chat.clear(conversation);
        return { text: '', action: { cleared: true } };
      default:
        return say(`There is no /${name} command. Use /help.`);
    }
  };
}
