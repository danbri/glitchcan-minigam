# Observability and deep links in the foafos era

2026-07-28. Owner direction: the pre-foafos tooling in finkapp must plug
into foafos-wide debugging and observability channels as they evolve.
This note records the inventory, the target, and the first steps taken.

## 1. The legacy tooling inventory

These tools predate the foafos shell. Each keeps its own private state
and its own private display. None of them shared data with the others.

| tool | file | what it holds | state (2026-07-28) |
|---|---|---|---|
| Breadcrumb tree | `fink-breadcrumb.js` (+css) | `finkStack`: the story-overlay hierarchy — which FINK loaded which, and the knot path in each | **Now publishes to the bus** (`nav.fink`, `nav.knot`). Display is still its own widget. |
| Dev panel | `fink-devpanel.js` | log ring buffer, swimlanes (NAV/INK/FINK/GAME), state dump, local fink list, synth test | Private. Reads `FinkUtils.debugLog` output, not the bus. |
| Load meter | `#scroll-status-bar` in `index.html`, `FinkUI.updateFinkStats` | FINKS / Loaded / Compiled counters | Counter bug fixed (it read a field that never existed). Still poll-based, not bus-fed. |
| debugLog | `fink-utils.js` | the string log everything above consumes | The real legacy side channel. |

The foafos side already has the modern channel: **the bus**
(`packages/foafos`, `FoafOS.bus`), with the drawer feed and the Logger
app as its readable surfaces. Story beats, minigame events, WM moves,
session and audio events already flow there.

## 2. The target

One rule: **a tool observes the bus; it does not keep a private diary.**

- Every navigation event is a bus event (done: `nav.fink`, `nav.knot`).
- The dev panel's swimlanes become bus subscribers. NAV/INK/FINK/GAME
  lanes map to bus channels. `debugLog` stays for free-text, but each
  structured fact it carries today moves to a typed bus event.
- The load meter becomes a chrome app that subscribes to
  `nav.fink` / `story.state` instead of polling globals.
- The breadcrumb keeps its widget UI, but its DATA is replayable from
  the bus: a new session of the Logger can reconstruct the tree.
- Guests (minigames, apps) already reach the bus through their SDK
  postMessage bridges. Their debug output belongs on the same bus, in a
  `guest.*` channel, not in per-app consoles.

Order of work (each step is small and testable):
0. ~~Running panel shows the three ledgers~~ (done 2026-07-28: the ⓘ
   panel renders requested / granted-by-chain / UTILIZED, fed by the
   shell's capUse tally; the story-overlay tree renders there too, and
   the floating widget lost its expanded mode).
1. ~~Breadcrumb publishes `nav.*`~~ (done, this commit).
2. ~~Dev panel NAV lane subscribes to `nav.*`~~ (done 2026-07-28: the
   lane observes `nav.*` with retained-event replay; `FinkNavigation.
   swimLog` now publishes `nav.link` to the bus instead of writing to
   the panel — no direct `swimEvent('nav', …)` caller remains).
3. ~~Load meter chrome app subscribes; delete `updateFinkStats`
   polling~~ (done 2026-07-28: the meter subscribes to `nav.fink` /
   `fink.load` / `ink.compile` with replay; the scroll-time polling and
   `updateFinkStats` are gone; `clearHistory` publishes depth 0 so the
   meter cannot go stale on return-to-menu).
4. ~~INK/FINK lanes: engine publishes `ink.compile`, `fink.load`
   events~~ (done 2026-07-28: engine publishes `ink.compile`,
   `ink.choice`, `ink.error`; sandbox publishes `fink.load` (count and
   size only, never content); player/engine publish `fink.ready`; the
   dev panel INK and FINK lanes observe `ink.*`/`fink.*` with replay.
   The NET lane still uses `swimEvent` — `net.*` feeds the user-facing
   feed, so loading noise stays off it for now).
5. ~~`debugLog` mirrors to a `debug.*` bus channel; the dev panel log
   tab reads the bus~~ (done 2026-07-28: `FinkUtils.debugLog` and
   `window.log` publish `debug.log` once the panel signals `busWired`;
   before that moment the direct path covers boot so no line is lost
   and none duplicates. The Logger firehose sees the channel for free;
   `scopeBus` grant filtering keeps `debug.*` out of guest frames).

All five steps are done, and the follow-up landed the same day: the
NET/GAME lanes observe the bus too. Loader lifecycle facts publish as
`fetch.start`/`fetch.fail` — a family the drawer feed does not
subscribe to, so loading noise stays out of the user feed while
transport `net.<name>.*` events keep their feed cards. The audio-track
fact is `game.audio`. `window.swimEvent` is deleted; no module writes
into a lane directly. Found on the way: the NET lane had CSS and code
but never markup — `swimEvent('net', …)` rendered into a null element
for its whole life. The lane now exists in index.html.

What remains beyond this list: whoever replaces the live player with
the boxed storyrunner inherits this wiring.

## 3. Deep links: durable versus ephemeral

What exists:

- **Two-part FINK links** (`#<urlHash>-<knotHash>`): salted SHA-256 of
  story URL and knot name (`fink-navigation.js`). Durable, shareable,
  and independent of session state. This is the durable spine.
- **`?story=<url>`**: loads any FINK by URL. Durable.
- **`?root=<id>`**: selects the installation (glitchcanary, office,
  webtv). Durable.
- **`?skin=`**: presentation override. Durable.

What is deliberately ephemeral, and should stay so:

- Pager position (beat/part). Parts are recomputed per device and per
  viewport; a link to "part 2 of 3" would be a lie on another phone.
  The beat is the story's address; the knot hash covers it.
- Theatre docked/undocked, WM window mode, drawer state.
- Ink VARIABLE state (progress). This is session state, not an address.

What foafos adds:

- **Composable addresses.** `?root=` + `?story=` + `#urlHash-knotHash`
  already compose: one URL names an installation, a story, and a place
  in it. Rule for new features: if it changes WHAT the user is looking
  at, it must be addressable; if it changes HOW, it must not leak into
  the address.
- **Session restore as the durable layer for the ephemeral.** Progress
  does not belong in URLs; it belongs in the storage broker under the
  sealed session (`foafos.store.*`, SAVE/UNLOCK). The pairing is:
  the URL says WHERE, the session says HOW FAR. A "continue" affordance
  can combine them without a single new URL scheme.
- **Apps need the same story.** An app window today is launched by id
  (`FoafOS.launchApp('robbamp')`) but has no address. The natural
  extension is `?app=<id>` on non-story roots, same salted-hash pattern
  if app-internal places ever need naming. Not built; recorded here as
  the agreed direction.

## 4. Rules of thumb

- New structured fact → bus event first, widget second.
- New navigable surface → give it an address the day it ships.
- Never put session state in an address; never put an address in
  session state.
