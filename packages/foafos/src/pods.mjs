// FoafPods — the user's LWS storages ("pods"), held by the shell, brokered to apps.
//
// A pod is a Linked Web Storage (https://www.w3.org/TR/lws10-core/) reached one of two ways:
//
//   carriage 'https'  the browser's fetch to the storage's own base IRI (the pod must send CORS)
//   carriage 'xmpp'   XEP-0332 through an XMPP relay (XmppWs.httpFetch): a pod at home, behind
//                     NAT, with no public HTTPS. The LWS requests are the same bytes either way.
//   carriage 'builtin' the Factoidal Lean LWS engine running IN THIS PAGE (@factoidal/core
//                     lws/inpage.mjs; the shell supplies `openBuiltin`). No server, no network.
//                     Its storage key is a secret under POD_OWNER, so the pod is kept (in
//                     `snapshots`, IndexedDB in the shell) only while secrets are sealed with
//                     the session passphrase; without one it lasts for this run, and says so.
//                     A shell with no pods starts with one, "browser", chosen for apps.
//
// An https pod signs in one of two ways: `auth: 'bearer'` (a token the person pastes), or
// `auth: 'did-key'` (the shell's own did:key agent for that pod: a P-256 key made in this browser,
// kept in FoafSecrets, never shown; its did:key is public, kept in the record as `agent`, and the
// pod's owner grants it in the pod's ACL). The shell supplies `newAgent` and `openAgent`
// (lws-agent.mjs over the Factoidal LWS client). Design: docs/foafos-local-lws-auth-20261107.md.
//
// The shell holds the pod list, the connections and the XMPP password (in FoafSecrets, under
// POD_OWNER). Apps never see a pod address, a JID or a credential: they get four verbs, aimed
// by their grant, on the same rule as ops.mjs —
//
//   THE SCOPE SUPPLIES THE DESTINATION. THE APP SUPPLIES THE DATA.
//
//   pods.grant('notes', { 'pod:read': { pod: 'home' }, 'pod:write': { pod: 'home' } })
//   pods.invoke('notes', 'pod.put', { path: 'today.json', body: '{}', contentType: 'application/json' })
//     → PUT <home base>apps/notes/today.json
//
// The prefix defaults to `apps/<appId>/`, so an app reaches only its own container. A path with
// `..` is refused (cleanPath). Listings come back as paths relative to the prefix, not as IRIs.
//
// One pod is the common SHARED pod (`appsPod()`, the record's `forApps`): the default for every
// app. A person may also give one app an EXTRA pod in System (`grantExtra`). The app gets a
// random handle for it, never the pod's id or address, and sends `pod: handle` with a verb. An
// app has no verb to list, name, add or ask for a pod. An extra pod rides on the app's grant for
// the shared pod, so with no shared pod it is asleep. Design: docs/foafos-pods-per-app-20261107.md.
//
// Every call is audited on the bus (`pods.*`) with the verb, the path and the status — never a
// credential, never a body. Design: docs/foafos-pods-20261103.md.

import { cleanPath } from './ops.mjs';
import { SECRETS_CAP } from './secrets.mjs';
import { deviceFetch, typeOf } from './device-fetch.mjs';
import { openArchive, listArchive, archiveParts, ArchiveError, ARCHIVE_LIMITS } from './archive.mjs';
import { TextIndex } from './search.mjs';
import { readMetadata, withoutLocation, metadataTurtle } from './metadata.mjs';

export const POD_OWNER = 'foafos.pods';
export const POD_VERBS = {
  'pod.get': 'pod:read',
  'pod.list': 'pod:read',
  'pod.search': 'pod:read',
  'pod.meta': 'pod:read',
  'pod.put': 'pod:write',
  'pod.delete': 'pod:write',
};
export const MAX_POD_BODY = 1024 * 1024;   // what one call may carry as text
/** What one call may carry as bytes (a photo, a PDF): read with { as: 'bytes' }, written as an ArrayBuffer or typed array. */
export const MAX_POD_BYTES = 8 * 1024 * 1024;
const bodyBytes = (b) => (typeof b === 'string' ? new TextEncoder().encode(b).length : b?.byteLength ?? 0);
const asBytes = (b) => (b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null);
/** At most this many pages of one container listing (100 items each on Factoidal LWS). */
const MAX_LIST_PAGES = 50;
/** The `next` link of a paged listing, resolved against the page's URL, or null. */
const nextPage = (link, from) => {
  const m = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(link || '');
  if (!m) return null;
  try { return new URL(m[1], from).href; } catch { return null; }
};
const CONTAINER_LINK = '<https://www.w3.org/ns/lws#Container>; rel="type"';
const TEXTUAL = /^(text\/|application\/([a-z0-9.+-]*\+)?(json|xml|turtle|n-triples|n-quads|trig))/i;
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const HANDLE = /^extra-[0-9a-f]{16}$/;

const secretName = (id) => `pod.${id}.password`;
const keyName = (id) => `pod.${id}.key`;
const agentName = (id) => `pod.${id}.agent`;
const DID_KEY = /^did:key:z[1-9A-HJ-NP-Za-km-z]{20,128}$/;
/** The secret that signs this pod in: a did:key pod's agent key, else its password or token. */
const loginName = (r) => (r.auth === 'did-key' ? agentName(r.id) : secretName(r.id));
const hasLogin = (r) => r.carriage === 'xmpp' || r.auth === 'bearer' || r.auth === 'did-key';
/** The built-in pod's IRI: never fetched; the in-page engine answers it. */
export const BUILTIN_BASE = 'https://pod.foafos.local/';
export const BUILTIN_PRINCIPAL = 'urn:foafos:shell';
/** The root ACL of a new built-in pod: the shell, and only the shell, may do everything. */
export const BUILTIN_ACL = `@prefix acl: <http://www.w3.org/ns/auth/acl#> .
<#shell> a acl:Authorization ; acl:agent <${BUILTIN_PRINCIPAL}> ; acl:accessTo <./> ; acl:default <./> ;
  acl:mode acl:Read, acl:Write, acl:Control .
`;
function randomKeyHex() {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const isLoopback = (u) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);

