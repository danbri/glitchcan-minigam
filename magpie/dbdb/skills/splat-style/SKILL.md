---
name: splat-style
description: >-
  Change how a Gaussian splat LOOKS or how clean it is, at runtime, in
  PlayCanvas — colour grades and stylisation, floater and haze removal,
  crisping, per-object fog — through the work-buffer modifier hook
  (setWorkBufferModifier), which runs one source per splat on both the WebGL
  work-buffer pass and the WebGPU compute projector. Also the honest map of
  what CANNOT be done at runtime: style transfer, super-resolution, gap
  filling and densification are all training-time or bake-time work, and this
  skill says which offline tool covers each. Use it when asked to restyle,
  recolour, tint, "make it look like X", clean up a scan, remove floaters or
  smear, sharpen a blurry splat, upscale, fill a hole, or add or remove
  splats. READ THE SILENT-FAILURE SECTION FIRST — a modifier chunk that fails
  to compile changes nothing, reports nothing, and looks exactly like a style
  that "did not have much effect".
---

# Styling, cleaning and upscaling Gaussian splats

This skill is about the pack in `magpie/dbdb/splats/pack/` and the games that
stamp it (`splatpack.html`, `dream.html`, the Skydock dreams). Cutting,
licensing and LOD live in the **splat-discovery** skill; this one starts after
an element is in the pack and asks how it should look.

Two questions get confused constantly, so separate them first:

| the ask | where it is answered |
|---|---|
| "make this one look different" | **runtime**, the work-buffer modifier — §1–§4 |
| "make this one *better*" (sharper, denser, hole-free) | **offline**, before it ships — §6–§8 |

Runtime restyling is cheap, reversible and verified here. Improving a scan is
none of those things, and nothing in the browser does it.

## 0. Evidence, per claim

Everything below is marked. The repo has been burned by confident, unverified
statements more than once, so:

- **measured** — run in this container, with numbers in §4.
- **read** — read out of `third_party/playcanvas/playcanvas.min.mjs`. Reliable
  about structure, not about how it feels on a real GPU.
- **literature** — from the papers. A direction, not a recipe.

WebGPU is **not available headless** here, so every WGSL claim in this file is
*read*, never *measured*. Do not upgrade one without a real WebGPU browser.

## 1. The hook

`entity.gsplat.setWorkBufferModifier({ glsl, wgsl })` installs a shader chunk
named `gsplatModifyVS` with three entry points (*read* — the stock chunk is a
no-op version of exactly these):

```glsl
void modifySplatCenter(inout vec3 center);
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter,
                              inout vec4 rotation, inout vec3 scale);
void modifySplatColor(vec3 center, inout vec4 color);
```

WGSL is the same three with `ptr<function, T>` in place of `inout`:

```wgsl
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(oc: vec3f, mc: vec3f,
                            rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {}
```

What makes this the right hook rather than one of several (*read*):

- The **same source runs on both backends**. PlayCanvas injects the chunk into
  the WebGL work-buffer fragment pass *and* into the WebGPU compute projector
  (`gsplatComputeSplatCS`). One idea, two languages, no branching in the game.
- `modifySplatColor` runs **after** spherical harmonics are evaluated, so it
  grades the final colour, not the DC term.
- Centres and rotation/scale arrive in **world space**, already carrying the
  entity transform. A height fog written here belongs to the object and holds
  still while the player walks around it.
- It is **per placement**, and a placement without its own modifier inherits
  its parent's. Our LOD-pyramid assets are parent/child placements, so one
  `setWorkBufferModifier` covers every level.

`setWorkBufferModifier` picks `glsl` or `wgsl` **at the moment you call it**,
from `device.isWebGPU`. Always pass both; passing one is a backend-specific
game.

## 2. THE SILENT FAILURE — read this before writing a chunk

**A modifier that fails to compile changes nothing and says nothing.**
*measured*: with a deliberately broken chunk, and again with a chunk missing
two of the three entry points, the render was byte-identical to no modifier at
all, and the page produced **zero** console errors, warnings or exceptions.
There is no "shader failed" to notice. It looks like a style that did not do
very much.

The commonest way in: **your chunk REPLACES the stock one whole.** Declare all
three entry points every time, even the two you do not use. A chunk carrying
only `modifySplatColor` leaves the other two undeclared, the geometry pass that
calls them fails to build, and you get silence. That is exactly the shape that
cost an evening here.

The rules that follow:

1. **Prove the chunk with a constant first.** `color.rgb = vec3(1.0,0.2,0.6);`
   Screaming pink or nothing — one glance answers "did it run?".
