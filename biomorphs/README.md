# Biomorphs (WebAssembly)

Browser demo of Richard Dawkins' biomorph concept from *The Blind Watchmaker*
(1986): a recursive, bilaterally-symmetric line-drawing parameterised by a
small integer "genome", driven from JavaScript via a freestanding wasm32
module.

## Layout

```
biomorphs/
├── index.html                       # demo page (breeder UI)
├── build.sh                         # clang --target=wasm32 build script
├── src/
│   └── biomorph.c                   # clean-room C implementation
├── dist/
│   └── biomorph.wasm                # built artefact (committed for GitHub Pages)
└── third_party/
    └── monochrome_pascal/           # original Dawkins Pascal source (reference)
        ├── NOTICE.md                # attribution + provenance
        ├── Blind_Watchmaker.p
        ├── Biomorphs
        ├── Main
        ├── ...
        └── User Interface
```

## Running locally

The demo is a static page that needs to be served over HTTP (browsers refuse
to `fetch()` `.wasm` from `file://`):

```bash
# from the repository root
python3 -m http.server 8080
# then open
#   http://localhost:8080/biomorphs/index.html
```

## Rebuilding the WASM

Requires `clang` with the `wasm32` target and `wasm-ld` (both ship with recent
LLVM/Ubuntu). No emscripten / no libc needed.

```bash
./biomorphs/build.sh
```

The resulting `dist/biomorph.wasm` is ~1 KB and exports:

| Export          | Signature                  | Purpose                          |
|-----------------|----------------------------|----------------------------------|
| `fb_width`      | `() -> i32`                | framebuffer width  (256)         |
| `fb_height`     | `() -> i32`                | framebuffer height (256)         |
| `num_genes`     | `() -> i32`                | gene count (9)                   |
| `framebuffer`   | `() -> i32 (ptr u8[W*H])`  | pointer to mono framebuffer      |
| `genes`         | `() -> i32 (ptr i32[9])`   | pointer to gene array            |
| `get_gene` / `set_gene` | `(i32, ...)`       | clamped accessors                |
| `mutate`        | `(idx, delta)`             | `genes[idx] += delta` (clamped)  |
| `reset_genes`   | `()`                       | restore default genome           |
| `render`        | `()`                       | redraw biomorph into framebuffer |

The framebuffer is 256×256 with 1 byte per pixel (`0` = background, `255` =
ink); JS expands this to RGBA when blitting onto a canvas.

## Algorithm

The C implementation is a clean-room build of the publicly-documented biomorph
concept and does **not** translate the Pascal source. Eight integer "shape"
genes perturb branch deltas at successive recursion levels; the ninth gene is
the recursion depth (clamped 1–8). Each `tree()` call draws one segment and
recurses with both `+gene` and `-gene` deltas, which yields the characteristic
left-right symmetry.

## Original Pascal

`third_party/monochrome_pascal/` contains the original 1980s Pascal source,
copied verbatim from the public WatchmakerSuite archive on GitHub. See
`third_party/monochrome_pascal/NOTICE.md` for source URL and authorship. Those
files are reference material only — they are not consumed by the build or the
runtime.
