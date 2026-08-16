---
name: splat-discovery
description: >-
  Find, licence-check, crop and ship Gaussian-splat content for magpie/dbdb —
  the clone-stamp pack behind splatpack.html, dream.html and the Skydock dream
  worlds. Covers the whole chain: searching the superspl.at catalogue and
  PROVING each scene's licence, converting a source scene to a work splat,
  cutting reusable elements with oriented boxes (splatpack.mjs clip), finding
  those boxes automatically (object-scout.mjs), building the four-level LOD
  pyramids that PlayCanvas needs before its splat budget does anything
  (pack-lod.mjs), and registering elements in pack.json + the layouts. Use this
  when adding or re-cutting a pack element, hunting new source scans, debugging
  an empty or wrong-looking clip, regenerating the LOD pack, describing an
  element in the use-neutral asset store, or reasoning about splat cost on weak
  hardware. READ THE LICENCE SECTION FIRST — every scene in
  this pack is Creative Commons and carries a required attribution, and the
  catalogue mixes CC BY with NC/ND and with no-licence-at-all.
---

# Splat discovery and the clone-stamp pack

`magpie/dbdb/splats/pack/` is a library of **elements** — a hedge, a fern, a
rusted truck, a falling-down shop — each cut out of a real Gaussian-splat scan
and canonicalised so a scene can be built by STAMPING: translate, yaw, scale,
no per-element fixup. `splatpack.html` composes them into the maze, the swamp
and the yard; `dream.html` flies the whole source scans.

Everything below was learned the hard way. Where a claim has evidence, the
evidence is quoted, because several of these were believed backwards first.

## 1. LICENCE, BEFORE ANYTHING ELSE

**Every source scan in this pack is CC BY 4.0 and the attribution ships.**
`pack.json` carries a `credit` string per element, inherited from the scene;
`splatpack.html` joins them into `CREDITS`, and the dream terminals render the
scene credit in-world. A clip with no credit is not finished.

Rules, not preferences:

- **Only take a licence the scene page itself declares** (`rel="license"`).
  The gallery mixes licences freely and most scenes declare none.
  `splat-scout.mjs` reads that link per page and reports `UNKNOWN` when absent.
  "Probably fine" is not a licence.
- **CC BY only for this pack.** `ND` forbids derivatives and a crop is
  emphatically a derivative. `NC` is a live risk for a published game. The
  scout prints those separately; do not promote them without the owner saying so.
- **Do not go around access control.** superspl.at's *download* endpoint mints
  signed URLs behind `Authorization: Bearer` — an account feature. The viewer's
  own data path is public and is how the existing scenes were obtained, but if
  the route in front of you is the authenticated one, stop and say so.

The catalogue is not the web page: superspl.at is a front end for
**`https://playcanvas.com/api`**, and `splats/explore?limit=100&search=…` is
public and returns everything — including the two fields that decide this:

    downloads.enabled   the author's own switch. false is an answer.
    downloads.license   the licence they attached to that offer.

    npm run splat:sources jungle "abandoned car" ruins tractor
    npm run splat:wanted            # every need in splats/wanted.json
    # Aug 2026 sweep: 800 scenes seen, 83 usable, 34 nc/nd, 654 not offered.

**You cannot download them, and should not try.** The file endpoint answers
`401 Unauthorized` to everyone without a PlayCanvas account — measured on GET
and POST, for `sog`, `compressed-ply` and `ply`, *including for scenes whose
authors switched downloads on*. A signed-in human fetches the file, drops it in
`splats/incoming/` (git-ignored — the originals are other people's work; the
repo keeps the derived clips and the credit), and:

    npm run splat:ingest <hash> <name>

which re-reads the licence off the scene page, refuses anything not
`by`/`by-sa`/`cc0`, thins the scan to a working weight, and prints the `SRC`
and `SCENES` entries for a person to paste — the up-axis and the name are
judgements, so it stops there.

**Field note (Aug 2026):** headless Chromium in this container cannot reach
superspl.at (`ERR_CONNECTION_RESET`, with or without the proxy) while `curl`
can. Scouting is therefore plain HTTP; anything needing the live viewer needs a
human or a different machine.