2. **Then add the uniforms.** Two changes at once and you cannot tell which
   one is broken.
3. **Count pixels, do not squint.** `node magpie/dbdb/tools/style-probe.mjs`
   renders plain, applies each style, and reports the share of lit pixels that
   moved. Under 1% means it did not run.
4. **No error is not evidence.** Say "measured" only about something you saw
   change.

## 3. Uniforms, live changes, and cost

Uniforms go on the **component**, not on a material (*measured*):

```js
const g = entity.gsplat;
g.setParameter('uShadow', new Float32Array([0.06, 0.10, 0.22]));
g.setParameter('uLight',  new Float32Array([1.00, 0.86, 0.55]));
g.setParameter('uAmount', 0.95);
g.setWorkBufferModifier({ glsl, wgsl });
```

`setParameter` stores the value against the placement and marks it dirty; the
work-buffer pass sets it per placement before drawing (*read*). Changing a
uniform afterwards restyles live with **no** touch to the modifier (*measured*
— `uAmount` 1.0 → 0.25 changed the image on its own). You do **not** need
`workBufferUpdate = WORKBUFFER_UPDATE_ALWAYS`; that recomputes the buffer every
frame and is for a modifier that animates from a clock, not from a knob.

Cost model (*read*): the work buffer is recomputed only when the placement is
dirty — a moved entity, a changed parameter, a new modifier, or
`WORKBUFFER_UPDATE_ALWAYS`. **A static style costs nothing per frame.** It is
paid once, over the splats of that placement, in the same pass that already
projects them. This is why runtime styling is affordable on a MacBook Air where
a post-process would not be.

Two cost traps:

- Shader variants are cached per `(format, work-buffer format, modifier hash,
  defines)` (*read*). Generating a chunk string per object compiles a shader
  per object. **Parameterise with uniforms; keep the chunk count small.**
- `WORKBUFFER_UPDATE_ALWAYS` pays the whole per-splat pass every frame. Reach
  for it only when the shader itself must change each frame.

Removing the style is `setWorkBufferModifier(null)`, and it restores the
original **byte for byte** (*measured*, 0 pixels moved). A style is a view of
the asset, never an edit to it.

## 4. The shipping styles, and what they measured

In `magpie/dbdb/tools/style-probe.mjs`, on `pickup` (9,563 gaussians), share of
lit pixels moved:

| style | what it does | moved |
|---|---|---|
| `duotone` | luminance onto a two-colour ramp — a palette, not a filter | 97.9% |
| `cull` | drops gaussians under an alpha threshold: scan floaters and haze | 27.4% |
| `crisp` | scales every gaussian down; tightens the silhouette | 98.1% |
| `fog` | world-height fog that belongs to the object | 99.9% |
| *reverted* | modifier removed | 0% |

`cull` is the one to reach for on a scan that reads as smeary. It removes the
wisps above a roofline and the smoke off a wheel arch, at zero cost, without
touching the file — the thing a destructive re-clip cannot offer. It is not a
substitute for cutting the element properly; it is the cheap first try.

Add a style by adding it to `STYLES` in the probe. It is then covered by the
same check, which is the whole point of the file.

## 5. Styling and spherical harmonics

Our pack elements are compressed PLY with the SH bands dropped, so this does
not bite today, but it will on a scan that keeps them (*read*):
`modifySplatColor` runs after SH evaluation, so it grades the *result*. A hard
grade therefore flattens view-dependence in look while the SH data still swings
the input underneath — the same surface can grade differently as the camera
moves. For a strong stylisation on an SH-carrying asset, bake the SH away
offline (`splat-transform` drops bands) rather than fighting it at runtime.

## 6. Style transfer proper — what is real, and what can ship

*literature.* The 3DGS style-transfer line — **StyleGaussian**,
**InstantStyleGaussian**, **StyleSplat**, **LocalGaussStyle** and relatives —
transfers a reference image's style onto a trained splat scene. They differ in
how much optimisation happens per style and whether the edit can be confined to
a selected object, and the good ones are interactive *after* a per-scene
preparation step. None of them is a shader. All of them want a training rig,
a Python stack and a GPU that is not the player's.

What that means here:

- **Bake, do not transfer at runtime.** If a story wants a scene in somebody's
  palette, that is an offline job whose output is another `.ply`/`.sog` in the
  pack, credited like any other derivative — and a derivative is exactly what
  the ND clause forbids, so re-check the licence before styling anything
  (splat-discovery §1).
