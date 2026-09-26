# Round 3 design (finite wraparound world, zones, easter eggs, 70s cover look)

Backups before round 3: scene.r3pre.wgsl, world.r3pre.js, main.r3pre.js, post.r3pre.wgsl, render3.r3pre.py

## World
- Torus NW = 768 blocks (LW = 19968 m). NW multiple of NC (96), 8 (BIG), 32 (regions), 24 (zones).
- Wrapped-centred block coords: wrapS(i) = ((i + 384) mod 768) - 384, so the seam sits at +-9984 m in the wild land.
- JS: computeBase/computeCell take any coords and wrap first; all hashes and city noises use wrapped coords.
  Records in cellData keep UNWRAPPED cx, cz (validation, tree positions); shader wraps for hashing (seed, ci hashes,
  giants b (wrap to +-48), canal line ids, tree ids).
- City: cityDist = toroidal distance from (0,0); cityR = 6000 + 2000*(pvn(4992,201)-.5) + 1000*(pvn(1248,202)-.5).
- pvn(x,z,s,k): value noise, lattice spacing s metres, lattice wrapped mod LW/s (s in 9984,4992,2496,1248,624,312,156,78).
- terrainAt(x,z) -> (H, W, dry, elev). H = edge * Hwild, edge = sstep(0,1,(cityDist-cityR)/1400).
  Biomes from dry/elev: sea, mountains (ridged), badlands (terraced mesas), desert (periodic dunes + oases),
  swamp (W = 1.4 water patches), forest hills. W = water level (-100 = none). Same code in JS and WGSL.
- GPU: terrTex rgba32float 768^2 per VERTEX (i*CS, j*CS): (H, W, dry, elev), built by compute terrBuild.
  ffB rgba16float 768^2 per block: (bodyTop, wx, wz, style=typ+16*zone), uploaded progressively from JS (farInfo).
  ffMax rgba32float 9 mips: (max surface, min surface, max incl. buildings, 0). mipBase/mipDown computes.
- traceFar(ro, rd, tA, tB, withBuildings): max-mip traversal, flat-tile plane shortcut, level-0 bilinear patch
  root (quadratic) + far box. Phase 1: terrain only [0, TMAX]; near field; phase 2 with buildings [TMAX, FARMAX].
- Record field 11 (s) = egg id (integer) + s hash (fract). Landmarks moved to typ 11 (fl&3: 1 pagoda, 2 tower).
  Zone in fl bits 15-17. Wild props typ 14 (egg id in s, base height in h).
- Bindings: 13 terrTex, 14 ffB, 15 ffMax, 16 terrOut (storage), 17 mipSrc, 18 mipOut. sdfcheck storage 40/41.

## Zones (0-7)
0 financial core, 1 neon entertainment, 2 old town + canals, 3 Chinatown, 4 industrial, 5 spaceport,
6 residential megablocks, 7 crystal gardens. Voronoi on 24-block lattice, type biased by centre distance.

## Easter eggs (egg ids)
Wild (typ 14): 1 lighthouse, 2 moai, 3 stone circle, 4 snowman, 5 crashed rocket, 6 UFO + cow, 7 treehouse,
8 camels, 9 flamingos, 10 Nessie, 11 whale, 12 hillside letters, 15 radio dish, 17 cabin, 18 shipwreck,
19 cat sphinx, 20 igloo. City: 21 rooftop cat, 22 donut, 23 rooftop saucer, 24 topiary dinosaur, 25 robot
statue, 26 rubber duck, 27 lucky-cat shop sign, 28 window heart. Sky/events: shooting stars, rainbow, aurora,
fireworks, rocket launches, hot air balloons.
