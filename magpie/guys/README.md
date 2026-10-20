# Escape / Great Maze Pond

A small standalone, mobile-first maze game inspired by the names and wayfinding vocabulary of Guy's Hospital in London.

- **Open `game.html`** in any current browser. No server, installation, external fonts or requests required.
- **Swipe** on the pad or on the map, or press the arrow keys or WASD. Movement is as in Pac-Man: you keep moving in the chosen direction. A new direction is taken at the next opening; until then you continue in the current direction. A wall stops you, and so does a lift, a stairwell or the exit. On the pad, one drag can steer several turns; a tap on an edge selects that direction; a tap in the centre stops you. A tap on the map walks you to that place.
- **Press E, Space or INTERACT** while on/adjacent to a lift, stairwell or exit.
- **Lift A** serves G–3 and needs the visitor badge; **lift B** serves B1–2 and needs the generator fuse. The amber staff doors are shortcuts: they open for you after you find the pharmacy key, and they are always open to the nurses. The west/east **stairs** serve neighbouring levels.
- Find the **visitor badge (3F)**, **pharmacy key (2F)**, **access code memo (1F)**, **fuse (B1)** and then leave by the exit on **G**. Each item gives 250 points and opens a route. The escape gives 1000 points, less 100 for each capture.
- Orange SVG nurses patrol and chase (see Nurses). Touching them takes you back to your bed, without discarding inventory.
- Use **MAP** to see the complete current floor; **SOUND** is off by default.

The nurse symbol is a hand-traced vector interpretation of the user-supplied pictogram and also exists as the standalone `nurse.svg` file. Its forms are reproduced in the game's internal SVG symbol for offline use.

This is a **fictional** playable maze, not an accurate floor plan or hospital access/security model. The wing names, atria, lettered lift/stair convention and Great Maze Pond are suggested by the hospital's published wayfinding guide:

- https://www.guysandstthomas.nhs.uk/sites/default/files/2022-04/patient-wayfinding-guide.pdf
- https://www.guysandstthomas.nhs.uk/guys-hospital

All code and art supplied as editable source with no dependencies.

## Nurses

The nurses are the hospital-sign pictogram itself (`nurse.svg`, the `#nurseGlyph` symbol): the same orange shapes and heavy ink, the long pointed headdress, the raised hand, the triangle dress and the pointed legs. The game cuts the pictogram at its joints (headdress, head, shoulder, elbow, dress, each leg) and animates it as itself, in the manner of rotoscoped animation (Prince of Persia, Sleeping Beauty): a walk with a weight shift and a bob, a forward-leaning run for a chase, a turn, a stop that settles, a crouch-and-snap when she notices you, breathing and small gestures when she stands. Damped springs on each part give the anticipation, overlap and follow-through: the headdress and the dress hem lag behind the body. A second arm, in a darker orange, swings behind the body; at rest it is hidden, so the still figure is the sign on the walls. The comedy is a wall sign that moves like a real, very committed person. A red "!" and a red glow show a nurse that has seen you; a "?" shows a nurse that has lost you.

Each nurse has one of five personalities (`NURSE_TYPES` in `game.html`; the cast for each floor is `NURSE_CAST`). They differ in how the pictogram moves and in size, never in costume. The step time is a multiple of 390 ms; sight is the walking distance at which she notices you; persistence is the number of steps she goes on after you leave her sight.

| Personality | Size | Step | Sight | Persist | Patrol | How she moves |
|---|---|---|---|---|---|---|
| Brisk matron | 1.10 | ×0.84 (×0.95 in a chase) | 9 | 7 | long straight corridors | upright, chin up, long stride, big arm swing; looks down at her watch |
| Weary night nurse | 1.00 | ×1.30 (×0.9 in a chase) | 6 | 2 | stays near her post | stooped, head down, short shuffling steps, heavy bob; yawns, rubs her neck |
| Chatty nurse | 0.96 | ×1.04 | 6 | 3 | wanders | bouncy step, head bobs; looks round, nods |
| Nervous trainee | 0.88 | ×0.95 | 5 | 1 | wanders | small, quick steps, fidgets, glances back, flinches when she sees you, hesitates in a chase |
| Stern sister | 1.05 | ×1.12 | 10 | 3 | long straight corridors | stiff and upright, arm held still, deliberate steps; slow look round |

Floor 3 has the matron and the night nurse; the other floors mix the rest.

## Adaptive music (Diddums)

The SOUND button plays music from the Diddums game-music engine, loaded at run time from its public URL, https://danbri.github.io/diddums/ (`adaptive.js`, `song.js`, `songbook.js`). The reference demo is https://danbri.github.io/diddums/game.html; the API is in https://danbri.github.io/diddums/skill/SKILL.md, "Adaptive music for games". The wiring is in `music.js`. `game.html` sends its sound cues through `cue()`, which uses the music when it plays and the original beeps when it does not.

- **One piece per floor:** 3F Synthwave · Neon Coastline, 2F Drum and Bass · Night Bus 174, 1F Bossa Nova · Late Café, G Northern Soul · All-Nighter, B1 Krautrock · Motorway Blue. A lift or stair changes the piece.
- **State (next bar line):** threat is the walking distance to the nearest nurse (nurses can use the staff doors). Parts enter one threshold at a time: an accompaniment part, then the rest of the accompaniment and the tune, then bass and drums, then a heartbeat, then a dread drone and 6% more tempo ("Quiet ward", "Footsteps", "Spotted", "Chased"). Items do not add parts. Capture cuts to bass, drone and heartbeat ("Escorted"). Escape plays everything ("Free").
- **Characters:** the nurses have a motif that enters when they are close and gets stronger and less stable as they close in.
- **Events (next 16th note, on the current chord):** pickups, a nurse that sees you, capture, a locked exit, a wrong code, the escape.
- **Heartbeat:** from a quarter threat, a lub-dub pulse plays and gets faster and louder as the nurses come closer: about 75 a minute at 6 steps, 150 at 2 steps, and fast while a nurse takes you back to bed. Each pulse pushes the rest of the mix down a little (ducking). The heartbeat part of the piece also starts earlier and is louder.
- **Mix (immediate):** a menu, map or pause muffles the music.

SOUND cycles OFF → MUSIC ON → OFF. If the engine does not load (offline), the button shows SOUND ON and the game uses its own beeps. `?diddums=<url>` loads another copy of the engine, for example a local server.
