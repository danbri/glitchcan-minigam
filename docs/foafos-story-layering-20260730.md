# foafos ⇒ StoryRunner ⇒ story sessions — the layer model

Owner statement, 2026-07-30. This is the canonical layering the platform is
migrating **toward**, and the yardstick for FINK parity. It exists to end the
legacy habit of running the story engine *inside* the foafos shell page —
"builtin story-foafos mixing of layers" — where level 0 (the OS) and the
narrative runtime were the same code on the same page. Each layer below is a
real control / instantiation / capability border, not a label.

## Mediation invariant (read first)

No level above 0 holds raw power. Every "serious power" is exercised through
foafos APIs — the bus and capability-checked verbs/commands. **foafos always
mediates.** The StoryRunner mediates *for* its sessions, but it reaches actual
I/O only by calling foafos, which performs the effect through its own brokers.
The real path is:

    session → StoryRunner → foafos broker → effect

A capability is *permission to ask*; foafos does the doing. This is what makes
the borders below trustworthy: they are not politeness, they are the only path
to any effect.

## The layers

### 0 — foafos shell
The OS and the **sole mediator**. Owns the event bus, the identity session
(`session.mjs`, ephemeral unless sealed with a passphrase), the app tree,
capability attenuation (`grant(child) ⊆ grant(parent)`), and the brokers
(storage, secrets, vars, audio, input). Knows nothing about ink. Grants
capabilities and isolation, and **performs all real effects**; it does not
play stories.

### 1 — a StoryRunner instance (labelled "Finkiverse")
foafos **begets a StoryRunner**. This is an app instance in the tree — the
same kind of thing as Office or TellyClub, forkable, boxed, bounded by what
foafos grants it. Its display label is **"Finkiverse"**. It has two standing
jobs for its subtree:

- **It coordinates serious I/O** — sound above all, plus notifications and
  state storage — but entirely via foafos APIs (bus + verbs), never with raw
  browser I/O of its own. It gives its sessions one shared, gesture-unlocked,
  master-governed audio path by *holding the audio capability and calling the
  foafos audio broker on their behalf*. A session asks the StoryRunner; the
  StoryRunner asks foafos; foafos acts.
- **It is the observability point for the story subtree** — see the
  Observability section below.

### 2 — story sessions
Under Finkiverse sit **story sessions**. A session is not a document and not a
file; it is a **live, ephemeral, evolving playthrough**, grounded in the
**instantiated fetch and merge of one or more FINK stories** into a running
inkjs state. A session:

- **loads and merges more FINK content during play** — a session is a moving
  composition, not a single compile;
- **manages its relations to other story sessions** — the narrative-respecting
  relationships: **dream / inception** (one session nested inside another) and
  **peering** (sibling sessions), including the mechanics that make merges
  behave: **variable / state propagation**, and **variable and knot renaming**
  so two stories can compose without colliding;
- **can mutate itself** — rewrite its own variables, knots, and composition as
  play demands;
- is **isolated, and that isolation is backed at the foafos level** — a
  session's blast radius is bounded by the shell's capability and origin
  borders, not by the session's own good behaviour;
- **reaches every platform service only by requesting it upward**
  (→ StoryRunner → foafos), never directly.

**inkjs reality.** Because of how inkjs works today, a distinct story session
will often keep a **cache** of what it fetched — either the recently fetched
`(f)ink` source, or its composition into merged inkjs JSON — so a re-entry or
a re-merge does not re-fetch and re-compile from zero. The cache belongs to
the session (the storyapp), not to the shell.

### 3 — subApp instances spawned by a session
A session can **spawn subApps**: minigames, maps, notification widgets. These
are children of the *session* that launched them — that is where they parent
in the tree, and their capabilities attenuate from the session, which
attenuates from the StoryRunner, which attenuates from foafos. A subApp that
finishes hands its result back to the session that is waiting on it. Like
every level above 0, it gets platform services only by asking upward, mediated
by foafos.

