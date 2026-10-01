# World Between Worlds: 32 faults (36.8 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/world-between-worlds.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/world-between-worlds.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/world-between-worlds.fink.js)

**Result:** 32 faults; 36.8 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/world-between-worlds.fink.js

- Prose lines: 87. Faults: 32. Faults per 100 prose lines: 36.8.
- Scores:
  - Specificity 2: the pools are described in stock fantasy terms, and each pool's description is said twice.
  - Interchangeability 2: six entry lines use one template ("The X [surrounds] you...").
  - Consequence 3: the hub routes correctly; "rest" and "drift" end where they began, but the text says otherwise.
  - Decoration 2: whispering leaves, beckoning shadows, glowing and shimmering everywhere (glow 5, shimmer 4).
  - Earned 3: "spend eternity", "where will you be?" are announced, not built.
  - Mean 2.4; density 36.8 is 31.8 above 5, six full 5s → minus 3.0; floored. **Grade 1.0.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 16 | 1.13 / F2 | "A vast, quiet wood stretches in all directions." | Opens on landscape before the reader acts; the first line is all many readers see | Start with what the reader is doing or notices first |
| 16 | 3.7-D | "ancient beyond measure, their leaves whispering secrets in a language older than words" | Stock personification; "secrets" recurs at 150 | One plain observed detail of the trees |
| 20 | 2.27 | "glows with warm light; distant green hills shimmer within" | Light wallpaper | What is seen in the pool, plainly |
| 21 | 2.27 | "stone walls and shadows beckon" | "shadows play/beckon" wallpaper | Name what is in the shadows |
| 20-25 | 1.31 / 1.6 | six lines "The [adj] pool [verbs] with X; Y [verbs]." | One sentence shape six times | Vary the syntax or cut to the distinguishing detail |
| 25 | 2.27 | "pulses with arcade lights and pixel glow" | Glow as wallpaper | Name one game seen in it |
| 27-32 | 1.26 / F1 | [Approach] [Peer into] [Examine] [Study] [Look into] [Approach] | Elegant variation: six verbs for one action | Use one verb, or let the pool's name do the work |
| 39 | 1.10 | "The golden pool shows rolling green hills ... Smoke rises from a chimney." | Repeats line 20 and the smoke of line 23 | Give only the new detail (the wizard at the door) |
| 42 | 3.7-I | "The warm light envelops you..." | Stock transition, first of six on one template | One transition line per world that names something of that world |
| 53 | 3.7-I | "The darkness swallows you..." | Same template | As line 42 |
| 61 | 1.10 / 3.7-S | "a grand but crumbling manor house. Ravens circle its chimneys." | Repeats line 22's ravens; "grand but crumbling" is stock gothic | Keep the one new detail (the lit window) |
| 64 | 3.7-I | "The mist closes around you..." | Same template | As line 42 |
| 71 | 2.36 | "a cozy village nestled in autumn woods" | Scanner hit, agreed: "nestled" is figurative brochure; "cozy" is told | Show what makes it cosy (the cat is a start) |
| 71 | 1.10 | "Smoke rises from cottages." | Third smoke line (23, 39) | Cut |
| 74 | 3.7-I | "Warmth surrounds you..." | Same template | As line 42 |
| 81 | 1.10 | "a wide river winding through marshland" | Repeats line 24 | Keep herons and the boat only |
| 84 | 3.7-I | "The current takes you..." | Same template | As line 42 |
| 91 | 2.27 | "pulses with neon light. Pixelated shapes dance across its surface" | Neon as wallpaper; repeats line 25 | Keep the list of ghosts, gems, creatures |
| 94 | 3.7-I | "The pixels swirl around you..." | Same template (sixth) | As line 42 |
| 102 | 2.27 / 2.2 | "a glowing space ... Each one hums with potential adventure." | Vague; "hums with potential" says nothing | Name one cabinet |
| 113 | 3.7-S | "Gems scatter before you, waiting to be collected..." | Stock; "waiting" is the first of four await/waiting uses | Say what the game is |
| 118 | 3.7-S | "The cave entrance yawns before you..." | Stock cave verb | As line 113 |
| 123 | 3.7-S | "Flocks of strange creatures await your command..." | Stock; same sentence as toc line 182 | Say what the flocks are or do |
| 128 | 3.7-S | "The maze materializes around you..." | Stock | As line 113 |
| 137 | 2.27 | "the glow of games surrounding you" | Glow wallpaper | Cut, or one concrete sound/sight |
| 150 | 3.7-E | "The quiet wood holds more secrets than just the pools." | Promises secrets; the knot then offers only Inventory | Say what is here (an inventory) |
| 157 | 1.3 / 2.16 | "The quiet is absolute." | Silence as an actor | What does the reader hear or not hear? |
| 157 | 2.17 | "Time moves differently here - or perhaps not at all." | Time-stretch cliché, hedged | Cut, or show it (a leaf that does not fall) |
| 159 | 2.2 / 1.12 | "you sense that each pool connects to a different world, a different story" | Vague interiority, then narration about the story mechanism | Cut; the reader already knows from line 18 |
| 159 | 1.25 | "You could spend eternity exploring them all." | Epic tone for a rest choice | Cut |
| 168 | 3.7-E | "When you open them again, where will you be?" | Rhetorical question; the only answer is the same glade | Make the question true (a different pool comes forward) or cut |
| 197 | 2.31 / 3.7-S | "Your pockets are empty. Adventures await!" | Stock cheer; fourth "await/waiting" | Point to where items come from |

