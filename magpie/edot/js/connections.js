// connections.js — the ONE place that manages Accounts (axis 4 of the storage/
// identity model). An Account is a connection to a provider that offers some
// capabilities (storage / mail / calendar / chat / people / vcs). The suite asks
// here for "a place to save a file" or "my mail accounts" instead of each app
// keeping its own backend registry.
//
// Seeded with a zero-config LOCAL account backed by OPFS, so there is always a
// real working place to store things with no login. Remote accounts (GitHub,
// WebDAV, S3, Solid, Gmail…) are added as the user connects them.

import { getKernel } from './edot-kernel.js';
import { OpfsResourceSource, makeAccount } from './resource-source.js';
import { PROVIDERS } from './ontology.js';

export class Connections {
  constructor() { this._accounts = new Map(); this._wired = false; this._session = null; }

  // Add an account. `sources` maps a capability name to its live adapter
  // (e.g. { storage: <ResourceSource> }). Returns the account.
  add({ id, provider, label, identity = null, sources = {} }) {
    const acct = makeAccount({ provider, identity, sources });
    acct.id = id;
    acct.label = label || (PROVIDERS[provider] && PROVIDERS[provider].label) || provider;
    this._accounts.set(id, acct);
    try { if (this._wired) getKernel().bus.publish('connections:changed', { id }); } catch (_) {}
    return acct;
  }
  remove(id) { this._accounts.delete(id); try { if (this._wired) getKernel().bus.publish('connections:changed', { id }); } catch (_) {} }
  list() { return [...this._accounts.values()]; }
  get(id) { return this._accounts.get(id) || null; }
  // Accounts that offer a given capability — "where could I save this file?".
  withCapability(cap) { return this.list().filter((a) => a.offers.includes(cap)); }
  // The storage mount for an account (or null if it offers no storage).
  storageFor(id) { const a = this.get(id); return a ? a.capability('storage') : null; }
  // The live adapter for any capability of an account (storage/mail/calendar/…).
  capabilityFor(id, cap) { const a = this.get(id); return a ? a.capability(cap) : null; }

  // ---- Identity axis (OIDC / PKCE sign-ins) -----------------------------
  // Signed-in OIDC identities (held by auth/js/session.js) ARE axis 1 of the
  // storage/identity model. They are not themselves capability-bearing accounts,
  // but they BACK accounts: a platform account (GitHub, Gmail, Graph) is "this
  // identity, at this provider". Attaching the AuthSession surfaces those
  // identities here and bridges its change events onto connections:changed, so a
  // single bus topic drives every Connections view. Kept guarded/lazy: the pure
  // Node tests never attach a session, and identities() just returns [].
  attachIdentities(session) {
    if (!session) return this;
    this._session = session;
    try {
      session.addEventListener('change', () => {
        try { if (this._wired) getKernel().bus.publish('connections:changed', { reason: 'identities' }); } catch (_) {}
      });
    } catch (_) {}
    try { if (this._wired) getKernel().bus.publish('connections:changed', { reason: 'identities' }); } catch (_) {}
    return this;
  }
  _identityView(a) { return a ? { key: a.key, sub: a.sub, provider: a.provider, providerName: a.providerName, name: a.name, email: a.email, picture: a.picture } : null; }
  // The signed-in identities ([] when no identity layer is attached).
  identities() {
    if (!this._session) return [];
    try { const act = this._session.activeSub; return this._session.list().map((a) => ({ ...this._identityView(a), active: a.key === act })); } catch (_) { return []; }
  }
  // The active identity (the "current user"), or null.
  activeIdentity() { if (!this._session) return null; try { return this._identityView(this._session.active()); } catch (_) { return null; } }

  // Expose a read-only view + a storage handle over the kernel so any app (and
  // Automations) can discover connections and reach a storage mount by id.
  wireKernel() {
    if (this._wired) return; this._wired = true;
    const k = getKernel();
    k.capabilities.provide('connections.list', (filter = {}) => {
      const accts = filter && filter.capability ? this.withCapability(filter.capability) : this.list();
      return accts.map((a) => ({ id: a.id, label: a.label, provider: a.provider, offers: a.offers, isLocal: a.isLocal, requiresAuth: a.requiresAuth }));
    });
    k.capabilities.provide('storage.source', ({ id } = {}) => this.storageFor(id));
    // Any capability's live adapter (mail/calendar/chat/people) by account id.
    k.capabilities.provide('connections.capability', ({ id, capability } = {}) => this.capabilityFor(id, capability));
    // The Identity axis: who is signed in (OIDC), and the current user.
    k.capabilities.provide('connections.identities', () => this.identities());
    k.capabilities.provide('connections.activeIdentity', () => this.activeIdentity());
  }
}

let _connections = null;
export function getConnections() {
  if (!_connections) {
    _connections = new Connections();
    // The always-available local account: OPFS, no login, real persistence.
    _connections.add({ id: 'device', provider: 'opfs', label: 'This app’s storage', sources: { storage: new OpfsResourceSource({ id: 'device' }) } });
    _connections.wireKernel();
    // Wire the OIDC identity layer when running in a browser. AuthSession's
    // constructor touches web storage / BroadcastChannel (absent in pure-Node
    // tests), so import + instantiate it lazily and only behind a window check.
    if (typeof window !== 'undefined') {
      import('../auth/js/session.js')
        .then(({ getAuthSession }) => { try { _connections.attachIdentities(getAuthSession()); } catch (_) {} })
        .catch(() => {});
    }
  }
  return _connections;
}
