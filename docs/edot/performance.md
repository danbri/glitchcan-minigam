# edot — Performance: cache, optimise, prefer WebGPU

## Framing correction (recorded so it doesn't recur)

**WebGL is not slow.** The headless CI runner renders through **SwiftShader**
(software rasterization), which is slow and non-representative; on real hardware
MapLibre/WebGL is fast. Test-suite changes that route around the headless map
init are for **CI determinism only**, never a real-performance workaround — and
nothing should describe WebGL as inherently slow.

Standing rule (unchanged): WebGPU and real-GPU rendering **cannot be verified
headless** — there is no adapter under SwiftShader, and "headless visual
verification" of WGSL silently exercises the WebGL path. So WebGPU is a
progressive enhancement with a mandatory WebGL fallback; never claim a WebGPU
render is verified from headless captures.

## Cache

- **Service Worker (`sw.js`)** now uses two strategies:
  - **Cache-first** for immutable heavy assets (`*.wasm`, `/vendor/`,
    `/third_party/`, `ink-full`, `sql-wasm`, `three.module`) — instant on repeat
    loads, no network round-trip; fetched + cached on first miss. These rarely
    change, so the round-trip was pure waste.
  - **Network-first** with cache fallback for app code + content — fresh online,
    resilient offline, navigations fall back to the app shell.
  - Bumped to `edot-v2` (old cache cleared on activate).

## Optimise

- **Image import (`js/image-util.js`)** now uses **`createImageBitmap`** with
  `{ resizeWidth, resizeHeight, resizeQuality: 'high' }` — decode happens off the
  main thread and downscaling happens *during* decode (high-quality resampling,
  no full-size intermediate), with `OffscreenCanvas`/`convertToBlob` when
  available. Falls back to `<img>`+canvas where unsupported. Used by Slides and
  Docs image import.

## Prefer WebGPU

- **`js/gpu.js`** — capability layer so rendering surfaces can *prefer* WebGPU
  when genuinely available and fall back to WebGL2/WebGL:
  - `hasWebGPU()` (presence), `webGPUAdapterAvailable()` (actually requests an
    adapter — `navigator.gpu` existing ≠ a usable adapter; cached), `hasWebGL2()`,
    `preferredBackend()`, `gpuReport()`.
  - The contract callers must honour: **await `webGPUAdapterAvailable()` and
    downgrade if false.** This mirrors Lucid's existing `backend="auto"`
    (Stinkyfish WebGPU → Mayfly WebGL).
  - edot's only heavy GPU surface today is Maps (MapLibre, WebGL); `gpu.js` is the
    foundation for WebGPU where a future surface can use it, without false claims.

## Tests

- `test-gpu.mjs` — WebGL2 present; `gpuReport` well-formed; `webGPUAdapterAvailable`
  is a consistent boolean and **false headless** (fallback contract); the optimized
  `createImageBitmap` image path decodes + downscales to the cap with aspect kept.
- The SW's runtime behavior isn't headless-testable (it isn't registered by the
  file-serving test harness); `sw.js` is syntax-checked (`node --check`).
