// test-xmpp-stanzas.mjs — MIX stanza builders (XEP-0369/0405). Pure Node: assert
// the wire XML is spec-correct (namespaces, elements, escaping). This is the part
// that MUST be right to talk to a real server, so it's tested independently of
// the (unverifiable-here) live connection.
import { joinChannel, leaveChannel, createChannel, groupMessage, requestParticipants, publishItem, NS } from './js/xmpp-stanzas.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const join = joinChannel({ id: 'j1', channel: 'coven@mix.example', nick: 'thirdwitch' });
ok('join uses MIX-PAM client-join with the channel', /<client-join xmlns='urn:xmpp:mix:pam:2' channel='coven@mix.example'>/.test(join));
ok('join wraps a MIX-CORE join', new RegExp(`<join xmlns='${NS.CORE}'>`).test(join));
ok('join subscribes to messages + participants nodes', /node='urn:xmpp:mix:nodes:messages'/.test(join) && /node='urn:xmpp:mix:nodes:participants'/.test(join));
ok('join carries the nick', /<nick>thirdwitch<\/nick>/.test(join));

const leave = leaveChannel({ id: 'l1', channel: 'coven@mix.example' });
ok('leave uses MIX-PAM client-leave + MIX-CORE leave', /<client-leave xmlns='urn:xmpp:mix:pam:2' channel='coven@mix.example'><leave xmlns='urn:xmpp:mix:core:1'\/>/.test(leave));

const create = createChannel({ id: 'c1', service: 'mix.example', channel: 'coven' });
ok('create targets the MIX service and names the channel', /to='mix.example'/.test(create) && /<create xmlns='urn:xmpp:mix:core:1' channel='coven'\/>/.test(create));

const msg = groupMessage({ id: 'm1', channel: 'coven@mix.example', from: 'hag66@example', body: 'Hail & <farewell>' });
ok('groupchat message has type=groupchat to the channel', /type='groupchat'/.test(msg) && /to='coven@mix.example'/.test(msg));
ok('message body is XML-escaped', /<body>Hail &amp; &lt;farewell&gt;<\/body>/.test(msg));

const msgP = groupMessage({ id: 'm2', channel: 'c@x', body: 'hi', payloadXml: "<edot-share xmlns='urn:edot:share'/>" });
ok('message carries an optional structured payload', /<edot-share xmlns='urn:edot:share'\/>/.test(msgP));

const parts = requestParticipants({ id: 'p1', channel: 'coven@mix.example' });
ok('participant request is a pubsub items query on the participants node', /<pubsub xmlns='http:\/\/jabber.org\/protocol\/pubsub'><items node='urn:xmpp:mix:nodes:participants'\/>/.test(parts));

// Publish a shared calendar event to the MIX events node (XEP-0060 publish).
const pub = publishItem({ id: 'pub1', channel: 'coven@mix.example', node: NS.NODE_EVENTS, itemId: 'ev-1', payloadXml: "<event xmlns='urn:edot:mix:event'>{}</event>" });
ok('publishItem is a pubsub publish IQ to the channel', /type='set'/.test(pub) && /to='coven@mix.example'/.test(pub));
ok('publishItem targets the events node with an item id + payload', /<publish node='urn:edot:mix:nodes:events'><item id='ev-1'><event xmlns='urn:edot:mix:event'>\{\}<\/event><\/item>/.test(pub));

console.log(fail ? `\n${fail} STANZA FAILURE(S)` : '\nXMPP-STANZAS OK');
process.exit(fail ? 1 : 0);
