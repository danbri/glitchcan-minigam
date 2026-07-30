# foafos: root, the app tree, and what FINK is for

*July 2026. A note for discussion, not a plan of record. Written from
danbri's framing, with the current-state claims verified against the code
rather than recalled.*

---

## 1. The historical reading, and it checks out

> **SUPERSEDED, 2026-07-30 — read this section as history.** The layer picture
> below (ink handling at the top level, unisolated) is what the migration
> removed. An ordinary visit now boots the story inside the boxed runner at
> level 1, and the shell compiles no ink; `?player=legacy` reaches the old
> arrangement on purpose. The current model is
> `docs/foafos-story-layering-20260730.md`. **Sections 2 onward still hold** —
> the proposal, the attenuation rule and the tree are what got built.

The pre-foafos player was already a proto-shell. The split was:

- **Top level, unisolated:** all the Ink handling, the UI, choice
  presentation, and the FINK sandbox management.
- **Isolated, strictly:** the *game content* that top-level code
  discovered and loaded.

That is still exactly the shape today, and it is measurable:

| claim | evidence |
|---|---|
| the narrative runtime is the host page | `FinkInkEngine`, `FinkPlayer`, `FinkUI` are `window.*` globals |
| a story reaches the shell directly | its tags touch `FinkAudio`, `FinkFoley`, `FinkMinigames`, `FinkNavigation`, `FinkBreadcrumb`, `FoafOS` |
| nothing gates it | grep `capabilit` across engine/player/ui → **zero hits** |
| game content is properly isolated | `iframe.sandbox = 'allow-scripts'` → opaque origin; `parent.document` throws |

So the isolation work went *outward* from the player onto the content it
loaded, and never inward onto the player itself. That is not a criticism
of how it happened — it is the natural order. But it is why the story
outranks every app, and why `docs/` now says so out loud.

## 2. The proposal

**Most of the top level becomes just another app.** The narrative runtime
stops being the thing that runs widgets and becomes a widget that is run.
Some installations may still bless one or more apps to instantiate at
root — but *blessed* should mean **declared in the installation's
configuration**, never *detected* or *special-cased in code*.

**The running environment is a root with a tree beneath it.** An app may
hold the capability to spawn another app instance. The child is chained
beneath its parent and can be operated on as a group: minimise, pause,
close, highlight — parent and all its descendants together.

This is a good shape. Two things follow that are worth stating.

### 2.1 The attenuation rule — the thing that makes spawn safe

If an app can spawn, it must only be able to grant a **subset of what it
holds**. A child can never exceed its parent.

```
grant(child) ⊆ grant(parent)
```

Without this, `spawn` is a privilege-escalation primitive: any app that
can spawn can mint an app with capabilities it does not itself have. With
it, the tree is a capability tree and the root is the only source of
authority — which is the property that makes the whole model worth
having, and it is cheap to enforce at the one call site.

It also gives grouping a precise meaning. "Close this app and everything
beneath it" is not a UI convenience; it is *revoking a subtree of
authority*, which is why it must cascade and why a child must not be able
to outlive its parent by default.

### 2.2 What the tree costs today

The instance registry (`FinkMinigames._registerInstance`) is **flat**:
`{ id, grants, lastSync, contracts, probeTimer, type, kind, iframe }`.
No parent link. Adding `parentId` is genuinely small; the work is in the
consequences —

- **lifecycle:** parent closes → cascade close is the right default.
  Detach-and-reparent is sometimes wanted (a game you want to keep while
  leaving the story that spawned it) and should be an explicit verb, not
  an accident.
- **suspend semantics:** pausing a subtree must reach apps that handle
  pause natively (the verb protocol) and those that do not (the shell's
  frost). Already solved for one level; needs to walk.
- **the switcher** currently lists running apps flat. A tree wants
  indentation, and "5 running" should probably mean 5 roots, not 5 nodes.

## 3. Different roots, and why that is not yet possible

The stated goal — instantiate foafos with only an office wrapper at root,
or a webtv root, where FINK is simply unknown — is the real test of
whether the abstraction is honest.

