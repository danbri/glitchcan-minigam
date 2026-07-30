# foafos ⇒ StoryRunner ⇒ story sessions — the layer model

Owner statement, 2026-07-30. This is the canonical layering the platform is
migrating **toward**, and the yardstick for FINK parity. It exists to end the
legacy habit of running the story engine *inside* the foafos shell page —
"builtin story-foafos mixing of layers" — where level 0 (the OS) and the
narrative runtime were the same code on the same page. Each layer below is a
real control / instantiation / capability border, not a label.

Verified against `master` at 2026-07-30, after the parity commit. Where this
doc states what the code does, a reader can check the named file and line. The
state sections say what is true, what is a deliberate exception, and what is
not built.

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

## Presentation invariant (read second)

**The layers are for the platform. The reader gets a story.** (Owner,
2026-07-30.) Every border below is real, and **none of them may show up as
chrome**. Whatever composition is happening — a link, a dream, a peer, a merged
chunk — what the reader experiences is *more story and more choices*, at most
with an interstitial or a passing notice. No pane management, no window
furniture, no configuration.

**The voice interface is the test.** A pure voice interface is in development,
and it has no panes, no `✕`, and no corner to put a title bar in. So: if a
feature can only be understood by looking at a second pane, or can only be left
by pressing a control, it is wrong at the design level and not merely
unpolished. Anything that must be *said* to be usable is the honest version —
which is why "the story ends and you are back" beats any button.

Mechanism belongs in the **advanced/debug view** — the runner's Subtree panel,
the shell's app tree, the capability ledger, the address bar. Those exist so the
mechanism is auditable, not so the reader must learn it. A reader who never
opens them must lose nothing.

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

**Named exception: the music bed is cooperative, not brokered.** Synth foley
goes through the `story.audio` verb, so foafos performs that effect. A media
bed does not: the runner makes its own `Audio` element in its own frame
(`inklet/apps/storyrunner/storyrunner.js`), and applies the shell master level
itself. This is deliberate. iOS unlocks audio only for a gesture in the **same**
frame as the element, so an earlier brokered version was silent after the
reader tapped. The rule that survives is *audio-as-a-host-service*: the shell
sets the level, the guest applies it. Any other raw I/O at level 1 is a defect,
not a precedent.

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

**MERGE IS NOT PEERING, and the test is the front door** (owner, 2026-07-30).
Two different needs were briefly being served by one mechanism, and only one of
them wants a frame:

- **A merge chunk has no entry point.** It is a room of a vast city, an episode
  of one work — meaningless if a reader arrived at it alone. It joins the engine
  already running: fetch it, add it to the ordered set this session has already
  parsed, recompile the union, carry on. No frame, no origin of its own, no
  shell of its own. **Publication and linkage, not window management.** An
  episodal game must not become a tree of sandboxed widget frames.
- **A peer HAS an entry point, or could have one.** Its own URL, quite possibly
  its own server, quite possibly its own preferred copy of foafos sitting beside
  it and styled for that work — while other frontends can still play it. The
  frame is right here precisely because it matches a real border: separate
  origin, separate front door, separate authorship.

The question an author answers is not "how big is this" but **"could a reader
have arrived here instead?"**

**The intended peer is REMOTE, and today the shell refuses it.** A peer's whole
point is a different front door — another author, another server, its own copy
of foafos beside it. Policy v0 allows same-origin only: `foafos-shell.js:2582`
answers a cross-origin link with `cross-origin-blocked`, and `:2570` does the
same for media. So peering is proven as a mechanism against local fixtures, and
the case it exists for is still gated. That gate is where the trust graph goes
(tiers, `# INTEGRITY:` hashes, plural signals) — it is not a bug to patch, it
is the slot the next phase fills. Anyone reading "peering works" should read it
as "peering works within one origin".

**Whose shell plays a remote peer? OPEN.** When a peer ships its own tweaked
foafos, three answers are all defensible and the choice is the owner's:
1. **The linking story's shell keeps playing** — one reader, one installation,
   one set of brokers and one audit ledger. Simple, and the remote author's
   styling is lost.
