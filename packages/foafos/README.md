# foafos

*Working name — the terminology is the project owner's to settle; every
name here is one rename away.*

The core of a browser shell that runs **mutually distrustful apps**.

Not a UI framework. This is the part that decides what an app may do,
holds the tree of what is running, and brokers the handful of things an
app cannot be handed directly. Rendering, chrome and the app list belong
to whoever embeds it. No story, game or site names live here (the NPM
boundary rule: mechanism ships; names arrive via config and content).

```js
import { FoafBus, AppTree } from 'foafos';

const bus  = new FoafBus();
const apps = new AppTree({ bus });

const root = apps.spawn({ appId: 'shell', parentId: null,
                          capabilities: ['storage', 'audio'] });

// A child may hold a SUBSET of its parent — never more.
apps.spawn({ appId: 'player', parentId: root.id, capabilities: ['audio'] });
apps.spawn({ appId: 'greedy', parentId: root.id, capabilities: ['same-origin'] });
//  → { refused: true, reason: 'attenuation', excess: ['same-origin'] }
```

## The one idea

**`grant(child) ⊆ grant(parent)`.**

Without that rule, letting an app open another app is a
privilege-escalation primitive: anything able to spawn can mint something
holding capabilities it does not hold itself. With it the root is the
only source of authority, every node is bounded by its ancestors, and
trimming the root's list genuinely locks an installation down instead of
merely hiding icons.

It also gives grouping a meaning. Closing a subtree is *revoking a
subtree of authority* — which is why `close()` cascades deepest-first and
why a child does not outlive its parent by default.

## The pieces

| module | what it is |
|---|---|
| `apptree.mjs` | `AppTree` — running instances as a tree. Attenuation on `spawn`, cascading `close`, subtree `setSuspended`. No DOM: each node carries an `onClose` and the embedder takes down whatever renders it, which is also why it tests in Node. |
| `store.mjs` | `FoafStore` — per-app key/value with a namespace it cannot name its way out of, a quota, and an audit trail. Backend-pluggable (`read(ns)` / `write(ns, obj)`), so a synced backend drops in without any app knowing. |
| `vars.mjs` | `FoafVars` — shared vs private variable governance, allowlisted per app, read-only for nested contexts, audited. |
| `audio.mjs` | `FoafAudio` — one master level, plus an honest report of the sources it *cannot* reach. |
| `input.mjs` | `FoafInput` — touch pad, keyboard and Gamepad normalised to one action vocabulary (`up down left right a b start`), with autorepeat and deadzones as service policy. |
| `bus.mjs` | `FoafBus` — local event spine. Dot-path topics, `'*'` and `'prefix.*'` matching, retained events, replay-on-subscribe, cross-tab mirroring via `bridge(channel)`. |
| `session.mjs` | Ephemeral identity: in memory, dies with the tab **unless sealed** — AES-256-GCM, key from a passphrase via PBKDF2-SHA256 (210k iterations). There is no unencrypted persistence path. |
| `widgets.mjs` | The widget contract + registry. A widget is a custom element with `set item(obj)` that may emit `foaf-action`. Kinds resolve exact → longest `prefix.*` → generic `<foaf-card>`, so a feed can always render what it is shown. |
| `feed.mjs` | `<foafos-feed topics="wm.*,story.*">` — bus events rendered through the registry, newest first, capped. |
| `transports.mjs` | Adapters to the wider event ecosystem. Shipped: SSE, WebSocket, RSS/Atom polling. Inbound traffic publishes under `net.<name>.*`. |

## Design rules it holds itself to

These came from bugs, and they are load-bearing:

- **A refusal is a normal answer, said out loud.** Denials, attenuation
  failures and quota exhaustion publish on the bus rather than throwing.
  A capability system whose refusals are invisible teaches people that
  nothing was refused.
- **Deny returns `null`, not `{}`.** An app reading an empty object
  concludes "no data yet" and overwrites on that basis.
- **A refused write leaves the old value intact.** A half-applied write is
  worse than a refused one.
- **Report what you cannot reach.** `FoafAudio.coverage().uncovered` names
  the sources the master volume misses; claiming a silence you cannot
  deliver is worse than admitting the gap.

## Guests

Guests speak the protocol via `app-sdk.js` in the reference shell:
`app.hello` → `app.init { appId, capabilities, store }`, then `store.set`
/ `store.remove` / `store.clear` as **proposals** the broker may refuse.
In a sandboxed frame `localStorage` throws, so the SDK installs a
snapshot-backed shim and existing synchronous code keeps working.

A guest that speaks nothing still runs — it simply gets no services, and
the shell reports what it could not reach rather than pretending.

## Transports roadmap

The contract is `{ name, connect(bus), close(), send?() }`. Designed to
fit, not yet shipped: MQTT-over-WebSocket, XMPP, WebRTC data channels
(needs a signalling rendezvous), ActivityPub inbox (needs the planned
server-side component). Cross-tab is not a transport — that is
`FoafBus.bridge()`.

## Tests

```
npm test        # bus, session crypto, registry, vars, audio, input,
                # store, and the app tree
```

Full shell behaviour (dock, drawer, window shelf, audio focus, roots, the
switcher tree, capability boundaries) is locked browser-side by
`inklet/finkapp/test/e2e-foafos.mjs`, `e2e-caps.mjs` and `e2e-root.mjs`.

## Status

**0.2.0, alpha.** Exercised by a running shell and unit-tested, but not
yet published, not yet consumed outside this repository, and the names
may still move. The normative platform spec is `docs/fink-spec-v1.md` §5;
design notes and open decisions are in `docs/foafos-notes.md` and
`docs/foafos-root-and-app-tree-20260726.md`.

MIT.