It currently **cannot** be done, and the blocker is small and specific:
the shell boots a story or nothing. `fink-config.js` sets
`DEFAULT_FINK_FILE: '…/toc.fink.js'` and `fink-player.js` auto-loads it.
The entry point is a story-player URL (`?story=…`) that grew a shell
around it.

The concrete artefact this wants is a **root manifest**: which apps this
installation has, which are blessed at root, and what happens on boot. It
is data, like `foafos-apps.js` already is. Once boot reads a manifest
instead of a story path, "office-only foafos" is a config file rather
than a fork.

## 4. Sequencing: the story-as-app move is blocked on snapshots

This is the one dependency I would not discover late.

The dream stack works **because** the story runs in the host page: it
pushes `story.state.ToJson()` and restores it on pop
(`fink-ink-engine.js:576`, `fink-player.js:214`). Nothing else in the
system can be snapshotted — there is no snapshot/restore contract in the
minigame SDK at all (checked: every "restore" in that code is *window
geometry*).

Move the narrative runtime into a sandboxed frame and the shell can no
longer reach in and serialise it. So either:

1. the snapshot/restore contract lands **first**, and the story uses it
   like any other app would; or
2. the story-as-app move silently loses the dream stack.

(1) is the right order, and it is the same contract that would let you
close a game and get your flock back. The story would then be the first
consumer of a general facility rather than the sole owner of a special
one — which is the whole thesis of this note in miniature.

## 5. What changes for the story's own verbs

Worth deciding explicitly, because some are behaviour changes:

| tag | today | as an app |
|---|---|---|
| `# MINIGAME:` | shell launches a game | **spawn a child app** — the story's most story-specific power becomes the general one |
| `# FINK:` | replaces the whole shell's story | should replace **only that app's content**. This is a real behaviour change |
| `# STATUS:` | writes host chrome directly | asks the shell for a status slot; a capability |
| `# BG:` / `# CLASS:` | restyles the host document | restyles **itself** only |
| `# AUDIO:` / `# FOLEY:` | drives audio directly | already brokered for level; becomes fully brokered |
| variables | ungoverned; the story *is* the state | needs a decision: does the app tree have shared state, or does the root hold it? |

The last row is the genuinely open one. `FoafVars` governs *guests
writing to the story*. If the story is no longer privileged, "the story"
stops being the obvious home for shared state, and something has to be.

### 5.1 `# FINK:` — two separate points, and only one is architecture

**Foundationally**, navigation must be constrained to the running app and
its subapps. Another app that happens to use FINK internally is different
business entirely. This falls straight out of §2: navigation is scoped to
a subtree, like close, like pause, like everything else in the tree. It
needs no special rule of its own, which is a good sign the tree is the
right model.

**Pragmatically**, the reason it currently replaces *everything* is not a
design position — it is what inkjs makes cheap. inkjs has no notion of
composing two stories, so the only lever available is **recompile with a
different list of ink inputs**, and the variable and knot clashes are the
toll for using that lever. `# FINK:` "replacing" is an artefact of the
tool, dressed up as a semantic.

That distinction matters because it says where the work belongs. The
composition question — simple merging vs dream-inception nesting vs
loading a new chapter vs having two bodies of content live at once, and
what happens to variable and knot names in each — is going to *evolve*,
probably for years. It must be able to evolve **without dragging a web OS
frontend along behind it.**

So: composition semantics belong in the **npm library**, not the shell.

```
gcfink.compose([sourceA, sourceB, …], { mode, naming }) -> { story, nameMap, diagnostics }
```

The shell picks a mode and consumes the result. Merging strategies get
library tests rather than E2E-through-a-browser tests, new modes are a
library version rather than a shell release, and someone using FINK with
no foafos at all gets the same behaviour.

Two concrete facts that support this:

- The LINKREL vocabulary is *specified* in spec §3.4
  (`sameWorld` / `goDeeper` / `goShallower` / `oneWay` / `unstable` /
  `merge`) but *implemented* across `fink-ink-engine.js` and
  `fink-navigation.js` in the shell. The vocabulary is already
  library-shaped; the code is not.
