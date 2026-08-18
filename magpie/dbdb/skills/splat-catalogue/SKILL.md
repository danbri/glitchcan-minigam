---
name: splat-catalogue
description: >-
  The asset store behind magpie/dbdb and the tools that fill it: what
  pack.json / subjects.json / sources.json each own, the split between
  HAND-WRITTEN judgement and DERIVED measurement, appearance tags (palette,
  tone, form, mass), near-duplicate detection by perceptual hash, the
  browsable catalogue page and the test that keeps it honest, and how the
  pictures get rendered fast on a machine with no GPU. Use this when adding
  or describing an element, regenerating thumbnails or turnaround sheets,
  triaging harvested scans, wondering whether two elements are the same
  thing, changing catalog.html, or when a render pipeline is slower than it
  should be. Read the RENDERING section before adding any wait to a headless
  render, and the HAND-WRITTEN VS DERIVED rule before writing anything into
  subjects.json.
---

# The splat asset store, and the tools that fill it

Finding and cutting elements is the **splat-discovery** skill; how an element
LOOKS at runtime is **splat-style**. This one is about the store itself: the
records, the tags, the pictures, and the page that shows them.

Every number here was measured in this repo. Where something was believed
backwards first, that is said, because the wrong version is the one that comes
back.

## 1. WHO OWNS WHAT

| file | holds | written by |
|---|---|---|
| `splats/pack/pack.json` | the one truth: id, file, scene, dims, count, credit, licence, subject, appearance | tools, merging the rest |
| `splats/subjects.json` | **what each element IS** — never what it is for | a person, by hand |
| `splats/sources.json` | provenance per source scan, `verified` flags, the catalogue table | a person, by hand |
| `splats/pack/thumbs/*.webp` | one render per element, 800×800 | `element-sheet.mjs` |
| `splats/wanted*.json` | what a story needs, and shopping lists for a signed-in human | a person |
| `catalog.html` | the browsable store; reads pack.json, no second copy | — |

**The store never says what an element is FOR.** A hedge is a hedge whether it
walls a maze, hides a body or fills a garden. Intended use lives in the game
layouts and in the want-list.

## 2. HAND-WRITTEN VS DERIVED — the rule that keeps the store trustworthy

- `subjects.json` is **human judgement**: `what`, `kind`, `condition`,
  `materials`, `standing`, `enclosing`, `note`. **No tool may write it.**
- `appearance` in pack.json is **derived measurement** and is rewritable at
  any time by `appearance.mjs`.
- A tool that blurs the two turns a catalogue into a guess with a confident
  face. Keep them apart, and label the derived block as derived — `pack.json`
  carries an `appearanceNote` saying exactly that.

## 3. APPEARANCE TAGS  (`npm run splat:looks`, `--write` to store)

Measured from the thumbnail — a real render on a known backdrop — plus the
dims already in pack.json:

    palette  grey | brown | green | red | orange | blue | violet | cyan
    tone     dark | mid | bright
    form     tall | upright | squat | flat      (H against max(W,D))
    mass     sparse | medium | dense            (gaussians per m³)
    cover    share of the frame the silhouette fills
    hash     64-bit dHash of the render

Facets in `catalog.html` are built from the DATA, never a hand-kept list: a new
`kind` or `palette` appears without editing the page.

**Calibration worth keeping.** Foliage renders at hue ≈1.5–2.5 of 6 —
yellow-green, not pure green — so a naive twelve-bucket naming calls a fern
"yellow". True of the pixels, wrong to a person. Green therefore starts at the
yellow-green bucket. Grey is `sat < 0.12`; brown is a warm hue below 0.46
lightness.

**Lit means above the backdrop.** The charcoal ground's brightest pixel is
27+34+40, so any test for "is there anything here" must sit above ~125 summed.
A threshold of 48 passes on empty backdrop alone — that bug made an empty view
score 62% "lit" in the catalogue test.

## 4. NEAR-DUPLICATES — reported, never removed

Two tests, and a pair must fail **both**: dHash distance ≤ 12 **and** box match
> 0.82. Either alone is noisy, because two things shot from the same bearing
share a lot of pixels.

What it found on the 34-element store: `hedge`/`hedge2`/`hedge3` and
`fern`/`fern2`/`fern3` — one cut at three densities each, deliberate — and
`grass ~ trail`, distance 5, identical box: two floor bands off the same forest
scan that nobody had noticed.

**A pair is a question, not a verdict.** Only a person can tell a deliberate
variant from an accident, and **NEVER DELETE USER FILES WITHOUT PERMISSION**
applies here in full.

## 5. RENDERING — read this before adding a wait

**This container has no GPU.** No `/dev/dri`, nothing matching vga/3d/display
on the PCI bus, and Chromium reports `ANGLE (Google, Vulkan 1.3.0 (SwiftShader
Device (Subzero)), SwiftShader driver)`. Four cores. So rendering is the slow
step, and most of the cost was self-inflicted:

| what | was | is | evidence |
|---|---|---|---|
| wait after moving the camera | 3200 ms | **600 ms** | output byte-identical for `pickup`, `fern`, and the 120k-gaussian `shed` |
| silhouette probe | full DPR-3 PNG, 1.4M px loop | `scale:'css'` JPEG | a ninth of the pixels and a ninth of the loop |
| concurrency | 1 page | `--jobs 3` | four cores |
| **34 thumbnails** | ~40 s each | **115 s total, 3.4 s each** | same pictures |

