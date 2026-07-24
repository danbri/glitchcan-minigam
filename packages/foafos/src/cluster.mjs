// FoafCluster — several shell instances (tabs/windows of one origin),
// lightly coordinated under one flexible monolith.
//
// Every member runs the same code; one is elected COORDINATOR — "the
// runner above", with oversight of the cluster's shared resources
// (audio, fullscreen, cast, fs-write, …). Everything travels over the
// FoafBus (bridge the bus and the cluster spans windows for free), so
// this also unit-tests in Node.
//
//   const cluster = new FoafCluster(bus).start();
//   await cluster.claim('audio', { label: 'jukebox' });  // → true when granted
//   cluster.onYield('audio', () => duck());              // someone else took it
//   cluster.release('audio');
//
// Policy (v0, deliberately simple): one holder per resource, last claim
// wins, previous holder is told to yield. That is the audio-focus rule
// generalized. Election: lowest (seniority, id) wins; coordinator
// heartbeats a retained presence; members re-elect when it goes stale.
// Zero-trust note: this coordinates *cooperating* same-origin shells; it
// is a courtesy protocol, not a security boundary — isolation comes from
// origins and capability grants, not from the cluster.

export class FoafCluster {
  constructor(bus, { id, heartbeatMs = 1000, now = Date.now } = {}) {
    this.bus = bus;
    this.id = id || `m-${Math.random().toString(36).slice(2, 10)}`;
    this.heartbeatMs = heartbeatMs;
    this.now = now;
    this.seniority = now();

    this.members = new Map();      // id → { seniority, lastSeen }
    this.coordinator = null;       // current coordinator id (as observed)
    this.holders = new Map();      // coordinator's book: resource → { holder, meta }
    this.myClaims = new Map();     // resource → meta (what I DESIRE)
    this.held = new Set();         // resources CONFIRMED mine (desired ⊇ held)
    this._yieldHandlers = new Map();
    this._waiters = new Map();     // resource → Set<resolve>
    this._timers = [];
    this._unsubs = [];
  }

  get isCoordinator() { return this.coordinator === this.id; }

  start() {
    const sub = (t, h) => this._unsubs.push(this.bus.subscribe(t, h));

    sub('sys.cluster.hello', (e) => {
      this.members.set(e.data.id, { seniority: e.data.seniority, lastSeen: this.now() });
      this._elect();
    });
    sub('sys.cluster.bye', (e) => {
      this.members.delete(e.data.id);
      if (this.coordinator === e.data.id) this.coordinator = null;
      this._elect();
    });
    sub('sys.cluster.coordinator', (e) => {
      const prev = this.coordinator;
      this.coordinator = e.data.id;
      this.members.set(e.data.id, { seniority: e.data.seniority, lastSeen: this.now() });
      // A new coordinator has an empty book: re-assert my claims.
      if (prev !== this.coordinator) {
        for (const [resource, meta] of this.myClaims) this._publishClaim(resource, meta);
      }
    });
    sub('sys.res.claim', (e) => {
      if (!this.isCoordinator) return;
      this.holders.set(e.data.resource, { holder: e.data.id, meta: e.data.meta });
      this.bus.publish('sys.res.state',
        { resource: e.data.resource, holder: e.data.id, meta: e.data.meta }, { retain: true });
    });
    sub('sys.res.release', (e) => {
      if (!this.isCoordinator) return;
      const cur = this.holders.get(e.data.resource);
      if (cur?.holder !== e.data.id) return;   // only the holder releases
      this.holders.delete(e.data.resource);
      this.bus.publish('sys.res.state', { resource: e.data.resource, holder: null }, { retain: true });
    });
    sub('sys.res.state', (e) => {
      const { resource, holder } = e.data;
      if (holder === this.id) {
        this.held.add(resource);
        for (const resolve of this._waiters.get(resource) ?? []) resolve(true);
        this._waiters.delete(resource);
      } else if (holder && this.held.has(resource)) {
        // Taken from me: yield. (A state naming someone else while my own
        // claim is merely in flight is stale ordering — the coordinator's
        // answer to MY claim is still coming; ignore it.)
        this.held.delete(resource);
        this.myClaims.delete(resource);
        try { this._yieldHandlers.get(resource)?.(e.data); } catch (err) { console.error('[FoafCluster] yield handler:', err); }
      }
    });

    this.members.set(this.id, { seniority: this.seniority, lastSeen: this.now() });
    this.bus.publish('sys.cluster.hello', { id: this.id, seniority: this.seniority });

    this._timers.push(setInterval(() => this._tick(), this.heartbeatMs));
    this._elect();
    return this;
  }

  stop() {
    this.bus.publish('sys.cluster.bye', { id: this.id });
    this._timers.forEach(clearInterval);
    this._unsubs.forEach(u => u());
    this._timers = []; this._unsubs = [];
  }

  // ── election ─────────────────────────────────────────────────────────

  _elect() {
    let best = null;
    for (const [id, m] of this.members) {
      if (!best || m.seniority < best.seniority || (m.seniority === best.seniority && id < best.id)) {
        best = { id, seniority: m.seniority };
      }
    }
    if (best && best.id === this.id && this.coordinator !== this.id) {
      this.coordinator = this.id;
      this._heartbeat();
    }
  }

  _heartbeat() {
    this.bus.publish('sys.cluster.coordinator',
      { id: this.id, seniority: this.seniority }, { retain: true });
  }

  _tick() {
    // re-announce myself; coordinator heartbeats; everyone prunes the stale
    this.members.set(this.id, { seniority: this.seniority, lastSeen: this.now() });
    this.bus.publish('sys.cluster.hello', { id: this.id, seniority: this.seniority });
    if (this.isCoordinator) this._heartbeat();
    const stale = this.now() - this.heartbeatMs * 3;
    for (const [id, m] of this.members) {
      if (id !== this.id && m.lastSeen < stale) {
        this.members.delete(id);
        if (this.coordinator === id) this.coordinator = null;
      }
    }
    if (!this.coordinator) this._elect();
  }

  // ── resources ────────────────────────────────────────────────────────

  claim(resource, meta = {}, { timeoutMs = 5000 } = {}) {
    this.myClaims.set(resource, meta);
    const p = new Promise((resolve) => {
      if (!this._waiters.has(resource)) this._waiters.set(resource, new Set());
      this._waiters.get(resource).add(resolve);
      setTimeout(() => resolve(false), timeoutMs);
    });
    this._publishClaim(resource, meta);
    return p;
  }

  _publishClaim(resource, meta) {
    this.bus.publish('sys.res.claim', { id: this.id, resource, meta });
  }

  release(resource) {
    this.myClaims.delete(resource);
    this.held.delete(resource);
    this.bus.publish('sys.res.release', { id: this.id, resource });
  }

  holds(resource) { return this.held.has(resource); }

  // handler(stateData) fires when another member takes a resource I held
  onYield(resource, handler) { this._yieldHandlers.set(resource, handler); }
}
