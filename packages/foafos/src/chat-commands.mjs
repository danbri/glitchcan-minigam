// Chat commands: asking the shell what is going on, and calling app tools, by
// typing. The Chat window uses all of them. A direct message from an account
// on the allowed list uses the remote set. See docs/foafos-chat-window-20261104.md.
//
// A room cannot carry commands: its members are known by nickname only, and
// anyone can take a nickname. A direct message has a `from` the server stamps.

const HELP = [
  ['/help', 'Show this list'],
  ['/where', 'Say where you are in the open world'],
  ['/go PLACE', 'Go to a place in the open world, for example /go tower of london'],
  ['/apps', 'List the apps that offer tools'],
  ['/tools APP', 'List the tools of an app'],
  ['/call APP TOOL {json}', 'Call a tool, for example /call moglob get_view'],
  ['/open APP', 'Open an app'],
  ['/bus [COUNT]', 'Show recent activity'],
  ['/join ROOM', 'Join a room (this window only)'],
  ['/leave', 'Leave this room (this window only)'],
  ['/clear', 'Clear this conversation (this window only)'],
];
const REMOTE = new Set(['help', 'where', 'go', 'apps', 'tools', 'call', 'open', 'bus']);
const WHY = {
  'no-app': 'That app is not offering tools. Open it first, or use /apps.',
  'no-tool': 'That app has no such tool. Use /tools to list them.',
  'bad-args': 'Those arguments do not fit the tool.',
  'read-only-caller': 'That tool changes something, and this caller may only read.',
  timeout: 'The app did not answer in time.',
  closed: 'The app closed before it answered.',
  replaced: 'The app reloaded before it answered.',
  'too-large': 'Those arguments are too large.',
};

export function explainToolFailure(r) {
  return [WHY[r.reason] || `Refused: ${r.reason}.`, r.error].filter(Boolean).join(' ');
}

// Moglob and Drift share these tools, so one sentence works in either. Each
// answers in its own terms, so these read only what both say.
const worldOf = (tools) => tools.list().find((a) => ['get_view', 'go_to'].every((n) => a.tools.some((t) => t.name === n))) || null;
const NO_WORLD = 'No world is open. Open one with /open moglob or /open drift.';
const placeIn = (v) => v?.found?.name || v?.place_title || v?.place || v?.site || null;

const say = (text) => ({ text });
const data = (text, value) => ({ text, value });

export function createChatCommands({ chat, tools, bus, openApp = null, findApp = () => null, keep = 100 } = {}) {
  const recent = [];
  bus?.subscribe?.('*', (e) => {
    if (e.source !== 'local' || !chat?.mirrors?.(e.topic)) return;
    recent.push({ ts: Date.now(), topic: e.topic, summary: e.data?.summary || '' });
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

    switch (name) {
      case 'help':
        return say(HELP.filter(([c]) => !remote || REMOTE.has(c.slice(1).split(' ')[0])).map(([c, d]) => `${c}: ${d}`).join('\n'));
      case 'where': {
        const w = worldOf(tools);
        if (!w) return say(NO_WORLD);
        const describes = w.tools.some((t) => t.name === 'describe_view');
        const r = await tools.call(w.id, describes ? 'describe_view' : 'get_view', {}, { caller: remote ? remote.from : 'you' });
        if (!r.ok) return say(explainToolFailure(r));
        const text = typeof r.value === 'string' ? r.value : r.value?.text || r.value?.description || placeIn(r.value);
        return data(text ? `${w.label}: ${text}` : `Here is the view in ${w.label}.`, r.value);
      }
      case 'go': {
        const w = worldOf(tools);
        if (!w) return say(NO_WORLD);
        if (!rest) return say('Where to? Use /go PLACE.');
        const r = await tools.call(w.id, 'go_to', { place: rest }, { caller: remote ? remote.from : 'you', allowWrite: true });
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
        const r = await tools.call(c[1], c[2], args, { caller: remote ? remote.from : 'you', allowWrite: true });
        if (!r.ok) return say(explainToolFailure(r));
        return data(`${c[2]} done`, r.value);
      }
      case 'open': {
        const app = findApp(rest);
        if (!app || !openApp) return say('There is no app by that name.');
        await openApp(app.id);
        return say(`Opening ${app.name}.`);
      }
      case 'bus': {
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
