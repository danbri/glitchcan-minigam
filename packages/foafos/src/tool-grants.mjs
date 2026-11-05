// ToolGrants: who may use which app's tools. See docs/foafos-caller-grants-20261105.md.
//
// A caller is named by the shell, never by the caller: the person at the Chat
// window, an account the XMPP server has stamped on a direct message, or a
// browser agent that reached the page's WebMCP tools. Nothing a caller sends
// can choose who it is treated as.
//
// Everyone but the person is refused until they hold a grant. A grant is
//
//   {caller, app, level, tools}
//
//   caller  'me@localhost', or 'browser-agent'
//   app     an app id or name, 'shell' for /open and /bus, or '*' for all
//   level   'look': what does not change anything; 'all': everything
//   tools   tool names allowed as well as looking
//
// Grants hold no secrets, so they are kept in plain page storage.

const KEY = 'foafos.toolGrants';
const MAX_GRANTS = 256;
const MAX_TOOLS = 64;
const JID = /^[^\s@/]+@[^\s@/]+$/;
const NAME = /^[A-Za-z0-9_.-]{1,64}$/;
const AGENT_ID = 'browser-agent';

export const PERSON = Object.freeze({ kind: 'person', id: 'you', label: 'you' });
export const BROWSER_AGENT = Object.freeze({ kind: 'agent', id: AGENT_ID, label: 'a browser agent' });
/** A caller for a bare JID the server has vouched for. */
export const accountCaller = (jid) => Object.freeze({ kind: 'account', id: String(jid), label: String(jid) });
/** The shell's own abilities that are not app tools, as an app a grant can name. */
export const SHELL_APP = Object.freeze({ id: 'shell', slug: 'shell' });

const validCaller = (id) => id === AGENT_ID || JID.test(id);
const validApp = (app) => app === '*' || NAME.test(app);
const clean = (g) => ({ caller: g.caller, app: g.app, level: g.level === 'all' ? 'all' : 'look', tools: [...new Set(g.tools || [])] });

export class ToolGrants {
  /**
   * @param storage   getItem/setItem, or null to keep grants for this run only
   * @param defaults  grants for a shell that has never saved any
   */
  constructor({ storage = null, key = KEY, bus = null, defaults = [] } = {}) {
    this.storage = storage;
    this.key = key;
    this.bus = bus;
    this._listeners = new Set();
    this._grants = defaults.map(clean);
    try {
      const saved = JSON.parse(storage?.getItem(key) || 'null');
      if (Array.isArray(saved)) {
        this._grants = saved.filter((g) => g && validCaller(g.caller) && validApp(g.app)
          && (g.tools === undefined || (Array.isArray(g.tools) && g.tools.every((t) => NAME.test(t))))).slice(0, MAX_GRANTS).map(clean);
      }
    } catch { /* unreadable: the defaults */ }
  }

  /** Be told when grants change. Returns the way to stop. */
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _changed(summary, data) {
    try { this.storage?.setItem(this.key, JSON.stringify(this._grants)); } catch { /* full or blocked */ }
    this.bus?.publish('tools.grant', { summary, ...data });
    for (const fn of this._listeners) { try { fn(); } catch { /* a listener's problem */ } }
  }

  list() { return this._grants.map((g) => ({ ...g, tools: [...g.tools] })); }

  /** Has this account been given anything at all? */
  holds(id) { return this._grants.some((g) => g.caller === id); }

  /** May this caller use this tool of this app? `app` is {id, slug}; `tool` is {name, readOnly}. */
  allows(caller, app, tool) {
    if (caller === PERSON) return true;
    if (!caller || !['account', 'agent'].includes(caller.kind)) return false;
    return this._grants.some((g) => g.caller === caller.id
      && (g.app === '*' || g.app === app.id || g.app === app.slug)
      && (g.level === 'all' || tool.readOnly === true || g.tools.includes(tool.name)));
  }

  /**
   * May this account send this action to this app? Stricter than `allows`: the
   * action must be named in a grant for that app, so 'all' and '*' do not reach it.
   */
  allowsAction(caller, app, action) {
    if (caller === PERSON) return true;
    if (caller?.kind !== 'account') return false;
    return this._grants.some((g) => g.caller === caller.id && (g.app === app.id || g.app === app.slug) && g.tools.includes(action));
  }

  /** Add to what a caller may do. A grant never takes anything away: use revoke. */
  grant(caller, app, { level = 'look', tools = [] } = {}) {
    if (!validCaller(caller)) return { ok: false, reason: 'bad-caller' };
    if (!validApp(app)) return { ok: false, reason: 'bad-app' };
    if (!['look', 'all'].includes(level)) return { ok: false, reason: 'bad-level' };
    if (!Array.isArray(tools) || tools.length > MAX_TOOLS || tools.some((t) => !NAME.test(t))) return { ok: false, reason: 'bad-tool' };
    let g = this._grants.find((x) => x.caller === caller && x.app === app);
    if (!g) {
      if (this._grants.length >= MAX_GRANTS) return { ok: false, reason: 'too-many' };
      g = { caller, app, level: 'look', tools: [] };
      this._grants.push(g);
    }
    if (level === 'all') g.level = 'all';
    g.tools = [...new Set([...g.tools, ...tools])].slice(0, MAX_TOOLS);
    this._changed(`${caller} may use ${app}: ${describeGrant(g)}`, { caller, app });
    return { ok: true, grant: { ...g, tools: [...g.tools] } };
  }

  /** Take back one app's grant, or all of a caller's. Calls still running are stopped by FoafTools. */
  revoke(caller, app = null) {
    const before = this._grants.length;
    this._grants = this._grants.filter((g) => !(g.caller === caller && (app === null || g.app === app)));
    const removed = before - this._grants.length;
    if (removed) this._changed(`${caller} may no longer use ${app ?? 'anything'}`, { caller, app });
    return { ok: true, removed };
  }
}

/** A grant in words, for the Chat window. */
export function describeGrant(g) {
  if (g.level === 'all') return 'everything';
  return g.tools.length ? `look, and ${g.tools.join(', ')}` : 'look only';
}