## The shape, in one line

    foafos (0)  — sole mediator; owns bus + brokers, performs all effects
      └─ StoryRunner "Finkiverse" (1)   — coordinates I/O + observes the subtree, all via foafos verbs/bus
            ├─ story session A (2)       — fetch/merge ≥1 fink; caches src or merged json; self-mutating
            │     ├─ minigame subApp (3)
            │     ├─ map subApp (3)
            │     └─ notification widget (3)
            ├─ story session B (2)  — peers with A
            └─ story session C (2)  — dream of A   (variable/state propagation, variable & knot renaming)

foafos begets a StoryRunner, which begets one or more stories with
narrative-respecting relationships (dream/inception or peering), which spawn
subApps and use StoryRunner-mediated platform services — every effect flowing
through foafos.

## Observability — StoryRunner sees the story subtree

Because everything a story does flows up through the StoryRunner, the
StoryRunner is the observability point for **all story work in an
installation**: every story, and every session, widget, game, map, and display
beneath it.

**Two kinds of "seeing", so the mediation invariant still holds.**
- **foafos** sees the raw traffic. It is the mediator; it sees every app across
  all domains, mechanically.
- **StoryRunner** sees and *understands* the story domain — it knows a beat from
  a choice, a dream depth from an economy change, a minigame outcome from a
  widget update. foafos sees mechanically; StoryRunner sees with meaning. They
  do not conflict.

**What "everything interesting" means, precisely.** It is the **observable
surface**: what was *done* — verbs called, bus events, launches, choices,
outcomes, displays shown. It is **not** god-mode into private state. A
session's private plot variables stay in its box; only the shared economy
crosses. Observability watches *effects*, not secrets — the same border, seen
from the audit side.

**Scope.** A StoryRunner sees its own subtree, in its own installation. It does
not see the Office root or the TV root — those are not its children and do not
ask through it. A forked StoryRunner sees only its own children.

**What it enables.** Cross-session dashboards (total economy, active sessions,
dream depth, live widgets/games/displays); the menubar's small "dashboardy
things" (scores, clocks) fed at the right level; a story-scoped, interpreted
debug timeline instead of raw bus noise; well-founded cross-session
coordination (peering, propagation, renaming) because one place holds the whole
picture; and event-driven foley, since the coordinator of sound also sees the
events.

**Two rules for observation.**
- **Honesty to the user.** Observation is a power; it must show in the audit
  ledger. Do not watch the person in secret.
- **Ephemeral by default.** Match the session rule: what StoryRunner observes
  dies with the session unless sealed. To persist observation is to seal it,
  and that needs consent.

## Consequence: foafos as a reality broker (proposed)

Because foafos mediates every effect, it can present each app a **governed,
optionally-fictional environment** — not only relay real values. A boxed,
opaque-origin app usually cannot reach real geolocation anyway (the browser
denies it), so a `location` broker is needed regardless; "report the location
as Atlantis or the North Pole" is then simply one policy of a broker that must
exist. The same shape generalises to time/"now", timezone/locale, a random
seed, online/offline, battery, and sensors — a per-app synthetic world, useful
for privacy (coarse or user-set values), repeatable testing (pin a location or
a clock), and narrative fiction. It ties to trust tiers: untrusted injected
content should get a coarse or fictional world by default, and real values
should need an explicit user grant, like secrets. **One rule:** foafos may lie
to the app, but must not lie to the user — the drawer must disclose a fictional
value (e.g. "location: fictional (Atlantis)"), the same way the SOUND note
already says what the shell cannot reach. Proposed direction, not built.

## Current state vs. this target (2026-07-30)

Honest gap list, so nobody reads the model as "done":

- **Level 1 audio — matches.** `# AUDIO:` now plays in the StoryRunner's own
  frame, gesture-unlockable, under the shell master volume. Serious I/O at the
  upper level is the target and this is on it.
