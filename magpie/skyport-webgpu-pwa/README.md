# Skyport WebGPU PWA

A dependency-free, mobile-first WebGPU prototype for a stylized coastal airport / toy-town flight scene.

## What is implemented

- Direct WebGPU renderer, no external libraries.
- Procedural WGSL shaders:
  - sky gradient with warm sun glow and dithering
  - stylized water with moving waves and specular glints
  - cloud billboards using SDF/noise-style density and silver-lining shading
  - material shader for asphalt, paint, concrete, glass/buildings, emissive runway lights
  - post-process pass with tilt-shift depth of field, light bloom, vignette, ACES-like tonemapping, dithering
- Mobile-first camera/touch controls.
- Tap-targetable animated planes.
- Dynamic resolution scaling for mobile performance.
- Offline-first PWA shell: manifest, icons, service worker cache.
- No network dependencies once installed/cached.

## Run locally

From this directory:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

For real iPhone testing, serve from HTTPS or a LAN tunnel with HTTPS. PWA service workers require a secure context except on localhost.

## Files

- `index.html` — app shell and HUD
- `app.js` — WebGPU renderer, shaders, scene generation, input, post-processing
- `manifest.webmanifest` — installable PWA metadata
- `sw.js` — offline app-shell cache
- `icons/` — app icons

## Notes

This is a compact prototype rather than a production engine. The next production pass should split the renderer, scene builder, shader strings, and PWA lifecycle into separate modules, add GPU timing/performance telemetry, and introduce a tiny binary scene-data format if the airport content grows.
