# How Much of Lucid Can Be Pushed into WebGPU?

A code-grounded analysis of both renderers — Mayfly (WebGL/GLSL, `mayfly/raymarcher.js`)
and Stinkyfish (WebGPU/WGSL, `stinkyfish/raymarcher.js`) — across standard inputs,
templating/inheritance, the rig/constraint layer, physics, and time. Verdict first,
then the per-subsystem detail with file:line evidence.

## Verdict

**WebGPU can host the entire pipeline end-to-end; WebGL structurally cannot.**
The interesting question isn't "can WebGPU match WebGL" — Stinkyfish is already
*ahead* on runtime inputs (it has `iMouse`, `iFrame`, `iTimeDelta`, and live quality
uniforms that Mayfly lacks). The question is which of the CPU-side subsystems should
move onto the GPU, and the answers split cleanly:

| Subsystem | Runs today | Push to WebGPU? | Why |
|-----------|-----------|-----------------|-----|
| Templating / `defs`·`ref` / DSL | Build-time JS (once per compile) | **No — never** | Produces static shader + uniform list; zero per-frame work; not SIMD-shaped |
| Rig / constraints (`derived`/`phase`/`bounds`) | Per-frame CPU, **Mayfly only** | **No (compute) / Yes (wire or inline)** | Too small & serial for a compute kernel; but Stinkyfish doesn't run it at all → a real parity gap to close by wiring or codegen-inlining |
| Physics (XPBD) | Per-frame CPU (Stack B) in production | **Yes — the one true GPU win** | Genuinely parallel; a WGSL compute engine already exists (but is unused/buggy); WebGPU-exclusive (WebGL has no compute) |
| Standard inputs / time / mouse | Split (Stinkyfish ahead) | **Already there** | Only Mayfly is behind (no mouse/frame/delta); Stinkyfish only lacks volume + a showEdges toggle |
| Volume rendering | Mayfly only | **Yes (port shader)** | Uniform plumbing trivial; the WGSL raymarch branch just hasn't been written |

**Bottom line:** *Stinkyfish is the only backend that can become fully GPU-resident
(compute physics + rig + raymarch sharing one device and buffers).* Mayfly is a
render-only backend — WebGL cannot run compute, and it cannot even share a WebGPU
physics device, so any GPU compute it consumes must be read back to the CPU to feed
its `u_*` uniforms. Plan for **Stinkyfish as the high-performance / compute path** and
Mayfly as the everywhere-compatible render fallback.

---

## 1. Templating & inheritance — build-time, not a WebGPU question

`defs`/`ref` inheritance (`json-loader.js:226-410`, `expandRef`/`applyOverrides`/
`substituteVars`), the DSL template system (`dsl-parser.js:74-249`, text expansion),
and the s-expr round-trip (`sexpr-dsl.js`) all run **once per scene compile** and emit
a **static** GLSL/WGSL string plus a fixed uniform list. They manipulate JSON/text
(tree clone, regex, recursion) — zero per-frame cost, nothing SIMD-shaped. **They do
not move to the GPU under any scenario**, and they're already backend-neutral (the same
IR feeds both codegens), so there's no WebGPU work here at all.

## 2. Rig / constraints — the parity gap, not a compute target

`evaluateRig(sceneParams, rig, time)` runs **every frame on the CPU**, but **only in
Mayfly** (`mayfly/raymarcher.js:806`; import `:7`). It computes `derived` (topologically
sorted DAG, `rig-evaluator.js:177-183`), `phase` animation (`:219-284`), and `bounds`
reports (`:186-216`); `chains`/`conserved` are stubs (`:289-312`). Output lands in
`u_<name>` uniforms (`mayfly/raymarcher.js:847-858`).

**The gap:** Stinkyfish's `render()` never calls `evaluateRig` (`stinkyfish/raymarcher.js:954`
only merges scene params + physics). So **rig-driven `derived`/`phase` values are frozen
on the WebGPU path** — animated rig scenes render static there unless something external
pushes values via `setParam`.

**Should the rig move to compute? No.** It's dozens of scalars in a serial topological
DAG feeding uniforms — kernel-launch + readback overhead dwarfs microseconds of
arithmetic. Two correct fixes instead, in order:

1. **Wire the existing CPU evaluator into Stinkyfish's loop** (cheap parity win): call
   `evaluateRig` and feed `derived`/`phase` into the scene-uniform write
   (`updateSceneUniforms`, `stinkyfish/raymarcher.js:917-952`). Closes the gap with no
   new GPU code. Caveat: the WGSL scene-uniform buffer is hand-packed, so added params
   must stay in sync (see §5).