- **Observability is partial and shell-side.** Today the drawer FEED subscribes
  to bus topics at level 0. The interpreted, story-scoped observability that
  belongs to the StoryRunner (dashboards, session graph, per-session meaning)
  is not built there yet.
- **Level 2 is not yet a distinct node.** Today the boxed runner plays one
  story at a time; a `# FINK:` link **replaces** the content in the same frame.
  There is no per-session object between the StoryRunner and its subApps.
- **Dream is a counter, not a nested session.** Depth lives in a shell-side
  `storyDepth` map keyed by the runner's app id (`foafos-shell.js`), not as
  nested level-2 session instances.
- **Minigames parent under the StoryRunner, not the session.** `_pendingGameParent`
  parents a launched game under the runner node. The target is: parent under
  the **session** node. The session node has to exist first.
- **Variable propagation is shell-brokered, not session-to-session.** The
  shared economy crosses through `story.vars` at the shell; the level-2
  "session manages its relations to other sessions" mechanics
  (propagation, variable/knot renaming) are not built as session operations
  yet.
- **Caching is not formalised.** The runner compiles in-frame; a per-session
  cache of fetched source or merged JSON is design intent, not code.
- **Reality broker — not built.** No `location`/environment broker exists yet.

## Conflicting docs / instructions (flagged for the owner)

1. **`inklet/finkapp/foafos-root.js` — "Finkiverse" is the ROOT label, not the
   StoryRunner's.** The `glitchcanary` root carries `label: 'Finkiverse'`
   ("owner's call, July 2026"). This model puts "Finkiverse" on the **level-1
   StoryRunner instance**, and the level-0 installation is the foafos root. The
   storyrunner app is currently named "Story Runner" in `foafos-apps.js`.
   Decision needed: move the "Finkiverse" label down to the StoryRunner app and
   rename the root, or keep the root label and pick another name for the
   StoryRunner. (The root *id* `glitchcanary` must not change — it keys saved
   data and shared `?root=` links.)

2. **`CLAUDE.md` still calls the mixed host player canonical.** "The production
   player is `inklet/finkapp/index.html` … finkapp is canonical." That page is
   the level-0/level-2 mixing this migration removes. It is already flagged
   pending-delete in code (`fink-player.js`, issue #779), but the top-level
   prose still names it *the* player. Update once the boxed StoryRunner carries
   parity.

3. **`docs/foafos-root-and-app-tree-20260726.md` §1 describes the OLD split.**
   "Top level, unisolated: all the Ink handling, the UI, choice… Isolated,
   strictly: the game content." That is precisely the pre-migration picture —
   ink handling at level 0. Under this model **all** ink handling moves down to
   levels 1–2. The doc's attenuation and tree sections still hold; its layer
   picture is superseded here.

4. **`docs/fink-story-sandbox-threatmodel-20260728.md` §5.3 conflates two
   "sessions".** It equates the FINK *game session* with "the existing foafos
   session model (`session.mjs`, sealed with a passphrase)". This model keeps
   them distinct: the **foafos identity session** is a level-0 thing
   (`session.mjs`); a **story session** is a level-2 narrative object whose
   isolation is *backed by* foafos but which is not the identity session. Same
   word, two layers — §5.3 should say the story session is foafos-*isolated*,
   not that it *is* the identity session.

5. **Word "session" is overloaded platform-wide.** The drawer's "SESSION" panel
   (save/unlock/forget a passphrase-sealed identity) is level 0. "Story session"
   is level 2. Any new UI or doc should qualify which one it means.

## Why this matters

Parity is not "the boxed runner can play Hampstead". Parity is **these borders
being real, and every power flowing through foafos**, so the legacy player —
which is level 0 and level 2 fused on one page, touching I/O directly — can be
deleted without losing what it did. Every parity blocker in issue #779
(minigame pause/resume, variables/shared economy, the dream stack, navigation)
is really a question of *which layer owns it, and which foafos verb carries it*.
