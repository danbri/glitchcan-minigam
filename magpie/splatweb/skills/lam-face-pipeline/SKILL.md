---
name: lam-face-pipeline
description: >-
  How the LAM (Large Avatar Model) faces in magpie/splatweb got made — the
  54-face roster behind Pentulpa Capulet and the demo-lam-* treatment
  demos. Covers the whole chain: where the source photos come from
  (synthetic-only, never a real identifiable person), converting a 2D
  photo into a riggable Gaussian-splat head avatar via a self-hosted LAM
  HuggingFace Space (tools/lam-generate.py), placing the output in
  third_party/, wiring it into lib/lam-face-roster.js, and the
  attribution/curation rules that go with it. Use this when adding a new
  face to the roster, re-running the batch conversion, investigating why
  a face looks wrong, or explaining what "LAM avatar" means in this
  project. READ THE ETHICS SECTION FIRST — this pipeline is
  synthetic-faces-only by design, not a general photo-to-avatar tool.
metadata:
  type: skill
---

# The LAM face pipeline

`magpie/splatweb`'s "LAM avatars" (Pentulpa Capulet's five personas, the
`demo-lam-arch-*`/`demo-lam-jar-*`/`demo-lam-ghost`/`demo-lam-organic`
treatment demos, `demo-lam-test.html`) are riggable Gaussian-splat heads:
a shared skinned mesh (`skin.glb`) plus per-face trained splat geometry
(`offset.ply`) that a 2D face photo gets converted into via the **LAM**
model (aigc3d, SIGGRAPH 2025, Apache-2.0,
https://github.com/aigc3d/LAM). `lib/lam-splats.js` (`loadLamHead`/
`loadLamAvatar`/`LamHeadAvatar`) loads and poses the result — that file
is untouched by this pipeline; this skill is entirely about how the
*assets* get made, not how they render.

## 1. ETHICS, BEFORE ANYTHING ELSE

**Source photos must be synthetic — algorithmically generated, no real
identifiable person.** Every face currently in the roster is either a
StyleGAN2 "this person does not exist" image or a Wikimedia Commons
"synthetic face" upload — public domain because there is no human
photographic subject to hold rights over it (the same "PD-algorithm"
reasoning Wikimedia Commons itself applies).

This is why `third_party/lam-sample-messi/` exists untracked and stays
that way — CLAUDE.md's standing instruction is *never commit or push
it*. A real, famous, identifiable person's face is exactly the case this
pipeline must not produce output for: it would carry real personality/
publicity-rights exposure that a synthetic face never does, however good
the source-photo test render looked. Treat `lam-sample-messi/`'s presence
as a live reminder, not a solved problem — if you find yourself about to
run a real person's photo through `tools/lam-generate.py` for anything
other than a private, never-committed test, stop and ask the owner.

**Curation, separately from identity:** `lib/lam-face-roster.js`'s
`EXCLUDED_TPDNE` set drops faces the owner judged too visibly
2020s-styled (glasses, ballcaps read as "photographed now", not
timeless) from a **spot-check of a contact sheet**, not a re-render of
every face — treat the exclusion set as a reasonable first pass, not
exhaustive proof, if you're auditing the full 50.

## 2. Where the source photos come from

Two source pools, both documented in `third_party/ATTRIBUTION.md` (that
file is the ground truth for licensing — update it in the SAME commit as
any roster addition, never after):

- **`lam-synth-faces/{boy1,man2,woman1,lightbrownhairwoman}`** — four
  individual Wikimedia Commons "synthetic face" uploads, each with a real
  `File:...jpg` source URL.
- **`lam-synth-faces-tpdne/tpdne-01..50`** — fifty StyleGAN2 faces from
  the HuggingFace dataset `javi22/this-person-does-not-exist-10k` (an
  archival scrape of thispersondoesnotexist.com, MIT-licensed dataset
  compilation over PD-algorithm source images).

**Not preserved anywhere in this repo:** the exact tooling used to pull
specific rows out of that HF dataset and build the curated final-50
selection (`tpdne-final/` in a past session's scratchpad — ephemeral,
already gone by the time this skill was written). If you're repeating
this, `datasets.load_dataset('javi22/this-person-does-not-exist-10k')`
or the HF Hub's own row-browser is the starting point; save whatever
selection script you write into `tools/` this time so it isn't lost
again — that gap is exactly what prompted writing this skill.

## 3. Converting a photo to a LAM avatar

`tools/lam-generate.py` — generalized from the two one-off scripts that
actually produced this project's roster (verified: 50/50 succeeded in a
real batch run, ~27-30s per face, ~25 minutes total). Needs a
**self-hosted LAM HuggingFace Space** (this project uses
`danbri/LAM-export`, not a public shared one — LAM's own repo has setup
instructions for standing one up) and an HF token:

    pip install gradio_client
    huggingface-cli login                       # writes ~/.cache/huggingface/token
    python3 tools/lam-generate.py \
      --images path/to/curated-photos \          # one .jpg per avatar, named by the id you want
      --out    path/to/output

Per photo this calls the Space's `/prepare_working_dir` then `/core_fn`
with the image plus ONE shared "motion driver" video (fetched once via
`/load_example_1`, index 6 — that index is undocumented outside this
Space's own UI, verify by eye if you change it). The motion only drives
the Space's preview video; the actual identity/geometry that ends up in
`offset.ply` is unaffected by which motion driver you pass. The script is
resumable (`batch_results.json` in `--out`, skips names already marked
`ok` on a re-run) — worth knowing before restarting a 50-face batch from
scratch after a network blip.

## 4. Placing the output

- **A face with its own distinct geometry AND you're fine paying ~3.6MB
  per avatar**: copy both `offset.ply` and a `skin.glb` (the Space's
  `/core_fn` doesn't return one — LAM's mesh is templated per
  identity-class, not per photo; see `lam-synth-faces/*/skin.glb`, each
  ~3.6MB) into `third_party/lam-synth-faces/<id>/`.
- **Adding to a large batch (the TPDNE-50 pattern)**: copy ONLY
  `offset.ply` into `third_party/lam-synth-faces-tpdne/<id>/` and share
  the ONE existing `lam-sample/skin.glb` via `loadLamAvatar`'s
  `meshBase` option — added specifically so 50 faces don't each
  duplicate a 3.6MB mesh (see `lib/lam-face-roster.js`'s own header
  comment). Confirm the new face's mesh topology actually matches
  `lam-sample`'s template before doing this — if the Space gives it a
  visibly different mesh, it needs its own `skin.glb` instead.

## 5. Wiring it into the roster

`lib/lam-face-roster.js` — add the new id to `FACES` and, if it needs
one, a branch in `resolveFace()` returning `{base, meshBase}` (see the
existing three shapes: `lam-sample/` self-contained, `lam-synth-faces/
<id>/` self-contained, `lam-synth-faces-tpdne/<id>/` sharing
`lam-sample`'s mesh). Every `demo-lam-*` treatment demo and Pentulpa's
`resolveFace(PERSONAS[i].faceId)` call pick up a new id automatically —
no other file needs touching for the id to become choosable.

## 6. Attribution — same commit, not a follow-up

`third_party/ATTRIBUTION.md` has a working template row for both source
shapes (Wikimedia individual photo, HF dataset batch) — copy the pattern
for the new id(s): source photo licence/URL, "avatar: aigc3d LAM model,
Apache-2.0" for the conversion itself. `catalogue.html` does NOT parse
that file — it only links to it in a couple of hardcoded spots — so
don't assume adding a row there is visible anywhere else automatically.
