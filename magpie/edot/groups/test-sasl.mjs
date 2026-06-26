// test-sasl.mjs — SASL correctness. SCRAM-SHA-1 is checked against the canonical
// RFC 5802 §5 test vector (username "user", password "pencil"), so we KNOW the
// authentication crypto is exact even though no live server is reachable here.
import { ScramSha1, plainResponse } from './js/sasl.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

// PLAIN: base64( \0 user \0 pencil ) — known value.
ok('PLAIN response matches the known base64', plainResponse('user', 'pencil') === 'AHVzZXIAcGVuY2ls');

// SCRAM-SHA-1 — RFC 5802 §5 worked example.
const cnonce = 'fyko+d2lbbFgONRv9qkxdawL';
const scram = new ScramSha1('user', 'pencil', cnonce);
ok('SCRAM client-first message is correct', scram.clientFirstMessage() === 'n,,n=user,r=fyko+d2lbbFgONRv9qkxdawL');

const serverFirst = 'r=fyko+d2lbbFgONRv9qkxdawL3rfcNHYJY1ZVvWVs7j,s=QSXCR+Q6sek8bf92,i=4096';
const clientFinal = await scram.clientFinal(serverFirst);
ok('SCRAM client-final has channel binding + full nonce',
  /^c=biws,r=fyko\+d2lbbFgONRv9qkxdawL3rfcNHYJY1ZVvWVs7j,p=/.test(clientFinal));
ok('SCRAM client proof matches the RFC 5802 vector',
  clientFinal.endsWith('p=v0X8v3Bz2T0CJGbJQyF0X+HI4Ts='));
ok('SCRAM verifies the server signature (RFC 5802 vector)',
  scram.verifyServerFinal('v=rmF9pqV8S7suAoZWja4dJRkFsKQ='));
ok('SCRAM rejects a wrong server signature', !scram.verifyServerFinal('v=AAAApqV8S7suAoZWja4dJRkFsKQ='));

// A tampered server nonce (doesn't start with our cnonce) is rejected.
let rejected = false;
try { await new ScramSha1('user', 'pencil', cnonce).clientFinal('r=EVILnonce,s=QSXCR+Q6sek8bf92,i=4096'); }
catch { rejected = true; }
ok('SCRAM rejects a server nonce that does not extend the client nonce', rejected);

console.log(fail ? `\n${fail} SASL FAILURE(S)` : '\nSASL OK');
process.exit(fail ? 1 : 0);