## 1a. SUPERSPL.AT IS NOT THE ONLY REPOSITORY

It is the one with the account gate. **Hugging Face has none**: a public repo
serves its files to anyone, declares a licence as a tag, and

    npm run splat:sources -- --source hf splat 3dgs "gaussian splatting"
    npm run splat:ingest hf:<owner>/<repo>/<file>.splat <name> --keep 170000

really does fetch. Aug 2026: 78 repos holding splat files, **13 declaring an
open licence** — `aleatorydialogue/trained_splats` (apache-2.0, 59 scans:
cabin, shed, bridge, stones, market, stairs, lighthouse, winery, marsh, ford),
`trent-spivey/splat-data` (mit), `keijiro-tk/splat-data` (unlicense — already
the ChristmasTree source).

**The catch is a different one and it matters.** On superspl.at the author
scanned the thing, so the licence is theirs to give. On Hugging Face the
uploader may be redistributing somebody else's dataset under a tag they picked
— several of these are recognisably the Tanks-and-Temples research scenes.
Treat an HF licence as a CLAIM. Prefer repos where the uploader is plausibly
the maker, and record the repo in the credit so the claim is traceable.

Others exist and are unexplored: Sketchfab's API answers (`downloadable=true`
filters by licence), Polycam and Scaniverse have public galleries, and the
academic 3DGS datasets are downloadable but usually research-only — read that
licence before assuming.

**A SOURCE IS NOT VERIFIED UNTIL SOMEONE HAS SEEN IT — AND USE PLAYCANVAS'S
OWN VIEWER TO SEE IT.** `splat-transform` emits a self-contained HTML viewer
from any scan. It is in its `--help`. It handles the up-axis and the framing,
which are exactly the things a hand-rolled viewer gets wrong.

    npm run splat:view -- magpie/dbdb/splats/cabin.sog splats/view/cabin.html
    # or free with every ingest: splats/view/<name>.html

I wrote my own instead — guessed the axis, framed from percentile bounds — and
it rendered the **known-good carshop** as coloured mush. I nearly filed six
sound scans as bad on that evidence. The official viewer put the same carshop
on screen as two old trucks on gravel, and then showed the truth about the
others: `cabin` is a real cabin interior at Christmas, `stones` is painted
pebbles on a garden step, `market` is smeared, `bridge` is doubtful.

**The rule: never judge a scan through a viewer you have not first pointed at
a scene you already trust.** `splats/sources.json` records, per scan, whether
anyone has looked and what they saw.

## 1b. THE STORE HAS NO PRECONCEPTIONS ABOUT USE

**`pack.json` says what a thing IS. It never says what it is for.**

An element named for its use is one nobody reaches for twice: a hedge cut as
"maze wall" does not get planted in a garden, and a shack filed under "swamp
decor" never becomes a mine head. Three separable things, three homes:

| what | where | who writes it |
|---|---|---|
| measured facts — counts, dims, the cut box, which side the scanner saw | `pack.json`, from the clipper | tools |
| **subject** — "flatbed pickup truck, rusted through, still on its wheels" | `splats/subjects.json` | a person; a machine guessing this would be inventing |
| licence — author, work, terms, source | `pack.json`, parsed from the credit | tools |
| **intended use** | `splatpack.html` layouts, `decor:1`, and `splats/wanted.json` | a person |

    npm run splat:index          # check
    node magpie/dbdb/tools/asset-index.mjs --fix   # merge subjects + licences

It FAILS on a use-word in a description. Note what is NOT a use-word: **wall**.
A wall is an object — a glasshouse wall panel is a real thing with a real
thickness, and the first version of that list rejected it, which was the list
being wrong rather than the description. The test is whether the word names a
role in a game: "tile", "decor", "prop", "spawn" do; "wall", "path", "roof"
do not.

`splats/wanted.json` is the other side of the same rule — it records what the
STORIES need (Hampstead's street, Riverbend's mill, Bag End's round door, the
gem mines) as subjects to look for, so the wanting never leaks into the store.
`splats/candidates.json` is the sweep's answer, with thumbnails, for eyes.

