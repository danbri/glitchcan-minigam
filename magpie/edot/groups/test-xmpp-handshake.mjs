// test-xmpp-handshake.mjs — the XMPP-over-WebSocket login state machine driven
// against a SCRIPTED server. Uses the RFC 5802 SCRAM vector so the bytes the
// client would put on the wire are provably correct. This is how the "live"
// path is verified without a reachable server.
import { XmppHandshake } from './js/xmpp-handshake.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8');

const h = new XmppHandshake({ jid: 'user@example.com', password: 'pencil', domain: 'example.com', nonceFn: () => 'fyko+d2lbbFgONRv9qkxdawL' });

// 1) open
const open = h.start();
ok('opens the stream with RFC 7395 framing', /<open xmlns='urn:ietf:params:xml:ns:xmpp-framing' to='example.com'/.test(open[0]));

// 2) pre-auth features advertising SCRAM-SHA-1 → client sends <auth>
let r = await h.receive("<stream:features><mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl'><mechanism>SCRAM-SHA-1</mechanism><mechanism>PLAIN</mechanism></mechanisms></stream:features>");
ok('chooses SCRAM-SHA-1 and sends <auth>', /<auth [^>]*mechanism='SCRAM-SHA-1'>/.test(r.out[0]));
const authPayload = unb64(/<auth[^>]*>([^<]+)<\/auth>/.exec(r.out[0])[1]);
ok('auth payload is the SCRAM client-first message', authPayload === 'n,,n=user,r=fyko+d2lbbFgONRv9qkxdawL');

// 3) server challenge (RFC 5802 server-first) → client sends <response> with proof
const serverFirst = 'r=fyko+d2lbbFgONRv9qkxdawL3rfcNHYJY1ZVvWVs7j,s=QSXCR+Q6sek8bf92,i=4096';
r = await h.receive(`<challenge xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>${b64(serverFirst)}</challenge>`);
const respPayload = unb64(/<response[^>]*>([^<]+)<\/response>/.exec(r.out[0])[1]);
ok('SCRAM response carries the RFC 5802 client proof', respPayload.endsWith('p=v0X8v3Bz2T0CJGbJQyF0X+HI4Ts='));

// 4) server success (with server signature) → authenticated, restart stream
r = await h.receive(`<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'>${b64('v=rmF9pqV8S7suAoZWja4dJRkFsKQ=')}</success>`);
ok('verifies server signature and reports authenticated', r.event === 'authenticated');
ok('restarts the stream after auth', /<open xmlns='urn:ietf:params:xml:ns:xmpp-framing'/.test(r.out[0]));

// 5) post-auth features with bind → client sends bind iq
r = await h.receive("<stream:features><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'/></stream:features>");
ok('requests resource binding', /<bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>edot<\/resource>/.test(r.out[0]));

// 6) bind result → ready + presence
r = await h.receive("<iq type='result' id='bind1'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><jid>user@example.com/edot</jid></bind></iq>");
ok('binds the full JID and becomes ready', r.event === 'ready' && r.jid === 'user@example.com/edot');
ok('sends initial presence when ready', /<presence\/>/.test(r.out[0]));

// failure path
const h2 = new XmppHandshake({ jid: 'u@x', password: 'bad', domain: 'x', nonceFn: () => 'n' });
h2.start();
await h2.receive("<stream:features><mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl'><mechanism>SCRAM-SHA-1</mechanism></mechanisms></stream:features>");
const fr = await h2.receive("<failure xmlns='urn:ietf:params:xml:ns:xmpp-sasl'><not-authorized/></failure>");
ok('reports SASL failure with a reason', fr.event === 'failure' && /not-authorized/.test(fr.error));

console.log(fail ? `\n${fail} HANDSHAKE FAILURE(S)` : '\nXMPP-HANDSHAKE OK');
process.exit(fail ? 1 : 0);
