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
// No DOM in here. The shell supplies an `onClose` per node to take down
// whatever actually renders it.

export class AppTree {
  constructor({ bus = null } = {}) {
    this.bus = bus;
    this.nodes = new Map();     // instanceId -> node
    this._seq = 0;
  }

  _say(topic, data) { this.bus?.publish(topic, data); }

  /**
   * Create a node. `parentId` null means a root — only the shell should
   * do that, which is why roots are created at boot from the manifest
   * rather than by anyone calling spawn.
   *
   * Returns the node, or `{ refused, reason, excess }` if attenuation
   * would be violated. Refusing is not an error condition: an app asking
   * for more than it holds is a normal thing to say no to, out loud.
   */
  spawn({ appId, parentId = null, capabilities = [], label = null, surface = null, onClose = null }) {
    const want = [...new Set(capabilities)];
    let parent = null;
    if (parentId !== null) {
      parent = this.nodes.get(parentId);
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

    const id = `app${++this._seq}`;
    const node = {
      id, appId, parentId, surface,
      label: label || appId,
      capabilities: want,
      suspended: false,
      onClose,
    };
    this.nodes.set(id, node);
    this._say('app.spawn', {
      summary: `${node.label} started${parent ? ` under ${parent.label}` : ' at root'}`,
      id, appId, parentId, capabilities: want,
    });
    return node;
  }

  get(id) { return this.nodes.get(id) || null; }
  roots() { return [...this.nodes.values()].filter(n => n.parentId === null); }
  children(id) { return [...this.nodes.values()].filter(n => n.parentId === id); }

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
    for (let n = this.get(id); n && n.parentId !== null; n = this.get(n.parentId)) d++;
    return d;
  }

  /**
   * Close a node and everything beneath it. Deepest first, so a child is
   * never left briefly parentless — and so an onClose that inspects the
   * tree sees a consistent one.
   */
  close(id) {
    const node = this.get(id);
    if (!node) return [];
    const doomed = [...this.descendants(id), node];
    doomed.sort((a, b) => this.depth(b.id) - this.depth(a.id));
    const closed = [];
    for (const n of doomed) {
      try { n.onClose?.(n); } catch (e) { this._say('app.close.error', { id: n.id, error: String(e).slice(0, 120) }); }
      this.nodes.delete(n.id);
      closed.push(n.id);
    }
    this._say('app.close', {
      summary: closed.length > 1
        ? `${node.label} and ${closed.length - 1} beneath it closed`
        : `${node.label} closed`,
      id, closed,
    });
    return closed;
  }

  /** Suspend/resume a whole subtree. Returns the ids affected. */
  setSuspended(id, suspended) {
    const node = this.get(id);
    if (!node) return [];
    const affected = [node, ...this.descendants(id)];
    for (const n of affected) n.suspended = suspended;
    this._say(suspended ? 'app.suspend' : 'app.resume', {
      summary: `${node.label}${affected.length > 1 ? ` +${affected.length - 1}` : ''} ${suspended ? 'suspended' : 'resumed'}`,
      id, ids: affected.map(n => n.id),
    });
    return affected.map(n => n.id);
  }

  /** For the switcher: roots with their subtrees, and a running count. */
  report() {
    const shape = (n) => ({
      id: n.id, appId: n.appId, label: n.label, surface: n.surface,
      suspended: n.suspended, capabilities: n.capabilities,
      children: this.children(n.id).map(shape),
    });
    return { roots: this.roots().map(shape), total: this.nodes.size };
  }
}
