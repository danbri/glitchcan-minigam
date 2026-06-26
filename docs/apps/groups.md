# Groups (XMPP / MIX)

A groupware chat app for edot, built on **MIX** (Mediated Information eXchange — XEP-0369/0405), the modern successor to MUC ("the future of MUCs"). It ships a fully-working **offline demo mode** (in-memory loopback transport + echo bot) so the whole UI works with zero setup, and a **real XMPP-over-WebSocket** path (RFC 7395 + SCRAM-SHA-1 SASL + resource binding) for connecting to an actual server. The protocol layer — stanza construction, the SASL crypto, and the login state machine — is unit-tested against published specs/vectors; a live federated session is the one thing not exercised here (no reachable server/credentials), and the UI says so honestly.

## Architecture

The code separates the parts that *must be spec-exact* from the parts that need a network, so the former are verifiable offline:

| Layer | File | Pure? | Role |
|-------|------|-------|------|
| Stanza builders | `groups/js/xmpp-stanzas.js` | yes | MIX wire XML: join/leave/create/message/participants/presence |
| SASL | `groups/js/sasl.js` | yes (Web Crypto) | SCRAM-SHA-1 + PLAIN |
| Login state machine | `groups/js/xmpp-handshake.js` | yes (reducer) | RFC 7395 open → SASL → bind → ready |
| Transports | `groups/js/transport.js` | — | `LoopbackTransport` (demo) + `WebSocketTransport` (real) |
| Component | `groups/js/groups-app.js` | — | `<edot-groups>` UI + client model |

Design intent: **the same stanza/handshake code drives both the loopback demo and a real socket** — the transport is the only thing that changes. That's what makes the demo a faithful stand-in.

## Features

- **MIX channel model** `[stable]` — channels with messages + participants; join/leave/create stanzas per XEP-0369/0405.
- **Demo mode (loopback)** `[stable]` — in-memory server reflects your groupchat messages (as MIX does) and runs an echo bot; seeds two channels with participants. Default on load.
- **Message timeline** `[stable]` — own messages right-aligned, others left, system lines centered; share-cards for structured payloads.
- **Composer** `[stable]` — send to the active channel.
- **Channel list + join** `[stable]` — switch channels; "Join channel" by name or full JID.
- **Participants panel** `[stable]` — live participant list per channel (from the participants pubsub node).
- **Mobile-first layout** `[stable]` — three-pane on desktop; channel + participant panes become drawers on a phone (☰ / 👥).
- **`groups.share` capability** `[stable]` — other apps post a shared object (e.g. a calendar) into the active channel; rendered as a share-card.
- **Real XMPP login (SCRAM-SHA-1 + bind)** `[partial — unverified live]` — `WebSocketTransport` runs the full RFC 7395 + SASL + bind handshake on connect; the crypto and state machine are unit-tested, but no live federated session is exercised here.
- **PLAIN fallback** `[stable, unit-tested]` — used when a server doesn't offer SCRAM.
- **Settings → connect a server** `[partial]` — URL/JID/password form switches from loopback to the real WebSocket transport. Reaching a live server is environment-dependent and unverified.

## Side-effecting actions (command-registry inventory)

Every mutating action, for the command-registry migration:

| Action | Trigger | Effect | Proposed command id |
|--------|---------|--------|---------------------|
| Send message | Composer submit / `sendMessage(body)` | Sends a `groupchat` message to the active channel | `groups.sendMessage` |
| Join channel | "＋ Join channel" / `joinChannel(jid)` | MIX client-join; adds a channel + subscribes | `groups.joinChannel` |
| Leave channel | `leaveChannel(jid)` | MIX client-leave; removes the channel | `groups.leaveChannel` |
| Select channel | Channel list click / `selectChannel(jid)` | Switches active channel (read-only nav) | `groups.selectChannel` |
| Share into channel | `groups.share` capability invoke | Posts a shared object (title/kind/payload) as a card | `groups.shareIntoActive` |
| Connect to server | Settings → Connect | Swaps to `WebSocketTransport`, runs the login | `groups.connectServer` |
| Open/close settings | ⚙ button | Shows/hides the connect panel (no side effect) | `groups.toggleSettings` |
| Toggle channel/participant drawer | ☰ / 👥 (mobile) | UI only | `groups.toggleChannels` / `groups.toggleParticipants` |

