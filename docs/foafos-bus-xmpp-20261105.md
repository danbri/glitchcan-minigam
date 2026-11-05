# Foafos: the app bus over XMPP (2026-11-05)

Owner, verbatim: "having the comms bus in our widget-app runner sandbox be exposed to XMPP, so humans and AI can monitor
and interact there."

People and AI agents join one XMPP room and read what the sandboxed apps do. An account that the owner allows can also send
an action to a running app. Room text never runs anything.

For several shells on a public server, see [foafos-shared-xmpp-20261105.md](foafos-shared-xmpp-20261105.md).

## Use it

1. `foafos-stack start xmpp shell`, then open
   <http://localhost:8080/glitchcan-minigam/inklet/finkapp/?root=apps>. The Chat app is now in the `apps` root beside the
   Playlist, and it stays in `office`.
2. In Chat, connect to "This computer". Join the room `bus@rooms.localhost` from any XMPP client.
3. To read app content, not only topics: Chat, Advanced, "What apps say on the bus".
4. To let an account act, do both of these in Chat:

   ```
   Advanced: tick "Let allowed accounts send actions to apps"
   /grant foafbot@localhost playlist queue pause
   ```

5. The account sends a **direct message** to the shell (`foafos@localhost`):

   ```
   /tell playlist queue {"track":"the-quiet-engines"}
   ```

   The room shows `app.action`, and then the app's own `app.playlist.now`.

## What crosses, in each direction

| Direction | What | Check |
|---|---|---|
| Shell to room | Local events on the mirror list | `mirrors()`, then `redact()` |
| App to room | What a sandboxed app publishes (source `guest:<app>#<window>`) | `scopeBus` when it publishes, then `mirrorApps`, then `redact()` |
| Room to bus | Room text, as `net.xmpp.message` with source `net.xmpp` | Size and rate only. No app hears it unless its manifest subscribes. None does. Never acted on |
| Direct message to app | `/tell APP ACTION {json}` | All six checks below |
| Direct message to tools | `/call`, `/go`, `/where` | ToolGrants, as before (docs/foafos-caller-grants-20261105.md) |

`mirrorApps` has three values:

| Value | The room sees |
|---|---|
| `off` | Nothing from apps |
| `topics` (default) | Topic and sender only: `app.playlist.now {"from":"guest:playlist#w2"}`. No content from the app |
| `data` | Also the event data, redacted |

## The six checks on `/tell`

Each comes before the next, and a failure stops the message:

1. `from` is the JID the server stamped on a **direct** message. A room nickname never counts.
2. The account holds a grant (`mayCommand`), the rate is under 10 commands in 10 seconds, and the command is 4,096
   characters or fewer. Else there is no answer, and `chat.refused` goes to the bus.
3. The owner's switch `inbound` is on. It is off by default, and changing it applies at once.
4. A grant for **that app** names **that action** (`ToolGrants.allowsAction`). Level `all` and app `*` do not reach
   actions: the allow-list is explicit.
5. The arguments are a flat object of plain values: 2,048 characters in all, 512 for each value.
6. `deliverAction` in the shell, the existing route that stories use: the action must be in the app's manifest `actions`,
   and the app must be running. This is not a new route. The app receives it through `foaf.onAction`, in its frame, and
   `from` is `{kind:'account', label:<jid>}`, set by the shell.

Nothing from XMPP is published on a bus topic that an app or the shell reads as fact. An outside account cannot make
`app.close` or `story.state`, because raw bus publishing from XMPP does not exist.

A stored direct message never runs. The server keeps a message for an offline account and delivers it later with no
`<delay>` stamp, before it answers the room entry that follows. So the shell treats a direct message as live only after that
answer. Before it, or with a `<delay>`, the message shows in Chat and `chat.refused` gives the reason `stored`.

## Bounds and redaction

`packages/foafos/src/bus-mirror.mjs`, pure functions, used for each mirrored event and for `/bus`.

- **Never mirrored, whatever the list says:** `secrets.*`, `net.*`, `chat.status`, `chat.message`, `chat.error`.
- **Removed by key name:** password, passphrase, secret, token, API key, access key, private key, authorization, bearer,
  cookie, credential, capability, caps, JWT, signature.
- **Removed from text:** PEM private keys, `Bearer` and `Basic` values, JWTs, GitHub, Slack, AWS and `sk-` keys, any run
  of 40 or more key characters, a login in a URL, and URL parameters with a secret-like name.
