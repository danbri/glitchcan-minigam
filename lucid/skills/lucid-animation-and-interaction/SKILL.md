---
name: lucid-animation-and-interaction
description: >-
  Work on time, animation, looping, the timeline scrubber, and camera/gesture
  interaction in the Lucid SDF viewer. Use this when driving scene parameters
  over time, wiring or debugging the node-editor timeline (play/pause/loop/
  scrub), controlling the render clock, adding orbit/pan/zoom or touch/tap
  interaction, or connecting a tap to a physics impulse or picking. Covers how
  the two backends derive time, how the timeline drives the preview, and the
  camera-interaction paths (the reusable <lucid-orbit-controls> component vs the
  hand-rolled handlers in index.html).
---

# Lucid Animation & Interaction

## Time & the render clock

Animation is driven by **time**, not keyframes — there is no keyframe model
anywhere in the system. Params animate through the shader `u_time` uniform and
the rig `time` variable; looping is implicit via periodic expressions like
`sin(time)`.

Both backends derive time the same way and expose the same override hook:

```
time = overrideTime !== null ? overrideTime : (performance.now() - startTime) / 1000
```

- `renderer.overrideTime = seconds` pins the clock (Mayfly `raymarcher.js:83`,
  Stinkyfish `raymarcher.js:106`); `= null` resumes the wall clock.
- Via the component: `<lucid-renderer>.setTime(seconds)` / `.clearTime()` — works
  on both backends (added July 2026).

To animate a param, reference `time` in an `expr` (see lucid-scene-authoring):

```json
{ "expr": "add", "args": [ 1.0,
  { "expr": "mul", "args": [ 0.2, { "expr": "sin", "args": [ { "var": "time" } ] } ] } ] }
```

## Two animation UIs

**index.html** — a binary `playing | frozen` state (no scrubber). Freezing pins
`overrideTime` to the captured time each frame; playing resumes the clock.
Auto-rotate is a separate camera concern, not animation.

**node-editor.html** — a full timeline: `{ time, duration:10, playing, loop }`
with play/pause, rewind, loop toggle, and a draggable scrubber. As of July 2026
the scrubber **is authoritative over the preview**: `updateScrubber()` calls
`previewEl.setTime(timeline.time)`, so play/pause/loop/scrub genuinely drive the
`<lucid-renderer>` clock. (Before that, the timeline only moved the visual handle
and never reached the renderer — it was cosmetic.)

**If you extend the timeline:** keep `setTime()` the single point where timeline
state reaches the renderer. Looping wraps `timeline.time` at `duration`; the
scrubber maps pointer x → time. To add keyframing, introduce a keyframe model
that resolves to param values at `timeline.time` and push them via the
component's `updateParam(name, value)` (backend-agnostic), keeping `setTime()`
for the clock.

## Interaction: camera

`<lucid-orbit-controls>` (`components/lucid-orbit-controls.js`) is the reusable
camera controller — spherical `{theta, phi, distance, target}`, mouse drag/wheel,
1-finger orbit, 2-finger pinch-zoom + pan, `touch-action:none`. It emits
`camera-change` / `drag-start` / `drag-end` and exposes
`getCamera/setCamera/getCameraPosition/isDragging`. **Prefer wrapping a canvas in
this component** for new interaction surfaces.

⚠️ Rough edge: **index.html does not use `<lucid-orbit-controls>`** — it
hand-rolls its own mouse + touch handling with separate click-vs-drag and tap
detection. Two camera-interaction implementations exist. Changing camera feel in
the main viewer means editing the hand-rolled handlers, not the component; ideally
migrate index.html onto the component rather than deepening the divergence.

## Interaction: tap → physics

`index.html`'s `applyImpulseFromScreen` projects a tap/click, finds the nearest
`PhysicsScene` body, and calls `applyImpulse`. Tap qualification: a click that
wasn't a drag, or a touch with movement < 15px and duration < 300ms. This path
targets **Stack B (`PhysicsScene`) only** — `PhysicsBridge.applyImpulse` (Stack A)
is not reachable from the index.html tap handler. See lucid-rigging-and-physics
for the two-physics-stack picture.

## Verifying animation without WebGPU

Headless Chromium runs Mayfly (WebGL), so you can verify the clock end-to-end:
load a page, press play, and assert the renderer's `overrideTime` advances, e.g.

```js
await page.click('#btnPlay');
const t1 = await page.evaluate(() => document.getElementById('preview')._renderer.overrideTime);
// …wait…
const t2 = await page.evaluate(() => document.getElementById('preview')._renderer.overrideTime);
// expect t2 > t1  — proves the timeline drives the render clock
```

(WebGPU is unavailable headless, so this exercises the Mayfly path; Stinkyfish
timing must be checked in a real WebGPU browser.)
