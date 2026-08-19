# Interpreted SDF — the roadmap past codegen

*August 2026. Owner direction: "the more we can push parallel-friendly SDF DSL
handling onto the GPU, the more we can intelligently trim at point of use" —
and then: ditto animations, physics, particles, interactions, constraints,
noise, reflections, tiling, token IDs.*

## What already exists (shipped, device-tested unless noted)

| layer | form | status |
|---|---|---|
| Edit list | flat data buffer folded by a loop; per-edit bound cull | on device |
| Chunked fold | two-level bound skip, exact | on device |
| Storage buffers | group-1 across classify/generate/render; no size cap | on device |
| Per-brick binning | CSR bins; exact in band, safe lower bound beyond | on device |
| Template VM | straight-line bytecode; one edit/thread; SEL predication; live params (`bear.html` feed) | Node-verified twin; device pending |
| Cheap refinement | render refinement cut to 1 field eval/hit (was 2) | splice patch |

**The architecture rule that makes everything below tractable:** the world
splits into a *static* part (baked once into the clipmap atlas — arbitrarily
heavy) and a *dynamic* part (a SMALL live edit list — bounded count). Static
costs nothing per frame; dynamic pays per frame but is small. Every feature
below is one of: a VM opcode, an edit-list op, a compute pass over buffers, or
a render-pass change. Nothing re-generates shaders at runtime.

## The ditto list

**Animations.** Pose params over time: `__lxSetParams({t})` per tick re-runs
the VM (µs) — the cost is the RE-BAKE, and a full-clipmap forceFull per frame
is too much. Two steps: (1) dirty only the bricks the CHANGED edits touch
(compare old/new edit bounds on GPU, write the engine's dirty list — the
engine already bakes per-brick); (2) for high-frequency motion, keep moving
edits out of the bake entirely: composite a small live fold into
`cacheSceneSample`'s RENDER-side use only (static from atlas, dynamic
analytic). Gait at 10–15 Hz re-bake reads fine; a running animal wants (2).

**Physics + constraints.** Already GPU-shaped: `colorConstraints` builds
race-free XPBD batches and `generateXpbdSolveWgsl` exists (gpu-physics.js).
Run integrate/solve as compute passes; the joints buffer IS the VM's param
buffer (bind it as `lxvm_params`) — physics drives the template with the CPU
fully out of the loop. The puppet rig (13 joints, 12 constraints, 3 colour
batches) is the first target.

**Particles.** Particles are edits. Reserve an edit RANGE; an integrator pass
writes translate/colour slots each frame; the fold already renders spheres
with smooth-union. Same re-bake economics as animations → live-fold composite
first, bake only settled particles ("snow piles up: dynamic while falling,
baked when at rest" — the Dreams trick).

**Interactions + token IDs.** Give every edit an id (spare f32 in the stride,
or widen 23→24). Picking: on tap, ONE compute thread marches the tap ray
through the binned field and also folds nearest-edit-id; writes {id, t, p} to
a 16-byte buffer; readback tells which animal/part was hit. Zero per-frame
cost — it runs per tap. Ids also tag SUBTREES (animal #3 = edits 36..47), so
"pet the bear" maps a hit id to a param change: tap → id → `{fed:+0.2}`.

**Noise.** Two placements: (a) a HASH/VALUE-NOISE opcode in the VM — params
jitter per animal (herd variation) at template-eval time, zero fold cost;
(b) a displacement term in the fold (edit flag + amplitude/frequency) for
surface detail — bounded amplitude keeps the cull margins valid (add |A| to
the edit bound). (a) is nearly free and lands first.

**Tiling.** Domain repetition as an edit op-flag: fold does
`p' = p - clamp(round(p/period), -n, n) * period` before the primitive —
one edit becomes a bounded grid of instances. Bound accounting: the repeated
edit's cull bound covers the whole repeat region (or radius ∞ in its chunk).
Forests, fences, colonnades for the cost of one edit each.

**Reflections.** The odd one out — a RENDER feature, not a model feature. The
cached atlas is exactly what cheap reflections want (cone-march the clipmap
from the hit point), but that is engine surgery in the sparseRender pass, on
the engine's own terms. Honest status: not started, needs its own design
round, nothing in the model layer blocks it.

## Perf ledger (device-measured)

- 19 rAF Hz close-up on the BAKED 80-edit herd: render refinement was 2
  analytic evals × full fold per hit pixel per frame. Fixed by (a) single-eval
  refinement (this commit), (b) binned field default (~9 edits/eval).
  `analyticNormal` in the engine is dead code — normals come from the cache.
- The engine's own quality governor (scale 0.72 in the report) cannot save a
  heavy analytic field; the field must be cheap at point of use. That is what
  binning is for.
