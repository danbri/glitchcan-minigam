# Lucid Human Visual Verification

A public, static page that closes the **headless verification gap**: automated
agents and CI run in headless Chromium, which cannot render WebGPU at all and
renders WebGL at ~2 FPS via SwiftShader — so nothing automated can actually *see*
what Lucid looks like on real hardware (this is the "Stinkyfish output visually
unverified" caveat in `stinkyfish/BUGS.md` and the interop skill).

This page makes a human the renderer's eyes.

**Live:** `https://danbri.github.io/glitchcan-minigam/lucid/verify/`
(deploys automatically with the rest of the site via GitHub Pages).

## The loop

```
human on a real GPU device
   │  visits verify/ → sees each scene in Mayfly (WebGL) AND Stinkyfish (WebGPU)
   │  answers "do they match? what differs?" per scene; captures screenshots
   ▼
pre-filled GitHub issue (label: visual-verification)
   │  human drags the downloaded PNGs into the issue, submits
   ▼
agent reads the issue (GitHub API) → gets objective env data + human verdicts
   │  parses the machine-readable JSON block, acts on real observations
```

## What the page does

1. **Probes the environment** — WebGPU availability + adapter, the WebGL
   `UNMASKED_RENDERER` string (objective GPU identity), browser, viewport, DPR.
   This alone is data headless can't produce.
2. **Interviews per scene** — a scene at a time, rendered in both backends side
   by side, with questions targeting the known GLSL↔WGSL divergences (mirror,
   radial, repeat, displace — see `../skills/lucid-renderer-interop/references/codegen-parity.md`).
   The scene/question list is data-driven in `verify-config.js`.
3. **Captures screenshots** — `renderer.render()` then `canvas.toDataURL()` per
   backend (forcing a synchronous draw so the buffer is valid). If a capture
   comes back blank it's flagged orange and the page tells you to use your
   device's own screenshot instead.
4. **Assembles a submission** — a Markdown report plus a `machine-readable` JSON
   block, a pre-filled GitHub-issue link, a copy button, and a screenshot
   download button.

No secrets, ever — it's a public page, so submission is via a pre-filled issue
URL you complete yourself, not an API token.

## For the human (danbri)

1. Open the page on the device/browser you want to test (ideally WebGPU-capable).
2. Click **Start**, walk the scenes, answer, hit **Capture** on each.
3. On the review screen: **Open pre-filled GitHub issue** → **Download
   screenshots** → drag the PNGs into the issue where each scene is marked →
   **Submit**.

## For the agent (reading it back)

Find submissions with `search_issues` for `label:visual-verification` in
`danbri/glitchcan-minigam`. Each issue body contains:

- A human-readable summary (environment + per-scene verdicts).
- A `<details>` block with a fenced ```json` payload — parse this for
  `env` (GPU/WebGPU facts) and `answers` (per-scene `match` / `discrepancies` /
  `notes`). This is the authoritative, structured signal.
- Screenshots the human dragged in (GitHub-hosted image URLs).

Treat the typed verdicts as the primary evidence — they are the observation
headless could not make. Screenshots corroborate and document.

## Extending

Add scenes or reword questions in `verify-config.js`. Bias new scenes toward
whatever backend divergence you currently distrust; keep the set short enough
that a human will actually finish it in one sitting.
