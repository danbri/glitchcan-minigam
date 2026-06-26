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

// The shared singleton seeds a real local OPFS account with no login.
const g = getConnections();
const dev = g.get('device');
ok('the singleton seeds a local "device" account (OPFS)', !!dev && dev.provider === 'opfs' && dev.isLocal === true && dev.requiresAuth === false);
ok('the device account offers storage and yields a ResourceSource', dev.offers.includes('storage') && g.storageFor('device') && g.storageFor('device').capability === 'storage');

console.log(fail ? `\n${fail} CONNECTIONS FAILURE(S)` : '\nCONNECTIONS OK');
process.exit(fail ? 1 : 0);
