# FINK Platform Specification v1.0

*Glitch Canary FINK — FOAFy Ink. July 2026.*

FINK tells one story across the web: Ink narrative, typed data blocks,
deep links, and embedded minigames, carried in ordinary JavaScript files
servable from any static host. This document specifies the v1.0 platform
contracts. Everything here is implemented and test-locked unless marked
**(roadmap)**.

Normative sources of truth: `packages/gcfink` (core library + tests),
`inklet/finkapp/` (reference player), `inklet/minigames/` (minigame SDK),
`docs/fink-linking-spec.md` (links, incorporated by reference),
`inklet/INK-GOTCHAS.md` (authoring pitfalls, incorporated by reference).

---

## 1. The `.fink.js` polyglot document

A FINK file is **executable JavaScript whose only job is to hand typed
text blocks to whoever is listening**, via tagged template literals
("sigils"). It is never parsed as text (the no-hackparsing rule).

```js
oooOO`
-> start
=== start ===
Hello. # IMAGE: cover.jpg
`;

OO('text/turtle')`@prefix foaf: <http://xmlns.com/foaf/0.1/> . ...`;
OO('application/vnd.fink.playlist+json')`{"tracks": []}`;
```

### 1.1 Sigils

- `oooOO` → `text/x-ink`. The one binding the platform ships.
- `OO(mediaType)` → curried capturer for any media type; no registry
  change required. Prefer registered types (`text/turtle`,
  `application/ld+json`); mint ours in the vendor tree
  (`application/vnd.fink.*`), never new `x-` types (RFC 6648).
- Hosts may register named sigils (`FinkSandbox.registerSigil`,
  `gcfink extractBlocks({sigils})`).

### 1.2 Capture is RAW — normative

Sigils capture `strings.raw`. This is load-bearing: Ink tag values
escape `//` as `\/\/` (§3.1) and only raw capture preserves the
backslashes. Cooked capture is a conformance violation.

### 1.3 Extraction

- Browser: sandboxed `<iframe sandbox="allow-scripts">` executes the
  file; blocks return via postMessage. Legacy consumers receive the
  first `text/x-ink` block (`data[0]`); typed consumers receive the
  ordered block list (`{sigil, mediaType, raw, index}`).
- Node: `gcfink extractBlocks()` in a `node:vm` context. Never `eval`.
- The legacy view (`extractFinkFromJsSource` / `inkOf`) is unique
  `text/x-ink` blocks, document order, newline-joined — frozen for
  back-compat.

## 2. Compilation

Real inkjs only (`new inkjs.Compiler(src).Compile()`), vendored at
`third_party/ink/ink-full.js`. **Platform contract (v1 wart):** the
reference player appends a private `=== _inventory ===` knot (declaring
`diamonds`, `mega_diamonds`, `keys`, `score` when absent) to every
story. Stories may divert to it; standalone validators MUST stub it
(`packages/gcfink/test/corpus.real.test.js`). **(roadmap v2)** the
injected knot becomes content-free and tunnel-based (§6.3).

## 3. Tag grammar

Tags are `# KEY: value` on Ink lines. Keys are case-insensitive at the
parser; values keep their case. Implemented tags:

| Tag | Meaning |
|---|---|
| `# IMAGE:` / `# VIDEO:` | media, resolved via §3.2 |
| `# BASEHREF:` | story/knot media base |
| `# FINK:` | load another FINK document (breaks the continue loop) |
| `# MINIGAME: name [mode=m] [controls=dpad\|lite\|none] [key=value …]` | a game; the story pauses until it completes (§5). Other keys reach the game only if its registry row lists them in `args` |
| `# WORLD: name [key=value …]` | a stage app beside the story that shows what the story's tags say; the story does not pause (§5.8) |
| `# AUDIO:` / `# FOLEY:` / `# STOP_AUDIO` | audio (§7) |
| `# PUBLIC:` | cold-entry respawn knots (links spec) |
| `#BG:` `#CLASS:` | presentation styling |
| `# IMPORT:` | variable import |

### 3.1 The `//` rule — normative

The Ink compiler treats `//` as a comment **inside tag values**.
`# FINK: https://x` truncates to `https:` and, in the reference player,
silently resolves back to the current story. Absolute URLs MUST be
escaped `https:\/\/…`. Relative URLs are always safe. Regression-locked
in `gcfink test/inkCompile.real.test.js`; `lintTagUrls` warns.

### 3.2 Tag attachment — normative authoring rule

A tag on its own line attaches **forward to the next text line, through
diverts**. Tags that mark a moment (especially `# MINIGAME:`) MUST be
inline on a text line. Reactions to minigame results MUST live behind a
choice in the return knot (Ink evaluates a knot's entry text before the
break takes effect). INK-GOTCHAS §8; E2E-locked in `e2e-robbin.mjs`.

### 3.3 Media resolution

Three layers: global media base → story `BASEHREF` (file-relative
fallback) → path. See `FinkUtils.resolveLayeredMediaUrl`.

### 3.4 Document composition — the depth model

Incorporates `docs/3dmap-idea.md` (Levels, the Depth Principle,
LINKREL vocabulary). A `# FINK:` link may carry `# LINKREL:` naming the
relationship; each maps to a composition semantic — Ink's own
control-flow vocabulary at document scale:

