# Radio Foundation quiz: 10 faults (2.5 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/demos/radio-foundation-quiz.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/radio-foundation-quiz.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/radio-foundation-quiz.fink.js)

**Result:** 10 faults; 2.5 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/demos/radio-foundation-quiz.fink.js

All text is speech of one character (a gruff "elmer"). Rubric 3.8 lets a character use a stock phrase in dialogue if he would say it; such lines are flagged and counted, with that noted.

- Prose lines (approx): 393 (scanner count)
- Faults found: 10
- Faults per 100 prose lines: 2.5

### Scores

| test | score | reason |
|---|---|---|
| Specificity | 4 | The technical content is exact and the elmer's asides are his own ("I've worked across Europe on less"), but the opening lines are the stock gruff-mentor script. |
| Interchangeability | 4 | The voice is one person throughout; only the intro lines and the slogans could come from any drill instructor. |
| Consequence | 5 | Every wrong answer gets its own rebuttal for that mistake, the score drives four different results texts, and navigation labels ("Next") are correct for a quiz. |
| Decoration | 4 | Analogies clarify (the repeater key, "shouting louder"); the slogans "Learn it. Live it." and "learn it, love it" only ornament. |
| Earned | 4 | The results and goodbye end on announced wisdom ("the licence is just the beginning") instead of the shack line that precedes it. |

Grade: mean 4.2; density 2.5 per 100 is below 5, no deduction: **4.2**.

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 15, 17 | 3.7-S (dialogue) | "I'm not here to hold your hand." / "since before you were born" / "Prove you deserve it." | The stock gruff-mentor opening; it could be any instructor in any story. | One fact about this man (his callsign, his first rig). |
| 25 | 1.24 (dialogue) | "Nobody's ever ready. That's why we practise." | Poster aphorism. | Keep only if the owner wants the stock voice; or a radio-specific line. |
| 88 | 1.24 (dialogue) | "You need to walk before you can run." | Stock proverb. | Say why Intermediate needs Foundation first. |
| 184 | 1.6 (dialogue) | "Learn it. Live it." | Slogan fragments; adds nothing to the alphabet list. | Cut. |
| 335 | 1.6 (dialogue) | "Identify. Every. Time." | One-word-sentence emphasis. | "Identify every time." |
| 372 | 1.10 / 1.6 (dialogue) | "learn it, love it, pass your exam with it" | Second slogan of the same shape as 184. | Cut; the trick is already stated. |
| 217 / 788 | 2.35 | "one of the oldest conventions in radio" / "one of the oldest traditions in radio" | The same unsupported importance claim, two times. | Give the date or origin (as 203 does with Marconi). |
| 698 | 3.7-S (dialogue) | "Don't throw in the towel" | Stock idiom. | Acceptable in voice; or cut. |
| 715 | 3.7-S (dialogue) | "Distance is your friend." | Stock phrase; the next sentences carry the point. | Cut. |
| 838 | 2.31 / 1.24 | "the licence is just the beginning. The real learning happens on the air." | Ending cliché; line 827 already says it better ("Listen more than you talk"). | End on "Now go study." or the shack line. |

### Scanner hits rejected

| line | rule id | reason |
|---|---|---|
| 107 | 1.4 | "Not a lot, but you'd be amazed" is a concession, not a "not X, but Y" correction. |
| 135 | 1.1 | "Check above, check around, then — and only then" The order is the safety rule. |
| 459 | 1.27 | "from A to B" is the literal meaning of propagation. |
| 625 | 2.6 | "unreadable" is the literal RST value R1. |
| 642 | 1.1 | "Readability first, then Signal strength" The order is the content. |

### Quiz clarity (not counted as clichés; for the owner to check)

- 715, 744: "Double the distance, quarter the field strength" — the inverse square law quarters power density; field strength halves. A learner can take the wrong fact into the exam.
- 572: "think of what the THIRD letter suggests" — the mnemonics do not follow this (QTH uses T and H; QRZ "Who is calling me?" uses no letter).
- 109, 116, 823: the power limits (10 W / 50 W / 400 W) and prefixes may be out of date after Ofcom's 2024 licence review. The reviewer did not verify this; check against current Ofcom terms.

### Strengths

- 142: "No! You can't measure SWR if you're dead!" The mistake is answered with its own consequence.
- 156: "You're thinking about feed loss when you should be thinking about not dying." Specific to the wrong answer chosen.
- 682: "That's like fixing a noise complaint by shouting louder." An analogy that explains the fault.
- 728: "People don't become RF-proof after dark." Answers the wrong option exactly.
- 829: "Now get out of my shack. I've got a pileup to work." Specific to this character and his hobby.

<details><summary>Patterns across the files in this review group</summary>

## Patterns across these files

- riverbend: "carefully" 9 times (14, 87 x2, 184, 274, 301, 303, 329, 407); 7 of these are faults in the table (303 and 329 are not counted: 303 leads to a specific clue, 329 shows the caution in action).
- riverbend: "hushed"/"low tones"/"murmur" for speech 7 times (120, 122, 128, 132, 136, 144, 221); 5 counted.
- riverbend: glances as communication 5 times (97, 120, 162, 195, 202); 4 counted.
- riverbend: dialogue-tag adverbs and voice descriptors 9 (casually x2, slightly, curtly, quietly, firmly, "tone is final", "tone is not unkind", "lowering your voice").
- riverbend: time-skip fillers 5 (23, 33, 77, 523, plus "After a few minutes" at 202, not counted).
- riverbend: "seemingly" 3 (16, 171/497 counted as 2.33 three times with 360 = 4 in all: 16, 171, 360, 497).
- riverbend: "drawn" 3 (16, 69, 544).
- riverbend: the reveal of the ATM told 4 times (14, 171, 497, 523); the same doorway entrance 3 times; the same compliment 3 times.
- riverbend: choices with no consequence: 3 pairs to search_mill; "settle_in" is the target of about 25 choices.
- quiz: slogan fragments 3 (184, 335, 372); stock proverbs/aphorisms 4 (25, 88, 715, 838); the tic "Simple as that." 2 times (203, 342) is the character's and is not counted.
- Across both files, the most frequent rule ids (counted by the first id in each table row): 2.5 = 19 (riverbend 19, quiz 0); 3.7-S = 14 (riverbend 11, quiz 3); 1.10 = 7 (riverbend 6, quiz 1). Next: 2.1 = 6 (riverbend only).
- Totals: riverbend 101 faults in about 243 prose lines (42 per 100); quiz 10 faults in about 393 prose lines (2.5 per 100). Riverbend is the accumulation case: no single fault is severe, but the same defaults recur on almost every knot.

</details>

