# Minigame corpus review — July 2026

Every widget any story invokes, driven in the real shell: does it load,
does it play, is it safe to run more than one, and is there anything at
all for a screen reader.

Method: `node inklet/tools/fink-universe.mjs --print` for the invocation
list; `node inklet/finkapp/test/sweep-minigames.mjs --shots` to boot and
measure each one; `e2e-instances.mjs` for multi-instantiation;
`play-boidwars.mjs` for one full playthrough. Numbers below are
measured, not estimated. Screenshots at 430×860 (phone portrait).

---

## 1. What exists

11 `# MINIGAME:` invocations across 8 stories, 7 distinct widget names:

| widget | invoked by | delivery |
|---|---|---|
| gems | world-between-worlds, diamond-cave ×2 | inline (built-in) |
| mega | hamfink2026-ch2 | inline (built-in, gems in mega mode) |
| robbin | hampstead, foafos-tour | iframe → `magpie/robbin/` |
| mudslider | world-between-worlds, mudslidemines | iframe (own game.js) |
| chess | shane-manor | iframe → `thumbwar/minichess.html` |
| battleboids | world-between-worlds | iframe → `thumbwar/battleboids.html` |
| gridluck | world-between-worlds | iframe → `thumbwar/gridluck.html` |

Four of the seven are **wrappers around a standalone game elsewhere in
the repo**. That is a good pattern — every one of them still runs on its
own URL — but it means the wrapper is where integration bugs hide, and
it is a frame boundary that most platform services have to be explicitly
forwarded across.

## 2. Sweep results

```
widget        boot   ready  drew   grants  frames  focusable  live  canvas-labelled
gems          633    yes    yes    —       0       16         0     —
robbin        642    yes    yes    5       1       17         1     1/2
mega          626    yes    yes    —       0       16         0     —
mudslider     652    yes    yes    9       1       0          1     —
chess         633    yes    yes    3       1       4          1     —
battleboids   634    yes    yes    2       2       1          2     1/1
gridluck      639    yes    yes    5       2       3          2     1/1
```

All seven boot in ~0.65s, reach `ready`, and draw. None throws. That is
better than the corpus's reputation and worth saying plainly.

`live` and `canvas-labelled` are non-zero only because of work done in
this pass; before it, **every packaged guest had exactly zero `aria-*`
attributes** (measured across all six manifests). `gems`/`mega` show
`frames: 0` because they are not iframes at all — see §5.

---

## 3. Multiple instances — the headline

Reported earlier: *"they can be multiply instantiated yet only show up as
one in window list"*. The window list was the visible symptom. Beneath
it, **nothing distinguished one running guest from another**.

Both message paths were bare `window.addEventListener('message', …)`
with no `event.source` check. Consequences, all reproduced:

- two copies of a widget each ran BOTH handlers — one gem counted twice
- they shared one `lastSync`, so each report was measured against the
  other's total and the story's diamonds walked
- closing one removed the listener the other was still using
- **any frame on the page could post `set-variable`** and have it applied
  with whatever grants the focused guest happened to hold

That last one matters most: it made the manifest capability model
(spec §5.3, shipped last week) decorative. A manifest attached to a
*type* means nothing if the host cannot tell which frame is speaking.

There was also a plain collision: `containerId` was
`inline-minigame-${Date.now()}`, so two widgets opened in the same
millisecond got the same id and the second overwrote the first's record.

**Fixed.** Every running guest now has an instance record and one
router dispatches by `event.source`. Locked by
`node inklet/finkapp/test/e2e-instances.mjs` (8 assertions), which
posts its attacks from inside a real guest frame:

```
✔ three guests running, three distinct identities: mg1=mudslider, mg2=mudslider, mg3=gridluck
✔ two copies of one widget each have their own container + record
✔ one widget's progress moved only its own baseline (mg1)
✔ a frame that is not a running guest cannot write story variables
✔ a spoofed `complete` did not close anybody else's window
✔ closing one guest leaves the other two registered
✔ a survivor is still heard after a sibling closed (5 → 11)
✔ shell can enumerate every running guest (mg1, mg2)
```

The shelf now lists embedded guests under **In the story**, one row per
instance, with locate-and-close. Two copies of one widget are two rows.

