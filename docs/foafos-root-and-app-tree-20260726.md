# foafos: root, the app tree, and what FINK is for

*July 2026. A note for discussion, not a plan of record. Written from
danbri's framing, with the current-state claims verified against the code
rather than recalled.*

---

## 1. The historical reading, and it checks out

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

## 6. FINK beyond storytelling

Two claims, and I think both are right with one caution each.

### 6.1 As a prettier JSONL

Real. `.fink.js` already carries multiple typed blocks via
`OO(mediaType)`, raw-captured, executed rather than parsed. Against JSONL
it wins on: comments, unescaped newlines inside records, free syntax
highlighting, and self-description (the file can *say* what it is,
because it runs).

**The cost to state plainly:** reading it requires a JavaScript engine.
JSONL does not. That is a genuine disadvantage for a data interchange
format and should be argued rather than glossed — the answer is probably
"FINK is an authoring and delivery format; export JSONL for consumers who
just want rows."

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
