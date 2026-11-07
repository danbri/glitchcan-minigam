// FoafTools — the tools that framed apps offer, brokered by the shell.
//
// An app in a sandboxed frame has an opaque origin, so the shell cannot reach
// into it, and the frame's own document.modelContext is out of reach of anyone
// outside it. Moglob (londat docklands/frame-bridge.js) therefore offers its
// tools to the parent by postMessage:
//
//   page -> parent  {type:'webmcp.tools', api, tools:[{name,description,inputSchema,readOnly}]}
//   parent -> page  {type:'webmcp.list'}
//   parent -> page  {type:'webmcp.call', id, name, args}
//   page -> parent  {type:'webmcp.result', id, ok, value|error}
//
// This module speaks that protocol for any app whose manifest says `tools`.
// It is the one place a call goes through: the Chat window, a direct message
// from an account, and a browser agent all reach a frame here, and each is
// checked against ToolGrants (tool-grants.mjs): the shell names the caller, and
// a caller holding no grant is refused. Taking a grant back stops its calls.
//
// Where the shell's page has document.modelContext (WebMCP), the same tools
// are registered there as `<app>.<tool>`, so a browser agent can use them.
// Design: docs/foafos-docklands-webmcp-20261104.md, steps 2 and 3.

import { ToolGrants, BROWSER_AGENT } from './tool-grants.mjs';

const MAX_ARGS = 65536;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

export class FoafTools {
  constructor({ bus = null, document = null, timeoutMs = 90000, grants = new ToolGrants() } = {}) {
    this.bus = bus;
    this.grants = grants;
    grants.subscribe(() => this._recheck());
    this.document = document;
    this.timeoutMs = timeoutMs;
    this.providers = new Map();
    this._seq = 0;
    this._listeners = new Set();
  }

  /** Be told when the list of tools changes. Returns the way to stop. */
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _changed() { for (const fn of this._listeners) { try { fn(); } catch { /* a listener's problem */ } } }

  /**
   * A frame has spoken. `source` identifies it, `post` reaches it, `alive`
   * says whether it is still on the page. A new frame for the same app
   * replaces the old one.
   */
  attach({ id, label, source, post, alive = () => true }) {
    const old = this.providers.get(id);
    if (old && old.source === source) return old;
    if (old?.source?.shell && !source?.shell) return null;
    if (old) this._drop(old, 'replaced');
    const p = { id, label, slug: slug(label || id), source, post, alive, tools: [], api: null, pending: new Map(), abort: null };
    this.providers.set(id, p);
    return p;
  }

  bySource(source) {
    for (const p of this.providers.values()) if (p.source === source) return p;
    return null;
  }

  /**
   * Tools the shell itself offers, with no frame: each is
   * {name, description, inputSchema, readOnly, handler(args, {caller})}. They
   * are listed, granted, called and published to WebMCP as a frame's are. The
   * handler hears who called, so a tool that calls another app's tool can call
   * it as the same caller, and that app's grants apply too. As with a frame, a
   * grant taken back stops the caller waiting, not a handler already running.
   * A frame cannot take over a shell tool's id (see attach).
   */
  offer({ id, label, api = null, tools }) {
    const handlers = new Map(tools.map((t) => [t.name, t.handler]));
    const p = this.attach({ id, label, source: { shell: id }, post: (m) => {
      const w = p.pending.get(m.id);
      const run = handlers.get(m.name);
      Promise.resolve().then(() => run(m.args, { caller: w?.caller ?? null }))
        .then((value) => this.receive(p, { type: 'webmcp.result', id: m.id, ok: true, value: value ?? null }),
          (e) => this.receive(p, { type: 'webmcp.result', id: m.id, ok: false, error: String(e?.message || e) }));
    } });
    this.receive(p, { type: 'webmcp.tools', api, tools: tools.map(({ handler, ...t }) => t) });
    return p;
  }

  /** A `webmcp.*` message from a provider's frame. */
  receive(p, m) {
    if (m.type === 'webmcp.tools' && Array.isArray(m.tools)) {
      p.api = typeof m.api === 'string' ? m.api : null;
      p.tools = m.tools.filter((t) => t && typeof t.name === 'string').map((t) => ({
        name: t.name, description: String(t.description || ''), inputSchema: t.inputSchema || null, readOnly: t.readOnly === true,
      }));
      this.bus?.publish('app.tools', { summary: `${p.label} offers ${p.tools.length} tools`, app: p.id, count: p.tools.length, tools: p.tools.map((t) => t.name) });
      this._publishToWebMCP(p);
      this._changed();
    } else if (m.type === 'webmcp.result') {
      const w = p.pending.get(m.id);
      if (!w) return;
      p.pending.delete(m.id);
      w.settle(m.ok ? { ok: true, value: m.value } : { ok: false, reason: 'tool-error', error: String(m.error ?? 'failed') });
    }
  }