- `inklet/demos/fink-namespace-preprocessor.js` — the machinery for the
  `merge` case — exists and is **not wired into anything** (verified). It
  is sitting in a demos folder because there is no library home for it.
  That is the gap this section is about, in one file.

## 6. FINK beyond storytelling

Two claims, and I think both are right with one caution each.

### 6.1 As a prettier JSONP

JSONP, not JSONL — and the distinction matters, because it names what
FINK *is* rather than what it resembles. A `.fink.js` is a script you
load that calls back into your page with data. `oooOO` is the callback.
That is JSONP exactly, with two upgrades: the callback is a **tagged
template** (so the payload needs no escaping and keeps its newlines), and
there can be **many callbacks with declared media types**
(`OO('text/turtle')`, `OO('application/vnd.fink.playlist+json')`).

Against JSON-as-data it wins on comments, unescaped multi-line content,
free syntax highlighting, and self-description — the file can *say* what
it is, because it runs.

**The cost to state plainly:** reading it requires a JavaScript engine.
That is a real disadvantage for interchange, and the honest answer is
that FINK is an authoring and delivery format — export plain JSON/JSONL
for consumers who just want rows.

### 6.1.1 The unresolved bit: many blocks, and knowing when they landed

This is the open issue, and JSONP is exactly where it bites: *did the
callback fire, and did all of them?*

**Current state, verified.** The sandbox executes the whole file
synchronously and then reports:

```js
(new Function(e.data.content))();
parent.postMessage({ type: 'fink-loaded',
                     data: window.finkData, blocks: window.finkBlocks }, '*');
```

So **"loaded" means "the file's top-level code finished"**. For the
format's normal shape — top-level tagged-template calls — that is a
genuinely sound guarantee, and it means classic JSONP's "did it fire?"
problem is already solved *by construction*. Worth knowing before
designing anything more elaborate.

Four things it does not survive:

1. **An async block vanishes silently.** A file doing
   `fetch(u).then(t => oooOO(t))` or deferring a block into a
   `setTimeout` posts `fink-loaded` *before* that block exists. No error,
   no warning — the block is simply absent. Nothing checks.
2. **Everything is eager, and resident about three times over.** All
   blocks accumulate in `window.finkData`; the whole array crosses
   postMessage (structured clone = a full copy); the parent keeps
   `lastBlocks`. A 40 MB binhexed video is a string in the sandbox, plus
   a clone in transit, plus a copy in the host.
3. **Only block 0 is consumed.** `data.data[0]`, commented "use only the
   first oooOO block". `lastBlocks` is captured and — checked — read
   **nowhere else**. Multi-block is plumbed and unused.
4. **One flat timeout for the whole file**
   (`SANDBOX_TIMEOUT_MS: 15000`). A large file fails as "Sandbox
   timeout", indistinguishable from a hung one.

**Direction I would propose.**

- **Manifest first, payload on demand.** `fink-loaded` returns only
  `[{ index, sigil, mediaType, bytes }]`. The host then asks for the
  blocks it actually wants, by index, and the sandbox stays alive until
  released. This removes one of the three copies outright and makes
  "block 0 now, block 5 never" expressible — which is the whole point
  when block 5 is an etext or a video.
- **An explicit not-done-yet signal.** Because the file is JS it can say
  so: a file that registers pending work defers `fink-loaded` until it
  settles. Absent that declaration, synchronous-complete stays the
  assumption, so every file that exists today is unaffected.
- **Per-block progress** rather than one 15s cliff, so a slow legitimate
  load is distinguishable from a hang.

**And a push-back:** binhexing video into a `.fink.js` is the wrong tool
even once the above exists. The format's strength is co-locating *small*
typed data with narrative. Large media should be referenced by URL — the
`# IMAGE:`/`# VIDEO:` tags already work that way, and the browser can
then stream and range-request it instead of us paying string + clone +
copy for bytes it could have handled natively.

### 6.2 As a shape many things fit