- **A grade is not a transfer, and often it is enough.** `duotone` costs one
  dot product; a neural transfer costs a research pipeline. For a dream world
  reached through a candy-coloured terminal, the grade is the honest answer.
- **The seam to keep open** is the modifier's uniforms: a baked palette and a
  runtime grade compose, because the grade is applied last.

## 7. Upscaling, super-resolution and gap filling

*literature.* **SuperGaussian**, **SRGS**, **SuperGS**, **S2Gaussian** and
**GaussianSR** all raise the effective resolution of a splat scene, and the 2D
Gaussian-splatting inpainting work fills holes by semantic alignment across
views. Every one of them is training-time. **There is no runtime upscaler for
splats, in any engine.** A request to "upscale this splat" is a request to
re-train or re-capture.

What actually moves perceived sharpness in the browser (*read*, and measured
last month in splat-discovery §5):

- `app.scene.gsplat.minPixelSize` — the floor on a splat's screen size. Lower
  is sharper and costs fill rate; it is also the knob that saves a weak GPU.
- Render resolution / `maxPixelRatio` — more honest than any sharpening.
- The **LOD pyramid**, which needs `lod-meta.json`; without it the whole splat
  budget is inert (splat-discovery).
- `crisp` above, which tightens the silhouette but invents nothing. Overdone it
  turns a scan into gravel.

For a hole or an unscanned face: do not fill it, **cut around it or turn it
away**. That is why `subjects.json` records smear as a `note` — `cistern` has a
bad arc from 160°–240°, `redtruck` from 0°–45°. A scene that never shows those
bearings needs no inpainting.

## 8. Cleanup, pruning and densification — where each belongs

*literature.* **Mini-Splatting**'s cumulative-weight pruning, **LP-3DGS**,
opacity-gradient density control and **AD-GS** all decide which gaussians earn
their place, during or after training. Densification — adding gaussians to fix
under-covered regions — is likewise a training-loop idea.

Where the equivalents live for us:

| job | tool | when |
|---|---|---|
| fewer splats, permanently | `splat-transform -d N out.ply` | at ingest (splat-ingest.mjs) |
| four-level pyramid | `npm run pack:lod` | after clipping |
| drop floaters, reversibly | `cull` style, §4 | at runtime |
| add or remove splats at runtime | **not possible in the modifier** | — |

The modifier is strictly one-in, one-out: it can move, resize, recolour or hide
a gaussian, never create one. Setting `color.a = 0.0` is how you delete one for
the frame.

For an actual bake — writing modified splats back into a resource — the engine
carries `GSplatProcessor` (a GPU pass from source streams to destination
streams with a user `process()` chunk) and `GSplatContainer` (a resource sized
to a splat count you choose, which is what a densifying bake would write into).
Honest status: *read*, and **attempted here without success**. Against a
`.compressed.ply` (one `packedTexture` stream) and against a `.sog`
(`means_l`, `means_u`, `quats`, `scales`, `sh0`, `sogCodebook`), the processor
constructed and ran with no error and changed nothing — its destination stream
list wants the *uncompressed* `GSplatResource` layout (`splatColor`,
`transformA`, `transformB`). If a bake path is ever needed, start there, and
prove it with a constant exactly as in §2 — the same silence applies.

## 9. Decision table

| the ask | do this |
|---|---|
| "make the swamp sicklier / the maze colder" | `duotone` or `fog` with per-zone uniforms |
| "this scan looks smeary" | `cull` first; re-clip only if that is not enough |
| "it is too blurry" | `minPixelSize` and render resolution; then `crisp`; never "upscale" |
| "there is a hole in the far side" | turn it away, or cut it out — record it in `subjects.json` |
| "make it look like a Van Gogh" | offline bake, licence re-checked; say plainly that runtime cannot |
| "add detail / more splats" | re-capture or re-train; not a runtime job |
| "it is slow" | splat-discovery §5 — LOD, budget, `minPixelSize`; style is not the cost |

## 10. Checks

    node magpie/dbdb/tools/style-probe.mjs              # every style, on pickup
    node magpie/dbdb/tools/style-probe.mjs duotone --element hut
    npm run splat:style

Exits non-zero if any style moved under 1% of lit pixels — which is the same
thing as "it did not run". Images land in `magpie/dbdb/tools/styles/`.

The renderer in this container is SwiftShader: a CPU pretending to be a GPU.
Colours and pixel counts from it are real; frame rates are not. And it has no
WebGPU at all, so the WGSL half of every style here is compiled nowhere. Say so
whenever you report on one.
