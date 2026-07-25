# Headless QA deep-dive — the OS experience and the games

July 2026. Two new harnesses, three shipped fixes, and a list of the
traps that made the first three versions of each harness lie.

Run them:

```
node inklet/finkapp/test/qa-journey.mjs     # the OS experience, 3 viewports
node inklet/finkapp/test/qa-games.mjs       # do the games respond?
```

## Why these are not more point-tests

The existing suites each prove one thing about one surface, and
`sweep-minigames.mjs` proves the corpus boots. Neither answers the two
questions a person actually has:

1. Does the whole thing hold together while I move through it?
2. Is this a game, or a screenshot of a game?

### qa-journey.mjs — continuous audit, not assertions

A 21-step session (story → drawer → home → office app → TV → switcher →
volume → maker → game → play → split → pip → pause → quit → story →
skins) run at phone 390×844, tablet 820×1180 and desktop 1440×900, with
**the same invariants re-checked after every single step**:

| check | what it catches |
|---|---|
| `overflow` | content crossing the viewport edge |
| `offscreen` | a control, or a whole panel, parked outside the screen but still focusable |
| `unnamed` | a visible control with no accessible name |
| `tiny` | a target under 24×24 (WCAG 2.5.8 AA) |
| `dialog` | `role="dialog"` without `aria-modal`, a name, or the focus |
| `occluded` | anything covering the on-screen pad while it is up |
| `errors` | page errors and console errors, attributed to the step that caused them |

A defect that only exists in one state — a label that vanishes once a
game is running, a dialog that drops focus on a phone — surfaces as the
step where an invariant first fails. Screenshots are written for every
step, so failures get looked at rather than guessed at.

**It self-tests.** Before each viewport it plants one known fault of each
kind and confirms all five are caught. An audit that silently stops
working reports a clean bill of health forever, which is worse than no
audit. This immediately earned its keep — see the overflow trap below.

### qa-games.mjs — differential, not "the pixels changed"

Most of these games animate on their own, so "it looked different after I
pressed a key" proves nothing. Each game is measured twice over the same
interval — once idle, once while being driven — and only a game that
shows more distinct states under input counts as responding. Where a game
exposes a state hook it is used instead, because exact beats statistical,
and the report names the method per row so a weak result reads as weak.

Current state — **7/7 respond**:

| game | method | idle | driven |
|---|---|---|---|
| robbin | state hook | 1 | 10 |
| gridluck | state hook | 1 | 10 |
| battleboids | state hook | 1 | 6 |
| mudslider | state hook | 1 | 4 |
| chess | canvas sample | 1 | 4 |
| gems | state hook | 3 | 5 |
| mega | state hook | 3 | 5 |

## What the audit found, and what was fixed

**1. A closed drawer kept 20 controls in the tab order.** It was hidden
by `transform: translateX(100%)` alone — which moves it out of sight and
does nothing else. Tabbing through the story dropped focus into an
invisible panel off the right edge, with no way to know where it had
gone. Fixed: `setDrawer` now sets `inert` and `aria-hidden` when closed,
and the drawer starts withdrawn rather than merely translated away.

**2. App windows opened partly off-screen on a phone.** `makeWindow` used
a fixed 380px width plus a cascade offset with no clamping, so on a 390px
screen the right edge landed 26–98px past the viewport. What lives on
that edge is the close ✕ and, in Maker, the SET button — unreachable,
with no scroll to recover them because the window is `position: fixed`.
Confirmed on a screenshot before fixing. Fixed: size and position are
clamped to the viewport; desktop is untouched because the clamp only
bites when the window would not fit.

**3. Drawer controls were 19–23px tall.** The home screen and switcher
already clear 44px, but the drawer never got the same pass, and
`#breadcrumb-toggle` was 24×23 — one pixel short. WCAG 2.5.8 (AA) puts
the floor at 24×24. Fixed with a `min-height` on drawer and Maker
controls; the dense retro chrome stays dense.

After the fixes: **63 steps across three viewports, zero findings**, with
the self-test confirming the audit could still see all five fault kinds.

## The traps — every one of these made a harness lie

Recorded because each cost a wrong conclusion, and the next harness will
hit them again.

- **`scrollWidth` cannot detect overflow here.** The shell sets
  `overflow: hidden`, so content wider than the screen is *clipped*, not
  made scrollable, and `scrollWidth` never grows. A check built on it
  reports clean forever. Measure geometry — elements crossing the edge —
  and exclude deliberate cases (`position: fixed` panels, ancestors with
  `overflow-x: auto`). **The self-test caught this, not a human.**
- **`querySelectorAll` does not cross a shadow boundary.** Mudslider's
  `<canvas>` lives in a web component, so the canvas branch was skipped
  and a canvas game got fingerprinted by its class names — which never
  change. It read "unresponsive" for two rounds. Walk shadow roots.
- **A coarse canvas downsample cannot see a one-tile move.** Even at
  32×32, a player moving one tile on a mostly-static board produces an
  identical fingerprint. This is why `inconclusive` is a distinct verdict
  and not a failure — and why a game that matters needs a state hook.
- **Probe each game the way it is played.** Driving everything with the
  arrow keys made battleboids look broken; it has a single keydown
  handler because it is aimed with a pointer. A true statement about an
  irrelevant input is worse than no statement.
- **A splash screen is not an unresponsive game.** Mudslider gates on its
  own start button inside a shadow root. Press it, then measure.
- **Read the shape of the thing you are reading.** robbin's `tube.cam` is
  an array `[x, y]`; `cam.x` is `undefined`, which silently pinned the
  sample to a constant and read as "no response".
- **A closed panel covering the pad is not an occlusion**, and the gap
  between the A and B buttons is legitimately see-through — probe the
  buttons, not their container, and only when no shell surface is open.
- **Report the container, not its children.** One off-screen panel is one
  defect; listing its 20 buttons hides the other nineteen findings.

## Not covered

- **WebGPU.** Unavailable headless, so Stinkyfish/WGSL is untested here
  and any "verified" claim about it from these harnesses is false.
- **Performance feel.** SwiftShader runs heavy scenes at ~2 FPS. These
  harnesses answer *does it work*, never *does it feel good*.
- **Colour contrast.** Not measured; `skins-a11y.mjs` covers the skins.
- **Audio output.** Levels and coverage are asserted structurally
  elsewhere; nothing here listens.