/** A pod record, checked. Throws with a reason a person can act on. */
export function checkPod(rec) {
  const r = { ...rec };
  if (!ID.test(String(r.id || ''))) throw new Error('id: 1 to 32 of a-z, 0-9 and "-", starting with a letter or digit');
  r.label = String(r.label || r.id);
  let base;
  try { base = new URL(String(r.base)); } catch { throw new Error('base: not an absolute IRI'); }
  // The base names the storage; with carriage 'xmpp' it is never fetched over the network,
  // but it is still the IRI every resource has, so it must be one a client can trust.
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && isLoopback(base))) {
    throw new Error('base: must be https: (or http: on loopback, for tests)');
  }
  if (!base.pathname.endsWith('/') || base.search || base.hash) throw new Error('base: must end with "/" and have no query or fragment');
  r.base = base.href;
  if (!['https', 'xmpp', 'builtin', 'device'].includes(r.carriage)) throw new Error('carriage: "https", "xmpp", "builtin" or "device"');
  if (r.carriage === 'device' && !['opfs', 'folder'].includes(r.device)) throw new Error('device: "opfs" or "folder"');
  if (r.carriage !== 'device') delete r.device;
  // An https pod may need a bearer token, kept as the pod's secret, or the shell's did:key agent,
  // whose key is a secret too. Apps never see either.
  if (r.auth !== undefined && !(['bearer', 'did-key'].includes(r.auth) && r.carriage === 'https')) throw new Error('auth: "bearer" or "did-key", for carriage "https"');
  if (r.auth === 'did-key' && r.agent !== undefined && !DID_KEY.test(String(r.agent))) throw new Error('agent: a did:key');
  if (r.auth !== 'did-key') delete r.agent;
  if (r.carriage === 'xmpp') {
    const relay = r.relay || {};
    let url;
    try { url = new URL(String(relay.url)); } catch { throw new Error('relay.url: not a WebSocket URL'); }
    if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && isLoopback(url))) {
      throw new Error('relay.url: must be wss: (or ws: on loopback, for tests)');
    }
    if (!relay.domain) throw new Error('relay.domain is required');
    if (!/^[^@/\s]+@[^@/\s]+(\/\S+)?$/.test(String(r.podJid || ''))) throw new Error('podJid: a JID such as pod@example.org/lws');
    // The account may come later: a saved server can wait for the person to sign in.
    r.relay = { url: url.href, domain: String(relay.domain), username: String(relay.username ?? '') };
    r.podJid = String(r.podJid);
  } else {
    delete r.relay; delete r.podJid;
  }
  // A space limit for the whole pod, in bytes (the owner's): writes through the shell that would go
  // over it are refused, and from 90% the shell says so. None: no limit.
  if (r.quota === undefined || r.quota === null || r.quota === '') delete r.quota;
  else {
    const q = Number(r.quota);
    if (!Number.isSafeInteger(q) || q <= 0) throw new Error('quota: a whole number of bytes, above 0');
    r.quota = q;
  }
  r.forApps = !!r.forApps;
  r.auto = !!r.auto;     // signed in and not disconnected: connect again when the logins unlock
  return r;
}

export class FoafPods {
  /**
   * @param secrets      a FoafSecrets; the XMPP password is reached only through secrets.use
   * @param storage      localStorage-shaped, for the pod records (never for a secret)
   * @param connectXmpp  (opts) => Promise<XmppWs>; injected so tests need no relay
   * @param fetchImpl    the browser's fetch, for carriage 'https'; injected for tests
   * @param openBuiltin  async ({ storageKey, snapshot, onSnapshot }) => { fetch, close }, for
   *                     carriage 'builtin' (the shell loads the engine); null: no built-in pod
   * @param snapshots    async { get(id), put(id, snapshot) }: where a built-in pod is kept
   * @param newAgent     async () => { subject, keyId, jwk }: a new did:key agent (the engine makes it)
   * @param openAgent    async ({ base, selfIssued }) => fetch: requests as that agent (lws-agent.mjs)
   */
  constructor({ secrets, bus = null, storage = null, key = 'foafos.pods', connectXmpp = null,
    fetchImpl = null, now = () => Date.now(), perMinute = 120, openBuiltin = null, snapshots = null, openDevice = null,
    newAgent = null, openAgent = null } = {}) {
    if (!secrets) throw new Error('foafos pods: a FoafSecrets is required');
    this.secrets = secrets;
    this.bus = bus;
    this.storage = storage;
    this.key = key;
    this.connectXmpp = connectXmpp;
    this.openBuiltin = openBuiltin;
    this._opening = new Map();      // pod id -> the connect() under way
    this.shares = new Map();        // token -> one file, held by one window
    this.usage = new Map();         // pod id -> { used, partial }: bytes in the pod, for its quota
    this.indexes = new Map();       // pod id -> Promise<{ index: TextIndex, partial }>: text search
    this.offers = [];               // shares waiting for their window to open
    this.openDevice = openDevice;   // async (rec, {ask}) => {ok, root} | {ok:false, status, detail}, for carriage 'device'
    this.newAgent = newAgent;
    this.openAgent = openAgent;
    this.snapshots = snapshots;
    this.fetch = fetchImpl || ((...a) => globalThis.fetch(...a));
    this.now = now;
    this.perMinute = perMinute;
    this.pods = new Map();     // id -> record
    this.live = new Map();     // id -> { status, detail, fetch, conn }
    this.grants = new Map();   // appId -> Map(capability -> { pod, prefix })
    this.extras = new Map();   // appId -> Map(handle -> pod id): the person's choices, kept
    this.extrasKey = `${key}.extras`;   // apart from the pod list, so a saved list is read as before
    this.calls = new Map();
    this.audit = [];
    if (!secrets.can(POD_OWNER)) secrets.grant(POD_OWNER, [SECRETS_CAP]);
    const fresh = this._load();
    // A shell that has never kept a pod list starts with the built-in pod, chosen for apps,
    // so an app holding pod:write works with no setup. Once the list exists (even empty, after
    // REMOVE) this does not come back.
    if (fresh && openBuiltin) {
      this.pods.set('browser', checkPod({ id: 'browser', label: 'This browser', base: BUILTIN_BASE, carriage: 'builtin', forApps: true }));
      this._save();
    }
    this._loadExtras();
    // A built-in pod is written out only while secrets are sealed. When they become sealed
    // (a passphrase is set or unlocked), write what is held now, and open a locked pod.
    bus?.subscribe?.('secrets.sealed', () => this._keepBuiltins());
    bus?.subscribe?.('secrets.unsealed', () => this._afterUnlock());
  }

  _say(topic, data) {
    this.audit.push({ topic, ...data });
    if (this.audit.length > 200) this.audit.shift();
    this.bus?.publish(topic, data);
  }

  /** Read the saved pod list. True when there was none (a new shell). */
  _load() {
    let raw = null;
    try { raw = this.storage?.getItem(this.key) ?? null; } catch { /* blocked */ }
    if (raw === null) return true;
    try {
      const saved = JSON.parse(raw || '[]');
      for (const rec of saved) { try { const r = checkPod(rec); this.pods.set(r.id, r); } catch { /* dropped */ } }
    } catch { /* unreadable: start empty */ }
    return false;
  }

  _save() {
    try { this.storage?.setItem(this.key, JSON.stringify([...this.pods.values()])); } catch { /* full or blocked */ }
  }

  _loadExtras() {
    let saved = [];
    try { saved = JSON.parse(this.storage?.getItem(this.extrasKey) || '[]'); } catch { /* unreadable: none */ }
    for (const g of Array.isArray(saved) ? saved : []) {
      if (!g || typeof g.app !== 'string' || !HANDLE.test(String(g.handle)) || !this.pods.has(g.pod)) continue;
      if (!this.extras.has(g.app)) this.extras.set(g.app, new Map());
      this.extras.get(g.app).set(g.handle, g.pod);
    }
  }

  _saveExtras() {
    const out = this.extraGrants().map(({ appId, handle, pod }) => ({ app: appId, handle, pod }));
    try { this.storage?.setItem(this.extrasKey, JSON.stringify(out)); } catch { /* full or blocked */ }
  }

