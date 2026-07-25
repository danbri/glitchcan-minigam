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
| `# MINIGAME: name [mode=m] [controls=dpad\|lite\|none]` | §5 |
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
- Games cannot divert the story. They mutate declared variables; the
  host resumes Ink on completion. Reactions follow §3.2.
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

Locked by `inklet/finkapp/test/e2e-wm.mjs` (which regression-tests the
two failures of the retired slider panel: a split state that crushed
the game to a 4px sliver, and a mini state that hid its own restore
control).

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
- Window geometry MUST use the visible viewport (`100dvh`), not `100vh`.

### 5.1.2 The conformance probe — normative

The shell cannot inspect a guest: opaque origin, no DOM access. So "does
this widget know its duties?" can only be answered by asking and seeing
who answers.

- `init.config.contracts` lists the OS contracts the shell is offering
  (v1: `['controls']`).
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

## 6. Links, navigation, identity

Incorporates `docs/fink-linking-spec.md`: two-part SHA-256 hash links
`#<urlHash8>-<knotHash9>` (salt `glitchcan-fink-v2`, v1 legacy
fallback), public knots (not `_`-prefixed), `?d=` encoded variable
state, `?story=`/`#story=` direct loads.

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
