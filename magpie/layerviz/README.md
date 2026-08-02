# LayerViz WebGPU

The WebGPU build of LayerViz. The core library and the graph data live at
`../../layerviz/` — this folder holds only the WebGPU backend and its page.
One core, two backends; do not copy the core here.

## Files

- `index.html` — boots WebGPU first. If the browser has no WebGPU adapter,
  or device setup fails, it falls back to the three.js/WebGL adapter at
  `../../layerviz/layerviz-three.js`. A badge in the info panel shows the
  active backend.
- `layerviz-webgpu.js` — the WebGPU RendererAdapter. Raw WGSL, no
  framework, no CDN. It implements the same contract as the three.js
  adapter, so `layerviz.js` is unchanged.

## What the WebGPU adapter does differently

- **Instancing.** All node spheres are one draw call; likewise the frame
  rails (boxes), the shared-entity links (cylinders), the layer planes,
  and all graph edges (one line-list draw). Six draw calls per frame.
- **One uniform write per frame** (view-projection, camera, light, fog).
  The animation updates touch only two small instance buffers: node
  bob/highlight and link pulse.
- **CPU picking and projection.** Hover picking is a ray-sphere test on
  the model; label placement is a matrix transform. No GPU readback.
- **Surface quality.** devicePixelRatio-aware canvas (capped at 2) with
  4x MSAA and a premultiplied-alpha surface over the page gradient.
- **Not carried over:** shadow maps. The three.js adapter's soft shadows
  are a large cost for a small effect at this scene scale; the WebGPU
  path uses direct + ambient light only.

## Verification status (headless, 2026-08-02)

- **WebGL fallback: fully verified** — renders correctly, screenshot
  checked, hover/labels/legend work, no console errors.
- **WebGPU path: API-verified only.** With
  `--enable-unsafe-webgpu --enable-features=Vulkan
  --use-webgpu-adapter=swiftshader` the headless Chromium DOES take the
  WebGPU path (badge shows it): device init, WGSL compilation, pipeline
  creation, and repeated frame submission all succeed with zero
  validation errors, and picking/labels/tooltip work. But the surface
  never presents pixels headless — screenshots are blank, `drawImage`
  readback returns zeros, and `mapAsync` fails with "A valid external
  Instance reference no longer exists" (a known headless Dawn limit).
  So per the CLAUDE.md rule, the WebGPU output is **not visually
  verified**. Check in a real WebGPU browser: the badge must say
  "backend: WebGPU" and the scene must match `../../layerviz/index.html`.

Test hooks: the page sets `window.__layerviz`; the adapter has a
`debugReadPixels()` method (renders a frame, copies a centre block of
the canvas texture to the CPU) for use on real hardware.
