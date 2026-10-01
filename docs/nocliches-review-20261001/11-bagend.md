# Burrow's End (bagend): 22 faults (17.7 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/bagend.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/bagend.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/bagend.fink.js)

**Result:** 22 faults; 17.7 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/bagend.fink.js (Burrow's End)

- Prose lines: 124. Faults: 22. Faults per 100 prose lines: 17.7.
- Scores:
  - Specificity 4: most rooms carry one exact detail (the pipe he was not offered, trolls arguing how to cook you, a fresh scratch on the door).
  - Interchangeability 3: the NPC gestures are stock fantasy ones (beard stroked twice, eyes twinkle/gleam/widen, innkeeper polishes a mug).
  - Consequence 4: state changes are shown (key, sword, map); the endings announce change instead of showing it.
  - Decoration 4: "shimmers like molten emerald", "stands invitingly".
  - Earned 3: three endings announce ("The adventure truly begins", "has only begun", "wonder what might have been").
  - Mean 3.6; density 17.7 is 12.7 above 5, two full 5s → minus 1.0. **Grade 2.6.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 58 | 3.7-I | "stroking his beard" | Stock dwarf gesture; first of two | Give the dwarf a gesture only he has (counting your spoons, checking the time) |
| 60 | 3.7-S | "a stern dwarf at your table, looking impatient" | "stern" and "impatient" are told; nothing is shown | One action that shows impatience |
| 77 | 2.36 | "Mossbottom bustles." | "bustling" is on the brochure list; scanner missed it | What are the villagers doing? |
| 77 | 2.36 / 2.5 | "The Drowsy Dragon inn stands invitingly near." | Brochure adverb; the inn invites by assertion | One detail at the door (a smell, a sign) |
| 95 | 3.7-I | "The innkeeper polishes a mug" | Stock innkeeper gesture | A gesture tied to this innkeeper or to the news he just gave |
| 157 | 1.25 / 2.31 | "The adventure truly begins." | Announces significance; repeated by the knot name and line 215 | End on the map's content or the next step |
| 178 | 2.2 | "The cave seems smaller now." | Guide's "the room feels smaller" | Show what the burrower now does differently |
| 199 | 1.21 | "smiling as if he knew" | Knowing claimed, not shown | What does the Wizard say or do that shows he expected it? |
| 203 | 1.24 | "look to the horizon. 'Perhaps... there are greater ones yet to come.'" | Poster line plus horizon gaze; any hero could say it | Something this burrower would say (about the gold, the pantry, the dragon) |
| 215 | 2.31 | "Your career as a burglar has only begun..." | Ending cliché ("It was a start") | End on an action |
| 217 | 3.7-D | "a pool shimmers like molten emerald" | Simile decorates; "shimmer" recurs across these files (8 uses) | Name the colour or what is seen in it |
| 224 | 2.4 | "For a moment you cannot breathe, cannot think—" / 226 "Then you surface" | Scanner hit, agreed (mild): beat placeholder plus "Then" as transition, stock portal line | What does the reader feel in the water (cold, weight, sound)? |
| 236 | 2.31 | "look toward the mountains and wonder what might have been..." | Ending cliché | A concrete habit that carries the regret |
| 238 | F1 / 2.31 | [Settle into quiet contentment] | Label names a mood ending, stock | Name what the reader does |
| 251 | 2.5 | "he says airily" | Dialogue-tag adverb; the line ("good house to burgle") carries its own tone | Cut the adverb |
| 256 | 2.1 | "His eyes twinkle." | Stock wizard tell; same tell in maple-hollow line 127 | A different gesture, or none |
| 262 | 3.7-I | "The Wizard simply smiles and returns to his pipe." | Second wizard smile (199), second pipe beat (248) | Cut, or give a new action |
| 272 | 3.7-I | "He strokes his magnificent beard." | Second beard-stroke (58) | As line 58 |
| 281 | 2.5 | "he says grimly" | Dialogue-tag adverb | Cut; "Exactly what we need" can carry it |
| 285 | 2.1 | "His eyes gleam." | Eye tell; one of four eye beats in this file (256, 285, 286, 217 fox) | A gesture with the hands or voice |
| 285 | 3.7-S | "gold beyond counting, and at its heart a gem beyond price" | Stock hoard phrasing, doubled "beyond" | One concrete object from the hoard |
| 286 | 2.1 | "Your own eyes widen despite yourself." | Second-person stock tell (F3) | What does the burrower do (lean in, ask a question)? |

Scanner hits rejected: none (one hit, line 224, agreed as mild).

Strengths:
- 40: "A tall wizard sits by your fire, smoking a pipe he was not offered."
- 85: "a fire that has never once gone out."
- 124: "Three enormous trolls sit around a fire, arguing about how best to cook you."
- 126: "They freeze, appalled, and turn to stone." ("appalled" is exact and funny)
- 248: "There is a fresh scratch on your green door." (shows the mark before it is explained)

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

