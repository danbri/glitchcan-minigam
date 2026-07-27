# Waterworld — Docklands Deep 🫧

Submarine salvage adventure in a flooded former London dock.
**Art direction v2 (the original picoCAD/blocky constraints are
officially retired):** smooth deep-sea bioluminescence — full-resolution
antialiased rendering (ACES tone mapping), smooth-shaded organic forms
(lathe-turned hull, blobby fatbergs, plump seal), soft round particles,
god rays, emissive undertones per structure family — and a shader
compositing pass (`js/post.js`): screen-space crepuscular rays,
depth-based water absorption, teal grade, vignette, breathing light and
fine grain, plus an animated water-surface shader overhead and GPU
caustic webs dancing on the shallow floor. Vendored three.js r169,
procedural lo-fi WebAudio, no external assets.

## The story — THE RISING (js/quests.js)

Your first banking wakes the sentient fatbergs; they mean to take the
city. Build a coalition of three, then win the finale:

- **Whale ghosts:** gather three ancestor bones → bury them at the
  Steelyard stone (Hanseatic ground — Cannon Street Station stands on it,
  which is true) → craft the loudspeaker (magnet + dynamo coil) → sing
  the lament → sink the PALE & SONS candle-drone barge by ping-detonating
  depth charges under its patrol line.
- **Eel Federation:** parley with the Amp and Volt elders (a gentle ping
  up close) → recover the three torn Eel Pie Charter fragments → return
  the charter: the island was held IN COMMON. The tribes unite.
- **The River Folk:** raise the East India Company strongbox with the
  grapple (hook + rope). Five uncut rubies: SPEND them at the bell
  (hull +1, air +25) or RETURN them to the river — return three and the
  river folk take the third seat.

**Finale:** the berg armada rises. Ghost whales converge on your last
sonar ping — ping to herd bergs into Blight Corner over the methane
vents, then spark the eel pylon. Democracy is saved; a wet wipe lands in
the Mayor's lunch. The end.

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
| hook + rope | grapple | heavy salvage, including the strongbox |
| magnet + dynamo coil | loudspeaker | the whale lament at the Steelyard |
| lamp + wet cell | arc lamp | seeing anything in the deep basin |
| soda crate + brass nozzle | fizz lance | dissolving fatbergs (hold B nearby) |

Victory belongs to the campaign (see THE RISING above). Lose the hull
(eel bites, mines, fatberg hugs, running out of air) and the dive ends
with a partial score.

Sonar also stuns eels up close and safely detonates mines at a distance.

## The living water (js/fx.js)

Each structure family keeps a signature colour as a faint emissive
undertone (`tint`). One basin-wide gyre (`currentAt`) carries everything: three boid
fish schools haunting the wrecks (shimmering hue-cycling point clouds),
plankton, drifting debris, vent bubble columns, and the dust motes
hanging in the **god rays** — slanted additive light shafts that fade
with depth. The sub casts a visible beam cone and feels the current.

**IR / thermal sight** (I key, or the IR button in the HUD): the water
goes near-black and unusually clear; everything drops to a cold navy
silhouette unless it carries heat. Fatbergs blaze (decomposition runs
warm — how sewer crews actually find them), the sub's engine glows, old
mines smoulder, eels barely register (cold-blooded), and the ghost whale
reads as a *cold* blue presence. Heat plumes rise off warm sources.
Late-spawned entities inherit the active mode.

## The captain's helm

She sails herself: the autopilot follows the current objective, keeps
off the floor/surface/walls, swerves mines, pings as she hunts and even
works the fizz lance alongside a fatberg. **Brushing the touchscreen is
a course order** — the sub banks onto the swiped heading for ~8s, then
resumes the hunt. A tap is a ping. Any pad/keyboard input takes the
helm manually for a few seconds; the ⚓AUTO chip toggles the autopilot
outright.

Delight pack: bioluminescent plankton flare on every ping, confetti on
every banked haul, a curious Thames seal that orbits the boat barking
hello (true codex entry — the annual seal survey is real), and after
the second banking, keep an eye on the surface near the bell. 🐥

## Controls

- **Brush the water:** set a new course · **Tap:** sonar ping
- **Steer:** arrows / WASD / d-pad (left-right = yaw, up-down = pitch)
- **A / Space / Z:** thrust · **B / Escape / X:** sonar ping + tools
- **I / IR button:** thermal sight · **⚓AUTO:** autopilot on/off
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
