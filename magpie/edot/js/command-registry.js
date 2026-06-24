// command-registry.js — CommandRegistry: user actions as data.
//
// Surfaces (command palette, menus, toolbars) render from *contributions* rather
// than being hand-wired, and every user-meaningful action flows through run() —
// the single choke point where, in the Enterprise phase, collaboration ops,
// undo/redo, audit logging and policy/DLP gates will hook in. Those seams are
// present now as no-ops (see onAudit/onPolicy) so adding them later is not a
// retrofit. See docs/research/pre-enterprise-foundations.md §1 and §4.
//
// A command is data:
//   { id, title, icon?, group?, order?, shortcut?, keywords?,
//     when?: (ctx) => boolean, run: (ctx, args) => any }

export class CommandRegistry extends EventTarget {
  constructor() { super(); this._cmds = new Map(); this._audit = null; this._policy = null; }

  register(cmd) {
    if (!cmd || !cmd.id || typeof cmd.run !== 'function') throw new Error('command needs an id and a run()');
    this._cmds.set(cmd.id, { group: '', order: 100, keywords: '', ...cmd });
    return this;
  }
  registerAll(list) { (list || []).forEach((c) => this.register(c)); return this; }

  get(id) { return this._cmds.get(id); }
  all() { return [...this._cmds.values()]; }
  has(id) { return this._cmds.has(id); }

  // Commands available in a context, honouring `when(ctx)`, sorted by group/order.
  contributions(ctx = {}) {
    return this.all()
      .filter((c) => !c.when || c.when(ctx))
      .sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.order - b.order) || a.title.localeCompare(b.title));
  }

  // Filter over title/keywords/id for a palette.
  search(query, ctx = {}) {
    const q = String(query || '').trim().toLowerCase();
    const avail = this.contributions(ctx);
    if (!q) return avail;
    return avail.filter((c) => `${c.title} ${c.keywords} ${c.id}`.toLowerCase().includes(q));
  }

  // THE choke point. Governance seams live here (no-ops until the Enterprise phase).
  run(id, ctx = {}, args) {
    const cmd = this._cmds.get(id);
    if (!cmd) throw new Error(`unknown command: ${id}`);
    if (cmd.when && !cmd.when(ctx)) return false;
    if (this._policy && this._policy(cmd, ctx, args) === false) return false; // policy/DLP gate (future)
    const result = cmd.run(ctx, args);
    if (this._audit) { try { this._audit({ id, at: Date.now(), ctx }); } catch { /* audit must never break the action */ } }
    this.dispatchEvent(new CustomEvent('run', { detail: { id } }));
    return result === undefined ? true : result;
  }

  onAudit(fn) { this._audit = fn; return this; }   // Enterprise: audit log
  onPolicy(fn) { this._policy = fn; return this; } // Enterprise: policy/DLP/RBAC gate
}