## 2. THE CHAIN

    source scan (.sog/.ply/.splat, in splats/)
      └─ splatpack.mjs  ensureWorkSplat  → tools/pack-work/<scene>.splat
          └─ splatpack.mjs clip          → splats/pack/<id>.compressed.ply
              │                            + pack.json entry (with credit)
              └─ pack-lod.mjs            → splats/pack/lod/<id>/lod-meta.json
                  └─ layout entry in splatpack.html  → visible in the game

Source scenes are declared in the `SRC` table at the top of `splatpack.mjs`
(src path, scan up-axis, credit) — **mirrored from `dream.html`'s registry**.
Keep them in sync when adding a scene.

## 3. FINDING BOXES: object-scout

Picking clip boxes used to mean flying around a scan guessing coordinates.

    npm run splat:objects carshop
    npm run splat:objects watertower --voxel 0.3 --band 0.9 --min 120

It voxelises the scan, removes the ground, runs connected components and prints
a ready-to-paste `clip` line per lump. **It shortlists; eyes decide** — the
ABCD doctrine. In the Aug 2026 pass, 4 of 12 candidates were rejected on sight
(smears, glasshouse framing, scrub) and are not in the pack.

Two settings matter, and both were got wrong first:

- `--band` (default 0.9 m) — the ground band removed per column. Everything
  stands on the floor, so too thin a band welds the whole scan together:
  carshop first returned **three** components for the entire ghost town.
- bounds are taken by **percentile (1–99%)**, not min/max. A drone scan trails
  stray splats for hundreds of metres; raw min/max on carshop asked for a
  `2339x505x2713` voxel grid, which is the sky, not the scene.

## 4. CUTTING: splatpack.mjs clip

    node magpie/dbdb/tools/splatpack.mjs clip --scene watertower --id pickup \
      --c -16.04,2.03,18.89 --yaw 0 --size 5.7,2,3.4 --trim 0.12

The box is ORIENTED (`--yaw`), then the clip canonicalises: scan-up rotated to
world +y, the facing bearing to +z, centred on x/z, base floored to y=0, ghosts
(alpha < 25) dropped. That is why stamping needs no per-element fixup.

Flags worth knowing: `--trim T` cuts below floor+T (scans drag their ground
along); `--mode floor` keeps ONLY the floor band, for ground tiles;
`--max` caps density; `--tint` makes colour variants; `--shadowlift` de-bakes
dark. `--hq` re-cuts from a full-resolution source when one is registered.

**THE BUG THAT ATE EVERY DEFAULT CLIP (fixed Aug 2026).** With `--trim 0` —
the default — the trim block read `kept2 = keep`, aliasing one array, and the
next line `keep.length = 0` emptied both. The copy loop then had nothing to
copy and the clip wrote a **zero-byte** `.splat`; splat-transform then said
`Invalid .splat file: file is empty`. Only trimmed and floor-mode clips ever
worked, which is why almost every older element carries a trim and why nobody
noticed. The fix is `kept2 = keep.slice()`. If a clip ever reports success but
produces an empty file again, look here first.

Sanity numbers from real elements: `pickup` 9,563 gaussians, `shed` 119,915,
`ruin` 877. Below ~1,500 a clip usually reads as a smear on screen — look
before keeping it.

## 5. LOOKING AT WHAT YOU CUT

Never keep a clip you have not seen.

    // in splatpack.html's headless hook
    window.__pack.only('pickup')      // one element, alone, centred

Screenshot that. `side-scout.mjs` turntables an element to find its photogenic
side and writes the verdict into `pack.json` as `sides`, so compositions can
point the unscanned smear at a wall.

## 6. LOD: WITHOUT IT, PLAYCANVAS'S WHOLE BUDGET SYSTEM IS INERT

This is the single most consequential fact in this file.

PlayCanvas 2.21 renders unified gsplats and ships a scene-level budget/LOD
system: `app.scene.gsplat.splatBudget` caps the splats DRAWN and the engine
spends that budget through LOD. **It is driven by `octree.lodLevels`, and a
`.compressed.ply` has no octree.** Measured in a nine-stamp scene:

    .compressed.ply   budget ignored — 7.53M drawn against a 1.6M cap
    lod-meta.json     budget 120k -> 135k drawn (honoured)

