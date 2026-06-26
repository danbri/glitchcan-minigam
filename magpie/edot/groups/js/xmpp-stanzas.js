// xmpp-stanzas.js — XML stanza builders for a MIX-based groupchat client.
//
// MIX (Mediated Information eXchange) is the modern successor to MUC — the
// "future of MUCs". We target the current draft family:
//   XEP-0369 MIX-CORE   urn:xmpp:mix:core:1
//   XEP-0405 MIX-PAM    urn:xmpp:mix:pam:2   (join/leave via your own server)
//   nodes: messages / participants / info
//
// These are pure string builders (no DOM, no network) so the protocol layer is
// unit-testable and identical whether it runs over a real WebSocket or the
// loopback transport used for the offline demo. Callers pass ids so output is
// deterministic (no Date.now()/random in here).

export const NS = {
  CORE: 'urn:xmpp:mix:core:1',
  PAM: 'urn:xmpp:mix:pam:2',
  NODE_MESSAGES: 'urn:xmpp:mix:nodes:messages',
  NODE_PARTICIPANTS: 'urn:xmpp:mix:nodes:participants',
  NODE_INFO: 'urn:xmpp:mix:nodes:info',
  CLIENT: 'jabber:client',
};

export function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
const attr = (k, v) => (v == null ? '' : ` ${k}='${xmlEscape(v)}'`);

// Join a MIX channel through the user's own server (XEP-0405). Subscribes to the
// messages + participants nodes by default.
export function joinChannel({ id, channel, nick, nodes = [NS.NODE_MESSAGES, NS.NODE_PARTICIPANTS] }) {
  const subs = nodes.map((n) => `<subscribe node='${xmlEscape(n)}'/>`).join('');
  const nickEl = nick ? `<nick>${xmlEscape(nick)}</nick>` : '';
  return `<iq type='set'${attr('id', id)}>`
    + `<client-join xmlns='${NS.PAM}'${attr('channel', channel)}>`
    + `<join xmlns='${NS.CORE}'>${subs}${nickEl}</join>`
    + `</client-join></iq>`;
}

// Leave a MIX channel (XEP-0405).
export function leaveChannel({ id, channel }) {
  return `<iq type='set'${attr('id', id)}>`
    + `<client-leave xmlns='${NS.PAM}'${attr('channel', channel)}>`
    + `<leave xmlns='${NS.CORE}'/>`
    + `</client-leave></iq>`;
}

// Create a MIX channel on a MIX service (XEP-0369). Omit name for an ad-hoc channel.
export function createChannel({ id, service, channel }) {
  return `<iq type='set'${attr('to', service)}${attr('id', id)}>`
    + `<create xmlns='${NS.CORE}'${attr('channel', channel)}/></iq>`;
}

// A groupchat message to a MIX channel. Body is the text; an optional structured
// payload (e.g. a shared calendar/feed) rides along as a child element.
export function groupMessage({ id, channel, body, from, payloadXml = '' }) {
  return `<message${attr('to', channel)}${attr('from', from)} type='groupchat'${attr('id', id)} xmlns='${NS.CLIENT}'>`
    + `<body>${xmlEscape(body)}</body>${payloadXml}</message>`;
}

// Request the participant list (a pubsub items request on the participants node).
export function requestParticipants({ id, channel }) {
  return `<iq type='get'${attr('to', channel)}${attr('id', id)}>`
    + `<pubsub xmlns='http://jabber.org/protocol/pubsub'><items node='${NS.NODE_PARTICIPANTS}'/></pubsub></iq>`;
}

// SASL/initial presence after binding — minimal availability presence.
export function presenceAvailable({ id } = {}) {
  return `<presence${attr('id', id)}/>`;
}