Scanner hits rejected: none (one hit, line 71, agreed).

Note: 14 trailing ellipses in 87 prose lines; most of them end a stock transition (F4: they count as one pattern).

Strengths:
- 18: "pools - perfectly still, perfectly round, each reflecting a different sky." (from the Lewis source, and it does work)
- 50: "The distant clang of pickaxes echoes from somewhere deep below."
- 81: "Herons stand motionless. A small boat is tied to a dock."
- 133: "One cabinet stands apart, dripping. The screen shows green water and old brick — a drowned dock, waiting."
- 144: "The pirate captain's chest sits by the flooded cabinet, still dripping dock water. {waterworld_treasure} points of drowned London history"

---

<details><summary>Patterns across the files in this review group</summary>

## Patterns across these files

Accumulation, counted over the seven files:

- **Light and sparkle words** (glow, shimmer, gleam, glint, glitter, sparkle, twinkle): 28 uses. world-between-worlds 11,
  mudslidemines 8, bagend 6, maple-hollow 2 (+ "lights glow", "paint" x2), toc 1. Most are 2.27 wallpaper; the hub alone
  has five "glow".
- **Stock transition lines with a trailing ellipsis**: 33 ellipses in total; world-between-worlds 14 (six "The X [surrounds]
  you..." entry lines on one template), bagend 7, maple-hollow 7, mudslidemines 3.
- **Ending clichés (2.31) and announced beginnings**: 10. bagend 157, 215, 236, 238; maple-hollow 273, 277, 296, 322;
  world-between-worlds 197; mudslidemines 62.
- **Poster aphorisms and epigraphs (1.24)**: maple-hollow has 13 epigraph lines plus 4 aphorisms in narration and speech
  (52, 105, 127, 277); bagend 203. Five maple-hollow epigraphs I cannot match to Lewis, and two belong to other authors.
- **Eye tells (2.1, 2.21)**: 7. bagend 256, 285, 286; maple-hollow 40, 127, 266, 300. "His eyes twinkle" (bagend 256) and
  "Her eyes twinkle" (maple-hollow 127) are the same tell in two stories.
- **Event-as-label choices (F1)**: 7, all in maple-hollow (54, 81, 107, 153, 178, 226, 229); plus 2 labels about story mechanics (282, 284, rule 1.12).
- **"await / waiting / waits"**: 9 uses, most for an inanimate thing. world-between-worlds 4, maple-hollow 4, toc 1.
- **Text copied between files**: "Flocks of strange creatures await your command" (toc 182, world-between-worlds 123);
  "pockets heavy with" (bagend 199, mudslidemines 53); "Gossip is the true fuel ..." (toc 128, skydock 16, deliberate).
- **Brochure and feature-list copy (2.35, 2.36)**: 17. toc 10 (three "Features ..." lists, "classic" x2), mudslidemines 4,
  bagend 2 ("bustles", "invitingly"), world-between-worlds 1 ("nestled").
- **Echo lines (1.10)**: 10. world-between-worlds 4 (each pool described twice), toc 2, maple-hollow 2, tml 1, skydock 1.

The scanner found 12 hits in these files; I agreed with 9 and rejected 3 as the given rule (maple-hollow 139, 296, 300).
I recorded 191 faults in total, so the scanner found about 5% of them. It missed "bustles" (bagend 77), "the old rhythm"
(maple-hollow 62) and "orb" (mudslidemines 69), which are on its lists.

The two densest files (maple-hollow 57.3, mudslidemines 43.2 per 100) and the hub (36.8) carry most of the faults. Skydock
(3.7) and the Ukrainian tutorial (3.6) score highest; Burrow's End has the best rooms but is pulled down by stock NPC tells
and announced endings.

</details>