2. **The peer's stated preference wins** — the fetched work names the shell it
   wants and gets it, nested. Honours authorship, and hands an unknown server
   the frame the reader is looking at.
3. **The reader's installation always wins** — their brokers, their master
   volume, their ledger, whatever the remote author prefers. Safest, and the
   least generous to the peer.
   The mediation invariant survives all three, because any nested shell still
   reaches real I/O only through the outer one. What differs is who chooses the
   chrome.

**Naming — stated, since either can work as long as we are clear.** Today the
top-level runner and a story-carrying leaf are **the same JS type and the same
page**: `inklet/apps/storyrunner/index.html`, one module, distinguished only by
`?peer=1` → `IS_PEER` (`storyrunner.js:22`), which subtracts two powers
(a peer may not announce sessions and may not observe). There are **no custom
elements** — no `<fink-runner>`, no `<fink-session>`; nothing in the platform
calls `customElements.define` for either. That is deliberate for now: one code
path cannot drift from itself, which is the reason a peer is a full runner
rather than a reduced copy. The decision this records is that **sameness is the
current answer, and any future split must be a stated one** — if a
story-carrying leaf ever gets its own type or element name, the distinction has
to be a real border (different powers, different lifecycle), not a synonym.

**Measured, before building the merge** (2026-07-30, real inkjs, offline):

| question | answer |
|---|---|
| does `state.LoadJson` into a RECOMPILED SUPERSET throw? | no, it loads |
| do variable values survive? | yes, exactly as saved |
| is the reader still at the same beat? | yes — the same choice is on offer |
| can the new chunk see the LIVE state? | **yes** — the merged-in knot read the restored value and incremented it |
| visit counts? | 0, which is ink's normal behaviour, not a merge fault |
| the same `VAR` in two merged files? | **compile error** |
| the same knot name in two merged files? | **compile error** |

**BUILT 2026-07-30.** `# LINKREL: merge` does exactly the above, and the reader
sees only more story. Two decisions are worth keeping:

- **`# ENTRY:` names the knot to walk into, and it is a TAG, not a URL
  fragment.** `# FINK: annex.fink.js#annex` is *two tags* to the ink compiler,
  because `#` starts a tag in ink's own syntax — the fragment never arrives.
  Measured the hard way: the merge landed and the reader read the host's
  fallback branch. An ENTRY is not a front door; no reader can arrive at it.
- **The arbiter is the real compiler, and a refusal costs the reader nothing.**
  The union compiles into a *local*; only on success does it become the
  reader's story. A collision leaves them exactly where they were, and the
  author is told in `compiler.errors`' own words — "found declaration variable
  'diamonds' that was already declared (line 16)". Note *`compiler.errors`*,
  not the exception: what is thrown says only "Compilation failed."

**On renaming — position changed, and stated rather than dropped.** This doc
previously said renaming was a prerequisite. It is not: the requirement was
that a clash must never merge silently, and the real compiler already meets it
precisely, at the right moment, with the line and the name. What renaming would
add is *convenience* for many hands — and it means rewriting ink identifiers
across diverts, tunnels, threads, logic and prose with pattern matching, which
is the hackparsing this repo has a rule about.
`inklet/demos/fink-namespace-preprocessor.js` has now been read: it is a
self-described strawman, regex-based, variables only, blind to knot names. It is
not the tool, and building on it would ship a landmine. Automatic renaming needs
a real ink front-end; until there is one, colliding authors get a precise
diagnostic, which is how every language without modules works.

**Fragments are offline-checkable.** A merge chunk cannot compile alone — it
diverts into its host's knots and reads its host's variables — so `fink:check`
would report it as broken. It now checks the union instead, from
`inklet/tools/fink-unions.json`, and the collision fixture is an *inverted*
test: that union MUST fail to compile, because a pass would mean two authors'
declarations had merged silently.

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

Honest gap list, so nobody reads the model as "done". Each line was checked
against the file named.

**True today.**

- **Level 0 owns the borders, and they bite.** The shell holds the bus, the
  identity session, the app tree, the brokers and attenuation. `story.launch`
  checks `grant(child) ⊆ grant(parent)` **before** it starts a guest, and a
  backstop ends the minigame when the node is refused (`foafos-shell.js`). An
  earlier version announced the refusal and let the guest run.