| LINKREL | Ink analogue | semantics |
|---|---|---|
| *(bare)* / `sameWorld` | divert | replace the story (today's behavior, frozen for back-compat) |
| `goDeeper` | tunnel in | **push** the current frame (URL + full Ink state incl. position) onto the dream stack; descend. Depth cap 8 → fault |
| `goShallower` | tunnel out | **pop** (the link URL is documentation); no-op at depth 0 |
| `oneWay` | divert, bridge burned | replace and clear the stack |
| `unstable` | — | reserved: traversal MAY mutate state (transit hooks) |
| *(merge)* | thread | **(roadmap)** load, namespace-rewrite clashing symbols, splice, recompile atomically (`fink-namespace-preprocessor.js` is the machinery) |

Normative behaviors, E2E-locked in `e2e-dream.mjs`:
- **END at depth > 0 is the pop edge, not the end.** The outer story
  resumes mid-breath (Ink `state.ToJson()` restores position and
  variables both). END at depth 0 is terminal.
- **Depth Principle scoping (v1):** an inner story starts with fresh
  state; writes do not propagate up. (Read-down and sanctioned exports
  are roadmap — the minigame variables contract is the model.)
- The engine publishes retained `story.state`
  `{phase: loading|play|end|fault, depth}`; the shell surfaces depth
  (shelf badge, and the story surface itself degrades with depth —
  reduced-motion honored).

## 4. Choice presentation model

Ink's flat `currentChoices` array **is the truth**. Presentation is a
negotiation layered on top of it, exactly as sigils layer typed data on
JS: renderers that understand the hints do better; renderers that don't
still work.

### 4.1 The shape of a "go"

The canonical beat offers a small **hand** of primary verbs — typically
three:

```ink
+ [BARTER] # CHOICE: verb
+ [RUN]    # CHOICE: verb
+ [STEAL]  # CHOICE: verb
```

Verbs may carry **nuances** — object-use, manner, targets — grouped
under their parent:

```ink
+ [Offer the pocket watch] # CHOICE: nuance # GROUP: barter # NEEDS: watch
+ [Barter loudly, for the crowd] # CHOICE: nuance # GROUP: barter
```

And some knots are **enumerations** — items, people, places — happily
larger than three; the knot declares it:

```ink
=== market_stalls ===
# VIEW: list
+ [The eel stall] ...
+ [The bird cage man] ...
(… a dozen more …)
```

### 4.2 The hint vocabulary (v1)

Knot-level:
- `# VIEW: hand | list | menu | map` — how this knot's choices want to
  be shown. Default `hand`.

Choice-level:
- `# CHOICE: verb | nuance | item | person | place | travel | system`
- `# GROUP: <verb-slug>` — folds a nuance under its primary.
- `# NEEDS: <thing>` — display hint: the renderer MAY show the choice
  disabled-with-reason instead of hiding it. (Existence is still gated
  by Ink conditionals; `NEEDS` is about *communicating* the gate.)

All hints are optional. A hint-free story renders exactly as today.
Unknown hints MUST be ignored. The reference player's keyword→emoji
mapping (`fink-config.js emojiMap`) is a legacy presenter heuristic
that hints subsume.

### 4.3 Ambient affordances

Inventory, skills, maps: these are not narrative choices and MUST NOT
consume slots in the hand. They are **runtime affordances** — always
available, entered via system knots. v1 reality: the injected
`_inventory` knot (reached by UI chrome, ends with `-> END`).
**(roadmap)** system knots become Ink **tunnels** (`-> inventory ->`)
so they return to the interrupted beat, and stories declare their own
ambient affordances with `# SYSTEM:` on `# PUBLIC:` knots; skills are
variables surfaced by the same mechanism (`# CHOICE: system` on
skill-application choices when a beat wants them in-hand).

### 4.4 The Presenter interface — UX vs API

The API boundary is deliberately narrow. A **presenter** receives:

```
{ knotTags, choices: [{ index, text, tags }] }
```

and eventually calls `choose(index)`. Nothing else. Everything between
— popup trees, voice, TTY, d-pad — is the presenter's business:

- **GUI (popup tree):** hand of ≤4 verb buttons; nuances fold into a
  press-and-hold or submenu under their `GROUP`; `VIEW: list` knots get
  a scrollable, searchable list; `NEEDS` renders greyed with the
  missing thing named; ambient affordances live in chrome (☰).
- **Voice:** verbs become the prompt ("You could barter, run, or
  steal."); nuances become a follow-up turn ("Barter — with the watch,
  or loudly?"); `VIEW: list` becomes paged enumeration with
  filter-by-name ("There are twelve stalls. Say a name, or 'more'.");
  ambient affordances are global utterances ("inventory", "what can I
  use?"). The flat index is what's finally chosen — the dialogue tree
  is presenter state, not story state.
- **Degenerate renderer:** a flat button list. Always correct, since
  hints are only hints.

The conformance rule that makes this work: **presenters MUST be able to
reach every choice in `currentChoices`, whatever the hints say.** A
nuance that can't be reached because its parent verb folded wrong is a
presenter bug, not a story bug.

## 5. Minigame SDK

Guest games run in `<iframe sandbox="allow-scripts">` (opaque origin).

- postMessage protocol — host→guest: `init {config:{mode}, variables}`,
  `pause`, `resume`, `terminate`, `key`; guest→host: `ready
  {capabilities}`, `progress {data}`, `set-variable {name, value}`,
  `complete {result:{success, score, variables}}`, `error`, `log`.
- Host→guest also: `variable-changed {name, value}` and, for a world
  beside a story, `story-beat {lines, base, replay}` (§5.8).
- Games cannot divert the story. They mutate declared variables; the
  host resumes Ink on completion. Reactions follow §3.2. A world (§5.8)
  may ask for one thing only: to re-enter the scene the reader is in.
- Packaging: `inklet/minigames/<name>/` with `manifest.json`
  (variables.read/write allowlists, modes, ui, and `features` — browser
  permissions such as `geolocation` that the host grants onto the
  iframe's permissions policy before load; no declaration, no power).
  The live tag routing is the registry in `fink-minigames.js`;
  **(roadmap)** routing moves to the manifest-enforcing `MinigameHost`.
- The host taps the protocol onto the bus (`sys.sdk.tx/rx`) — hidden
  from the default feed, surfaced in the shell's Maker window, which
  also exposes live editable story variables and the dream stack.
- Opaque-origin consequences — normative for guests: `localStorage`
  access throws (shim it — see `magpie/robbin/robbin.html`); module and
  asset fetches require CORS (GitHub Pages provides it; local harnesses
  need a CORS server).
- The host's iframe `onload` handler persists across navigations: a
  wrapper page may redirect to the real game, which then receives the
  re-sent `init`. (`inklet/minigames/robbin/` is the worked example;
  full loop locked by `inklet/finkapp/test/e2e-robbin.mjs`.)

### 5.1 The window model

The game runner is the shell of a small web OS: the story is the
desktop, a running minigame is a **window**. One state machine
(`FinkWM`) owns window geometry:

- Modes: `full` (window owns the screen) · `split` (story and game
  genuinely share it) · `pip` (a live corner viewport). **Pause is
  orthogonal to geometry** — any mode can be paused, and pausing never
  moves the window.
- The chrome (title-bar toolbar) is itself a first-class window
  citizen: draggable by its grip, docks to a screen edge (persisted),
  and collapses to the grip alone. It is reachable in every mode.
- **No one-way doors — normative:** every mode MUST be exitable by a
  direct gesture. Pip restores on tap; in pip the window is a viewport,
  not a control surface (guest input is suspended).
- Mode changes are presentation only: they send no SDK messages except
  pause/resume, and never touch story state.
- **Exactly one geometry owner — normative.** No other module may set
  position, size or z-index on the game window. Retiring a geometry owner
  means deleting its CSS as well as its buttons.
- **Mode changes settle — normative.** A mode change MAY be one of a
  burst; the host MUST coalesce and, once the window stops moving, perform
  one authoritative layout and send `{ type: 'resized', mode }` to the
  guest. Guests SHOULD debounce their own rebuild on that message, because
  each rebuild reallocates a canvas backing store.

**Guests fit their frame — normative.** A guest's document MUST NOT be
taller or wider than the frame it is given: `document.body.scrollHeight`
MUST equal `window.innerHeight`. Overflow is invisible at full screen
(`overflow: hidden` hides it) and becomes clipped gameplay in a short
split pane. The three recurring causes are padding outside a `100vh`
box under `content-box`, an inline-replaced `<iframe>`/`<canvas>` sitting
on the text baseline, and an absolutely-positioned visually-hidden element
left at its static position.

Locked by `inklet/finkapp/test/e2e-wm.mjs` (which regression-tests the
two failures of the retired slider panel — a split state that crushed
the game to a 4px sliver, and a mini state that hid its own restore
control — plus a flip storm that asserts the panes still tile, the guest
still fits, and the canvas backing store tracked the resize).

### 5.1.1 Input is a host service — normative

Directional input belongs to the shell, not to each guest:

- The host renders the on-screen pad. **A guest MUST NOT render its own
  touch controls when `init.config.controls.provider === 'host'`.** A
  pad inside a sandboxed iframe cannot see the visible viewport or the
  device's safe-area insets (`env(safe-area-inset-*)` is 0 there), so
  guest pads land under browser chrome — this is a correctness rule,
  not a style preference.
- Sources (touch, keyboard, gamepad) normalize to one vocabulary:
  `up down left right a b start`. The host translates to the existing
  SDK `key` messages, so guests written before this rule keep working.
- Autorepeat, deadzones and edge-detection are the service's policy
  (`packages/foafos/src/input.mjs`). A connected gamepad retires the
  on-screen pad.
- **Accepting the service obliges the guest to handle `key` — normative.**
  A guest that hides its own controls and does not act on the host's
  `{ type:'key', … }` message has no input at all. Guests using the SDK
  get this free; a guest with its own bridge MUST implement the case.
- **A guest whose game lives in a nested frame MUST forward the raw
  message.** The SDK dispatches its synthetic KeyboardEvent on the
  document it was loaded in, which for a wrapper is not where the game
  is. Include `inklet/minigames/host-keys.js` in the nested document to
  replay it.
- **`repeat` is part of the message — normative.** The service
  autorepeats a held button; games use `e.repeat` to tell a hold from a
  fresh tap, so the flag MUST survive the trip to the guest.
- Window geometry MUST use the visible viewport (`100dvh`), not `100vh`.
- **Sticks (September 2026).** A guest that steers in 3D needs values, not
  four directions. Its registry row says `controls: 'sticks'`, and the
  guest registers SDK `onSticks`, which declares the `sticks` contract. The
  host's pad then shows two analog sticks in place of the d-pad and the
  buttons, and the guest receives `{ type: 'sticks', l: [x, y], r: [x, y] }`
  whenever a value changes: from the on-screen sticks, and from a
  gamepad's two sticks (axes 0-1 and 2-3). x is right +, y is up + (the
  Gamepad API's y is down +, and is turned), each -1..1 inside the unit
  circle, 0 inside a dead zone of 0.12. Level, not events: the guest keeps
  the last values; a release and a gamepad unplugged send zeros. The host
  does not also send a gamepad's directions as keys to such a guest (they
  would move it twice); the keyboard's directions and the buttons still
  go as keys. With a world open on a phone, the pad sits above the story
  window, over the world (§5.8).

Verified end-to-end in `inklet/finkapp/test/e2e-input.mjs`, which plays
the Konami code once per controller — keyboard with the guest focused,
keyboard with the shell focused, the on-screen pad, and a gamepad. Ten
ordered presses mixing directions with A and B, where any wrong token
resets the sequence, is the strictest available proof that a controller
is genuinely wired rather than merely present.

### 5.1.2 The conformance probe — normative

The shell cannot inspect a guest: opaque origin, no DOM access. So "does
this widget know its duties?" can only be answered by asking and seeing
who answers.

- `init.config.contracts` lists the OS contracts the shell is offering
  (v1: `['controls', 'audio', 'snapshot']`).
- A guest that speaks a contract replies
  `{ type: 'conformance', contracts: [...] }`. It may reply at any time;
  replying repeatedly is harmless.
- If nothing arrives within the grace period (2.5s — a redirecting
  wrapper has a second document to load), the shell concludes the guest
  **predates the contract**, and therefore is doing its own thing.

**The rule is adaptation, not compliance.** On non-conformance the shell
RETRACTS the equivalent service rather than stacking on top of it:

- it sends `{ type: 'controls', controls: { provider: 'guest', … } }`
- it hides its own d-pad
- it publishes `sys.guest.nonconforming`, which the announcer speaks

So silence costs a legacy widget nothing: it keeps working exactly as it
did standalone. Adaptation costs one line — `sdk.onControls(cb)`, which
both applies the policy and answers the probe, because registering a
handler IS the answer. Guests speaking the protocol natively post the
`conformance` message themselves (see `magpie/robbin/robbin-game.js`).

**Retraction must never produce a dead game — normative.** A guest that
already hid its own controls has to be told to put them back, which is
why retraction sends `controls` rather than simply hiding the pad. For
the same reason a LATE `conformance` is honoured and the service is
restored: a brief flicker beats a game nobody can play.

This replaces "guests MUST hide their own touch controls" (§5.1.1) as
the *enforcement* mechanism. The obligation still stands for guests that
opt in; the difference is that the shell no longer assumes it.

### 5.2 Verbs and native handlers

Widgets and minigames MUST be fully playable standalone, with their own
— deliberately unstandardized — handlers for pausing, quitting,
settings, and the rest. The shell imposes only a **loose global
consistency**: a small verb vocabulary with fixed names and meanings,
implemented however each guest likes.

- Verbs (v1): `pause`/`resume`, `quit`, `audio-blur`/`audio-focus`.
- A guest declares the verbs it handles natively in its `ready`
  message: `capabilities: { verbs: ['quit', 'audio'] }`.
- For a **declared** verb the shell DELEGATES: it sends the verb
  message and stays out of the way (no frost overlay over a game that
  presents its own pause; no `terminate` when `quit` routes to the
  game's own confirmation dialog — the guest completes via the normal
  SDK path when the player decides).
- For an **undeclared** verb the shell applies its generic fallback
  (frost-pane pause, hard terminate). Undeclared is always safe:
  guests ignore unknown messages.
- Escape hatch — normative: delegation must never create a stuck
  window. The reference host hard-terminates if exit is pressed again
  within 10s of a delegated `quit`.

The declared-verbs pattern follows the edot kernel's capability
registry (`docs/edot/command-registry.md`): stable string ids, native
per-app implementations, contextual applicability. Worked example:
robbin declares `quit` (routes to its paper dialogs) and `audio`
(bus ducking) but NOT `pause` — the tube deliberately has no pause
concept, so the shell's generic pause is the correct fallback there.

### 5.3 Variable governance — normative

A guest is untrusted code. `manifest.json`'s `variables` block is its
**capability**, not documentation:

- The host resolves the manifest **before** the guest's `src` is set,
  and a guest with no manifest is granted no writes at all. Failing open
  would make the whole mechanism theatre.
- Every path a guest can reach — `set-variable`, `progress` (the
  gems→`diamonds` and score bridges), and `complete.variables` — goes
  through the broker. A name absent from `variables.write` is REFUSED.
- `init.variables` is filtered by `variables.read` ∪ `variables.write` ∪
  the shared economy ∪ host context. A chess game cannot read a
  whodunnit's plot flags.
- Refusals are events (`vars.denied`), never silence: an honest bug and
  a cheat look identical from the host, so both get surfaced.

Two name classes:

| class | names | meaning |
|---|---|---|
| **shared economy** | `diamonds`, `mega_diamonds`, `keys`, `score`, `minigame_played` | cross-work **on purpose**; one slot, many works |
| **private** | everything else | belongs to the work that declared it |

Independent stories run as separate `Story` objects, so two works using
`points` are never actually wired together — but a guest granted that
name writes into whichever story is hosting it. That is the cross-work
hazard, and `inklet/tools/fink-vars.mjs` reports it (`--strict` fails
CI). Private names may be namespaced per work as `<workId>__<name>`
(`FoafVars.scopedName`).

**Depth rule — normative:** inside a dream (§3.4, depth > 0) the shared
economy is READ-ONLY. A dream may keep its own private counters but MUST
NOT spend the waking world's diamonds. Things true above are true below;
they are not changeable from below. This governs the **variable bridge**
— what guests and the host may push into the story — not Ink's own `~`
assignments, which are the dream's internal logic and run unimpeded.

Values are bounded (±10⁶ by default) and must be finite. A game that
"earns" 10⁹ diamonds is reporting a bug, not a score.

A permitted write to a name **nothing declares** is not an attack but is
still a defect: Ink refuses assignment to an undeclared variable, so the
value would vanish inside the host's `try`. The broker keeps it in
`scratch`, publishes `vars.unbound`, and the tool reports it. A story
opts in to a guest's result simply by declaring the `VAR`.

### 5.4 The debug clock — normative for guests

Under software rendering a moving game is a blur, so "look at the frame"
is not a debugging strategy. The platform provides slow motion instead,
as a service rather than a per-game feature:

- Host→guest message: `debug {timeScale, stepFrames}`. `timeScale` 1 =
  real time, `0.02` = 50× slow, `0` = frozen; `stepFrames` advances
  exactly n frames while frozen.
- `inklet/minigames/debug-clock.js` implements it once and MUST be
  included by any guest, whether it uses `minigame-sdk.js` or speaks the
  protocol natively. It virtualises `requestAnimationFrame`,
  `setTimeout`, `setInterval`, `performance.now` and `Date.now` by
  delivering every k-th real frame (k = 1/scale) with a normally-advanced
  timestamp — so both fixed-step and dt-integrating games slow down
  correctly, unmodified, with identical per-frame behaviour.
- Nothing is patched at scale 1: normal play is untouched.
- It patches ONE document. A guest wrapping another game in a nested
  iframe MUST forward the `debug` message inward (see
  `inklet/minigames/battleboids/index.html`).
- Standalone: `?timescale=0.02` on the guest's own URL.
- Host surface: `window.__finkDebug` — `.slow(50)`, `.freeze()`,
  `.step(n)`, `.normal()`, and `.state()`, which returns the running
  guest, its window/WM geometry, its granted capability, and the
  governance ledger in one call. `?slow` / `?timescale=` on the shell.
  Guest surface: `window.__mgDebug`.

### 5.5 Audio is a host service — normative

Volume and mute belong to the shell, not to each sound source. Guests
receive `init.config.audio = {level, volume, muted}` and, if they declare
the `audio` contract (§5.1.2), `{type:'audio-level', level, …}` on every
change. `level` is `muted ? 0 : volume`, so mute never destroys the
level a person chose.

**The honest limit — normative.** A guest runs in a sandboxed iframe with
its own AudioContext, and there is no `iframe.volume`. A master volume is
therefore only real for:

- same-document sources (FinkAudio, FinkFoley), whose gain the shell owns
- guests that answered the `audio` probe
- app windows whose frame answered (the shell offers the same contract to
  launcher windows, not just minigames)

A guest that never answers **cannot be turned down**, and the control MUST
say which sources it cannot reach rather than showing a slider that
quietly lies (`FoafAudio.coverage().uncovered`). Registries SHOULD mark
which apps make sound (`audio: true`) so the disclosure lists noisy
silent-by-nature apps, not every open spreadsheet.

**Spoken lines are played by the shell — normative.** iOS starts sound
only in a document that has had a tap, and a new sandboxed frame has had
none (beside a story the taps go to the runner and to the shell page). A
stage guest SHOULD therefore not play a recorded line itself. It sends
`{type:'speech', action:'play', url, id}` (SDK `speak(url, id)`), and the
shell plays the file from its own page under the master volume. The shell
MUST refuse a guest whose node does not hold `audio`, and a file from
another origin than the guest page. It answers with
`{type:'speech-state', id, t, playing, ended, waiting, error, cut}`, about
20 times a second while the line plays, so a guest can move a face's lips
from `t`. One line plays at a time; a new line cuts the last (`cut:
true`). Where the shell page has had no tap either, the line waits
(`waiting: true`) behind a "Tap for sound" button that the shell shows.
`{type:'speech', action:'stop'}` (`stopSpeech()`) stops it. A guest's own
synthesised sound (its AudioContext) is not covered: it still needs a tap
in the guest's own frame.

### 5.5.1 Apps, surfaces and capabilities — normative

There is **one class of runnable thing: an app.** A story widget, a maze,
a spreadsheet and a channel player are all apps. Two properties describe
one, and they are independent:

- **`surface`** — where it is drawn: `stage` (the window manager's game
  window), `window` (a floating shell window), `story` (loaded into the
  story engine), `panel` (shell-native UI). **Surface confers no
  authority.** Being drawn in a window MUST NOT grant anything that being
  drawn on the stage would not.
- **`capabilities`** — what it may do: `storage`, `vars:read`,
  `vars:write`, `audio`, `input`, `geolocation`. Anything absent is
  unavailable, and the app MUST be told which capability it lacks rather
  than receiving an opaque platform error.

**The default is an opaque origin.** An app frame is sandboxed
`allow-scripts` (plus `allow-forms`/`allow-modals`), giving a distinct
security context with no `parent.document`, no shared storage, and no
route to another app. The host derives the sandbox from the declared
capabilities; it MUST NOT derive it from the surface.

**`same-origin` is a capability, not a default.** It drops an app into
the shell's own origin, where every other broker becomes advisory. It
exists only as a declared migration path for apps still using ambient
`localStorage`/`indexedDB`. When granted, the host MUST announce it
(`sys.app.ambient`) and MUST list the holders in a user-visible surface.
The target is zero holders.

**Storage is brokered (`FoafStore`).** The shell holds the bytes; the app
holds a capability. Each app gets a namespace it cannot name its way out
of, with a quota. A refused write MUST leave the previous value intact —
a half-applied write is worse than a refused one. An app without the
capability MUST receive `null` from a snapshot, never `{}`: an empty
object reads as "no data yet" and invites an overwrite.

The protocol is `app.hello` (guest→host, "I speak this") answered by
`app.init { appId, capabilities, store }` carrying the app's whole
keyspace, so a synchronous storage shim is warm before the app's first
line runs. Writes are proposals: `store.set`/`store.remove`/`store.clear`
guest→host, with `store.refused` back when the broker declines.

Locked by `inklet/finkapp/test/e2e-caps.mjs`, which asserts the boundary
by *trying to cross it* — `parent.document`, `parent.FoafOS` and
`localStorage` must all throw inside a de-privileged app.

### 5.5.2 The status line belongs to the story — normative

The player MUST NOT hardcode a status line. A story declares its own with
`# STATUS:` tags, one per item, in declaration order:

```ink
# STATUS: flock_size icon=🐦 label=flock always
# STATUS: fuel icon=⛽ format=bar max=8 always
# STATUS: none          -- no status line at all
```

- Items are keyed by **variable**. A knot the reader loops through
  re-declares its tags on every visit, so a repeat declaration MUST
  update in place rather than append.
- `format`: `number` (default) · `bar` (needs `max`) · `percent` · `time`
  · `text`. Unknown formats fall back to `number`.
- Items hide at zero unless `always`. Each item MUST carry an accessible
  name pairing the value with what it counts — an emoji alone is silence
  to a screen reader.
- Declared items MUST be cleared when a new story compiles, or one
  story's HUD follows the reader into the next.
- A story that declares nothing keeps the host's default, so existing
  stories are unaffected.

### 5.5.3 Service inventory — normative

Some capabilities are brokered per app; others are services the shell
owns and mediates; others are named in the vocabulary with nothing behind
them. A host MUST be able to report which is which (`FoafOS.services()`),
with `state` ∈ `brokered` | `shell` | `unimplemented`, and MUST surface
the unimplemented ones to the user rather than letting the vocabulary
imply a boundary that does not exist. Today: `storage`, `vars`, `audio`
and `input` are brokered; `wm` and `announce` are shell-owned;
`geolocation`, `capture`, `gpu` and `cast` are named but unimplemented.

### 5.5.4 Snapshot and restore — normative

Closing a guest destroys its browsing context and everything in it. The
shell cannot serialise an opaque origin from the outside — no DOM, no
globals, not even `localStorage` — so continuity across a close is only
possible by **asking the guest**, exactly as with every other service
here.

- A guest that registers `onSnapshot`/`onRestore` thereby declares the
  `snapshot` contract (registration IS the conformance reply, §5.1.2).
- On close the shell sends `{ type: 'snapshot' }` to a declaring guest
  and waits for `{ type: 'snapshot-data', state }`, routed by
  `event.source` like every other guest message. A guest MAY answer
  `null` to decline — mid-animation state that would restore to a board
  disagreeing with itself is better refused than saved.
- The wait is **bounded** (400ms). A guest that declared the contract and
  then goes silent MUST NOT be able to hold a window open: losing state
  is bad, a window that will not shut is worse.
- A window app MAY also send its state **unasked**, each time it changes:
  `{ type: 'app.snapshot-keep', state }` (`keepSnapshot` in the app SDK),
  where `null` declines as above. The shell holds only the latest one, in
  memory. When the close gets no answer within the bound, the shell writes
  that state instead and marks the close `late`. Reason (measured, September
  2026): a frame can share a thread with another one. A story runner and the
  game it launched stopped together for up to 1.15s, so a close in that time
  lost the reader's place. A kept state is written only on close; it does not
  change what survives a reload.
- A write that the store refuses (for example over quota) MUST NOT be
  reported as kept.
- The shell MUST NOT destroy the frame before the answer can arrive.
  This is the whole difficulty of the feature: a request posted in the
  same tick as the teardown looks correct, runs without error, and
  captures nothing. Implementations MUST be tested by comparing state
  *through* a close, never by the presence of the code path.
- On next open the shell sends `{ type: 'restore', state }` immediately
  after `init`, so a guest registering `onRestore` inside `onInit` still
  receives it; the SDK holds a restore that arrives before its handler.
- The host MUST disclose, **before** the close is pressed, whether the
  running guest will keep its place. A guest that predates the contract
  is reported as such, not silently lost.
- A guest that **completes** (win or lose) clears its saved state. A
  finished game has nothing to resume, and without this rule "keeps its
  place" would mean the player can never start a fresh run.

State is keyed by guest type and written through to FoafStore under a
shell-owned namespace, so it survives a reload. The guest cannot read
that namespace — it receives only the `restore` it is handed. An
installation whose root lacks `storage` gets no persistence, because the
namespace is never granted: attenuation applies to the shell's own
conveniences too.

### 5.5.5 Secrets and brokered actions — normative

**A secret is not storage.** The one guarantee a storage broker makes —
you can read back what you wrote — is the one guarantee a credential
cannot afford. `secrets` is therefore a **separate capability** from
`storage`: an app that may remember preferences MUST NOT thereby be able
to keep tokens.

Measured before this rule existed: an app's "stay signed in" moved a
bearer token from `sessionStorage` to `localStorage`, which under the
shell is the brokered shim, so the token landed in the shell's own
origin, in plaintext, on disk. Nothing had been broken. That is what a
storage broker is *for*.

The secrets interface is deliberately asymmetric:

| | |
|---|---|
| `PUT` | an app MAY hand a secret over |
| `NAMES` | an app MAY ask which of its **own** secrets exist |
| `USE` | an app MAY ask the shell to act with one |
| `GET` | **there is no get** |

- `get` MUST be present only in order to **refuse**, with an explanation
  of what to do instead. A documented refusal is a design; a missing
  method is an omission. The refusal MUST also be given over the
  transport (`secrets.refused`, `reason: 'not-readable'`), not only in
  the SDK — an app that bypasses the SDK must meet the same wall.
- `names` MUST return `null`, not `[]`, when the capability is absent:
  absent is not empty.
- Sealing at rest requires a passphrase (AES-GCM + PBKDF2 over the
  session). With no passphrase the host MUST hold secrets for the run
  only and MUST report `sealed: false`. Writing them out unsealed is the
  exact failure the feature exists to prevent, so it MUST NOT be offered.
- The host MUST be able to report that a sealed store exists but is
  locked, distinctly from holding nothing. They are different situations
  for a user, and reporting the second for the first invites them to
  replace a credential they still have.
- Unsealing restores values, NOT grants. An app's entitlement is granted
  when it launches, so a restored secret MUST stay ungrantable to an app
  that is not running: attenuation is not suspended by a reload.
- Clearing the session MUST clear the secrets with it. A sealed credential
  surviving an explicit "forget" is the worst available reading of it.
- A failed use MUST report the error **type** and never its message: a
  fetch failure's message and URL routinely contain the credential.

**Brokered actions.** Because there is no `get`, "use" needs a meaning,
and the meaning MUST NOT be "run this function the guest supplied" — a
guest-supplied function receiving the value is `get` with extra steps.
So the transport carries a verb NAME and data (`{ type: 'verb', verb,
detail, rid }`, answered by `verb.result`), and the host owns the
dictionary of what verbs exist.

> **THE SCOPE SUPPLIES THE DESTINATION. THE APP SUPPLIES THE DATA.**

This is normative, not stylistic. An operation that took its host, repo
or bucket from the caller would be a signed-request-to-anywhere primitive
with a live credential attached. Therefore:

- The **operation** declares which secret it uses. A caller MUST NOT be
  able to name one.
- The **grant** names the destination, and the host MUST validate a scope
  when it is set rather than when it is used, so a misconfiguration fails
  at boot and not at a user's first save.
- The app MAY contribute a path, which MUST be rejected outright if it
  contains `..` (refused, never resolved) and MUST be checked against the
  grant's prefix as a path boundary, not a string prefix.
- A verb with **no scope configured MUST be refused**, and SHOULD NOT
  appear in the list of verbs the app may call. A verb aimed nowhere must
  not act.
- A verb grant requires **both** conditions: the app tree granted the
  capability (attenuation still applies, §5.5.1) **and** a scope exists.
  A stored scope MUST NOT resurrect a capability the tree denied.
- Results MUST carry a status code and MUST NOT carry the provider's
  response body: error bodies routinely quote the credential back.
- Every refusal MUST be a named reason (`denied`, `bad-scope`,
  `bad-params`, `throttled`, `no-secret`, `unknown-verb`, `http`), never
  silence.

Locked by `packages/foafos/test/{secrets,ops,sigv4}.test.js` and the
`e2e-caps.mjs` legs, which test the property that matters — an
**absence** — by grepping the whole observable surface for the value, and
by attempting to redirect a brokered credential to a destination that was
never granted.

### 5.5.6 Network egress — a stated limit of the reference deployment

**The sandbox controls what an app receives. On GitHub Pages it cannot
control what an app sends.** Owner, September 2026: "It is ok our
instance of server is on gh pages but since that makes net egress
unblockable we must document that situation ie apps can blab to arbitrary
hosts without tighter server."

- Any app frame can send any data it holds to any host on the internet:
  by fetch (no-cors), image, `sendBeacon`, form POST (window apps have
  `allow-forms`), and WebRTC. This includes the text of every document
  the reader opens in that app, every story line a world receives, and
  every value a broker gave it. Measured in Chromium; see the fink skill,
  "Limits of the sandbox partition".
- A `<meta>` CSP in the app's page does not stop WebRTC, and an app can
  leave it out anyway. The iframe `csp` attribute (CSP Embedded
  Enforcement) would let the shell impose `connect-src` on a frame, but
  the frame then loads only if its response sends `Allow-CSP-From`.
  GitHub Pages cannot set response headers, so on this deployment the
  shell has no way to impose an egress policy.
- The brokers (storage, secrets, variables, verbs) still hold. A secret
  is never given to an app, so an app cannot send it. What an app is
  GIVEN, it can send.
- So on GitHub Pages foafos protects **integrity and powers** (what an app
  may change, launch, read from the shell, or use a credential for) but
  NOT **secrecy against the app itself**. Opening a document in an app
  is telling that app's author the document, if the author wants it.
- A host MUST say this to the reader where the powers are shown. The
  reference shell says it in the Task Manager's "The sandbox and its
  limits" panel.
- Closing it needs a server that sets headers: `Allow-CSP-From` on app
  pages plus an iframe `csp` with `connect-src` limited to a network
  broker, and a CSP on the shell page itself. WebRTC and DNS lookups need
  checking per browser even then. A Cloudflare front for the same files
  is being considered (September 2026).

### 5.6 Shell surfaces: home and switcher

Two affordances the platform borrows rather than invents, because every
device already teaches them:

- **Home** — a grouped grid of installed apps (`FoafOS.openHome()`,
  Alt+H). One grid for every family; the shell does not know which app is
  an office document and which is a maze.
- **Switcher** — a list of what is running (`FoafOS.openSwitcher()`,
  Alt+Tab), assembled from every subsystem that has its own idea of a
  window: the story, the WM's game, embedded guest instances, and shell
  windows.

Both are `role="dialog" aria-modal="true"`, close on Escape, and open
focused. Alt+M toggles mute. Shortcuts MUST NOT fire while a text field
or contenteditable has focus.

The installed set is **content, not platform**: `foafos-apps.js` lives
beside the shell instance, never in `packages/foafos` (NPM boundary).

### 5.7 Guests and window apps on the bus — normative

Stage guests are full foafos apps: spawned in the app tree under the
app that summoned them (the story), and SPEAKING on the shell bus
through a scoped view. Window apps (office documents, TV widgets) hold
the same citizenship. One wire protocol serves all three guest kinds
(`<foafos-guest>` widgets, stage minigames, window apps):

    guest → host   { type: 'bus-publish', topic, data }
    host  → guest  { type: 'bus-event', event }          (granted only)

- The SHELL builds the scoped view (`scopeBus`) and owns the policy;
  the frame hosts (`FinkMinigames.attachBus`, `governAppFrame`) only
  route. Grants come from the app's registry entry (`bus: {publish,
  subscribe}`) or the surface default: a stage guest may publish
  `guest.<type>.*` and hear `wm.mode`, `audio.volume`, `story.state`;
  a window app may publish `app.<id>.*` and hear `wm.mode`,
  `audio.volume`, `ui.skin`.
- Every publish is stamped with its speaker (`guest:<type>#<instance>`)
  — two copies of one game are two voices, and provenance survives the
  bridge because routing is by `event.source` before any grant check.
- A publish outside the grant is dropped AND announced
  (`sys.guest.denied`), never silent: an honest bug and a cheat are
  indistinguishable at the host, so both surface.
- Guest side, the SDK exposes `sdk.bus.publish(topic, data)` and
  `sdk.bus.subscribe(pattern, cb)`; using either declares the `bus`
  contract (registering a handler IS the answer, §5.1.2). Grants ride
  in `init.config.bus` so a guest need not learn them by being denied.
  Standalone, both are honest no-ops.
- The scoped view closes with the instance (`_dropInstance`, window
  teardown) — a closed app keeps no voice.

E2E: `inklet/finkapp/test/e2e-bus.mjs` — posts its attacks from inside
real guest frames. SDK wire shapes pinned offline in
`packages/finkgame/test/run.js`.

### 5.8 The world beside a story (`# WORLD:`) — normative

A story may name a stage app that shows the world the story happens in:
`# WORLD: <name> [key=value …]`. Unlike `# MINIGAME:` it does not break the
beat or pause the story, does not take the screen from the story window,
and never completes. Added September 2026, so that Drift City plays its
stories in the foafos runner instead of an Ink engine of its own.

- The runner asks with the verb `story.world` (authority `story:launch`).
  `open {app, args}` passes the same checks as a game: a registered stage
  app, parented under the session that asked, holding nothing its parent
  does not. The shell starts it with `world=1` added to its arguments, and
  replies `{ok, reads}`, where `reads` is the registry row's
  `variables.read`. One world per runner; opening the one already open
  replies `reused`.
- After every step the runner sends `beat {lines, base}`: each line with
  tags the runner does not handle itself, as `{tags, text}`, and the
  story file's address, for paths in tags. The guest receives
  `{type: 'story-beat', lines, base, replay}` (SDK `onStoryBeat`, which
  declares the `world` contract). The host holds these messages until the
  guest declares that contract, because a world's page may still be
  loading when the first step is sent.
- Story to world: the runner observes the variables in `reads` and sends
  their values at open and each change, as `vars {values}`. The shell
  passes on only names in `reads`, as `variable-changed`.
- World to story: the guest's `set-variable` goes through the variable
  broker (§5.3), with the row's `variables.write` and `vars:write` on the
  world's node. An accepted write goes to the runner as
  `story.event world.var {name, value}`, and the runner assigns it at once;
  a name the story does not declare is dropped.
- When the world's node closes, the runner gets `story.event world.closed`
  and plays on as text. The world is a child of the session that opened
  it, so a replacing link or the end of a dream closes it too.
- The runner's snapshot (§5.5.4) carries `world: {tag, lines}`: the last 60
  lines sent. A restore opens the world again and sends those lines as a
  `replay` beat, which rebuilds places and props and does not speak again.
- A world may move the story in one way only (owner's decision, September
  2026): it may ask the story to re-enter the scene the reader is in, after
  something in the world changed it (a clue found, the reader moved to a
  `# live` scene). Guest SDK `reenterScene(scene)` sends `story-reenter`.
  The shell passes it on only from a world instance whose node holds
  `story:steer` (the runner and the root hold it to confer it), as
  `story.event world.reenter {scene}`. The runner accepts only the knot that
  the story's last `# scene:` tag named, only while the story is ready and
  no game plays, and then does `ChoosePathString(scene)` and continues. A
  variable the world sets first (`set-variable`) arrives before the
  re-entry, so the scene reads it. A story that uses a world still keeps a
  text route for anything found in the world (the story-game-sync skill,
  Fallbacks).

### 5.9 One window menu, and the app's own actions — normative

Owner, September 2026: "The settings we had in a hamburger menu should be
formalised via foafos menuing … possibly via actions registry. Similarly
the window manager buttons should all be hidden behind a single
os-mediated structure which might show as hamburger menu."

**One menu per game window, drawn by the shell.** Over a stage app the
shell draws exactly one control: ☰ ("Window menu"). It opens a panel of
labelled rows, in this order:

1. the title: the app's name, and in split which pane it serves;
2. the window: Full screen, Split with story, Picture-in-picture, Swap the
   panes (in split), Pause / Resume;
3. On-screen controls (only while the shell's pad applies to this app):
   Always shown, Faint until touched (the default), Hidden until touched,
   Off. Per device. Hidden still takes touches where the controls sit;
   Off removes them (keyboard, gamepad, or the app's own touch remain);
4. the app's own actions (below), under the app's name;
5. Exit the game.

A row that DOES something (a mode, swap, a command, exit) closes the
menu; a row that SETS something (pause, the pad, a check) leaves it
open. Escape, a tap outside, and focus moving into a frame close it.
Enter or Space on ☰ opens it. It is a disclosure (a button and a panel
of buttons), not an ARIA menu, so every row is an ordinary button.

**The app's actions are data** (SDK):

```js
sdk.setActions([
  { id: 'time', label: 'Time and weather', items: [
      { id: 'time/night', label: 'Night', checked: true },
      { id: 'time/day',   label: 'Day',   checked: false } ] },
  { id: 'map', label: 'City map' },          // a command
]);
sdk.onAction((id) => run(id));              // declares the `actions` contract
```

- `checked` (true or false) makes a setting; `items` makes a group that
  opens in place (depth ≤ 4); anything else is a command. `detail` is a
  short note on the right. Labels ≤ 80 characters. `closes: true` on a
  setting closes the window menu after it is chosen (a setting otherwise
  keeps it open): for a setting whose point is the view, such as Drift's
  "Pause the city", which stops the world so the reader can tap in it.
- The shell's own pause row reads "Pause everything (sound too)": it
  frosts the app and stops its sound. An app's own pause (Drift's) is a
  different thing and says what it keeps going.
- The list replaces the last one; send it again when a label or a check
  changes. The shell keeps it per instance and draws the playing one's.
- The shell sends back only an id the app offered
  (`FinkMinigames.runAction`); a forged id is dropped.
- Ids should come from the row's place in the app's own menu (Drift uses
  the path of labels), so that a changed menu makes an old id find
  nothing, not the wrong row.
- Standalone, an app draws its own menu as before. Inside foafos it hides
  its own ☰ and offers the same rows as actions: one menu on the screen.

Reference: `inklet/finkapp/fink-wm.js` (the menu), `foafos-shell.js`
(`FoafOS.pad`), `packages/finkgame/src/minigame-sdk.js` (`setActions`,
`onAction`), `drift-city/src/host.js` (the first app to use it). Locked by
`e2e-wm.mjs` 1-3, `e2e-input.mjs` 0b and `e2e-drift.mjs` 20a.

Not done yet: window apps (office, players) have no actions; the menu does
not tell the app that it opened (Drift's own menu paused a guided tour
while open); the pad's "B" still sends Escape to the app.


**One menu (September 2026).** The ☰ is the one menu, with or without a
game. With no game it sits bottom right (where the ⊞ dock was) and shows only
foafos's own rows (`wm-shell-only`). What the side drawer held is pages of it:
Sound (mute, volume), Look (the skins), Widgets, and Session and capabilities
(a window). The dock is not shown; the drawer stays as an API
(`FoafOS.openDrawer`) for its feed and shelf. Owner: the drawer was a "super
ugly archaic side menu which should be assimilated into the one true menu
system". The owner's direction: a radial menu with a top-level fork between foafos
and the running cluster of apps, stories, minigames and documents (a
"project"). A first version is a setting (☰ › foafos › Look › "Menu as a
ring"; `foafos.menu.radial` in the browser's storage): the first ring is the
fork, the project's ring holds the app's own rows with "Window", "On-screen
controls" and Exit, and foafos's ring its rows and pages. A ring item clicks
the list row it stands for, so the two cannot drift apart; eight to a ring,
then "More". Keyboard: the arrow keys move round, Escape closes.
### 5.10 The activity stream and the app's readout — normative

Owner, September 2026: talking heads were "icons within world view.
Promote them into foafos, maybe a generic Activity Stream like Facebook
/Friendfeed had? Same with the text/info at bottom of world view showing
stats."

**Activity** (SDK `post({who, text, image?, verb?, live?})`). The shell
publishes `activity.<app>` on the bus; its feed (the ⊞ drawer) draws each
as a `foaf-activity` card: a face or an initial, who, the app, the time,
the text. The newest one or two show over the app's pane for a few
seconds (one when the pane is short); a tap opens the history.

- `image`: a `data:image/(png|jpeg|webp)` URL of at most 120 kB.
- `live: true` (a face that speaks): the app then sends frames with
  `postFrame(ImageBitmap)` (transferred, about 15 a second) and
  `endLive()` when the line ends. The card draws the frames; the item
  reaches the feed at the end, with the last frame as its still. A live
  item that never ends is closed after 30 s.
- Frames are not logged and not put on the bus: the bus is mirrored to
  other tabs, and a bitmap 15 times a second does not belong there.

**Readout** (SDK `setStatus(items)`, `[{id, label?, value, icon?}]`, at
most 6). Published retained as `app.<id>.status` (the menubar reads it)
and shown under the title of the window menu (§5.9).


**The Activity window (September 2026).** Nothing is drawn over an app's
pane. The stream lives in a window the shell manages: the `activity` panel
app (`foafos-apps.js`), opened from the window menu ("Activity: who said
what"). A face that starts to speak opens it as a short strip across the top
(`makeWindow(..., { float: true })`: it does not maximize on a phone), unless
the reader has closed it; then new items are counted on the ☰ instead. It
holds the live card and the history (a `foafos-feed` on `activity.*`, which
replays). Owner: the items "only render within monolithic World pane, not
managed in foafos"; the talking heads were "an activity bar shown in main
world view not separately in foafos".
### 5.11 The selection — normative

Owner, September 2026: "an object picker so clicking in the world gives
us a building, person or entity to feed into other lookups/actions or
visually highlight … something for fly to vs walk to".

The app decides what was picked and marks it in its own view; the shell
shows it and publishes it. SDK `select({id, kind, name, detail?, where?,
actions?})`, or `select(null)`:

- `kind`: building, person, place, vehicle, room, thing (an icon each).
- `id` says what it is in the app's own terms (Drift: `building:<cx>,<cz>`,
  `person:<slot>`, `ship:<n>`, `place:<name>`).
- `where`: a position the app can state; Drift gives IAU_2015:60600 (see
  the drift-city skill, "Coordinates").
- `actions` (≤ 6, `{id, label}`): drawn as buttons on the shell's
  selection card; a chosen id comes back to `onAction` like a menu action,
  and only an offered id is sent. ✕ clears it and the app hears
  `onDeselect`.
- Published retained as `app.<id>.selection` `{entity}`, so another app
  granted the topic can look the thing up.

Locked by `e2e-drift.mjs` 20a-20c.

## 6. Links, navigation, identity

Incorporates `docs/fink-linking-spec.md`: two-part SHA-256 hash links
`#<urlHash8>-<knotHash9>` (salt `glitchcan-fink-v2`, v1 legacy
fallback), public knots (not `_`-prefixed), `?d=` encoded variable
state, `?story=`/`#story=` direct loads.


**Where the world goes — normative.** The world's place on screen is the
reader's choice, made with the window manager (FinkWM: full, split, pip).
The shell follows the mode: in split the story window takes the part of
the screen the stage leaves; in full the story stands aside; in pip the
stage floats above the story. The mode control MUST stay reachable above
the story window. A shell MAY choose the first mode (split on a narrow
screen); it MUST NOT fix a placement the reader cannot change. In split
the reader sets the share with a grip on the seam and may swap the order
(the window manager keeps both per device). The layout moves only the
story window that owns the world: other open apps keep their places.


`facts` (optional, up to 4): labelled lines about the thing,
`{ label, value }` (label ≤ 20 characters, value ≤ 100), shown under the
detail. Drift uses it for a person's home and workplace, real buildings of
the city chosen by the person's slot.
### 6.3 Known v1 leaks (scheduled for v2)

Content in platform files, tracked for removal: `fink-config.js`
(default story, LOCAL_FINKS, deploy-root paths), the story link inside
the injected `_inventory` knot, the minigame registry + splash copy in
`fink-minigames.js`, chess's sibling path. The NPM boundary rule:
**mechanism ships; names arrive via config, manifests, or typed
blocks.**

## 7. Audio **(roadmap)**

v1 reality: `FinkAudio` (single looping bg track + crossfade),
`FinkFoley` (procedural layers), no playlist, no master mute. v2
direction, proven in `magpie/robbin`: one jukebox element owns the
audio graph (playlist, bus, Media Session, master mute); all UIs —
including visualizers — are views; embedded games negotiate the stage
via `audio-focus` protocol messages; playlists arrive as
`application/vnd.fink.playlist+json` typed blocks.

## 8. Conformance summary

A conforming **file** uses sigils, raw-safe escaping, and inline moment
tags. A conforming **extractor** captures raw, preserves order, never
regexes Ink. A conforming **player** compiles with real inkjs, ignores
unknown tags/hints/media-types, and keeps the flat choice list fully
reachable. A conforming **minigame** speaks §5 and survives an opaque
origin. A conforming **presenter** implements §4.4.

## 9. Test topology

- `packages/gcfink` `npm test` — sigil semantics, `//` regression
  (real compiler), whole-corpus extract+compile.
- `node inklet/finkapp/test/e2e.mjs` — the mandatory journey.
- `node inklet/finkapp/test/e2e-robbin.mjs` — the full widget loop.
- `node inklet/finkapp/test/e2e-wm.mjs` — the window manager (§5.1).
- `node inklet/validation/checkfink.mjs` — per-story validation.