  _setStatus(id, status, detail = '') {
    const l = this.live.get(id) || {};
    this.live.set(id, { ...l, status, detail });
    this._say('pods.status', { summary: `pod ${id}: ${status}${detail ? ` (${detail})` : ''}`, id, status, detail });
  }

  // ── the pod list (shell side) ─────────────────────────────────────────

  /** The pods, with their live status. No secret is ever part of this. */
  list() {
    return [...this.pods.values()].map((r) => ({
      ...r,
      status: this.live.get(r.id)?.status || 'offline',
      detail: this.live.get(r.id)?.detail || '',
      hasPassword: hasLogin(r) ? this.secrets.has(POD_OWNER, loginName(r)) : null,
      // Its login may be on this device, sealed: the person must unlock, not sign in again.
      locked: hasLogin(r) && !this.secrets.has(POD_OWNER, loginName(r)) && this._locked(),
      // 'builtin': is it written out (sealed), or held for this run only?
      kept: r.carriage === 'builtin' ? (this.secrets.sealed ? 'sealed' : 'run') : null,
      // Bytes in use, once measured (a pod with a quota is measured at its first write).
      usage: this.usage.get(r.id)?.used ?? null,
    }));
  }

  get(id) { return this.list().find((p) => p.id === id) || null; }

  add(rec, { password } = {}) {
    const r = checkPod(rec);
    if (this.pods.has(r.id)) throw new Error(`a pod "${r.id}" exists already`);
    this.pods.set(r.id, r);
    this._save();
    if (password != null) {
      const held = this.setPassword(r.id, password);
      if (!held.ok) this._say('pods.refused', { summary: `the password for ${r.id} was not held (${held.reason})`, id: r.id, reason: held.reason });
    }
    this._say('pods.added', { summary: `pod ${r.id} added (${r.carriage})`, id: r.id, carriage: r.carriage });
    return this.get(r.id);
  }

  update(id, changes) {
    const old = this.pods.get(id);
    if (!old) throw new Error(`no pod "${id}"`);
    const r = checkPod({ ...old, ...changes, id });
    this.pods.set(id, r);
    this._save();
    this._say('pods.updated', { summary: `pod ${id} updated`, id });
    return this.get(id);
  }

  async remove(id) {
    await this.disconnect(id);
    this.pods.delete(id);
    this.secrets.forget(POD_OWNER, secretName(id));
    this.secrets.forget(POD_OWNER, agentName(id));
    for (const box of this.grants.values()) {
      for (const [cap, scope] of box) if (scope.pod === id) box.delete(cap);
    }
    for (const [appId, box] of this.extras) {
      for (const [handle, pod] of box) if (pod === id) box.delete(handle);
      if (!box.size) this.extras.delete(appId);
    }
    this._save();
    this._saveExtras();
    this._say('pods.removed', { summary: `pod ${id} removed`, id });
  }

  /** The common shared pod: what apps' grants point at (at most one), or null. */
  appsPod() { return [...this.pods.values()].find((r) => r.forApps)?.id || null; }

  /** Make `id` the shared pod (null: none). Each app still reaches only its own prefix. */
  setAppsPod(id) {
    if (id !== null && !this.pods.has(id)) throw new Error(`no pod "${id}"`);
    for (const r of this.pods.values()) r.forApps = r.id === id;
    this._save();
    this._say('pods.updated', { summary: id ? `apps now use pod ${id}` : 'no pod for apps', id });
  }

  setPassword(id, password) {
    if (!this.pods.has(id)) return { ok: false, reason: 'no-such-pod' };
    const r = this.secrets.put(POD_OWNER, secretName(id), password);
    if (r.ok) this.secrets.flush?.();
    // For an https pod this is its access token, so it may gain one after it was added.
    const rec = this.pods.get(id);
    if (r.ok && rec.carriage === 'https' && rec.auth !== 'bearer') { rec.auth = 'bearer'; delete rec.agent; this._save(); }
    return r;
  }

  _locked() { return this.secrets.hasSealed() && !this.secrets.sealed; }

  /**
   * Sign in, and connect. `way` changes how the pod is reached and how the person signs in:
   * { carriage: 'xmpp', relay, podJid } or { carriage: 'https', auth: 'bearer' }. `secret` is the
   * password or token: it goes to FoafSecrets, and the old one goes when the carriage changes.
   */
  async signIn(id, { way = null, secret = null } = {}) {
    const old = this.pods.get(id);
    if (!old) throw new Error(`no pod "${id}"`);
    if (way) {
      const r = checkPod({ ...old, auth: undefined, agent: undefined, relay: undefined, podJid: undefined, ...way, id });
      await this.disconnect(id, { quiet: true });
      this.pods.set(id, r);
      if (r.carriage !== old.carriage) this.secrets.forget(POD_OWNER, secretName(id));
      if (r.auth !== 'did-key') this.secrets.forget(POD_OWNER, agentName(id));
      this._save();
      this._say('pods.updated', { summary: `pod ${id} updated`, id });
    }
    if (secret) {
      const held = this.setPassword(id, secret);
      if (!held.ok) {
        this._setStatus(id, 'error', `Your login could not be held (${held.reason}).`);
        return this.get(id);
      }
    }
    const p = await this.connect(id, { ask: true });
    if (p.status === 'online') { this.pods.get(id).auto = true; this._save(); }
    return this.get(id);
  }

  // ── connections ───────────────────────────────────────────────────────

  status(id) { return this.live.get(id)?.status || 'offline'; }

  /**
   * `ask`: the person has just acted, so a browser permission prompt may be shown.
   * Calls that overlap share one opening, so a second caller waits rather than
   * finding the pod half open.
   */
  async connect(id, opts = {}) {
    const busy = this._opening.get(id);
    if (busy) {
      await busy.catch(() => {});
      if (!opts.ask || this.status(id) === 'online') return this.get(id);
    }
    const run = this._connect(id, opts);
    this._opening.set(id, run);
    try { return await run; } finally { if (this._opening.get(id) === run) this._opening.delete(id); }
  }