**Capabilities provided:** `groups.share({ title, kind, body, payload })` → posts into the active channel; returns `false` if no channel is open.
**Capabilities consumed:** none today (it's a sink for shares from Calendar/Feeds/Docs).

## User journeys

1. **Chat in the demo** — Open Groups → lands in `#general` (demo mode banner shown) → type "hello" → message appears right-aligned, the echo bot replies "echo: hello". No setup required.
2. **Join another channel** — "＋ Join channel" → enter `team` → joins `team@groups.edot.local`, switches to it, participants populate, a system "— joined —" line appears.
3. **Receive a shared calendar** — In Calendar, open a calendar's ⋯ → "Share to group" → switch to Groups → a 📎 share-card "calendar: <name>" appears in the active channel (via the `groups.share` capability).
4. **Connect a real server** — ⚙ → enter WebSocket URL + JID + password → Connect → the client runs the real SCRAM-SHA-1 login and binds a resource. (Reaching a live server is environment-dependent; the panel notes the live path isn't verified in this build.)
5. **On a phone** — ☰ opens the channel drawer, pick a channel, it closes; 👥 opens participants; the timeline + composer fill the screen.

## Test coverage

Four suites, all green. Exact assertion labels are recorded in `docs/edot/test-coverage.md` (area `groups`).

| Feature | Covered by (suite :: assertion) | Status |
|---------|----------------------------------|--------|
| MIX join stanza (PAM + core, node subs, nick) | `test-xmpp-stanzas.mjs` :: "join uses MIX-PAM client-join…", "join subscribes to messages + participants nodes", "join carries the nick" | ✅ |
| MIX leave / create | `test-xmpp-stanzas.mjs` :: "leave uses MIX-PAM client-leave…", "create targets the MIX service…" | ✅ |
| Groupchat message + escaping + payload | `test-xmpp-stanzas.mjs` :: "groupchat message has type=groupchat…", "message body is XML-escaped", "message carries an optional structured payload" | ✅ |
| Participants pubsub query | `test-xmpp-stanzas.mjs` :: "participant request is a pubsub items query…" | ✅ |
| SCRAM-SHA-1 crypto (RFC 5802 vector) | `test-sasl.mjs` :: "SCRAM client proof matches the RFC 5802 vector", "SCRAM verifies the server signature…", "SCRAM rejects a wrong server signature", "…rejects a server nonce that does not extend…" | ✅ |
| PLAIN response | `test-sasl.mjs` :: "PLAIN response matches the known base64" | ✅ |
| Full login handshake → ready | `test-xmpp-handshake.mjs` :: "opens the stream with RFC 7395 framing", "chooses SCRAM-SHA-1 and sends <auth>", "auth payload is the SCRAM client-first message", "SCRAM response carries the RFC 5802 client proof", "verifies server signature and reports authenticated", "restarts the stream after auth", "requests resource binding", "binds the full JID and becomes ready", "sends initial presence when ready" | ✅ |
| Login failure path | `test-xmpp-handshake.mjs` :: "reports SASL failure with a reason" | ✅ |
| Demo channels + active channel | `test-groups.mjs` :: "demo seeds channels", "a channel is active and titled", "demo-mode status is shown" | ✅ |
| Send → reflect → echo | `test-groups.mjs` :: "the sent message appears in the timeline", "the echo bot replies in the channel", "my own message is right-aligned (.me)" | ✅ |
| Participants render | `test-groups.mjs` :: "participants render for the active channel" | ✅ |
| Channel switching isolates timelines | `test-groups.mjs` :: "switching channel changes the timeline" | ✅ |
| `groups.share` posts a card | `test-groups.mjs` :: "groups.share posts a shared card into the channel" | ✅ |

### Gaps (untested / unverified)
- **Live federated MIX session** — no reachable server/credentials in this environment; the real `WebSocketTransport.connect()` path (socket open → handshake → bound) is not exercised end-to-end against a server. The handshake *logic* is unit-tested via the scripted server.
- **`leaveChannel` UI path** — method exists; no UI button or test drives it.
- **Incoming-stanza parsing for real-server message shapes** — `_onStanza` is tested against loopback-shaped stanzas; a real server's exact `from`/`id` conventions aren't.
- **SCRAM channel binding (`-PLUS`)** — only `c=biws` (no channel binding) is implemented.
- **Reconnect / presence/roster / MAM history** — not implemented.
- **Settings "Connect" success path** — the form wires `WebSocketTransport`, but success requires a live server (untested).

## Known issues / honesty notes
- The Settings panel explicitly states: *"MIX over WebSocket (RFC 7395) with a real SCRAM-SHA-1 login (unit-tested). Live federation isn't verified in this build — demo mode stays on this device."*
- This is the same honesty posture used elsewhere in edot for unverifiable-headless paths (WebGPU/WebXR): the code is real and spec-correct where it can be checked offline, and the one thing that needs a live server is labelled as such rather than claimed.