So the pack ships LOD pyramids:

    npm run pack:lod              # all elements
    npm run pack:lod shed tower   # named elements

Four levels — full, half, quarter, eighth. Three was not enough: the coarsest
level is a floor the budget cannot go under, and with three levels the bottom
three quality rungs all landed within 15% of each other.

Effect at a Retina laptop's geometry, the maze, reading the ENGINE's own
`app.stats.frame.gsplats` and its `gsplat:sorted` worker time:

    before (ply)   q0 7.53M drawn · 95ms sort
    after  (LOD)   q0 3.37M drawn · 47ms sort     ← no quality turned down
                   q4 0.80M drawn

**Second bug (fixed):** `pack-lod.mjs` used to REPLACE the manifest's LOD id
list with whatever it had just built, so rebuilding a few elements by name
silently dropped the rest back to flat plys and turned the budget off for most
of the pack. It now reads the list from disk, which self-corrects on deletion.
After any partial rebuild, check:

    node -e "const p=require('./magpie/dbdb/splats/pack/pack.json');
      console.log(p.elements.map(e=>e.id).filter(i=>!p.lod.ids.includes(i)))"

## 7. COST, AND HOW TO MEASURE IT HONESTLY

This container renders through SwiftShader — **a CPU pretending to be a GPU**.
Its frame rates are worthless and have misled this project before. Measure the
facts about the work instead: splats drawn, sort time, pixels.

    npm run test:quality        # the ladder, at a Retina laptop's geometry

Traps found while building that harness, all of which produced confident wrong
numbers first:

- **`splatBudget` is a TARGET, not only a ceiling.** The engine spends UP to
  it. A fixed 2.5M "budget" pushed the swamp from 1.14M to 2.49M — a quality
  rung that made the picture heavier. Rungs are now a fraction of what rung 0
  actually draws on that scene, on that machine.
- That yardstick must **settle, not take a maximum** — a running max latched
  onto a load-time spike, and 0.18 of a wrong big number is a budget above what
  the scene would draw anyway.
- **Clamp slow frames, do not discard them.** A `wdt < 0.5` guard threw away
  nearly every frame on a machine slow enough to need the governor: thirty
  seconds of wall clock advanced the warm-up timer by 1.4 s.
- **Freeze the camera before comparing rungs** (`__pack.freezeCam()`) — LOD is
  chosen by distance and the idle orbit makes two readings incomparable.
- The LOD system converges over ~100 ticks: a couple of seconds on a real GPU,
  over a minute here.
- Judge a rung on **splats × pixels**. The bottom rungs land on the same splat
  count at the LOD floor; what they still buy there is resolution.

## 8. REGISTERING AND PLACING

`clip` writes the `pack.json` entry itself (id, file, scene, box, count, dims,
credit). To make an element visible, add it to a layout in `splatpack.html`
(`LAYOUTS.yard`, `jungleLayout()`, `mazeLayout()`); mark scenery `decor:1` so
the quality governor may thin it. An element in the pack but in no layout is
only reachable through the catalogue.

## 9. THE CORPUS (Aug 2026)

26 elements from four scenes, all CC BY 4.0:

- **carshop** — Nelson Ghost Town Car Shop · Paolo Tosolini: `pump`,
  `rustcar`, `windowwall`, `shed`
- **watertower** — Nelson Ghost Town Water Tower · Paolo Tosolini: `cistern`,
  `redtruck`, `trestle`, `tower`, `pickup`, `chassis`, `hut`, `ruin`
- **garden** — Botanical Garden Victoria House · Simon Bethke: the fern /
  hedge / plantbed / palmfan / pond family, `vine`, `canopy`
- **forest** — Forest path · Pavel Tanhäuser: `grass`, `trail`

Unmined and available: `museum`, `pool`, `calico`, `tree` (the last has an HQ
source registered). `calico` scouted as mostly rock shelves — desert, not ruin.