**Caveat, stated plainly:** this makes concurrency *safe*, not *full*.
The window-mode game is still one at a time — that is FinkWM's model, not
an accident. Several simultaneous game *windows* would be a real
feature, and it is now unblocked rather than done.

---

## 4. Accessibility

### The honest starting position

Six packaged guests, **zero `aria-*` attributes between them**, no live
regions, no headings, and — for the three canvas games — no
keyboard-reachable element of any kind. A canvas game is opaque to
assistive technology by construction: there is nothing in the DOM to
read, so a screen-reader user gets an unlabelled box and silence. No
amount of sprinkled roles fixes that; the game has to *say* things.

### What this pass added

`inklet/minigames/guest-a11y.js` — one implementation, included by every
guest (SDK-based and native-protocol alike), providing:

- an sr-only `role="status" aria-live="polite"` region
- an sr-only `<h1>` from the document title
- `role="img"` + a *live* `aria-label` on the primary canvas, refreshed
  by a per-game describer, so "what is this" is answerable
- `__mgA11y.announce(text)`, deduped — a loop that announces every frame
  is worse than silence, because a reader never finishes a sentence

Announcements are **pooled**: they go to the guest's own live region and,
via postMessage, to the shell's `#foafos-announcer` — which is where the
player's attention already is, survives the guest closing, and is the
only place that can say *which* of two copies spoke.

Also done:
- **gems** (both implementations, see §5): gems are now `<button>`s.
  Tab-reachable, named ("blue gem, worth 2 gems"), Enter/Space collect,
  visible focus ring, `prefers-reduced-motion` kills the pulse. This is
  the one game in the set that is now genuinely playable without sight
  or a mouse.
- **boidwars**: canvas describer (health, boids aloft) plus turn and
  damage announcements.
- **gridluck**: canvas describer (score, level), score and game-over
  announcements, plus a `__gridluck` headless hook.
- **mudslider**: now honours `config.controls.provider === 'host'` and
  hides its own arrows — see §6.

### What remains genuinely undone

- **mudslider, chess, battleboids, gridluck have no keyboard path to
  gameplay** through the shell. Their arrow-key handlers exist but are
  bound inside a sandboxed iframe that needs focus first, and the shell's
  d-pad only forwards keys when `controls !== 'none'`.
- **No text mode anywhere.** Narration tells you what happened; it does
  not let you play. For mudslider (a discrete grid) a text mode is
  genuinely feasible and would be the single highest-value a11y
  investment in the corpus. For boidwars (continuous aiming) it is not.
- **No guest declares `prefers-reduced-motion` handling** except robbin,
  which does it thoroughly (7 call sites).
- Shell-level ARIA is in good shape and gated: `aria-audit.mjs` reports
  0 errors, `skins-a11y.mjs` passes all six skins. The gap is entirely
  *inside* the guests.

---

## 5. Design findings

### Two gems, and the shell ships the wrong one

There are two complete, independent gem games:

- `inklet/finkapp/gems.minigam.js` (220 lines) — **the one that runs.**
  No manifest, no SDK, no sandbox, no debug clock. Its diamond writes go
  through the host actor, so it **bypasses the capability model
  entirely**.
- `inklet/minigames/gems/` — packaged properly: manifest with
  read/write allowlists, SDK, styles, a NOTE.md. **Never loaded**, because
  `gems` is not in `iframeMinigames`.

I made both accessible rather than silently switching the default gem
experience for every story that uses it — that is a design call, not a
bug fix. **Recommendation:** add `gems` to `iframeMinigames` and delete
`gems.minigam.js`, or delete the packaged copy and stop pretending it is
the reference implementation. Keeping both is the worst of the three.

### The shell chrome covers guest HUDs

GridLuck's top-left HUD ("v1.3.0 Lv.1 …  XP: 5/100") is clipped by the
floating WM chrome. The chrome is draggable so a player can work around
it, but no guest is *told* where the occluded region is.

**Proposed contract:** `init.config.safeArea = {top, right, bottom, left}`,
re-sent when the chrome docks or the mode changes. Cheap on the host
side; guests inset their HUD by it. Not implemented — it changes the SDK
surface and deserves a decision.

### Two sources of truth for controls

`minigameInfo` in `fink-minigames.js` and `manifest.json.controls` both
claim a control scheme, and they had already drifted (mudslider: registry
`lite`, manifest `dpad`). I aligned the manifests to the registry, since
the registry is what the code reads. **Recommendation:** the manifest
should win — it is the packaging contract and it travels with the game —
and the registry entry should become a fallback for unmanifested guests.

