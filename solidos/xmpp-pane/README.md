# xmpp-pane

A demo [SolidOS](https://github.com/SolidOS/solidos) pane for XMPP chat with
[Strophe.js](https://strophe.im/strophejs/), plus a small Node WebSocket→TCP
proxy.

The pane appears on any WebID profile that lists an XMPP address:

```turtle
<#me> foaf:jabberID "bob@example.org" .
# or
<#me> vcard:hasInstantMessage <xmpp:bob@example.org> .
```

If you are logged in to Solid and your own profile has a Jabber ID, it is
pre-filled as the login JID. Passwords are never stored. The JID and service
URL are remembered in `localStorage`.

## Layout

| Path | What |
|---|---|
| `src/xmppPane.ts` | The `PaneDefinition` (`label` / `render`), registered with pane-registry |
| `src/jabberIds.ts` | Finds JIDs in a profile (rdflib store) |
| `src/xmppSession.ts` | Strophe wrapper: connect, roster, presence, messages (as DOM events) |
| `src/chatView.ts`, `src/xmppPane.css` | Plain-DOM UI (login, contacts, conversation) using solid-ui theme tokens |
| `proxy/server.mjs` | WebSocket (RFC 7395) ↔ TCP (RFC 6120) bridge, with STARTTLS done in the proxy. It also serves `demo/` |
| `proxy/mock-server.mjs` | Tiny in-memory XMPP server for tests and demos (users `alice`, `bob`, password `secret`) |
| `demo/profile/*.ttl` | Two demo WebID profiles |

## Run the demo

```sh
npm install            # use npm 11 (`npx npm@11 install`): npm 10 hits the arborist edgesOut crash
npm run demo           # mock XMPP server :5222, proxy :5281, pane sandbox :5173
```

Open <http://localhost:5173/?subject=http://localhost:5281/profile/bob.ttl%23me>
and log in as `alice@localhost` / `secret`. In a second (private) window, open
`.../profile/alice.ttl%23me` and log in as `bob@localhost`.

## Against a real server

If the server already offers XMPP over WebSocket (Prosody `mod_websocket`,
ejabberd `ejabberd_http_ws`), skip the proxy and put its `wss://` URL in the
pane's *Connection* field.

Otherwise, run the proxy and allowlist the domains it may connect to:

```sh
XMPP_DOMAINS=example.org npm run proxy                      # SRV lookup, then example.org:5222
XMPP_DOMAINS=example.org=xmpp.example.org:5222 npm run proxy
```

| Env | Default | |
|---|---|---|
| `PORT` | `5281` | Endpoint is `ws://host:PORT/xmpp-websocket` |
| `XMPP_DOMAINS` | `localhost=127.0.0.1:5222` | Only these domains are reachable, so the proxy is not an open relay |
| `XMPP_TLS_INSECURE` | off | Accept self-signed server certificates |
| `XMPP_ALLOW_PLAINTEXT` | off | Allow servers without STARTTLS |
| `ALLOWED_ORIGINS` | any | Restrict browser origins |
| `XMPP_PROXY_DEBUG` | off | Log frames, with SASL payloads redacted |

Note that the browser→proxy hop is plain `ws://` here. For anything beyond
localhost, put the proxy behind TLS (`wss://`).

## How the proxy works

1. Client `<open to="example.org"/>`: if the domain is allowlisted, open TCP and send `<stream:stream>`.
2. Server features offer `<starttls/>`: the proxy negotiates TLS itself. The client never sees it.
3. The client sees the server's header as `<open/>` and the post-TLS `<stream:features>`. Each
   top-level element gets its inherited namespaces declared, as RFC 7395 requires.
4. SASL, bind and stanzas pass through unchanged. A client `<open/>` after SASL is a
   stream restart (new parser, new header). `<close/>` ↔ `</stream:stream>`.

## Tests

```sh
npm test    # unit tests (jsdom) + e2e: Strophe → proxy → mock server with STARTTLS
```

## Adding it to the databrowser

In `solid-panes/src/registerPanes.js`, add next to the chat panes:

```js
import { xmppPane } from 'xmpp-pane'
register(xmppPane)
```

## Where this lives, and the Lean server (2026-11-03)

Made on 2026-11-02 in a local SolidOS workspace (`solidos/workspaces/xmpp-pane`, against
https://github.com/SolidOS/solidos at 296faf3) and moved here on 2026-11-03, so that it is in a
main branch. Its dependencies are npm packages (the SolidOS ones at their `dev` tags), so it
builds from this folder: `cd solidos/xmpp-pane && npx npm@11 install && npm test`.

The proxy is only needed for a server that speaks TCP alone. Factoidal's Lean XMPP server speaks
RFC 7395 itself (https://github.com/danbri/factoidal-core/pull/311), so Strophe.js in this pane
connects to it directly. Measured on 2026-11-02: two browser windows chatting through

    factoidal xmpp-serve DIR --domain localhost --port 15222 --ws-port 5290 --ws-origin http://localhost:5173

with the service URL `ws://localhost:5290/xmpp-websocket` in the pane. The same server also
offers MUC (`--muc`), MIX (`--mix`) and a GC3 prototype (`--gc3`); this pane does one-to-one chat
only.

Related: the foafos and SolidOS comparison, and the idea of running SolidOS panes as sandboxed
foafos apps, `docs/foafos-solidos-20261103.md` section 6 (this pane is the first-experiment
candidate).
