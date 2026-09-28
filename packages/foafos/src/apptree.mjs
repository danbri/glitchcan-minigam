// AppTree — running app instances, as a tree, with attenuation.
//
// The registry this replaces was flat: every running thing was a peer,
// and the only relationship between a story and the game it opened was
// that both happened to exist. So "close this and everything it opened"
// could not be expressed, and neither could "an app may open another
// app, but not a more powerful one".
//
// The tree is a CAPABILITY tree, which is the part that makes `spawn`
// safe to hand out:
//
//     grant(child) ⊆ grant(parent)
//
// Without that rule spawn is a privilege-escalation primitive — anything
// able to spawn could mint a node holding capabilities it does not hold
// itself. With it, the root is the only source of authority and every
// node's power is bounded by its ancestors.
//
// It also gives grouping a precise meaning. "Close this app and
// everything beneath it" is not a UI convenience, it is revoking a
// subtree of authority: which is why close cascades, deepest first, and
// why a child does not outlive its parent by default.
//
// The tree is also the ONE place a running node's powers are held, so it
// hands out nothing that could change them. Records are private; callers
// get one frozen view per node (stable identity, live reads, writes
// throw), and `nodes` is a read-only Map view. The only ways to change a
// node are the methods below. `can(id, cap)` is the question every broker
// asks, so a closed node holds nothing, everywhere, at once.
//
// No DOM in here. The shell supplies an `onClose` per node to take down
// whatever actually renders it.

const VIEW_FIELDS = ['id', 'appId', 'parentId', 'surface', 'label', 'capabilities',
                     'suspended', 'dreamOf', 'peerOf', 'scopes'];

const clone = (v) => (typeof structuredClone === 'function'
  ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(v[k]);
  }
  return v;
}

function makeView(rec) {
  const view = {};
  for (const f of VIEW_FIELDS) {
    Object.defineProperty(view, f, { get: () => rec[f], enumerable: true });
  }
  return Object.freeze(view);
}

// The read half of the Map API over the private records, yielding views.
function readOnlyMap(map) {
  const out = (r) => r.view;
  const view = {
    get size() { return map.size; },
    has: (k) => map.has(k),
    get: (k) => (map.has(k) ? out(map.get(k)) : undefined),
    keys: () => map.keys(),
    *values() { for (const r of map.values()) yield out(r); },
    *entries() { for (const [k, r] of map) yield [k, out(r)]; },
    forEach(fn, thisArg) { for (const [k, r] of map) fn.call(thisArg, out(r), k, view); },
    *[Symbol.iterator]() { for (const [k, r] of map) yield [k, out(r)]; },
  };
  return Object.freeze(view);
}

export class AppTree {
  #nodes = new Map();     // instanceId -> private record
  #nodesView = readOnlyMap(this.#nodes);
  #seq = 0;

  constructor({ bus = null } = {}) {
    this.bus = bus;
  }

