# Waterworld — Docklands Deep 🫧

Submarine salvage adventure in a flooded former London dock. picoCAD-style
low-poly 3D (vendored three.js r169, PICO-8 palette, low-res pixelated
render, flat shading), procedural lo-fi WebAudio, no external assets.

## The loop

Ping the sonar (B) → glints reveal salvage → touch to collect → bank cargo
at the diving bell (refills air, haul-size multiplier) → every banking
stirs the dock: more eels, and eventually the fatbergs escape the culverts.
Each new artifact type logs a **true London-history fact** in the codex
(mudlarks' clay pipes, Execution Dock pirates, the Whitechapel fatberg,
the 2006 Thames whale…).

Adventure-style crafting, auto-combined when both halves are aboard:

| combo | tool | unlocks |
|---|---|---|
| magnet + rope | grapple | heavy salvage, including the chest |
| lamp + wet cell | arc lamp | seeing anything in the deep basin |
| soda crate + brass nozzle | fizz lance | dissolving fatbergs (hold B nearby) |

Bank enough of the dock's past and the **ghost whale** — a particle-cloud
whale, no mesh — appears and leads you east to the pirate captain's chest.
Grapple it, bank it, win. Lose the hull (eel bites, mines, fatberg hugs,
running out of air) and the dive ends with a partial score.

Sonar also stuns eels up close and safely detonates mines at a distance.

## Controls

- **Steer:** arrows / WASD / d-pad (left-right = yaw, up-down = pitch)
- **A / Space / Z:** thrust · **B / Escape / X:** sonar ping + tools
- Touch pad appears standalone; inside the FINK shell the host provides
  input (`sdk.onControls`) and this pad hides.

## Integration

Speaks the minigame SDK natively (`ready`/`init`/`key`/`pause`/`resume`/
`snapshot`/`complete`; conformance: controls, audio, snapshot). Packaged
wrapper: `inklet/minigames/waterworld/` (redirect + manifest). Invoked
from `# MINIGAME: waterworld` — live in the world-between-worlds arcade.
Writes `waterworld_won`, `waterworld_treasure`, `waterworld_artifacts`,
plus the shared economy (`score`, `diamonds`, `minigame_played`).

Headless hook: `window.__waterworld` (state/pos/press/ping/teleport/
grabAll/bank/win/lose). Playtest: `node magpie/waterworld/test/playtest.mjs`.
Shell e2e: `node inklet/finkapp/test/e2e-waterworld.mjs`.

`?lite` halves the particle budget for low-end devices/CI.
