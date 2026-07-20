---
name: lucid-rigging-and-physics
description: >-
  Work with Lucid's constraint/rig layer (core/rig-evaluator.js) and its physics
  stacks (core/physics/*.js) — the systems that drive scene parameters from
  expressions, phase-coupled animation, bounds, and XPBD simulation, and feed the
  results into the renderer as uniforms. Use this when authoring or debugging a
  scene's `rig` or `physics` block, when a physics scene behaves oddly (jitter,
  double simulation), when wiring parameters to be driven/constrained, or when
  you need to know what the rig binding-state badges (phys/constrained/driver/
  expr) actually mean. Covers the integration points between rig, physics,
  params, and the render loop — including two known architectural rough edges.
---

# Lucid Rigging & Physics

Two layers sit between a scene's params and the shader: the **rig** (CPU,
deterministic, evaluated every frame) and **physics** (XPBD simulation). Both
ultimately write parameter values that become `u_<name>` / `phys_<name>`
uniforms.

```
params ─▶ rig-evaluator (derived/phase/bounds) ─▶ uniforms ─▶ shader
       └▶ physics (XPBD) ─▶ phys_<name> uniforms ─▶ shader
```

## The rig layer (`core/rig-evaluator.js`)

`evaluateRig(rig, baseParams, time)` interprets the **same expression AST as
codegen** (`const` / `var` (incl. `time`) / `expr`). A scene's `rig` object has
six sections:

| Section | Status | What it does |
|---------|--------|--------------|
| `derived` | ✅ implemented | computed params, topologically sorted (cycle-detected). **Drives geometry.** |
| `bounds` | ✅ implemented | min/max validity → `violations[]` (reports only; does **not** clamp) |
| `phase` | ✅ implemented | phase-coupled animation: a `driver` expr feeds `followers` with phase/amplitude/offset/waveform. Emits `${cycle}_${follower}` params |
| `chains` | ❌ stub | only registers `${chain}_joint${i}` defaults; `maxBend/taper/sequential` are unimplemented |
| `conserved` | ❌ stub | no-op (volume/mass preservation not implemented) |
| `constraints` | ⚠️ UI-only | see below |

⚠️ **Expression gap:** the CPU rig evaluator implements arithmetic/trig/`pow`/
`sqrt` etc. but **not** `noise/fbm/turbulence/hash` (which the GLSL shader path
has). A rig `derived`/`phase` expression using noise evaluates differently on the
CPU than the same expression in-shader. Avoid noise in rig expressions.

## Two "constraint" concepts — don't confuse them

This is a real rough edge. `rig.constraints` and `rig.derived`/`phase` are
**disjoint systems that don't reference each other**:

- **`rig.derived` / `rig.phase`** → evaluated by `rig-evaluator.js`, produce
  uniform values, **affect the rendered geometry**. The evaluator has **no
  handling of `rig.constraints`**.
- **`rig.constraints`** → read only by the `index.html` param panel
  (`enforceConstraints`) as `coupled` driver/follower relations that **clamp
  slider ranges in the UI**. Never touches geometry.

## Binding-state badges (param panel)

Computed per param in the index.html panel:

| Badge | Condition |
|-------|-----------|
| ⚛️ phys | `param.physics` is truthy |
| ⚙️ constrained | param is a `follower` in `rig.constraints` (the UI-only system) |
| ⚙️ driver | param is a `driver` in `rig.constraints` |
| ƒ expr | `param.expr` is a string |

⚠️ The ⚙️ badges reflect only `rig.constraints`, so a param driven by
`rig.derived`/`phase` gets **no badge** even though it is genuinely driven. Keep
this in mind when reasoning about "why is there no badge."

## Physics — two stacks, one conflict

There are **two independent physics implementations**. Know which one a scene/
entry point uses:

| | Stack A — `PhysicsBridge` | Stack B — `PhysicsScene` |
|---|---|---|
| Files | `physics/physics-bridge.js` + `xpbd-gpu.js` (WGSL compute, GPU w/ CPU fallback) | `physics/physics-scene.js` (CPU only) |
| Wired via | the **renderer**: `raymarcher.js` `initPhysics` when `sceneJson.physics.enabled`; steps inside `render()` | **`index.html` directly**: instantiated & stepped in the render loop, pushing positions via `renderer.setParam` |
| Used cleanly by | `stinkyfish/demo.html` | `index.html` |

⚠️ **The conflict:** loading a physics scene in `index.html` activates **both** —
`renderer.updateScene(...)` triggers Stack A inside Mayfly, while `index.html`
also builds and steps Stack B. Both write the same `phys_*` uniforms with no
arbitration, so they double-simulate and fight. If you see physics jitter/doubled
motion in the main viewer, this is the likely cause. When changing physics
wiring, make one stack authoritative per entry point rather than adding a third
path.

Other notes: Stack B steps **after** `render()` using the frame's
`renderer.lastRigValues`, so physics lags the rig by one frame; Stack A steps
before draw. `splat-physics.js` is a separate rigid/soft stack for Gaussian
splats (open TODOs: torque on offset impulse, object-object collisions).

## Shared SimulationDriver (July 2026)

`core/simulation-driver.js` is a backend-neutral per-frame simulation used by the
`<lucid-renderer>` component: each frame it evaluates the rig (base/derived/phase)
and steps physics (`PhysicsScene`), pushing every result into whichever renderer
through the shared contract — `setParam(name)` for rig params, `setParam('phys_'+name)`
for body positions. So one simulation feeds **both** engines; the shader language
is the only backend difference.

To avoid two stacks fighting, the renderers expose opt-out flags the component
sets: **`externalRig`** (Mayfly skips its internal `evaluateRig`) and
**`externalPhysics`** (Mayfly skips its internal `PhysicsBridge`/Stack A). Both
default **false**, so direct users like `index.html` keep the built-in behaviour;
only the component turns them on. This is the clean resolution of the
double-physics rough edge below (for the component path). `index.html` still uses
its own `PhysicsScene` directly and is unchanged.

## Integration points (the API surface)

- **rig → shader:** `evaluateRig` output → `u_<name>` uniforms (raymarcher binds
  base + derived + phase).
- **rig → physics:** `renderer.lastRigValues` → `PhysicsScene.updateFromRig`
  (rig-driven constraint targets).
- **physics → shader:** `phys_<name>` position3 uniforms via `renderer.setParam`.
- **interaction → physics:** `applyImpulse(bodyName|id, impulse)` on either stack;
  the index.html tap handler (`applyImpulseFromScreen`) currently reaches **Stack
  B only**.

## Authoring a physics/rig scene

- Physics config: `physics.enabled` + `bodies`, `distanceConstraints`,
  `positionConstraints`, plus `gravity`/`ground`/`bounds`/`damping`/`iterations`/
  `dt`. Params exposed as `phys_<name>` (position3).
- Rig config: put geometry-driving relations in `derived`/`phase`; use
  `constraints` only for UI slider coupling.
- Test in `stinkyfish/demo.html` (Stack A, isolated) to avoid the index.html
  double-physics interaction while iterating.