Form filling (VoiceXML-ish), slide decks, photo galleries — all of these
are branching or sequential content with state, which is what Ink is.

**The caution:** "everything is a story" is exactly the claim that
produces a framework nobody can use. What keeps it honest here is that
the presentation negotiation already exists and is principled: spec §4
has `# VIEW: hand | list | menu | map` with the rule that **unknown hints
must be ignored**. A deck is `# VIEW: deck`; a gallery is
`# VIEW: gallery`. The extension point is there, it degrades gracefully,
and it does not require the core to know about decks.

The discipline: a new domain earns a `VIEW`, not a new engine.

### 6.3 Three things called FINK, kept distinct

The note's most useful clarification may be simply naming them:

1. **FINK the format** — `.fink.js`, sigils, typed blocks. Spec §1.
2. **FINK the sandbox service** — "execute this untrusted file, give me
   back typed blocks." Today `fink-sandbox.js` is a story-loading
   implementation detail. As a **foafos service** it is useful to *any*
   app: Office opening a `.fink` file wants exactly this and should not
   have to know what a story is.
3. **FINK the tool** — the npm library (`packages/gcfink` is already the
   natural home) covering format → compile → validate/lint → present.

Stated this way, "FINK shows up in Office as a file format" is not a
stretch; it is what happens when (1) and (2) exist without (3) assuming a
narrative.

## 7. Where I would push back, or want a decision

- **Attenuation (§2.1)** is not optional. Spawn without it is worse than
  no spawn.
- **`# FINK:` semantics (§5)** is a real break. Existing stories navigate
  the shell; app-scoped navigation is correct but changes behaviour.
- **Shared state ownership (§5)** has no obvious answer once the story is
  demoted.
- **Blessed root apps** must reuse the machinery we just built — declared,
  disclosed, countable (`enforced: false` / `same-origin`) — and not
  become a second special case. The whole point of last week's work was
  that there is one class of thing.
- **Order:** root manifest and snapshot contract are both prerequisites
  to story-as-app. Doing story-as-app first means discovering them the
  hard way.

## 7a. Status: steps 1-3 are done (July 2026)

Implemented and test-locked since this note was written:

- **`AppTree`** (`packages/foafos/src/apptree.mjs`) — instances as a tree,
  with attenuation enforced in `spawn()` and refusals published rather
  than thrown. Close cascades deepest-first; suspend/resume take a
  subtree; spawning under a dead parent is refused, not reparented.
- **Root manifests** (`inklet/finkapp/foafos-root.js`) — `?root=office`
  boots with **zero stories compiled**, which is the claim §3 said could
  not be met. `webtv` holds no `same-origin`, so by attenuation nothing
  beneath it can either.
- **Storyless chrome** — a root with no stories hides the breadcrumb and
  the status line.

Still open, unchanged: the snapshot contract (§4) and therefore
story-as-app (§5), the composition library (§5.1), and the block manifest
(§6.1.1) — the last deliberately deferred while FINK stays one function,
one argument.

## 8. Smallest honest next steps

Roughly in dependency order, none of them large:

1. `parentId` on instances + cascade close. Makes the tree real, changes
   nothing else.
2. Attenuation check at the spawn call site, with a bus event on refusal.
3. Root manifest: boot reads app config rather than `DEFAULT_FINK_FILE`.
   Unlocks office-only / webtv-only installs.
4. Snapshot/restore contract in the SDK — offered, declared, and honestly
   disclosed when a guest cannot do it (the pattern the volume control
   already uses).
5. Only then: narrative runtime into a frame.

Steps 1–4 are each useful on their own even if step 5 never happens,
which is the main reason to do them in that order.

Independent of all five, and cheap:

- **Block manifest + on-demand payload** in the sandbox (§6.1.1). Removes
  a whole copy of every large block and makes multi-block usable at all —
  today block 0 is the only one anyone reads.
- **`gcfink.compose()`** as the home for composition semantics (§5.1),
  starting by giving `fink-namespace-preprocessor.js` a library home
  instead of a demos folder.
