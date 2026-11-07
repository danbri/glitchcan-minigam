// Pod servers this site knows, so a person does not have to remember an address. Content, not
// platform: another site lists its own. Addresses only: never an account, a password or a token.
//
// `ways` lists only what the server really accepts. On this one, HTTPS takes a bearer token and
// nothing else (Caddy holds the token), and XMPP takes an account on the server, which must also
// be on the pod's --allow list. Both reach the same files. Source:
// https://github.com/danbri/factoidal-core/tree/main/deploy/foafos-xmpp
// Design: docs/foafos-system-pods-20261107.md.
export const KNOWN_PODS = [{
  id: 'fly',
  label: 'Shared test server',
  base: 'https://foafos-xmpp.fly.dev:8443/',
  note: 'A pod on the shared test server, the one Chat uses. Test data only.',
  ways: [{
    id: 'xmpp',
    title: 'Username and password',
    sub: 'Over XMPP',
    help: "Use an account on this server. The pod opens only for accounts on its list, and it says so if yours is not.",
    carriage: 'xmpp',
    relay: { url: 'wss://foafos-xmpp.fly.dev/xmpp-websocket', domain: 'foafos-xmpp.fly.dev' },
    podJid: 'pod@foafos-xmpp.fly.dev/lws',
  }, {
    id: 'https',
    title: 'Token',
    sub: 'Over HTTPS',
    help: "This way takes a token, not a username and password. It is the pod's own token, not a Fly login. Ask the person who runs the server. On the laptop that set it up: tr -d '\\n' < ~/.config/foafos-xmpp-fly/token | pbcopy",
    carriage: 'https',
    auth: 'bearer',
  }],
}];