### Keyboard hints on touch-only surfaces

GridLuck's buttons read "Teleport (T)" and "Hold Zoom (Z)" on a phone.
Harmless but unfinished-looking.

### Screen budget

Chess renders a 4×3 board occupying the top third of a phone screen with
two thirds empty; mudslider's board is similarly small and centred. Both
would benefit from filling the window they were given. Compare gridluck,
which fills it completely.

---

## 6. Playability and finishedness

Ranked by how close each is to something you would show someone.

**robbin** — the most finished by a distance. 17 focusable elements, its
own live region, thorough `prefers-reduced-motion` support, native quit
dialog, audio ducking, real TfL data, a headless hook. It behaves like a
product; the others behave like prototypes.

**gridluck** — visually the richest arcade game: v1.3.0, XP, zones,
ghosts, treasure, teleport/zoom. Plays well on touch (swipe + buttons).
Held back by the HUD occlusion and the keyboard-hint labels.

**boidwars** — playable *as of this week*. It was mathematically
unwinnable in portrait until the aspect and mountain-shape fixes: every
flock hit an impassable rock needle and mined it, so nobody could ever
take damage (6 turns, 0 hits, 1678 blocks of rubble). Now: purple 7→5→3,
blue 7→6 in the first three turns, then it settles into a mining siege.
Slow by design; the siege phase may want a shot clock or an erosion rate
that resolves it.

**chess** — small, clean, complete. Finishes properly and reports a
result. The least ambitious and the most *finished* per line of code.

**mudslider** — the largest game (124KB) and the roughest fit. Until this
pass it drew its own arrows *on top of* the shell's joystick — two
overlapping control systems, the left arrow and up arrow buried under the
ring. Fixed. Ten rooms, four keys, a real map; deserves a proper playtest
pass of its own, which it has never had.

**gems / mega** — a spawner and a click handler. Complete for what it is;
now the most accessible thing in the set, which is a slightly absurd
outcome of it being the only one not built on a canvas.

### Cross-cutting

- **Nothing has a tutorial.** Every game drops you in. Robbin's GO gate
  is the only onboarding in the corpus.
- **Nothing has a difficulty setting**, though `difficulty` is passed to
  every guest in `init.variables` and read by nobody.
- **Completion is inconsistent.** chess and boidwars report a result and
  close; gridluck and mudslider can end; gems auto-completes on a timer;
  robbin is deliberately endless. A story author cannot rely on "the
  minigame finished" meaning the same thing twice.
- **12 dead writes**, from `fink-vars.mjs --strict`: guests writing
  variables no story declares (`chess_won`, `mudslider_gems`, all four
  `has_*_key`…). Ink refuses the assignment and the host swallows it, so
  those results go nowhere. Either the stories should declare them or the
  guests should stop claiming them.

---

## 7. Recommended next actions

1. **Resolve the two gems.** One implementation, packaged, manifested.
2. **Safe-area contract** in `init.config`, so guests stop drawing under
   the chrome.
3. **A text mode for mudslider** — the one game whose state is discrete
   enough to narrate as a playable interface, not just a commentary.
4. **Make the manifest authoritative for `controls`**, registry as
   fallback.
5. **Decide what `complete` means** and make all seven honour it.
6. **Playtest mudslider and gridluck headlessly**, the way boidwars was.
   Both derive their world from the viewport; boidwars proved that class
   of bug is invisible until you actually play.

## 8. What this pass changed

- instance registry + `event.source` routing (`fink-minigames.js`)
- per-instance `lastSync`, grants and verbs; counter-based container ids
- `sys.guest.unrouted` announced when an unregistered frame speaks SDK
- shelf lists embedded guests, one row per instance, locate + close
- `inklet/minigames/guest-a11y.js`, included by all six guests
- `guest.announce` pooled into `#foafos-announcer`
- gems → buttons, labels, focus ring, reduced-motion (both copies)
- boidwars + gridluck canvas describers and announcements
- mudslider honours the host input policy (spec §5.1.1)
- manifests: `controls` aligned with the live registry
- new: `e2e-instances.mjs` (8), `sweep-minigames.mjs`