  /** Read-only: `size`, `get`, `has`, `keys`, `values`, `entries`, `forEach`. */
  get nodes() { return this.#nodesView; }

  _say(topic, data) { this.bus?.publish(topic, data); }

  /**
   * Create a node. `parentId` null means a root — only the shell should
   * do that, which is why roots are created at boot from the manifest
   * rather than by anyone calling spawn.
   *
   * Returns the node's view, or `{ refused, reason, excess }` if
   * attenuation would be violated. Refusing is not an error condition: an
   * app asking for more than it holds is a normal thing to say no to, out
   * loud.
   */
  spawn({ appId, parentId = null, capabilities = [], label = null, surface = null,
          onClose = null, dreamOf = null, peerOf = null }) {
    const want = [...new Set(capabilities)];
    let parent = null;
    if (parentId !== null) {
      parent = this.#nodes.get(parentId);
      if (!parent) {
        const r = { refused: true, reason: 'no-such-parent', parentId };
        this._say('app.spawn.refused', { summary: `spawn of ${appId} refused: parent ${parentId} is gone`, ...r });
        return r;
      }
      const excess = want.filter(c => !parent.capabilities.includes(c));
      if (excess.length) {
        const r = { refused: true, reason: 'attenuation', excess, parentId, appId };
        this._say('app.spawn.refused', {
          summary: `${parent.appId} may not grant ${excess.join(', ')} to ${appId} — it does not hold ${excess.length > 1 ? 'them' : 'it'}`,
          ...r,
        });
        return r;
      }
    }

    const id = `app${++this.#seq}`;
    const rec = {
      id, appId, parentId, surface,
      label: label || appId,
      capabilities: Object.freeze(want),
      suspended: false,
      dreamOf: dreamOf || null,
      peerOf: peerOf || null,
      scopes: Object.freeze({}),
      onClose: typeof onClose === 'function' ? onClose : null,
    };
    rec.view = makeView(rec);
    this.#nodes.set(id, rec);
    this._say('app.spawn', {
      summary: `${rec.label} started${parent ? ` under ${parent.label}` : ' at root'}`,
      id, appId, parentId, capabilities: want,
    });
    return rec.view;
  }

  get(id) { return this.#nodes.get(id)?.view || null; }
  roots() { return [...this.#nodes.values()].filter(r => r.parentId === null).map(r => r.view); }
  children(id) { return [...this.#nodes.values()].filter(r => r.parentId === id).map(r => r.view); }

  /** Depth-first, parents before children. */
  descendants(id) {
    const out = [];
    const walk = (pid) => {
      for (const c of this.children(pid)) { out.push(c); walk(c.id); }
    };
    walk(id);
    return out;
  }

  depth(id) {
    let d = 0;
    for (let r = this.#nodes.get(id); r && r.parentId !== null; r = this.#nodes.get(r.parentId)) d++;
    return d;
  }

  /** Does this LIVE node hold `cap`? A closed or unknown node holds nothing. */
  can(id, cap) { return !!this.#nodes.get(id)?.capabilities.includes(cap); }

  /** The live nodes holding `cap`. */
  holders(cap) { return [...this.#nodes.values()].filter(r => r.capabilities.includes(cap)).map(r => r.view); }

  /** Replace what closing this node takes down (null: nothing). */
  setOnClose(id, fn) {
    const rec = this.#nodes.get(id);
    if (!rec) return false;
    rec.onClose = typeof fn === 'function' ? fn : null;
    return true;
  }

  /**
   * Record a SCOPE a broker enforces for this node: which bus topics it
   * may publish and hear, which variables, where a verb points. The value
   * is frozen as given, and the returned copy is what the broker should
   * be built from, so what the switcher shows is what is enforced.
   */
  setScope(id, name, value) {
    const rec = this.#nodes.get(id);
    if (!rec) return null;
    const frozen = deepFreeze(clone(value));
    rec.scopes = Object.freeze({ ...rec.scopes, [name]: frozen });
    this._say('app.scope', { summary: `${rec.label}: ${name} scope set`, id, appId: rec.appId, name });
    return frozen;
  }

  /**
   * Close a node and everything beneath it. Deepest first, so a child is
   * never left briefly parentless — and so an onClose that inspects the
   * tree sees a consistent one.
   */
  close(id) {
    const node = this.#nodes.get(id);
    if (!node) return [];
    const doomed = [...this.descendants(id).map(v => this.#nodes.get(v.id)), node];
    doomed.sort((a, b) => this.depth(b.id) - this.depth(a.id));
    const closed = [];
    for (const r of doomed) {
      try { r.onClose?.(r.view); } catch (e) { this._say('app.close.error', { id: r.id, error: String(e).slice(0, 120) }); }
      this.#nodes.delete(r.id);
      closed.push(r.id);
    }
    this._say('app.close', {
      summary: closed.length > 1
        ? `${node.label} and ${closed.length - 1} beneath it closed`
        : `${node.label} closed`,
      id, closed,
    });
    return closed;
  }

  /** Suspend/resume a node — by default with its whole subtree
   *  (children never outlive or outrun their parent's state), or alone
   *  with { subtree: false } for the switcher's app-only pause.
   *  Returns the ids affected. */
  setSuspended(id, suspended, { subtree = true } = {}) {
    const node = this.#nodes.get(id);
    if (!node) return [];
    const affected = subtree ? [node, ...this.descendants(id).map(v => this.#nodes.get(v.id))] : [node];
    for (const r of affected) r.suspended = !!suspended;
    this._say(suspended ? 'app.suspend' : 'app.resume', {
      summary: `${node.label}${affected.length > 1 ? ` +${affected.length - 1}` : ''} ${suspended ? 'suspended' : 'resumed'}`,
      id, ids: affected.map(r => r.id),
    });
    return affected.map(r => r.id);
  }

  /** For the switcher: roots with their subtrees, and a running count.
   *  Plain copies — a caller may do what it likes with them. */
  report() {
    const shape = (v) => ({
      id: v.id, appId: v.appId, label: v.label, surface: v.surface,
      suspended: v.suspended, capabilities: [...v.capabilities],
      dreamOf: v.dreamOf, peerOf: v.peerOf, scopes: clone(v.scopes),
      children: this.children(v.id).map(shape),
    });
    return { roots: this.roots().map(shape), total: this.#nodes.size };
  }
}
