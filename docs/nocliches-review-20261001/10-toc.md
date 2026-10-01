# Table of contents (toc): 19 faults (14.4 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/toc.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/toc.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/toc.fink.js)

**Result:** 19 faults; 14.4 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/toc.fink.js

- Prose lines: 132 (scanner). Faults: 19. Faults per 100 prose lines: 14.4.
- Scores:
  - Specificity 3: about half of the episode blurbs are generic ("Collect gems, solve puzzles, and escape!"); the Drift City, Waterworld and Skydock blurbs are specific.
  - Interchangeability 3: the "Features X, Y and Z" formula appears three times and could describe any game.
  - Consequence 4: most menu copy says honestly what a row opens; the Help page promises help that the page then says does not exist.
  - Decoration 3: "constellation", "shimmering", "chocolate-box-perfect" ornament without information.
  - Earned 3: "classic" twice, "serves as a hub connecting all FINK adventures" (it links five of eight episodes).
  - Mean 3.2; density 14.4 is 9.4 above 5, one full 5 → minus 0.5. **Grade 2.7.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 26 | 3.7-S | "Choose your adventure!" | Stock opener for any game menu; the next sentence ("half-finished in a different way") is the real line | Keep the second sentence alone, or name what the reader picks between |
| 54 | 2.36 | "Get help with using the FINK system, understanding controls, and troubleshooting common issues." | Help-page brochure copy; line 58 says nothing is documented yet, so it promises what is not there | Say what this page actually holds (two links and test stories) |
| 69-70 | 3.7-D | "a constellation of interactive fiction" | Metaphor decorates; "a set of" or a count says more | Give the count and the hub's job |
| 70 | 2.14 | "AI models finding their footing" | Stock grounding idiom; the list after the colon already says the subject | Cut the idiom; let the list carry it |
| 86 | 2.35 | "A nod to the classic 1982 text adventures." | "classic" asserts status; first of two uses | Name the game or the feature it borrows |
| 86 | 2.36 | "Features inventory tracking, conversation gating, and state management." | Developer feature list in a reader-facing blurb | Move to the dev guide, or say what the reader does (carry food, talk your way past) |
| 97 | 3.7-S | "Awaken in a shimmering underground cavern. Collect gems, solve puzzles, and escape!" | Generic dungeon blurb; verb triple (1.6) with no detail of this cave | Name one thing only this cave has |
| 97 | 2.36 | "Features minigame integration and multi-chapter story progression." | Second "Features" list | Same as line 86 |
| 117 | 2.33 | "Navigate the challenging social dynamics of 1980s London." | Scanner hit, agreed: "navigate" (social) and "dynamics" are AI vocabulary | Name one social situation in the story |
| 117 | 2.35 | "inspired by the classic 80s game" | Second "classic"; the game is not named | Name the game, or cut "classic" |
| 150 | 2.36 | "Discover the secrets of a chocolate-box-perfect village" | Back-cover blurb opener plus a picturesque idiom | One concrete village detail and one concrete secret-shape |
| 150 | 1.3 / 2.16 | "a conspiracy of silence" | Stock phrase; silence as the actor | Say who keeps quiet about what |
| 161 | 2.36 | "reconnect with old flames, and find your way home. Warmth points track your journey." | Romance-blurb stock phrases in a triple; "journey" is filler | Say what happens and what the warmth score changes |
| 182 | 1.10 | "Command your wizard flock ... Flocks of strange creatures await your command." | Second sentence repeats the first (command/command, flock/flocks); same sentence is reused in world-between-worlds line 123 | Keep one sentence; add what the flocks do |
| 245 | 2.35 | "serves as a hub connecting all FINK adventures" | "serves as" puffery; "all" is not true (the hub links five episodes) | Name the stories it links |
| 267 | 2.36 | "Features evidence chains, contradiction mechanics, fair-play clue system, and multiple layered endings." | Third "Features" list; "layered" again in line 269 | Keep for developers only, or say what the player does with evidence |
| 279 | 2.33 / 2.34 | "works-in-progress showcasing different gameplay mechanics and visual styles" | Scanner hit, agreed: "showcasing" | State what the links are |
| 279 | 1.10 | "A collection of experimental games, prototypes, and technical demonstrations. These are works-in-progress ..." | The second sentence says the first again | Keep one sentence |
| 328 | 2.36 | "for rapid prototyping and easy sharing" | Brochure reason; the reader needs where things are, not why | "Most are on CodePen; the rest are on this site." |

Scanner hits rejected: none (both hits, lines 117 and 279, agreed).

Notes outside the cliché rules (not counted): line 117 says "No images." and line 119 then sets an IMAGE tag. Lines 285, 313
and 323 escape the opening `**` but not the closing `**`, so the reader may see literal asterisks.
Choice labels are navigation ("Episodes", "enter Burrow's End"); F1 accepts that in a menu. Capitalisation is not
consistent ("enter" vs "Enter").

Strengths:
- 9: "Enter the Finkiverse. Everything isn't here yet." (honest, specific to this project)
- 26: "Each episode is half-finished in a different way."
- 108: "A city on Titan, under an orange sky. ... Each has its own narrator; only the city is shared."
- 128: "Gossip is the true fuel of the post-terrestrial economy. That and gemstones." (the second sentence undercuts the aphorism)
- 206: "dodge eels and rampant fatbergs, and follow the ghost whale to a pirate captain's chest."

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

