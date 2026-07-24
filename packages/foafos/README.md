# foafos

*Working name — the terminology is the project owner's to settle; every
name here is one rename away.*

The core of a **shell for the social, playable web**: the UI side of a
web-based OS, in the sense that a desktop or mobile frontend is. A host
page (the reference one is the FINK player, `inklet/finkapp/`) becomes a
shell instance: windows (games, stories, tools) run in it, everything
that happens is an event, and everything on screen is a web component.

No story, game, or site names live in this package (the NPM boundary
rule: mechanism ships; names arrive via config and content).

## The pieces

| module | what it is |
|---|---|
| `bus.mjs` | `FoafBus` — local realtime event spine. Dot-path topics, `prefix.*` patterns, retained events, replay-on-subscribe, cross-tab mirroring via `bridge(channel)` (BroadcastChannel). |
| `session.mjs` | Ephemeral identity. A session lives in memory and dies with the tab **unless sealed**: AES-256-GCM, key from a passphrase via PBKDF2-SHA256 (210k iterations). There is no unencrypted persistence path. |
| `widgets.mjs` | The widget contract + registry. A widget is a custom element with `set item(obj)` that may emit `foaf-action` events. Kinds resolve exact → longest `prefix.*` → generic `<foaf-card>`, so a feed can always render what it is shown. |
| `feed.mjs` | `<foafos-feed topics="wm.*,story.*">` — a social-style stream of bus events rendered through the registry, newest first, capped. |
| `transports.mjs` | Adapters into the wider event/notification ecosystem. Shipped: SSE (server push), WebSocket (bidirectional JSON frames), RSS/Atom polling. Inbound traffic publishes under `net.<name>.*`; transport lifecycle is itself feed content. |

## Transports roadmap

The contract is `{ name, connect(bus), close(), send?() }`. Designed to
fit, not yet shipped: MQTT-over-WebSocket, XMPP, WebRTC data channels
(needs a signalling rendezvous), ActivityPub/fedi inbox (needs the
planned server-side component). Cross-tab is not a transport — that is
`FoafBus.bridge()`.

## Tests

```
npm test        # zero-dep node runner: bus, session crypto, registry
```

The full shell behavior (dock, drawer, window shelf, audio focus,
session UI) is locked browser-side by
`inklet/finkapp/test/e2e-foafos.mjs`.

## Design notes

`docs/foafos-notes.md` in the repo root records the current design and
the open decisions (naming above all).