2. **Or inline rig expressions into the shader at codegen time** (elegant long-term):
   codegen already lowers the same AST (`exprToGlsl`, `json-codegen.js`), so `derived`/
   `phase` expressions over `time` + constant params can be emitted directly into the
   shader, eliminating both the per-frame CPU evaluation *and* the derived/phase
   uniforms — and automatically fixing the WebGPU gap. `bounds` reporting stays CPU
   (it's diagnostic, not render-critical).

Note also: the CPU evaluator lacks `noise/fbm/hash` that the shader has — another reason
inlining (option 2) is cleaner than duplicating the evaluator.

## 3. Physics — the real GPU opportunity (WebGPU-exclusive)

There are **three separate physics stacks** converging only on a shared `phys_<name>`
position3 uniform contract:

- **Stack A — `xpbd-gpu.js`**: a *genuine* WGSL compute engine — 5 `@compute
  @workgroup_size(64)` stages (integrate/distance/position/ground/velocity,
  `xpbd-gpu.js:66-188`), pipelines, dispatch, readback. Wired via `physics-bridge.js`
  into Mayfly's `initPhysics` and `stinkyfish/demo.html`.
- **Stack B — `physics-scene.js`**: CPU-only. **This is what the main viewer
  (`index.html`) actually runs for *both* backends** (`index.html:1769,2745,2373-2388`),
  feeding positions via `setParam`.
- **Stack C — `splat-physics.js`**: CPU-only, for Gaussian splats.

**~0% of physics runs on the GPU in production today.** Stack A's GPU path is
aspirational and currently broken by three concrete bugs:
1. **Particle stride mismatch** — WGSL `Particle` is 48 B/12 floats (`xpbd-gpu.js:23-30`)
   but JS packs at 64 B/16 floats (`:368-378,:547`) → every particle past index 0 is
   garbage.
2. **Uniform alignment** — `SimParams.gravity` is 16-B-aligned in WGSL (`:49`) but JS
   writes it at offset 4 (`:461`).
3. **Racy parallel solve** — `solveDistanceConstraints` writes shared particles from
   parallel invocations with no atomics (the code comments acknowledge it, `:113-115`).

To make GPU physics real and primary:
- Fix the three correctness bugs above.
- Replace the sequential Gauss–Seidel solver with a **graph-colored / Jacobi** scheme so
  constraints solve parallel-safe — *this is the single biggest architectural blocker.*
- Add a **spatial hash / broadphase** before particle–particle collision (`stepCPU:683`,
  `physics-scene.js:365`) can become a compute pass; naive O(n²) on GPU is a non-starter.
- Retire Stack B by porting its extras (rig targets `updateFromRig:197`, bounds, restitution)
  into the WGSL shaders, and switch `index.html` to `PhysicsBridge`.
- **Device reality:** Mayfly (WebGL) cannot share a device with a WebGPU physics context,
  so it must read positions back to CPU each frame to fill `u_phys_*` — **Mayfly can never
  be zero-copy.** Only Stinkyfish can keep physics buffers resident and bind them directly
  (its `raymarcher.js` currently has zero physics awareness — it just accepts a
  `physicsParams` arg, `:954,:1016-1028`).
- Make Mayfly `await` the step (`mayfly/raymarcher.js:873` currently doesn't) or adopt a
  one-frame-late double-buffer so async GPU readback doesn't stall the render loop.
- Add a verification harness — none exercises `stepGPU` today.

**Realistic end state:** Stinkyfish fully GPU-resident (compute + render share device/
buffers, zero-copy); Mayfly GPU-*computed* but always paying a readback. Per-particle
integration is essentially done; the solver parallelization and broadphase are the real
engineering.

## 4. Standard inputs & time — Stinkyfish is ahead

| Input | Mayfly | Stinkyfish |
|-------|--------|-----------|
| resolution, time, cameraPos/Target, full Phong lighting, ground/axes/opacity, scene params | ✅ | ✅ |
| `iTimeDelta` | ❌ | ✅ (`:620,:983`) |
| `iFrame` | ❌ | ✅ (`:646,:987`) |
| `iMouse` + touch/mouse handlers | ❌ (no mouse at all) | ✅ (`:647,:247-344`) |
| Quality params (steps/threshold/…) | compile-time `#define` (`:441-444`) | **live uniforms** (`:626-632`) |
| `showEdges` toggle | ✅ (`:358`) | ❌ (hardcoded on `:882`) |
| Volume rendering (mode/step/density/edgeFocus/…) | ✅ (`:360-365,508-590`) | ❌ (entirely absent) |
| Rig `derived`/`phase` uniforms | ✅ | ❌ (no rig eval) |

So the input-parity work is mostly *Mayfly-ward* (add mouse/frame/delta if wanted) and
two Stinkyfish gaps: a `showEdges` uniform (trivial — a pad slot already exists at
`stinkyfish/raymarcher.js:643-644`) and **volume rendering** (uniform plumbing trivial,
but the whole WGSL volume-accumulation branch must be written — a shader-authoring job).

## 5. The WGSL uniform-packing tax

Every input added to Stinkyfish must be edited in **three synchronized places**: the WGSL
struct (`stinkyfish/raymarcher.js:617-648`), the size/layout comment (`:549-560`), and the
hand-packed `Float32Array` (`:999-1013`), plus the group(1) scene-uniform builder
(`:917-952`) for scene/rig params. Mayfly's named GLSL uniforms are order-independent and
need none of this. This packing tax is the practical friction on every "port to WebGPU"
item — worth considering a small layout-generation helper if this migration proceeds.

---

## Recommended sequence (value ÷ effort)

1. **Close the rig gap on Stinkyfish** (option 2: codegen-inline `derived`/`phase`). High
   value (animated rig scenes currently freeze on WebGPU), no new GPU code, also removes
   per-frame CPU work on Mayfly. *Start here.*
2. **`showEdges` uniform on Stinkyfish** — trivial, uses the existing pad slot; makes edge
   darkening a real toggle instead of hardcoded.
3. **Port volume rendering to WGSL** — medium; write the accumulation branch, add the
   ~7 volume uniforms.
4. **Fix + verify GPU physics for Stinkyfish** (Stack A bugs → graph-colored solver →
   retire Stack B). Highest effort, highest payoff, WebGPU-exclusive. Verify visually via
   `lucid/verify/` (the deviation lab is built for exactly this).
5. **A WGSL uniform-layout generator** to kill the three-places-in-sync tax before doing
   1–4 by hand.

Nothing here needs WebGL to change; every item makes Stinkyfish a fuller — eventually
fully GPU-resident — backend, with Mayfly remaining the compatible render fallback.
