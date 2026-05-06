# Biomorphs

Browser port of Richard Dawkins' Monochrome WatchMaker biomorph drawing
algorithm (*The Blind Watchmaker*, 1986; v1.1 Pascal source 1993). Pure
JavaScript, no build step.

## Layout

```
biomorphs/
├── index.html                       # demo page (3x3 breeder UI)
├── biomorph.js                      # ES module — faithful JS port
└── third_party/
    └── monochrome_pascal/           # original Dawkins Pascal source (reference)
        ├── NOTICE.md                # attribution + provenance
        ├── Blind_Watchmaker.p
        ├── Biomorphs                # core Develop/Tree/PlugIn procedures
        ├── Globals                  # type definitions (chromosome, person)
        ├── Main / Initialize / ...
        └── User Interface
```

## Running locally

`index.html` and `biomorph.js` are both static; serve them over HTTP from any
working directory:

```bash
# from the repo root
python3 -m http.server 8080
# then open
#   http://localhost:8080/biomorphs/
```

Once deployed on GitHub Pages, the live demo will be at
`https://danbri.github.io/glitchcan-minigam/biomorphs/`.

## Algorithm fidelity

The JS port preserves the v1.1 Pascal genome structure end to end:

| Pascal field         | JS field                | Notes                              |
|----------------------|-------------------------|------------------------------------|
| `gene[1..9]`         | `classic[0..8]`         | gene 9 (`classic[8]`) = order/depth, capped at 12 |
| `dgene[1..10]`       | `dev[0..9]`             | each one of `swell` / `same` / `shrink` |
| `SegNoGene`          | `segCount`              | number of stacked segments         |
| `SegDistGene`        | `segDist`               | inter-segment vertical drop        |
| `CompletenessGene`   | `completeness`          | `single` / `double`                |
| `SpokesGene`         | `spokes`                | `northOnly` / `nsouth` / `radial`  |
| `tricklegene`        | `trickle`               | divisor on every step              |
| `mutsizegene`        | `mutSize`               | per-mutation step size             |
| `mutprobgene`        | `mutProb`               | mutation probability (currently informational) |

The recursive tree procedure follows the Pascal version exactly: 8 compass
directions, mirror entries (indices 0/1/7) populated from the same genes that
feed indices 4/3/5, recursion with `dir±1`, `oddOne`-driven alternation,
`lgth < order` lateral cap, and `dgene[9]`-driven thickness. Between segments
the running chromosome is mutated by the dgenes (`swell` adds `trickle`,
`shrink` subtracts `trickle`), and the inter-segment gap is grown by
`dgene[10]`. Spokes are implemented by replaying the figure rotated about the
seed point (`nsouth` = 2 copies, `radial` = 8 copies).

## Module API

```js
import {
    defaultGenome, cloneGenome,
    develop, renderInto,
    mutateGene, MUT_TYPE,
    COMPLETENESS, SPOKES, SWELL, SAME, SHRINK,
} from './biomorph.js';

const g = defaultGenome();
const ctx = canvas.getContext('2d');
const bbox = renderInto(g, ctx, canvas.width / 2, canvas.height / 2);
// bbox = { left, top, right, bottom } — useful for fit-to-cell scaling

const child = mutateGene(g, MUT_TYPE.CLASSIC_GENE, /*idx=*/0, /*sign=*/+1);
```

`develop(genome, ctx, cx, cy, opts?)` does a single rendering pass.
`renderInto(...)` is the high-level entry point which also handles
`spokes` rotation. `mutateGene(genome, type, idx?, sign?)` returns a new
mutated genome without modifying the original.

`MUT_TYPE` mirrors the original Mutations menu: `CLASSIC_GENE`, `ORDER`,
`DEV_GENE`, `SEG_COUNT`, `SEG_DIST`, `COMPLETENESS`, `SPOKES`, `TRICKLE`,
`HOPEFUL_MONSTER`.

## Original Pascal

`third_party/monochrome_pascal/` contains the original 1980s/1990s Pascal
source, copied verbatim from the public WatchmakerSuite archive on GitHub.
See `third_party/monochrome_pascal/NOTICE.md` for source URL, fetch date and
authorship. Those files are reference material — they are not consumed by the
runtime, but the JS port is intentionally a behaviour-faithful translation of
the `Develop` / `Tree` / `PlugIn` procedures in the `Biomorphs` unit.
