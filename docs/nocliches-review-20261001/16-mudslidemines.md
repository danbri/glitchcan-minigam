# Mudslide Mines: 19 faults (43.2 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/mudslidemines.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/mudslidemines.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/mudslidemines.fink.js)

**Result:** 19 faults; 43.2 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/mudslidemines.fink.js (Mudslide Mines)

The TOC calls this "Test only" (toc line 139). It is in the Episodes menu, so I score it as a story.

- Prose lines: 44. Faults: 19. Faults per 100 prose lines: 43.2.
- Scores:
  - Specificity 2: the rooms are stock jungle-ruin furniture (ancient x6, mysterious x3, gnarled tree, glowing orb).
  - Interchangeability 2: the bridge alone gets three rotating adjectives; most rooms could be in any jungle game.
  - Consequence 3: the minigame result does not change the text ("pockets heavy" always; a fixed +1066 diamonds).
  - Decoration 2: gleaming, glittering, shimmering, sparkling, dancing rainbows, hypnotic power.
  - Earned 2: "legendary", "incredible sight", "left you wiser" are asserted.
  - Mean 2.2; density 43.2 → minus 3.5; floored. **Grade 1.0.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 27 | 3.7-D | "the jungle labyrinth" | Ornament (mild) | Cut |
| 34 | 2.27 | "their scales gleaming in the dappled light" | Light wallpaper | What do the snakes do? |
| 40 | 3.7-S | "The air grows cool and damp ... Water drips somewhere within, echoing off unseen walls." | Stock cave set | One detail only this cave has |
| 48 | 3.7-S | "You venture deeper into the twisting cave passages..." | Stock transition | Name the game the reader is about to play |
| 53 | 3.7-E / 3.7-C | "pockets heavy with gems and treasures" | Said whatever the minigame result; same phrase as bagend line 199 | Use the game's result |
| 53 | 2.34 / 1.28 | "The experience has left you wiser about the dangers lurking in these ancient ruins." | Narrator states the lesson | Cut, or one danger the reader met |
| 60 | 2.37 / 2.27 | "the familiar glow of the pool's edge" | Scanner hit, agreed; the reader may never have been to the pool (direct entry from TOC) | Name what is at the edge |
| 62 | 2.35 / 3.7-E | "a legendary treasure haul!" | Puffery on a fixed +1066 | State the number only |
| 69 | 2.28 | "a strange, humming pedestal topped with a glowing orb" | "orb" is on the guide's filler list | Name the object |
| 36, 53, 69, 76, 95, 111 | 3.7-S (accumulation) | "ancient" x6 in prose and labels | One adjective doing all the age work | Give one room a specific age sign |
| 72, 105, 111 | 3.7-S (accumulation) | "mysterious" x3 | Tells the reader to feel mystery | Describe the symbols |
| 76 | 3.7-S | "An ancient, gnarled tree dominates this quiet grove." | Stock | What is odd about this tree? |
| 83 | 2.36 / 2.27 | "The spray is refreshing and the mist creates dancing rainbows in the filtered sunlight." | Travel-brochure line | One sensation |
| 88 | 3.7-D | "The current rushes past with hypnotic power" | Ornament | How fast, how loud? |
| 94 | 2.36 | "Tucked away behind foliage" | Brochure placement phrase | Cut |
| 94 | 2.34 | "Tiny lights like fireflies drift in the air, creating an otherworldly atmosphere." | Participle that interprets | Cut the participle |
| 99, 101, 106 | 1.26 | "precarious bridge" / "treacherous log bridge" / "dangerous bridge" | Elegant variation | Use "log bridge" each time |
| 111 | 2.27 | "The treasure sparkles in the mysterious light filtering through cracks in the ancient stone." | Light wallpaper; "mysterious" and "ancient" again | Keep the two locked chests, cut this |
| 115 | 2.35 | "It's an incredible sight! The wealth of a lost civilization lies before you." | Puffery; tells the reader to be impressed | One object in the hoard |

Scanner hits rejected: none (one hit, line 60, agreed).

Strengths:
- 21: "You stand amidst the wreckage of a small plane in a jungle clearing. Moss covers twisted metal."
- 76: "A large snake rests coiled near the tree's base, watching you with golden eyes."
- 99: "They look slippery and the water rushes dangerously below." (plain and useful before a risk choice)
- 105: "You made it across the river! This shore is rocky and damp."
- 111: "Two imposing chests stand against the far wall, locked with red symbols."

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

