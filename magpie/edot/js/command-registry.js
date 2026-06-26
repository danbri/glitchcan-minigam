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
//   { id, title, icon?, group?, order?, shortcut?, keywords?, appliesTo?,
//     when?: (ctx) => boolean, run: (ctx, args) => any }
//
// `appliesTo` (optional) is an entity type from the ontology (ontology.js). It
// makes the implicit "this action is for that kind of thing" relationship
// explicit: a command for SlideElement is offered for any SlideElement subtype,
// a command with no appliesTo is global. Surfaces can filter by the entity in
// focus (ctx.forType) and the whole vocabulary can be emitted as RDF.

import { isType, isA } from './ontology.js';

export class CommandRegistry extends EventTarget {
  constructor() { super(); this._cmds = new Map(); this._audit = null; this._policy = null; }

  register(cmd) {
    if (!cmd || !cmd.id || typeof cmd.run !== 'function') throw new Error('command needs an id and a run()');
    if (cmd.appliesTo && !isType(cmd.appliesTo)) console.warn(`command "${cmd.id}": appliesTo "${cmd.appliesTo}" is not an ontology type`);
    this._cmds.set(cmd.id, { group: '', order: 100, keywords: '', ...cmd });
    return this;
  }
  registerAll(list) { (list || []).forEach((c) => this.register(c)); return this; }

  get(id) { return this._cmds.get(id); }
  all() { return [...this._cmds.values()]; }
  has(id) { return this._cmds.has(id); }

  // Commands available in a context, honouring `when(ctx)` and (if ctx.forType is
  // set) the ontology applies-to relation. Sorted by group/order.
  contributions(ctx = {}) {
    return this.all()
      .filter((c) => !c.when || c.when(ctx))
      .filter((c) => !ctx.forType || !c.appliesTo || isA(ctx.forType, c.appliesTo))
      .sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.order - b.order) || a.title.localeCompare(b.title));
  }

  // Commands relevant to a given entity type (global + applies-to this type or a
  // supertype). The ontology link, used directly.
  forType(type, ctx = {}) { return this.contributions({ ...ctx, forType: type }); }

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

// The shared, suite-wide registry (the shell, every app, the palette and
// Automations register into and read from this one). The standalone editor
// (edot-app.js) still constructs its own CommandRegistry; both are valid.
let _registry = null;
export function getRegistry() { if (!_registry) _registry = new CommandRegistry(); return _registry; }

