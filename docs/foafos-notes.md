# foafos — design notes (v0, July 2026)

*Working name. Terminology — including "foafos" itself, and what to call
a shell instance — is danbri's to settle. Nothing below is named-in-stone;
the code keeps names one rename away.*

## The idea

The game runner grew into the UI side of a web-based OS (FinkWM,
spec §5.1: story = desktop, minigame = window). foafos generalizes that
shell: identity, events, feeds, and the outside world.

Principles:

1. **Everything that happens is an event on the local bus.** Story beats,
   window mode changes, minigame results, session changes, network
   notifications — one spine (`FoafBus`), dot-path topics, wildcard
   subscription, retained state topics, cross-tab mirroring.
2. **Everything on screen is a web component satisfying the widget
   contract** (`set item(obj)`, emit `foaf-action`). The registry resolves
   an item's kind to an element; the generic card guarantees everything
   renders. Social-web-style feeds are just `<foafos-feed>` subscribed to
   topic patterns.
3. **Sessions are ephemeral by default and encrypted at rest when kept.**
   No passphrase, no persistence — deliberately. AES-256-GCM sealed blobs
   in localStorage; wrong passphrase yields nothing. Federated login
   (WebID, fedi, OAuth, the planned fly.io service for logins/state/
   authoring/shares) is a later layer that populates `profile` without
   changing the storage contract.
4. **The shell participates in the wider event ecosystem through
   transports** — a deliberately thin contract ({connect(bus), close(),
   send?}) so MQTT/XMPP/WebRTC/fedi are adapters, not architecture.
   Inbound events are marked `net.<name>.*` and are feed content like
   everything else, including transport lifecycle (open/error/closed).

## What exists now (v0, all test-locked)

- `packages/foafos/` — bus, session crypto, widget registry + generic
  card, feed element, SSE/WebSocket/Atom transports. Unit-tested in Node
  (`npm test` in the package).
- `inklet/finkapp/foafos-shell.js` — the reference shell instance:
  - dock button (⊞, bottom-right) → drawer (session card · WINDOWS
    shelf · FEED).
  - session UI: name, passphrase, SAVE/UNLOCK/FORGET; status line says
    plainly whether you are ephemeral or sealed.
  - the shelf lists open windows (currently the one game window) and
    brings them forward — including out of pip.
  - the feed shows the session as a social stream: story beats, game
    starts/results, window changes, audio focus, session events.
  - `window.FoafOS` is the console surface: `bus`, `session`,
    `widgets`, `transports`, `connect()`.
- Platform instrumentation: guarded one-line `FoafOS?.bus.publish` calls
  in fink-wm.js (wm.open/close/mode, audio.focus), fink-minigames.js
  (minigame.start/complete), fink-ink-engine.js (story.beat).
- **Audio-focus protocol** (spec §7 first slice): entering pip sends
  `audio-blur` to the guest, leaving pip sends `audio-focus`; robbin
  ducks all its buses on blur (same ramp as narrator ducking) and will
  not un-duck on speech end while blurred.
- E2E: `node inklet/finkapp/test/e2e-foafos.mjs`.

## Deliberately not yet

- **Multi-window minigames.** The ink engine runs one MINIGAME break at
  a time; the shelf and WM are built for N windows but the engine
  contract isn't. Next step would be detaching window lifetime from the
  story break.
- **Server anything.** Login federation, ActivityPub inbox, shared
  presence → the fly.io service arc.
- **MQTT/XMPP/WebRTC adapters** — contract-ready, unwritten.
- **Typed-block widgets**: `OO('application/vnd.fink.playlist+json')`
  blocks rendering as playlist widgets in the feed — the sigil registry
  and the widget registry are shaped to meet.

## Open decisions (owner's call)

- All naming: foafos itself, "shell instance", card/widget/feed terms,
  topic taxonomy.
- Whether the drawer is the long-term shape (vs. feed-as-desktop,
  multiple docks, a lock screen for sealed sessions…).
- Which external ecosystem gets the first real adapter (MQTT broker?
  fedi via server? an Atom feed of the finkiverse itself?).
