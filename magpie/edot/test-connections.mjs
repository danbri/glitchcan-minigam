// test-connections.mjs — the Connections registry: the one place that manages
// accounts and their capabilities. Pure Node (uses MemoryResourceSource).
import { Connections, getConnections } from './js/connections.js';
import { MemoryResourceSource } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const c = new Connections();
const mem = new MemoryResourceSource({ provider: 'webdav' });
const acct = c.add({ id: 'work', provider: 'webdav', label: 'Work WebDAV', sources: { storage: mem } });
ok('add returns an account with provider metadata', acct.id === 'work' && acct.requiresAuth === true && acct.isLocal === false);
ok('get + list expose the account', c.get('work') === acct && c.list().length === 1);
ok('storageFor returns the account\'s storage mount', c.storageFor('work') === mem);
ok('withCapability filters by offered capability', c.withCapability('storage').length === 1 && c.withCapability('mail').length === 0);
c.remove('work');
ok('remove drops the account', c.get('work') === null && c.list().length === 0);

// Multi-capability service accounts (the "future of MUCs" XMPP/MIX shape): one
// account offering chat + people + calendar + storage, each a live adapter.
const chatAdapter = { kind: 'chat' }, rosterAdapter = { kind: 'people' };
const grp = c.add({ id: 'team', provider: 'xmpp', label: 'Team MIX', sources: { chat: chatAdapter, people: rosterAdapter } });
ok('a groupware account offers many capabilities at once', grp.offers.includes('chat') && grp.offers.includes('people') && grp.offers.includes('calendar') && grp.offers.includes('storage'));
ok('capabilityFor returns the live adapter for a capability', c.capabilityFor('team', 'chat') === chatAdapter && c.capabilityFor('team', 'people') === rosterAdapter);
ok('capabilityFor is null for a capability with no adapter wired', c.capabilityFor('team', 'calendar') === null);
ok('withCapability finds the account under each capability', c.withCapability('chat')[0] === grp && c.withCapability('people')[0] === grp);
c.remove('team');

// The Identity axis: signed-in OIDC identities (from AuthSession) surface here.
// A tiny fake session stands in for auth/js/session.js (no web storage in Node).
ok('with no identity layer attached, identities() is empty', c.identities().length === 0 && c.activeIdentity() === null);
const fakeSession = (() => {
  const listeners = [];
  const accts = [
    { key: 'google:111', sub: '111', provider: 'google', providerName: 'Google', name: 'Ada', email: 'ada@example.com', picture: null },
    { key: 'gitlab:222', sub: '222', provider: 'gitlab', providerName: 'GitLab', name: 'Ada L', email: 'ada@git.example', picture: null },
  ];
  return {
    activeSub: 'gitlab:222',
    list() { return accts.slice(); },
    active() { return accts.find((a) => a.key === this.activeSub); },
    addEventListener(_t, fn) { listeners.push(fn); },
    _fire() { listeners.forEach((fn) => fn()); },
  };
})();
c.attachIdentities(fakeSession);
ok('attached identities surface as the Identity axis', c.identities().length === 2 && c.identities()[0].provider === 'google');
ok('identities mark the active (current user)', c.identities().find((i) => i.active).key === 'gitlab:222');
ok('activeIdentity is the signed-in current user', c.activeIdentity().name === 'Ada L' && c.activeIdentity().provider === 'gitlab');

// The shared singleton seeds a real local OPFS account with no login.
const g = getConnections();
const dev = g.get('device');
ok('the singleton seeds a local "device" account (OPFS)', !!dev && dev.provider === 'opfs' && dev.isLocal === true && dev.requiresAuth === false);
ok('the device account offers storage and yields a ResourceSource', dev.offers.includes('storage') && g.storageFor('device') && g.storageFor('device').capability === 'storage');

console.log(fail ? `\n${fail} CONNECTIONS FAILURE(S)` : '\nCONNECTIONS OK');
process.exit(fail ? 1 : 0);