- **Size:** depth 6, 32 items for each level, 500 characters for each string, 2,000 for each message. A message that is
  too long becomes `{"truncated":true,...}`, so it is always whole JSON.
- **Rate out:** 20 events a second, and 5 a second from one app. The room is told of a loss: `chat.dropped`.
- **Rate in:** 20 room messages a second onto the bus, each cut to 2,000 characters.

Redaction is a pattern match. It cannot find a secret with no recognisable name or shape. That is why `topics` is the default.

## The loop guard

Each mirrored stanza carries `<x xmlns="urn:foafos:bus:0" topic="..." source="..."/>`. The Factoidal MUC keeps this
element (tested on the live server, 2026-11-05).

- A marked groupchat stanza is shown in the Chat window and never goes onto the bus.
- A marked direct message is dropped.
- Only a marked stanza shows as an event. Before this, anyone who typed `app.close {}` in the room looked like an event.
- Anyone can add the marker. That only keeps their own words off the bus, so forging it gains nothing.
- `chat.message` now has source `net.xmpp`, and it is on the never-mirrored list. Before this, a mirror list of `*`
  mirrored `chat.message`, which came back as `chat.message` and looped at the rate limit.

## What was on master before this work

Master at `7262f673` already had: the room, the mirror list and 20 events a second; room text as `net.xmpp.message`; direct
message commands; ToolGrants; `/call` to apps with tools (Moglob and Drift).

These were missing:

- What sandboxed apps publish never reached the room. `_mirror` kept `source === 'local'` only, and a guest's source is
  `guest:...`. The room had the shell's reports about apps, not the apps' own traffic.
- No redaction. The room got `JSON.stringify(e.data)` whole.
- No marker, and the `*` loop above.
- No size or rate bound on what came in.
- An app with no tools could not be reached. The Playlist has manifest `actions`, not tools.
- A refused sender left no trace.

## The sandbox

**No sandbox or frame code changed.** `FoafOS.deliverAction` takes one more argument, `from`, which the inner
`deliverAction` already accepted. The rest is in `chat.mjs`, `chat-commands.mjs`, `tool-grants.mjs`, `bus-mirror.mjs` and the
Chat window.

## Tests

- `node packages/foafos/test/run.js`: includes `bus-mirror.test.js`.
- `node inklet/finkapp/test/e2e-bus-xmpp.mjs`: Chrome, the stack's shell and XMPP server, the real Playlist in its sandboxed
  frame, and two outside clients over TCP in a new room. Accounts: `foafos` is the shell, `foafbot` holds grants, `me` holds
  none. Stop the `foafbot` service first.

## Not built

- **Commands in a room.** Room members are nicknames here. This needs a room that shows real JIDs to the shell, and that
  is a Factoidal change. Members-only rooms are now on Factoidal main (`--muc-members`), not yet in a release.
- **XEP-0050 ad-hoc commands**, so that Gajim shows buttons.
- **MIX and GC3** forms of the room.
- **Per-value limits on arguments.** A grant for `queue` allows any track.
- **Conversations from strangers** are limited by rate, not by count, in the Chat window's list.

## Decisions for the owner

1. **`mirrorApps` default.** It is `topics`, the safe value. Should `data` be the default for the `localhost` server?
   Any account on that server can join the room.
2. **The bus room is open to every account on the server**, as before.
3. **Chat in the `apps` root.** This work added it, so that the Playlist and Chat can open together. A revert is one word in
   `foafos-root.js`.
4. **`/tell` for foafbot.** Built on 2026-11-05, off by default, with the bot's own rules: an owner's direct message only, and
   never room text. See [foafos-foafbot-tell-20261105.md](foafos-foafbot-tell-20261105.md).

## Test results, 2026-11-05

- foafos package suite: 142 of 142 pass. `e2e-bus-xmpp`: all 32 checks pass on the live stack. `e2e-chat`, `e2e-bus`, `e2e-apps-demo`: pass.
- `e2e-storyrunner`: the mandatory journey (TOC, Episodes, Hampstead) passes. The test reports 15 failures, and master `7262f673` with none of this work reports the same 15 (peer and merge choices at the coin beat in the demo story, and a `caches` SecurityError). They are not from this work, and nobody has examined them yet.
- These browser tests need the repository served under the name `glitchcan-minigam`, because stories use that path.
