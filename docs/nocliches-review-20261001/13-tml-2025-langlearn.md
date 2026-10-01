# Ukrainian tutorial (tml-2025-langlearn): 8 faults (8.0 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/tml-2025-langlearn.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/tml-2025-langlearn.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/tml-2025-langlearn.fink.js)

**Result:** 8 faults; 8.0 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/tml-2025-langlearn.fink.js (Ukrainian language learning)

- Prose lines: 100. Faults: 8. Faults per 100 prose lines: 8.0.
- Scores:
  - Specificity 4: the teaching content is exact (words, case forms, endings); only the opener and the praise are generic.
  - Interchangeability 3: the feedback interjections ("Nope!" four times, "Oops!", "Not quite!") could come from any quiz.
  - Consequence 3: the praise and the "finished" message do not depend on what the reader did.
  - Decoration 5: no ornament.
  - Earned 3: "Awesome!", "Great job!", "Well done!" are given whatever the score.
  - Mean 3.6; density 8.0 is 3.0 above 5, no full 5 → no penalty. **Grade 3.6.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 8 | 3.7-I | "Welcome to your Ukrainian Food Words tutorial! Let's learn a few basics. Ready?" | Stock tutorial opener | Say what the reader will be able to do after (order bread, say "I eat cheese") |
| 33, 37, 41, 88, 98, 135 | 3.7-I (accumulation) | "Oops!" "Not quite!" "Nope!" x4 | Stock interjections; the useful part is the correction after them | Lead with the correction |
| 147 | 3.7-E | "Awesome! Now that you know some food words" | Shown after wrong answers too | Use `correct_answers` to vary it, or drop the praise |
| 237 | 3.7-E | "✅ Great job!" | Shown whatever the case answers were | As line 147 |
| 256 | 3.7-E | "🎉 Well done! You finished" | Shown at 0 correct | Make it conditional on the score |
| 259 | 3.7-S | "Keep practicing and soon you'll be ready for more cases" | Stock encouragement | Name the next lesson or cut |
| 264 | 1.10 | "You've finished this brief Ukrainian food vocabulary tutorial." | Repeats line 256 straight after it | Keep "До побачення! (Goodbye!)" only |
| 264 | 3.7-C | same line, reached from "Not right now." (line 12) | A reader who declined at the start is told they finished | Separate goodbye for the decline path |

Scanner hits: none.

Note outside the cliché rules (not counted): line 163 teaches "Яблуко зелене" (green), the recap at line 242 shows "Яблуко велике" (big).

Strengths:
- 67: "\"Борщ\" is a beet soup, not a dairy product."
- 187: "\"Хліб\" remains the same in the accusative case (masculine inanimate nouns often do)."
- 225: "Feminine nouns ending in \"-а\" often change to \"-у\" in the accusative case."
- 229: "That’s the nominative form. In this sentence, we need the accusative: \"ковбасу\"."
- 233: "\"Ковбасою\" is instrumental case — not used here."

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