**The clever version was worse.** An `--wait auto` mode polls until two frames
are identical. It first declared convergence on frames the renderer had not
redrawn yet — two identical polls can mean nothing happened. Tightened to
demand three identical polls after two observed changes, it then waited 10–15 s
per element for pixel noise that never reaches the encoded image: slower than
the fixed wait, for the same bytes. It is kept, it is not the default.

On a machine with a real GPU nothing changes — these are plain Playwright. Run
`npm run splat:thumbs` there and it is faster again.

## 6. THE PICTURES

**Framing is computed, then measured and corrected** (`element-sheet.mjs`):

- Place the camera from the box projected onto the camera's right and up axes,
  **not** from its bounding sphere. A sphere fit marooned every wide flat
  element in black.
- Then render once, measure the silhouette that actually appears, correct the
  distance, and only then shoot. `dims` is the *cut* box — padded, and not
  always ordered the way you assume. `hut` filled 59% of its frame before this.
  **Most of what reads as "low resolution" in a thumbnail is empty frame.**
- One distance serves every bearing, so sizes stay comparable across a sheet.
- **Supersample**: render at `--dpr 3`, compose down to 2×. Splats have no MSAA.
- **WebP, not JPEG**, and not on pure black: JPEG blocking is very visible on a
  dark noisy scan, and dark timber on `#000` has no ground to sit against. The
  charcoal radial backdrop needs `graphicsDeviceOptions: { alpha: true }` — the
  canvas otherwise clears opaque and the backdrop never shows.
- A single game screenshot is a picture of a game, not of an object. Catalogue
  from turnarounds.

**Triage sheets for raw scans** (`scan-contact.mjs`) have three more:

- **Flip.** Every scan met so far is y-down (`up:[0,-1,0]` in every SRC entry).
  Rendered the other way up you are looking at the underside of the ground, and
  a known-good scene comes back as mush.
- **Percentile framing.** The engine's aabb spans the floater halo, not the
  subject: `bouquet`'s box is 191 m for a vase of flowers, so fitting it renders
  a dot. Frame on a 6th–94th percentile box of the centres.
- **Floater cull** — the verified work-buffer modifier from **splat-style**.
  Culling under alpha 0.5 is what made `carshop` and `watertower` legible.

**Point any new viewer at a scan you already trust before you trust it on a new
one.** A hand-rolled viewer that guessed the up-axis once rendered known-good
scans as mush and nearly condemned six good ones.

## 7. THE CATALOGUE PAGE AND ITS TEST

`catalog.html` reads the same `pack.json` the game reads, so the two cannot
drift. `npm run test:catalog` asserts every element carded, every thumbnail
decoded, every credit shown, the facets narrowing, and the live view putting
lit pixels on screen. Two traps it encodes:

- **Count pixels from a Playwright screenshot, never from `drawImage` on the
  WebGL canvas** — blank without `preserveDrawingBuffer`, so the check reports
  "nothing rendered" about a picture plainly there.
- **The jsdelivr failure is expected.** CDN-first-then-vendored is the house
  pattern and this container cannot reach the CDN; filter that one request, not
  console errors in general.

## 8. HARVESTING SOURCE SCANS  (`npm run splat:harvest`)

- Take **only** what declares an open licence. Of 78 Hugging Face repos holding
  splat files, 62 declare nothing and are skipped, 4 are gated, 13 are usable —
  137 files.
- Record the tag as the **uploader's claim**, with the repo named, and start
  every entry `verified:false`, `looked:false`.
- **Ask the size before downloading**: one repo holds a 265 MB LiDAR dump that
  cost ten minutes and produced nothing usable.
- Put research dumps (nuscenes, vkitti, SLAM sequences) last.
- Harvested scans stay **out of git** — 2 MB each and unjudged. The manifest is
  committed and re-fetches them. A scan earns a place in the repo when an
  element is cut from it.
- Two gates that only a person can apply, and both have already come up:
  **recognisable brands or characters** (a CC licence on a capture does not
  license what was captured) and **memorials** (real memorials to real people
  are not game material, in the spirit of the Bristol tree rule).

## 9. COMMANDS

    npm run splat:harvest -- --survey     # what is reachable, by licence
    npm run splat:contact                 # triage sheets for harvested scans
    npm run splat:objects <scene>         # candidate boxes in a scan (--json)
    npm run splat:sheet -- <id> --angles 9   # turnaround for one element
    npm run splat:thumbs                  # all thumbnails (3.4s each)
    npm run splat:looks -- --write        # appearance tags + duplicate report
    npm run splat:index -- --fix          # merge subjects + licences into pack
    npm run pack:lod                      # LOD pyramids
    npm run test:catalog                  # the page, against the pack

## 10. WHERE LESSONS LIVE

**Here, not in the code.** Owner instruction, August 2026: lessons belong in
skills with frontmatter, so they are discoverable and editable in one place.
Tool headers stay short — what the tool does, how to run it, and a pointer to
this file. If you learn something while fixing a tool, add it to the relevant
section above rather than growing an essay in a comment.