- **Level 1 exists as an app.** `inklet/apps/storyrunner/` is boxed at an opaque
  origin. It reaches the shell only through `story.launch`, `story.link`,
  `story.navigate`, `story.vars`, `story.audio` and a grant-filtered bus.
- **Level 1 audio is at the right level.** `# AUDIO:` plays in the runner's own
  frame, unlocks on a tap in that frame, and follows the shell master level.
  One part is brokered (synth foley, through `story.audio`) and one part is
  cooperative — see "Named exception" under level 1.
- **The shared economy has a real border.** `FoafOS.storyVars` records an
  `owner`, so a write is attributed to the story that made it, and reads pass
  through `vars.filterReadable(actor, …)`.
- **Observation is already partly in the ledger.** `tallyCap` records every
  capability use, so verb use is visible to the person. The honesty rule below
  is therefore started, not merely stated.
- **Level 2 is a node** (added 2026-07-30). A playthrough announces itself with
  `story.session` and the shell spawns `story-session` under the runner, with
  the runner's own grant and no more. The relation travels with it: a plain
  link or a one-way link ends the playthrough it replaces, a dream keeps the
  outer session alive and marks the new one its dream, and surfacing ends the
  inner one so the outer gets its reader back mid-breath.
- **The StoryRunner observes its own subtree** (added 2026-07-30).
  `story.observe`, on its own capability `story:observe` — watching is not
  implied by playing. The shell forwards effects from the watcher's descendants
  and nothing else, and computes that filter itself: a guest cannot be trusted
  to discard what it should not see, because by then it has seen it. Measured:
  an app opened outside the subtree stays invisible. The four rules hold —
  effects not secrets (nodes, sessions, depth, game outcomes; never another
  app's state), subtree scope, disclosed on the bus and tallied in the ledger,
  and ephemeral (a bounded array in the runner's frame, nothing persisted).
- **Peering** (added 2026-07-30). `# LINKREL: peer` opens a second session
  BESIDE the first: both live, neither containing the other, the reader keeping
  their choices in one while the other keeps its own. The shell spawns a sibling
  session marked `peerOf` and does not close what a peer stands beside.
  A peer is a NESTED RUNNER — the same page in its own sandboxed frame at its
  own opaque origin — which buys three things: the two stories are isolated by
  the browser rather than by our good behaviour (measured: `parent.document` and
  `parent.__storyrunner` both throw from inside the peer); the mediation chain
  is literal, since the peer asks the runner and the runner asks foafos; and a
  peer is a full runner, so it plays media, audio and games without a reduced
  copy of the engine to drift. Two refusals define the border from the other
  side: a peer may not announce sessions (its plain link would arrive as
  "replace" and end the reader's own story) and may not observe the subtree
  (that is level 1's authority). **One peer at a time.**

  **A PEER LOOKS LIKE NOTHING** (owner, 2026-07-30). Reading into a peer is
  *just more story and more choices* — possibly an interstitial or a notice, and
  nothing else. It must never throw the reader out of the illusion and into
  window management. So a peer **takes the reading surface**, the way a dream
  already does: no title bar, no close button, no split pane. The way back is
  **the peer's story ending** — the peer equivalent of a dream surfacing — so
  the reader needs no control at all. The first version was two stacked panes
  with a `✕`, which was wrong twice over: it announced the mechanism to the
  reader, and a pane means nothing in the **voice interface** in development,
  where there is no second pane to look at. Measured on that old build: 45% of
  the surface, one chrome bar, one button.

  What peering *is* stays invisible and structural, which is the whole point:
  the reader's own story is not destroyed, and they come back to its **live
  beat**. Measured: no reload — the outer story's load count does not change,
  because it never stopped being that document's running story. A dream has to
  reload and `LoadJson` its way back; a peer just stops covering the page.
  The covered stage is also made **inert and `aria-hidden`**, which is not
  decoration: the prose region is `aria-live`, so without it a screen reader —
  and the voice interface — narrates two stories interleaved, and a keyboard
  reader can tab into choices that are not on screen.

  The mechanism shows only where mechanisms belong: the runner's Subtree panel,
  the shell's own app tree, and the capability ledger. That is the
  advanced/debug view, and the reader never has to open it.
- **MERGE — composition with NO frame** (added 2026-07-30). `# LINKREL: merge`
  fetches a chunk, appends it to the ordered set this session has parsed,
  recompiles the union with the real compiler and carries the reader's place
  across. Measured: the ordered set grows to two, one engine holds 15 knots, no
  new frame is made, the shell records composition rather than a journey (one
  session, depth 0), the reader walks into the knot `# ENTRY:` names, and the
  merged knot **writes the live state** — which is what an episode of one work
  needs and a peer must never have. The merged chunk diverts back into its host,
  which only compiles as a union. A colliding chunk is refused in the compiler's
  own words and the reader keeps their story. The composition appears in the
  Subtree panel and nowhere else.
- **Level 3 parents under level 2.** A launched game is a child of the SESSION,
  not of the engine. Measured: `root → Finkosphere → session → game` at depths
  0, 1, 2, 3, with capabilities attenuating at each step.
- **Level 0 boots no ink** (flipped 2026-07-30). `autoBoot: 'boxed'`. An
  ordinary visit plays the story in the box and the host page's engine compiles
  nothing. `?player=legacy` is the way back, `?player=none` opens the shell
  with nothing playing.

**A rule, not a gap.**

- **Dream depth is counted by the shell, on purpose.** Depth lives in a
  shell-side `storyDepth` map keyed by the runner's app id, and
  `bus.subscribe('story.state', … vars.setDepth)` feeds the broker's
  `strictDreams` rule. The runner **asks** ("goDeeper", "goShallower",
  "oneWay"); the shell counts. A story that reported its own depth could claim
  0 from inside a dream and switch off the read-only rule on the shared
  economy. Keep the count at the shell after level-2 nodes exist. The ink state
  stays in the box; the shell holds only the number.

  **Per SESSION, not per runner** (2026-07-30). It was keyed by the runner's app
  id, which is one number for the whole engine — right while a runner played one
  story, wrong the moment peering let two read at once. Measured on the old code:
  a peer's dream turned the reader's own economy read-only. Two halves to the
  fix: the shell keys depth by session, and every request from a runner NAMES
  its own session, because the shell's only other option is to guess "the
  innermost", which is the peer. A runner may name only sessions already known
  to be its own.

**Not built.**

- **The host-page engine is still in the page.** It no longer plays by default,
  but `inklet/finkapp/index.html` still loads it so `?player=legacy` works. The
  file set is superseded and pending delete (issue #779). Deleting it is a
  separate job from flipping the default, and the suites pinned to
  `?player=legacy` are the list of what has to move first.
- **A peer keeps nothing.** It gets no store, and its session is not
  snapshotted, so closing the window loses the peer while restoring the primary.
  Whether a peer should come back is a design question, not an oversight.
- **A REMOTE peer, which is the case peering exists for.** Policy v0 refuses a
  cross-origin link (`foafos-shell.js:2582`), so every peer today is a
  same-origin fixture. And whose shell plays a remote peer is an open owner
  question — see "The intended peer is REMOTE" under level 2.
- **Session-to-session mechanics.** The shared economy crosses through
  `story.vars` at the shell, which is the level-0 half of the job. The level-2
  half — a session managing its relations to other sessions, with state
  propagation and variable/knot renaming — is not built as session operations.
- **Cross-session dashboards.** The StoryRunner now observes its own subtree
  (see "True today"), and reads the stream as story events. What is NOT built
  on top of it: totals across sessions, a session graph, and the menubar's
  small dashboardy things fed from level 1 rather than level 0. The drawer FEED
  at level 0 still exists and is still the raw view; the two do not conflict,
  which is what the two-kinds-of-seeing rule says.
- **The per-session cache is code** (2026-07-30). A session keeps the EXTRACTED
  INK for what it fetched, bounded at six entries, oldest out first — a dream
  stack walks back the way it came, so the entries a reader is about to need are
  the newest. Measured: a peer's dream ending and surfacing gave 3 loads, 2
  fetches, 1 hit. What is kept is the ink, not a compiled story: the vendored
  inkjs does not promise a story survives a serialise/restore round trip, and NO
  HACKPARSING means the real compiler stays the only way in — so a hit still
  compiles, from bytes already in hand. The cache lives in the runner's frame
  and dies with it, which is what "belongs to the session, not the shell" means
  in practice: the shell never sees a story's source at all.
- **Reality broker — not built.** No `location`, time or environment broker
  exists.

## Conflicting docs / instructions (flagged for the owner)

1. **`inklet/finkapp/foafos-root.js` — "Finkiverse" is the ROOT label, not the
   StoryRunner's.** The `glitchcanary` root carries `label: 'Finkiverse'`
   ("owner's call, July 2026"). This model puts "Finkiverse" on the **level-1
   StoryRunner instance**, and the level-0 installation is the foafos root.
   **Update:** the storyrunner app is now named **"Finkosphere"**
   (`foafos-apps.js`), so the two names no longer collide. The decision is still
   open, and it is now a naming choice rather than a clash: keep root
   "Finkiverse" + app "Finkosphere", or move "Finkiverse" down to the app and
   rename the root. (The root *id* `glitchcanary` must not change — it keys
   saved data and shared `?root=` links. The app *id* `storyrunner` must not
   change either — it is in `?app=` links, the snapshot key, the capability
   ledger and the test suites.)

2. **`CLAUDE.md` still calls the mixed host player canonical.** "The production
   player is `inklet/finkapp/index.html` … finkapp is canonical." That page is
   the level-0/level-2 mixing this migration removes. It is already flagged
   pending-delete in code (`fink-player.js`, issue #779), but the top-level
   prose still names it *the* player. Update once the boxed StoryRunner carries
   parity. **Update:** that condition is met. `foafos-root.js` records
   `parityReached: '2026-07-30'`, and the mandatory journey (TOC ⇒ Episodes ⇒
   Hampstead) plays in the box. What remains is the boot default, which is a
   test-fixture job, not a capability job.

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

## The route from here to true (owner-approved, 2026-07-30)

The order matters: each step makes the next one smaller.

1. ~~**Make the boot default boxed.**~~ **DONE 2026-07-30.** Twenty-two suites
   named a story URL and then waited on the HOST page's ink engine as proof the
   page was up, which made "level 0 runs ink" the definition of a working boot.
   Every URL now says which player it means, `?player=none` was added for the
   suites that drive the runner themselves, and `autoBoot` is `'boxed'`.
2. ~~**Create the level-2 session node.**~~ **DONE 2026-07-30.** Games parent
   under the session; the depth count stayed at the shell.
3. ~~**Correct the conflicting docs.**~~ **DONE 2026-07-30** (CLAUDE.md, the
   app-tree paper's §1, the threat model's §5.3).
4. ~~**Give the StoryRunner its observability.**~~ **DONE 2026-07-30** — the
   stream and its four rules. What is left on top of it is dashboards.
5. ~~**Peering**: two sibling sessions playing at once~~ **DONE 2026-07-30**,
   with per-session dream depth. Still open beneath it: the session-to-session
   mechanics — state propagation, and variable/knot renaming so two stories
   compose without colliding.
6. ~~**Formalise the per-session cache**~~ **DONE 2026-07-30.**
7. ~~**Renaming, then MERGE**~~ **MERGE DONE 2026-07-30**, and the order turned
   out to be wrong: the requirement was never "rename", it was "a clash must not
   merge silently", and the real compiler meets that exactly. Renaming is
   downgraded from prerequisite to convenience, and it needs a real ink
   front-end rather than the regex strawman — see the merge section above.
8. **The reality broker**, still a proposal, and it wants an owner decision
   before code: it changes what an app is told about the world.
9. **Delete the host-page engine**, which is what all of this was for.

**Still open beneath merge.** A dream that surfaces reloads its outer story, so
merges made before descending are lost with it — recorded, not pretended away.
Automatic renaming, when there is a front-end that can do it honestly. And a
session's composition is not snapshotted, so a restored playthrough comes back
as its base story.