  // A grant was taken back. A call already running stops here, and its caller
  // sees no result; the app may still finish what it had started.
  _recheck() {
    for (const p of this.providers.values()) {
      for (const [id, w] of p.pending) {
        if (this.grants.allows(w.caller, p, w.tool)) continue;
        p.pending.delete(id);
        w.settle({ ok: false, reason: 'revoked' });
      }
    }
  }

  /** Forget frames that have left the page. */
  prune() { for (const p of [...this.providers.values()]) if (!p.alive()) this._drop(p, 'closed'); }

  _drop(p, reason) {
    this.providers.delete(p.id);
    p.abort?.abort();
    for (const w of p.pending.values()) w.settle({ ok: false, reason });
    p.pending.clear();
    this.bus?.publish('app.tools', { summary: `${p.label} offers no tools now`, app: p.id, count: 0 });
    this._changed();
  }

  list() {
    this.prune();
    return [...this.providers.values()].map((p) => ({ id: p.id, name: p.slug, label: p.label, api: p.api, tools: p.tools }));
  }

  /** An app by its id or its name, in any case. */
  find(name) {
    this.prune();
    const n = slug(name);
    return [...this.providers.values()].find((p) => p.id === name || p.slug === n || slug(p.id) === n) || null;
  }

  /**
   * Call a tool. Resolves to {ok:true,value} or {ok:false,reason}, and never
   * rejects. `caller` comes from tool-grants.mjs and is named on the bus, even
   * when refused; the arguments are not, because they may say what an app
   * holds, and the bus room shows what apps do.
   */
  async call(appName, toolName, args = {}, { caller = null, timeoutMs = this.timeoutMs } = {}) {
    const p = this.find(appName);
    if (!p) return { ok: false, reason: 'no-app' };
    const tool = p.tools.find((t) => t.name === toolName);
    if (!tool) return { ok: false, reason: 'no-tool' };
    const who = caller?.label || 'nobody';
    if (!this.grants.allows(caller, p, tool)) {
      this.bus?.publish('tools.called', { summary: `${who} called ${p.label} ${toolName}: not-granted`, app: p.id, tool: toolName, caller: who, ok: false, ms: 0 });
      return { ok: false, reason: 'not-granted' };
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) return { ok: false, reason: 'bad-args' };
    let text;
    try { text = JSON.stringify(args); } catch { return { ok: false, reason: 'bad-args' }; }
    if (text.length > MAX_ARGS) return { ok: false, reason: 'too-large' };
    const missing = (tool.inputSchema?.required || []).filter((k) => !(k in args));
    if (missing.length) return { ok: false, reason: 'bad-args', error: `missing ${missing.join(', ')}` };
    const id = `t${++this._seq}`;
    const started = Date.now();
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => { p.pending.delete(id); resolve({ ok: false, reason: 'timeout' }); }, timeoutMs);
      p.pending.set(id, { caller, tool, settle: (r) => { clearTimeout(timer); resolve(r); } });
      try { p.post({ type: 'webmcp.call', id, name: toolName, args: JSON.parse(text) }); }
      catch { p.pending.delete(id); clearTimeout(timer); resolve({ ok: false, reason: 'closed' }); }
    });
    this.bus?.publish('tools.called', {
      summary: `${who} called ${p.label} ${toolName}: ${result.ok ? 'ok' : result.reason}`,
      app: p.id, tool: toolName, caller: who, ok: result.ok, ms: Date.now() - started,
    });
    return result;
  }

  async _publishToWebMCP(p) {
    const mc = this.document?.modelContext;
    if (!mc?.registerTool) return;
    p.abort?.abort();
    const abort = new AbortController();
    p.abort = abort;
    for (const t of p.tools) {
      try {
        await mc.registerTool({
          name: `${p.slug}.${t.name}`.slice(0, 128),
          description: t.description || `${t.name} in ${p.label}`,
          ...(t.inputSchema ? { inputSchema: t.inputSchema } : {}),
          annotations: { readOnlyHint: t.readOnly },
          execute: async (args) => {
            const r = await this.call(p.id, t.name, args || {}, { caller: BROWSER_AGENT });
            if (!r.ok) throw new Error(r.error || r.reason);
            return JSON.stringify(r.value ?? null);
          },
        }, { signal: abort.signal });
      } catch { /* a name the browser refused: the other tools still register */ }
    }
  }
}
