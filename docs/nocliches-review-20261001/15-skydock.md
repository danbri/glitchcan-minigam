# Skydock: 5 faults (34 prose lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/skydock.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/skydock.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/skydock.fink.js)

**Result:** 5 faults; under 40 lines (14.7) faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/skydock.fink.js (Skydock Scuttlebutt)

- Prose lines: 34. Faults: 5. Faults per 100 prose lines: 14.7.
- Scores:
  - Specificity 5: the lines belong to this station (THE JOVIAL NEWT, bread for beer, gems that were STAMPED).
  - Interchangeability 4: the veterans have one voice between them, but it is a particular voice.
  - Consequence 4: trades and diamonds change what the veterans say; the route home is promised, not reached (it is a frame).
  - Decoration 4: one wallpaper line at the close.
  - Earned 4: "The room goes quiet" announces weight the diamonds already carry.
  - Mean 4.2; density 14.7 is 9.7 above 5, one full 5 → minus 0.5. **Grade 3.7.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 33 | 1.4 | "That's not a rumour, that's ECONOMICS." | Not X, Y; in dialogue, where the guide allows it if the speaker would say it (flagged, mild) | Keep if it is this veteran's joke |
| 50 | 2.29 | "The veterans look up from their tea." | Tea as filler (mild) | A mess-hall object of this station |
| 58 | 2.16 | "The room goes quiet." | Stock reaction | Who does what when the diamonds land? |
| 72 | 2.27 | "The skydock hums on without you." | "the city hummed" wallpaper | Cut, or a specific station sound |
| 72 | 1.10 | "Somewhere below, a manor keeps its own hours; somewhere further, the whispers keep doing the rounds." | Mirrored halves; the second repeats line 18's "doing the rounds" | Keep the manor half |

Considered and not counted: line 16 "Gossip is the true fuel of ..." is the shape of a poster aphorism (1.24), but the next
sentence undercuts it and it is the story's premise. Line 62 "A start." is a veteran rating progress, not an ending cliché.
Scanner hits: none.

Strengths:
- 29: "Jacked straight into somebody's dreams. Dreams of PLACES. Old places. Earth places."
- 31: "Half the shop orders never go home — they go over the Newt's counter for a pint. That trade is older than the station."
- 35: "they say the gems in those were never mined. They were STAMPED."
- 55: "Bread for beer, and no terminal takes a cut."
- 59: "\"That,\" says the oldest veteran, \"is ticket-shaped.\" She slides one back to you."

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