  async _connect(id, { ask = false } = {}) {
    const rec = this.pods.get(id);
    if (!rec) throw new Error(`no pod "${id}"`);
    await this.disconnect(id, { quiet: true });
    this._setStatus(id, 'connecting');
    let podFetch;
    let conn = null;
    if (rec.carriage === 'builtin') {
      const opened = await this._openBuiltin(rec);
      if (!opened) return this.get(id);
      conn = opened;
      podFetch = opened.fetch;
    } else if (rec.carriage === 'device') {
      if (!this.openDevice) { this._setStatus(id, 'error', 'this shell cannot reach device storage'); return this.get(id); }
      const opened = await this.openDevice(rec, { ask });
      if (!opened.ok) { this._setStatus(id, opened.status || 'error', opened.detail || ''); return this.get(id); }
      podFetch = deviceFetch(opened.root, rec.base);
    } else if (rec.carriage === 'xmpp') {
      if (!this.connectXmpp) { this._setStatus(id, 'error', 'no XMPP client in this shell'); return this.get(id); }
      if (!rec.relay.username) return this._askLogin(id, 'Enter your username and password, then press Sign in.');
      if (!this.secrets.has(POD_OWNER, secretName(id))) return this._noSecret(id, 'Enter your password, then press Sign in.');
      let refused = false;
      const used = await this.secrets.use(POD_OWNER, secretName(id), async (password) => {
        try {
          return await this.connectXmpp({ url: rec.relay.url, domain: rec.relay.domain, username: rec.relay.username, password, resource: `pod-${id}-${crypto.randomUUID().slice(0, 8)}` });
        } catch (e) {
          // Read here, because the message goes no further than this line: only what kind of failure it is.
          refused = /not-authorized|not-allowed|account-disabled/.test(String(e?.message));
          throw e;
        }
      });
      if (!used.ok) {
        if (refused) return this._askLogin(id, 'The server did not accept this username and password. Check them, then sign in again.');
        this._setStatus(id, 'error', 'The XMPP server did not answer. Try again in a moment.');
        return this.get(id);
      }
      conn = used.result;
      podFetch = conn.httpFetch({ jid: rec.podJid, base: rec.base });
    } else if (rec.auth === 'did-key') {
      const opened = await this._openAgent(rec);
      if (!opened) return this.get(id);
      podFetch = opened;
    } else if (rec.auth === 'bearer') {
      if (!this.secrets.has(POD_OWNER, secretName(id))) return this._noSecret(id, 'Enter your token, then press Sign in.');
      podFetch = async (url, init = {}) => {
        const used = await this.secrets.use(POD_OWNER, secretName(id), (token) =>
          this.fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }));
        if (!used.ok) throw new Error('the access token is not available');
        return used.result;
      };
    } else {
      podFetch = (url, init) => this.fetch(url, init);
    }
    this.live.set(id, { status: 'connecting', detail: '', fetch: podFetch, conn });
    let probe;
    try { probe = await podFetch(rec.base, { method: 'HEAD' }); } catch { probe = null; }
    const denied = probe?.status === 401 || probe?.status === 403;
    if (!probe) this._setStatus(id, 'error', 'The storage did not answer. It may be down, or it may not allow this page.');
    else if (probe.status === 504) this._setStatus(id, 'error', 'The pod is offline. Try again when it is running.');
    else if (probe.status >= 500) this._setStatus(id, 'error', `The storage has a fault (it answered ${probe.status}). Try again later.`);
    else if (denied && rec.carriage === 'xmpp') return this._askLogin(id, "The server accepted this account, but the pod does not let it in. Sign in with an account on the pod's list, or ask the pod's owner to add this one.");
    else if (denied && rec.auth === 'bearer') return this._askLogin(id, 'The server did not accept this token. Check it, then sign in again.');
    else if (denied && rec.auth === 'did-key') return this._askGrant(id);
    else if (denied) return this._askLogin(id, 'This storage asks for a token. Enter it, then press Sign in.');
    else this._setStatus(id, 'online', probe.status === 200 ? '' : `HEAD ${probe.status}`);
    return this.get(id);
  }

  /** The person must act before this pod can open. What is open now is closed, and a login
   *  that was refused is not kept: it would only be sealed and refused again. */
  _askLogin(id, detail) {
    try { this.live.get(id)?.conn?.close(); } catch { /* gone */ }
    this.live.delete(id);
    if (this.secrets.has(POD_OWNER, secretName(id))) { this.secrets.forget(POD_OWNER, secretName(id)); this.secrets.flush?.(); }
    this._setStatus(id, 'needs-login', detail);
    return this.get(id);
  }

  /** The pod does not let this browser's agent in yet. The key is kept: the owner grants its
   *  did:key (public), then the person connects again. */
  _askGrant(id) {
    this.live.delete(id);
    const did = this.pods.get(id)?.agent || '';
    this._setStatus(id, 'needs-ok', `This storage does not let this browser in yet. On the computer that runs it, run: foafos-stack lws-allow ${did} — then connect again.`);
    return this.get(id);
  }

  /** This browser's agent for a did:key pod: its key from the secrets (made on first use), and a
   *  fetch that signs in as it. The key never leaves the secrets except into `openAgent`. */
  async _openAgent(rec) {
    const id = rec.id;
    if (!this.openAgent || !this.newAgent) { this._setStatus(id, 'error', 'this shell cannot sign in with a did:key'); return null; }
    if (!this.secrets.has(POD_OWNER, agentName(id))) {
      if (this._locked()) { this._setStatus(id, 'locked', 'Unlock your saved logins to connect.'); return null; }
      let made;
      try { made = await this.newAgent(); } catch { made = null; }
      if (!made || !DID_KEY.test(String(made.subject))) { this._setStatus(id, 'error', 'no did:key could be made in this browser'); return null; }
      const put = this.secrets.put(POD_OWNER, agentName(id), JSON.stringify(made));
      if (!put.ok) { this._setStatus(id, 'error', `the key could not be held (${put.reason})`); return null; }
      this.secrets.flush?.();
      this.pods.get(id).agent = made.subject;
      this._save();
      this._say('pods.updated', { summary: `pod ${id}: this browser has a new did:key agent`, id, agent: made.subject });
    }
    const used = await this.secrets.use(POD_OWNER, agentName(id), (json) => this.openAgent({ base: rec.base, selfIssued: JSON.parse(json) }));
    if (!used.ok) { this._setStatus(id, 'error', 'could not sign in as this browser\'s agent'); return null; }
    return used.result;
  }

  /** No login held: it is on this device, locked, or the person has yet to give it. */
  _noSecret(id, detail) {
    if (!this._locked()) return this._askLogin(id, detail);
    this._setStatus(id, 'locked', 'Unlock your saved logins to connect.');
    return this.get(id);
  }

  /** Open a built-in pod: its key from the secrets (made on first use), its saved snapshot. */
  async _openBuiltin(rec) {
    const id = rec.id;
    if (!this.openBuiltin) { this._setStatus(id, 'error', 'this shell has no built-in pod engine'); return null; }
    let saved = null;
    try { saved = (await this.snapshots?.get(id)) ?? null; } catch { /* unreadable: as none */ }
    if (!this.secrets.has(POD_OWNER, keyName(id))) {
      if (saved !== null) {
        // The pod is on this device, sealed, and its key is in the sealed secrets: wait for
        // UNLOCK. With no sealed secrets the key is gone and the pod cannot be opened; it is
        // left as it is, not overwritten.
        if (this.secrets.hasSealed()) this._setStatus(id, 'locked', 'UNLOCK the session to open it');
        else this._setStatus(id, 'error', 'the saved pod cannot be opened: its key is not on this device');
        return null;
      }
      const put = this.secrets.put(POD_OWNER, keyName(id), randomKeyHex());
      if (!put.ok) { this._setStatus(id, 'error', `no key could be held (${put.reason})`); return null; }
      this.secrets.flush?.();
    }
    const used = await this.secrets.use(POD_OWNER, keyName(id), (storageKey) => this.openBuiltin({
      storageKey, snapshot: saved,
      onSnapshot: (s) => { const l = this.live.get(id); if (l) l.snapshot = s; this._keep(id, s); },
    }));
    if (!used.ok) { this._setStatus(id, 'error', 'the built-in pod did not open'); return null; }
    return used.result;
  }

  _keep(id, snapshot) {
    if (!this.secrets.sealed || !this.snapshots || snapshot == null) return;
    Promise.resolve(this.snapshots.put(id, snapshot)).catch(() =>
      this._say('pods.refused', { summary: `pod ${id} could not be written to this browser`, id, reason: 'not-kept' }));
  }

  _keepBuiltins() {
    for (const r of this.pods.values()) {
      if (r.carriage === 'builtin') this._keep(r.id, this.live.get(r.id)?.snapshot ?? this.live.get(r.id)?.conn?.snapshot?.());
    }
  }

  // A pod waiting for its login, and one the person was signed in to, open again by themselves.
  _afterUnlock() {
    for (const r of this.pods.values()) {
      const held = this.secrets.has(POD_OWNER, loginName(r));
      if ((r.carriage === 'builtin' && this.status(r.id) === 'locked') || (held && (r.auto || this.status(r.id) === 'locked'))) {
        this.connect(r.id).catch(() => {});
      }
    }
  }

  async disconnect(id, { quiet = false } = {}) {
    this.indexes.delete(id);         // built again on the next search, so changes made elsewhere show
    this.usage.delete(id);           // measured again at the next write
    const l = this.live.get(id);
    if (l) {
      try { l.conn?.close(); } catch { /* gone */ }
      this.live.delete(id);
    }
    if (quiet) return;
    // The person chose this, so unlocking must not connect it again.
    const rec = this.pods.get(id);
    if (rec?.auto) { rec.auto = false; this._save(); }
    if (l) this._setStatus(id, 'offline');
  }

  /**
   * The shell's own fetch to a connected pod (the Pods window, the storage backend). Never
   * handed to an app: an app gets `invoke`, which is aimed by its grant.
   */
  fetchFor(id) {
    const l = this.live.get(id);
    return l?.status === 'online' ? l.fetch : null;
  }

  // ── grants and the app verbs ──────────────────────────────────────────

  /**
   *   pods.grant('notes', { 'pod:read': { pod: 'home' }, 'pod:write': { pod: 'home', prefix: 'apps/notes/' } })
   * The prefix defaults to `apps/<appId>/`. Checked here, so a bad manifest fails at boot.
   */
  grant(appId, scopes = {}) {
    const box = new Map();
    for (const [cap, scope] of Object.entries(scopes)) {
      if (cap !== 'pod:read' && cap !== 'pod:write') throw new Error(`pods: unknown capability ${cap}`);
      if (!this.pods.has(scope?.pod)) throw new Error(`pods: ${cap} names no known pod (${scope?.pod})`);
      const prefix = scope.prefix == null ? `apps/${appId}/` : String(scope.prefix);
      const clean = prefix === '' ? '' : cleanPath(prefix);
      if (clean === null) throw new Error(`pods: ${cap} prefix "${prefix}" is not a clean path`);
      box.set(cap, Object.freeze({ pod: scope.pod, prefix: clean ? clean + '/' : '' }));
    }
    this.grants.set(appId, box);
    return this;
  }

  revoke(appId) { this.grants.delete(appId); return this; }

  /**
   * With a handle: an extra pod of this app, at the app's own prefix. It needs the same
   * capability on the shared pod, so an extra pod never gives an app more verbs, and no shared
   * pod means no pod at all.
   */
  scopeFor(appId, cap, handle = null) {
    const common = this.grants.get(appId)?.get(cap) || null;
    if (handle === null) return common;
    const pod = common && this.extras.get(appId)?.get(handle);
    return pod ? Object.freeze({ pod, prefix: `apps/${appId}/` }) : null;
  }

  // ── extra pods: one app, one more pod, chosen by the person ───────────
  // Called only from the System app. No app verb reaches grantExtra or revokeExtra, and none must.

  /** Give one app an extra pod. Returns its handle (the same one if it has this pod already). */
  grantExtra(appId, pod) {
    if (!this.pods.has(pod)) throw new Error(`no pod "${pod}"`);
    if (pod === this.appsPod()) throw new Error('that is the shared pod: every app has it already');
    if (typeof appId !== 'string' || appId.includes('/') || cleanPath(appId) !== appId) throw new Error('pods: not an app id');
    const box = this.extras.get(appId) || new Map();
    for (const [handle, id] of box) if (id === pod) return handle;
    // Random, and per app: two apps with one extra pod cannot tell that it is the same pod.
    const handle = `extra-${randomKeyHex().slice(0, 16)}`;
    box.set(handle, pod);
    this.extras.set(appId, box);
    this._saveExtras();
    this._say('pods.updated', { summary: `${appId} may now use pod ${pod}`, id: pod, appId });
    return handle;
  }

  revokeExtra(appId, handle) {
    const box = this.extras.get(appId);
    const pod = box?.get(handle);
    if (!pod) return;
    box.delete(handle);
    if (!box.size) this.extras.delete(appId);
    this._saveExtras();
    this._say('pods.updated', { summary: `${appId} may no longer use pod ${pod}`, id: pod, appId });
  }

  /** Every extra grant, with pod ids. For the System app; never for an app. */
  extraGrants() {
    const out = [];
    for (const [appId, box] of this.extras) for (const [handle, pod] of box) out.push({ appId, handle, pod });
    return out;
  }

  /** All that an app may know of its extra pods: a handle, and what it may do. */
  extrasFor(appId) {
    const box = this.grants.get(appId);
    if (!box?.size) return [];
    return [...(this.extras.get(appId)?.keys() || [])].map((handle) => ({ handle, read: box.has('pod:read'), write: box.has('pod:write') }));
  }

  // ── one file, shared with one window ──────────────────────────────────
  // Exploring: docs/foafos-open-with-20261105.md. A share is apart from an app's
  // grants: it adds one file, and takes nothing else from the app's own scope.

  /** Offer one file to the next window of an app to ask. Returns the token. */
  offerShare(appId, { pod, path, write = false }) {
    const clean = cleanPath(String(path ?? ''));
    if (clean === null || clean === '' || !this.pods.has(pod)) throw new Error('pods: a share needs a pod and a file path');
    const token = crypto.randomUUID();
    this.offers.push({ token, appId, pod, path: clean, write: !!write, name: clean.split('/').pop(), holder: null, window: null });
    return token;
  }

  /** The shell has opened the window this offer is for: only that one may take it. */
  bindOffer(token, window) {
    const s = this.offers.find((x) => x.token === token);
    if (s) s.window = window;
  }

  /** A window of an app takes what was offered to it, or nothing. */
  claimShare(appId, holder) {
    if (holder == null) return null;
    // A window that reloads asks again, and keeps what it had.
    for (const s of this.shares.values()) if (s.appId === appId && s.holder === holder) return { token: s.token, name: s.name, write: s.write };
    const i = this.offers.findIndex((s) => s.appId === appId && (s.window === null || s.window === holder));
    if (i < 0) return null;
    const [s] = this.offers.splice(i, 1);
    s.holder = holder;
    this.shares.set(s.token, s);
    this._say('pods.shared', { summary: `${appId} has ${s.name}${s.write ? '' : ', to read'}`, appId, pod: s.pod });
    return { token: s.token, name: s.name, write: s.write };
  }

  cancelOffer(token) { this.offers = this.offers.filter((s) => s.token !== token); }

  /** These windows have closed: what they held ends. */
  endShares(holders) {
    for (const [token, s] of this.shares) if (holders.includes(s.holder)) this.shares.delete(token);
  }

  /** Who may reach which pod, and where. For the Pods window. */
  holders() {
    const out = [];
    for (const [appId, box] of this.grants) for (const [cap, s] of box) out.push({ appId, capability: cap, pod: s.pod, prefix: s.prefix });
    return out;
  }

  _throttled(appId, verb) {
    const key = `${appId}|${verb}`;
    const t = this.now();
    const recent = (this.calls.get(key) || []).filter((ts) => t - ts < 60_000);
    if (recent.length >= this.perMinute) { this.calls.set(key, recent); return true; }
    recent.push(t);
    this.calls.set(key, recent);
    return false;
  }

  _refuse(appId, verb, reason, summary, extra = {}) {
    this._say('pods.refused', { summary, appId, verb, reason, ...extra });
    const { pod, ...forApp } = extra;   // the shell's log names the pod; the app's answer does not
    return { ok: false, reason, ...forApp };
  }

  /** The target path inside the scope, or null. `container` keeps a trailing "/". */
  static target(scope, path, { container = false } = {}) {
    const raw = String(path ?? '');
    if (raw === '' || raw === '/') return container ? scope.prefix : null;
    const clean = cleanPath(raw);
    if (clean === null) return null;
    const isDir = raw.endsWith('/');
    if (isDir && !container) return null;
    return scope.prefix + clean + (container ? '/' : '');
  }

  /**
   * Run one verb for one app. Every check that needs no network is made first.
   * Results carry the HTTP status, and for reads the body as text; never a URL or a header
   * other than ETag and Content-Type.
   */
  async invoke(appId, verb, params = {}, { holder = null } = {}) {
    const cap = POD_VERBS[verb];
    if (!cap) return this._refuse(appId, verb, 'unknown-verb', `${appId} asked for unknown verb "${verb}"`);
    // One shared file reaches that file only, whatever path the app sends.
    let shared = null;
    if (params.share !== undefined) {
      shared = this.shares.get(params.share) ?? null;
      if (!shared || shared.appId !== appId || shared.holder !== holder) return this._refuse(appId, verb, 'denied', `${appId} holds no such shared file`);
      if (verb !== 'pod.get' && verb !== 'pod.put' && verb !== 'pod.meta') return this._refuse(appId, verb, 'denied', `${appId} may only read or write a shared file`);
      if (verb === 'pod.put' && !shared.write) return this._refuse(appId, verb, 'read-only', `${shared.name} was shared with ${appId} to read`);
    }
    // `params.pod` is a handle. A pod's real id, another app's handle and nonsense all miss alike.
    const scope = shared ? { pod: shared.pod, prefix: '' } : this.scopeFor(appId, cap, params.pod ?? null);
    if (!scope) return this._refuse(appId, verb, 'denied', `${appId} may not "${verb}": no ${cap} grant`, { capability: cap });
    const path = shared ? shared.path : FoafPods.target(scope, params.path, { container: verb === 'pod.list' || verb === 'pod.search' });
    if (path === null) {
      return this._refuse(appId, verb, 'bad-params', `${appId}'s "${verb}" path was refused`,
        { detail: verb === 'pod.list' ? 'a container path, without ".."' : 'a resource path, without ".." and not ending in "/"' });
    }
    let body = null;
    if (verb === 'pod.put') {
      const bytes = asBytes(params.body);
      if (bytes) {
        if (bytes.byteLength > MAX_POD_BYTES) return this._refuse(appId, verb, 'too-large', `${appId}'s "pod.put" body is over ${MAX_POD_BYTES} bytes`);
        body = bytes.slice();                // a copy: the app's buffer is not the pod's
      } else {
        if (typeof params.body !== 'string') return this._refuse(appId, verb, 'bad-params', `${appId}'s "pod.put" body is not a string or bytes`, { detail: 'body must be a string, an ArrayBuffer or a typed array' });
        body = params.body;
        if (new TextEncoder().encode(body).length > MAX_POD_BODY) {
          return this._refuse(appId, verb, 'too-large', `${appId}'s "pod.put" body is over ${MAX_POD_BODY} bytes`);
        }
      }
    }
    if (this._throttled(appId, verb)) return this._refuse(appId, verb, 'throttled', `${appId} called "${verb}" more than ${this.perMinute} times in a minute`);
    let podFetch = this.fetchFor(scope.pod);
    // The built-in pod opens on first use: its engine is a large download. Device storage opens then too.
    if (!podFetch && ['builtin', 'device'].includes(this.pods.get(scope.pod)?.carriage) && ['offline', 'connecting'].includes(this.status(scope.pod))) {
      await this.connect(scope.pod);
      podFetch = this.fetchFor(scope.pod);
    }
    if (!podFetch && this.status(scope.pod) === 'locked') return this._refuse(appId, verb, 'locked', `${appId}'s "${verb}": pod ${scope.pod} is locked`, { pod: scope.pod });
    if (!podFetch && this.status(scope.pod) === 'needs-ok') return this._refuse(appId, verb, 'needs-ok', `${appId}'s "${verb}": pod ${scope.pod} needs the person's OK`, { pod: scope.pod });
    if (!podFetch) return this._refuse(appId, verb, 'offline', `${appId}'s "${verb}": pod ${scope.pod} is not connected`, { pod: scope.pod });

    const base = this.pods.get(scope.pod).base;
    this._say('pods.invoke', { summary: `${appId} → ${verb} ${path}`, appId, verb, path, pod: scope.pod });
    let result;
    try {
      // What a file says about itself (EXIF, ID3, PDF Info), as fields and Turtle. Through a share,
      // never the position: a photo shared with another app does not say where it was taken.
      if (verb === 'pod.meta') {
        const raw = path.includes('!/') ? await this._inArchive(podFetch, base, path, 'pod.get', { as: 'bytes' })
          : await this._run('pod.get', podFetch, base, path, { as: 'bytes' }, null);
        if (!raw.ok) result = raw;
        else {
          const m = readMetadata(new Uint8Array(raw.body));
          const withLocation = !shared;
          result = { ok: true, status: 200, kind: m.kind, fields: m.fields, location: withLocation ? m.location : null,
            ...(shared && m.location ? { locationRemoved: true } : {}),
            turtle: metadataTurtle(path.split('/').pop().replace(/!$/, ''), m, { withLocation }) };
        }
        this._say(result.ok ? 'pods.done' : 'pods.failed', { summary: `${appId}'s pod.meta ${path}: ${result.status ?? result.reason}`, appId, verb, path, status: result.status });
        return result;
      }
      // Inside an archive (`a.zip!/b/c.txt`): read-only, by the limits in archive.mjs.
      if (path.includes('!/')) {
        result = verb === 'pod.list' || verb === 'pod.get' ? await this._inArchive(podFetch, base, path, verb, params) : { ok: false, reason: 'read-only' };
        this._say(result.ok ? 'pods.done' : 'pods.failed', { summary: `${appId}'s ${verb} ${path}: ${result.status ?? result.reason}`, appId, verb, path, status: result.status });
        return result;
      }
      if (verb === 'pod.search') {
        // Results only under the asker's own scope (and the folder asked about), as paths relative to it.
        const { index, partial } = await this._index(scope.pod, podFetch, base);
        const hits = index.search(String(params.query || ''), { limit: Math.min(Number(params.limit) || 50, 200), keep: (p) => p.startsWith(path) });
        result = { ok: true, status: 200, partial, hits: hits.map((h) => ({ path: h.path.slice(scope.prefix.length), score: h.score, snippet: h.snippet })) };
        this._say('pods.done', { summary: `${appId}'s pod.search ${path}: ${hits.length} found`, appId, verb, path, status: 200 });
        return result;
      }
      const quota = this.pods.get(scope.pod)?.quota;
      let before = 0, after = 0;
      if (quota && (verb === 'pod.put' || verb === 'pod.delete')) {
        if (!this.usage.has(scope.pod)) this.usage.set(scope.pod, await this._measure(podFetch, base));
        before = await this._sizeOf(podFetch, base + encodePath(path));
        after = verb === 'pod.put' ? bodyBytes(body) : 0;
        const used = this.usage.get(scope.pod).used;
        if (verb === 'pod.put' && used - before + after > quota) {
          return this._refuse(appId, verb, 'quota', `${appId}'s "pod.put" ${path} would take pod ${scope.pod} over its space limit`,
            { used, quota, needs: after - before });
        }
      }
      if (verb === 'pod.put') await this._ensureContainers(podFetch, base, path);
      result = await this._run(verb, podFetch, base, path, params, body);
      // A photo read through a share leaves without its position (GPS emptied, XMP removed).
      if (shared && verb === 'pod.get' && result.ok && result.body instanceof ArrayBuffer) {
        const before = new Uint8Array(result.body);
        const after = withoutLocation(before);
        if (after.length !== before.length || after.some((v, i) => v !== before[i])) {
          result.body = after.buffer.slice(after.byteOffset, after.byteOffset + after.byteLength);
          result.locationRemoved = true;
        }
      }
      // A built index follows each write and delete through the shell.
      const built = result.ok && this.indexes.get(scope.pod);
      if (built && (verb === 'pod.put' || verb === 'pod.delete')) {
        const { index } = await built;
        if (verb === 'pod.put' && typeof body === 'string' && TEXTUAL.test(String(params.contentType || 'text/plain'))) index.put(path, body);
        else index.remove(path);
      }
      if (quota && result.ok && (verb === 'pod.put' || verb === 'pod.delete')) {
        const u = this.usage.get(scope.pod);
        u.used = Math.max(0, u.used - before + after);
        result.space = { used: u.used, quota };
        if (u.used >= quota * 0.9) {
          this._say('pods.quota', { summary: `pod ${scope.pod} is ${Math.round((100 * u.used) / quota)}% full`, pod: scope.pod, used: u.used, quota });
        }
      }
      // A folder's permission can end during a visit: that is a question for the person, not a failure.
      if (result.status === 403 && this.pods.get(scope.pod)?.carriage === 'device') {
        this._setStatus(scope.pod, 'needs-ok', 'allow access to this folder');
        result = { ok: false, reason: 'needs-ok', status: 403 };
      }
    } catch {
      // A failed fetch's message can carry a URL; report only that it failed.
      result = { ok: false, reason: 'unreachable' };
    }
    this._say(result.ok ? 'pods.done' : 'pods.failed', {
      summary: `${appId}'s ${verb} ${path}: ${result.status ?? result.reason}`, appId, verb, path, status: result.status,
    });
    return result;
  }

  /**
   * The pod's text index, built on first search: every textual resource up to MAX_POD_BODY,
   * found through the listings, at most 3000 files. Writes and deletes through the shell keep it
   * fresh; a change made elsewhere shows after the pod reconnects.
   */
  _index(podId, podFetch, base) {
    if (!this.indexes.has(podId)) {
      this.indexes.set(podId, (async () => {
        const index = new TextIndex();
        let partial = false, files = 0;
        const queue = [base];
        for (let seen = 0; queue.length; seen++) {
          if (seen >= 2000) { partial = true; break; }
          let url = queue.shift();
          for (let page = 0; url && page < MAX_LIST_PAGES; page++) {
            const r = await podFetch(url, { headers: { Accept: 'application/lws+json' } });
            if (!r.ok) break;
            const doc = await r.json();
            for (const it of doc.items || []) {
              const id = String(it.id || '');
              if (!id.startsWith(base)) continue;
              if (id.endsWith('/') || [].concat(it.type || []).some((t) => /Container$/.test(String(t)))) { queue.push(id); continue; }
              if (it.format && !TEXTUAL.test(String(it.format))) continue;
              if (Number(it.size) > MAX_POD_BODY) continue;
              if (++files > 3000) { partial = true; break; }
              const got = await podFetch(id, { headers: { Accept: 'text/*, application/*' } });
              const type = got.headers.get('content-type') || '';
              if (got.ok && TEXTUAL.test(type)) { if (!index.put(decodeURIComponent(id.slice(base.length)), await got.text())) partial = true; }
            }
            const next = nextPage(r.headers.get('link'), url);
            url = next && next.startsWith(base) ? next : null;
          }
        }
        return { index, partial };
      })());
    }
    return this.indexes.get(podId);
  }

  /**
   * List or read inside an archive, and archives within it, without writing anything. The outer
   * archive is fetched as bytes (at most ARCHIVE_LIMITS.archiveBytes) and kept, by its ETag, for
   * the next call; each inner archive is opened from its entry. Errors are reasons, not throws.
   */
  async _inArchive(podFetch, base, path, verb, params) {
    const parts = archiveParts(path);
    if (parts.length - 1 > ARCHIVE_LIMITS.depth) return { ok: false, reason: 'too-deep' };
    try {
      const url = base + encodePath(parts[0]);
      const r = await podFetch(url, { headers: { Accept: '*/*' } });
      if (!r.ok) return { ok: false, reason: 'http', status: r.status };
      if (Number(r.headers.get('content-length')) > ARCHIVE_LIMITS.archiveBytes) return { ok: false, reason: 'too-large' };
      const etag = r.headers.get('etag') || '';
      this.archives ??= new Map();
      let arc = etag && this.archives.get(url)?.etag === etag ? this.archives.get(url).arc : null;
      if (!arc) {
        arc = await openArchive(new Uint8Array(await r.arrayBuffer()));
        if (etag) { this.archives.set(url, { etag, arc }); if (this.archives.size > 8) this.archives.delete(this.archives.keys().next().value); }
      }
      for (const name of parts.slice(1, -1)) {
        const e = arc.entries.find((x) => x.name === name && !x.dir);
        if (!e) return { ok: false, reason: 'http', status: 404 };
        arc = await openArchive(await arc.read(e));
      }
      const inner = parts.at(-1);
      if (verb === 'pod.list') {
        if (inner && !inner.endsWith('/')) return { ok: false, reason: 'bad-params' };
        const items = listArchive(arc, inner).map((e) => (e.dir ? { path: e.name, container: true }
          : { path: e.name, container: false, size: e.size, contentType: typeOf(e.name) }));
        return { ok: true, status: 200, etag: `${etag}!${inner}`, items, readOnly: true };
      }
      const e = arc.entries.find((x) => x.name === inner && !x.dir);
      if (!e) return { ok: false, reason: 'http', status: 404 };
      const bytes = await arc.read(e);
      const type = typeOf(inner);
      if (params.as === 'bytes') return { ok: true, status: 200, contentType: type, etag: `${etag}!${inner}`, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), readOnly: true };
      if (!TEXTUAL.test(type)) return { ok: false, reason: 'not-text', status: 200, contentType: type };
      if (bytes.length > MAX_POD_BODY) return { ok: false, reason: 'too-large', status: 200 };
      return { ok: true, status: 200, contentType: type, etag: `${etag}!${inner}`, body: new TextDecoder().decode(bytes), readOnly: true };
    } catch (err) {
      return { ok: false, reason: err instanceof ArchiveError ? err.reason : 'bad-archive' };
    }
  }

  /** A resource's size now, from HEAD (0 if it is not there). */
  async _sizeOf(podFetch, url) {
    const r = await podFetch(url, { method: 'HEAD' });
    return r.ok ? Number(r.headers.get('content-length')) || 0 : 0;
  }

  /** Bytes in a pod: every container's listing sizes, summed (no request per file). */
  async _measure(podFetch, base, maxContainers = 2000) {
    let used = 0, seen = 0, partial = false;
    const queue = [base];
    while (queue.length) {
      if (++seen > maxContainers) { partial = true; break; }
      let url = queue.shift();
      for (let page = 0; url && page < MAX_LIST_PAGES; page++) {
        const r = await podFetch(url, { headers: { Accept: 'application/lws+json' } });
        if (!r.ok) break;
        const doc = await r.json();
        for (const it of doc.items || []) {
          const id = String(it.id || '');
          if (!id.startsWith(base)) continue;
          const container = id.endsWith('/') || [].concat(it.type || []).some((t) => /Container$/.test(String(t)));
          if (container) queue.push(id); else used += Number.isFinite(it.size) ? it.size : 0;
        }
        const next = nextPage(r.headers.get('link'), url);
        url = next && next.startsWith(base) ? next : null;
      }
    }
    return { used, partial };
  }

  async _ensureContainers(podFetch, base, path) {
    // LWS does not promise to create missing parents, so make each one, top down.
    const parts = path.split('/').slice(0, -1);
    let dir = '';
    for (const p of parts) {
      dir += p + '/';
      const head = await podFetch(base + encodePath(dir), { method: 'HEAD' });
      if (head.status === 404) {
        await podFetch(base + encodePath(dir), { method: 'PUT', headers: { Link: CONTAINER_LINK, 'Content-Type': 'text/turtle' } });
      }
    }
  }

  async _run(verb, podFetch, base, path, params, body) {
    const url = base + encodePath(path);
    if (verb === 'pod.get') {
      const r = await podFetch(url, { headers: { Accept: String(params.accept || '*/*') } });
      const type = r.headers.get('content-type') || '';
      if (r.status === 413) return { ok: false, reason: 'too-large', status: 413 };
      if (!r.ok) return { ok: false, reason: 'http', status: r.status };
      if (params.as === 'bytes') {
        const declared = Number(r.headers.get('content-length'));
        if (declared > MAX_POD_BYTES) return { ok: false, reason: 'too-large', status: r.status };
        const buf = await r.arrayBuffer();
        if (buf.byteLength > MAX_POD_BYTES) return { ok: false, reason: 'too-large', status: r.status };
        return { ok: true, status: r.status, contentType: type, etag: r.headers.get('etag'), body: buf };
      }
      if (!TEXTUAL.test(type)) return { ok: false, reason: 'not-text', status: r.status, contentType: type };
      const text = await r.text();
      if (text.length > MAX_POD_BODY) return { ok: false, reason: 'too-large', status: r.status };
      return { ok: true, status: r.status, contentType: type, etag: r.headers.get('etag'), body: text };
    }
    if (verb === 'pod.list') {
      const r = await podFetch(url, { headers: { Accept: 'application/lws+json' } });
      if (!r.ok) return { ok: false, reason: 'http', status: r.status };
      // A large container is listed in pages (LWS pagination: `CONTAINER?page=N`, a `next` link).
      // Every page is read, up to MAX_LIST_PAGES, so a folder of 101 items is not cut to 100.
      const docs = [await r.json()];
      // A next page must stay inside this pod: a link elsewhere would carry the pod's login with it.
      const inPod = (u) => (u && u.startsWith(base) ? u : null);
      let next = inPod(nextPage(r.headers.get('link'), url));
      while (next && docs.length < MAX_LIST_PAGES) {
        const pr = await podFetch(next, { headers: { Accept: 'application/lws+json' } });
        if (!pr.ok) break;
        docs.push(await pr.json());
        next = inPod(nextPage(pr.headers.get('link'), next));
      }
      // Relative to the scope's prefix: the app learns its own paths, not the pod's address.
      // Size, type and modification time come through where the storage gives them.
      const root = base + encodePath(path);
      const items = docs.flatMap((doc) => doc.items || []).map((it) => {
        const id = String(it.id || '');
        const rel = id.startsWith(root) ? decodeURIComponent(id.slice(root.length)) : null;
        if (rel === null) return null;
        const types = [].concat(it.type || []);
        const item = { path: rel, container: rel.endsWith('/') || types.some((t) => /Container$/.test(String(t))) };
        if (Number.isFinite(it.size)) item.size = it.size;
        if (typeof it.format === 'string') item.contentType = it.format;
        if (typeof it.modified === 'string') item.modified = it.modified;
        return item;
      }).filter(Boolean);
      return { ok: true, status: r.status, etag: r.headers.get('etag'), items, ...(next ? { truncated: true } : {}) };
    }
    if (verb === 'pod.put') {
      const headers = { 'Content-Type': String(params.contentType || 'text/plain') };
      if (params.etag) headers['If-Match'] = String(params.etag);
      else if (params.ifNoneMatch) headers['If-None-Match'] = '*';
      const r = await podFetch(url, { method: 'PUT', headers, body });
      if (r.status === 412) return { ok: false, reason: 'conflict', status: 412 };
      if (!r.ok) return { ok: false, reason: 'http', status: r.status };
      return { ok: true, status: r.status, etag: r.headers.get('etag') };
    }
    if (verb === 'pod.delete') {
      const headers = params.etag ? { 'If-Match': String(params.etag) } : {};
      const r = await podFetch(url, { method: 'DELETE', headers });
      if (r.status === 412) return { ok: false, reason: 'conflict', status: 412 };
      if (!r.ok) return { ok: false, reason: 'http', status: r.status };
      return { ok: true, status: r.status };
    }
    return { ok: false, reason: 'unknown-verb' };
  }
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
