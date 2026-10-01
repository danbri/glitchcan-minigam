# Hampstead chapter 3 (hamfink2026-ch3): 25 faults (8.7 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/demos/hamfink2026-ch3.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/hamfink2026-ch3.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/hamfink2026-ch3.fink.js)

**Result:** 25 faults; 8.7 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/demos/hamfink2026-ch3.fink.js

- Prose lines (approx): 287. Faults found: 25. Faults per 100 prose lines: 8.7.
- A large part of the text is QWEN-TNG's dialogue. An AI character that talks in AI register is in character
  (guide 3.8), so I did not count its formal vocabulary; I counted repeats and fabricated quotes.

### Scores

| test | score | reason |
|---|---|---|
| Specificity | 4 | Most lines could only be in this story (2:47 AM, Bentham's wax head, TNG episode names, an 87% battery, a 3:15-3:45 guard break, the hedon list); the weak lines are the shadows and the three dawns. |
| Interchangeability | 4 | Marcus, Sophie and Raj have separate jobs and voices; a few gestures are stock (adjusting glasses, freezing, crossing himself). |
| Consequence | 3 | Variables change, but most branches converge on `proceed_plan`, and "Maybe tone down the quotes" / "No, this is perfect" (438-439) give the same result. |
| Decoration | 4 | Little ornament; the exceptions are "surprising grace", "glass eyes seem to survey the future" and "sunrise paints UCL gold". |
| Earned | 3 | QWEN-TNG's arc is built across the consultations, but the endings tell their meaning ("The guilt will haunt you", "Some questions have no answers"). |

Mean 3.6. Density 8.7 per 100 is 3.7 above 5, less than one full step: no deduction. **Grade 3.6.**

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 34 | 3.7 Interchangeability | "whispers Marcus, adjusting his glasses" | stock nervous-student gesture | an action of Marcus that is about the plan |
| 51 | 2.4 | "The laptop emits a soft hum." | beat placeholder; repeated at 281 "The laptop hums." | cut, or show the screen |
| 136 | 2.4 | "Long pause. Then:" | beat placeholder | show what the screen does during the pause (cursor, fans) |
| 183 | 2.5 | "You firmly close the laptop." | adverb | cut "firmly" |
| 317 | 2.27 | "Your group moves through the shadows." | stock stealth wallpaper; "shadows" used 4 times across files | one obstacle in the cloister |
| 376 | 2.27 | "You scan the shadows" | same stock, second use in this file | what the lookout watches (the CCTV blind spot, the guard office door) |
| 378 | 2.1 | "Everyone freezes." | stock freeze (3 uses across files) | what each person does |
| 380 | 3.7 Specificity | "...Nothing. Just the wind." | stock false alarm | a specific cause of the bang |
| 401 | 2.4 | "For a moment, everyone just stares." | beat placeholder (scanner hit, accepted); the rest of the line is strong | cut the first sentence |
| 407 | 1.10 | "I am experiencing what my training data describes as 'awe.'" | third use of the device (143, 171, 407; variants at 571, 589); the joke loses force | vary or cut the third use |
| 455 | 3.7 Interchangeability | "The cleaner crosses himself and backs away." | stock frightened-bystander gesture; "backs away" also in Hampstead 338 | a reaction of this cleaner |
| 469 | 2.27 / 1.25 | "Bentham surveys his domain. ... the sleeping university he helped inspire." | stock phrase and epic tone | one concrete thing in the quad |
| 472 | 2.4 | "QWEN-TNG falls unusually silent. Then:" | beat placeholder, second "Then:" | show the screen |
| 477 | 1.4 / 1.29 | "'To be human is to not merely observe, but to participate.'" | not-X-but-Y (scanner hit, accepted); the quote is attributed to Data and I cannot find it in the show, so the dialogue excuse does not cover it | use a real Data line, or let QWEN-TNG misquote on purpose and have someone notice |
| 486 | 2.5 | "Marcus says quietly" | adverb tag (scanner hit, accepted) | the line carries it; cut "quietly" |
| 494 | 2.7 | "navigates the corridors with surprising grace" | competence/grace default | one specific movement of the scooter |
| 496 | 1.25 / 3.7 Decoration | "Bentham's glass eyes seem to survey the future he helped create." | epic tone, "seem", ornament | cut, or one object in the workshop |
| 438-439 | 3.7 Consequence | "[Maybe tone down the quotes]" / "[No, this is perfect]" | two choices, one outcome, no text difference | let each choice change text or `prank_severity` |
| 541 | 2.31 | "Thank you. For showing me the world." | stock closing line (the "awakening?" line before it does the work) | cut |
| 546 | 2.27 | "The sun begins to rise over London." | stock dawn; second of three (484, 546, 627) | one dawn only, with a consequence (the first staff arrive) |
| 552 | 2.27 | "The Qwen3 model's interface glows." | filler | show what is on screen |
| 611 | 1.10 | "Researchers would be fascinated. Or terrified." | echo twist line | cut the second sentence |
| 627 | 2.27 | "The sunrise paints UCL gold." | light-painting wallpaper; third dawn | cut |
| 645 | 2.31 | "The guilt will haunt you." | ending cliché; tells the feeling | end on line 643, which shows it |
| 657 | 1.24 | "Some questions have no answers. That's what makes them interesting." | poster aphorism | end on QWEN-TNG still processing (655) |

Other notes (not counted): line 407 "Data once said that becoming human is about experiencing moments like this" is
also an attribution I cannot confirm; line 86 attributes a line to "Stardate 41153.7" (the stardate of "Encounter at
Farpoint"), which should be checked. The chapter is a prank with the real remains of a real person (Jeremy Bentham's
Auto-Icon at UCL). This is not a dataset record and is outside the CLAUDE.md data-ethics rule, but the owner may
want to know.

Scanner hits rejected:
- 362 (1.18 "calculated"): QWEN-TNG literally computes hedons; the word is the joke.
- 407 (2.33 "profound"): in QWEN-TNG's dialogue, an AI speaking AI register is in character (guide 3.8). I counted the line under 1.10 for a different reason.
- 531 (1.18 "calculated"): literal calculation, as 362.
- 587 (2.33): no AI-vocabulary word in narration; the line ("That is what Commander Maddox argued about Data. It was not considered a compelling argument.") is one of the best in the file.

Scanner hits accepted: 401 (2.4), 477 (1.4), 486 (2.5).

### Strengths

- 30: "a wheeled robot frame cobbled together from a mobility scooter and a mannequin stand, and a laptop running a locally-hosted Qwen3-32B model." (specific objects, no adjectives needed)
- 264: "Their break is 3:15 to 3:45 in the security office. CCTV has known blind spots in the cloisters - they've been requesting new cameras for years." (plan detail as character)
- 309: "You delete the chat history." (an action that shows the choice and the feeling)
- 422: "One bleary PhD student looks up from her thesis, sees Bentham roll past the window, and slowly closes her laptop." (the reaction is particular and funny)
- 587: "That is what Commander Maddox argued about Data. It was not considered a compelling argument." (dialogue that carries its own tone)

---

<details><summary>Patterns across the files in this review group</summary>

## Patterns across these files

Counts are lines in the three files; a line counted once per pattern.

- **Pool and portal exits in one construction** ("The warm light envelops you...", "The darkness swallows you...", "The mist closes around you...", "Warmth surrounds you...", "The current takes you...", "words flow into your mind..."): 10 (Hampstead 555, 569, 583, 597, 611, 625; ch2 269, 291, 313, 337). Ch2 269-271 and 291-295 then give a real first sensation; the Hampstead exits do not.
- **"flicker"**: 12 (Hampstead 163, 455, 500, 518, 538, 593; ch2 47, 55, 79, 140, 152, 279).
- **"shimmer"/"shimmering"**: 5 (Hampstead 372, 486, 510; ch2 31, 224).
- **"pulse"/"pulsing" with light or power**: 4 (Hampstead 506, 634; ch2 37, 90).
- **"stretches"** for scale or time: 4 (Hampstead 394, 529; ch2 69, 295).
- **"something" placeholders**: 9 lines (Hampstead 108, 457, 486, 500, 577; ch2 283, 303; ch3 143, 655); 5 of them are faults (486, 577, 283, 303 and the "somehow" family), the others are literal or in dialogue.
- **Eye tells for different characters**: 4 in Hampstead (clerk 161, volunteer 224, curator 423, artist 435).
- **"freeze"**: 3 (Hampstead 198, 473; ch3 378). I accepted 198 (it has a cause and a duration).
- **"shadows"/"shadowy"**: 4 (ch2 195, 283; ch3 317, 376).
- **"danger" paired with treasure or possibility**: 3 (Hampstead 88, 563; ch2 281).
- **Stock villain or bandit lines**: 4 (Hampstead 492, 504, 512; ch2 197).
- **Beat placeholders ("Then:", "For a moment", "Long pause")**: 3 in ch3 (136, 401, 472).
- **Dawn lines**: 3 in ch3 (484, 546, 627).
- **Narrator aphorisms and "for now" endings**: 8 (Hampstead 228, 398, 636, 638, 652; ch2 305, 329; ch3 657).
- **Exclamation marks in narration**: 28 lines in ch2, 6 in Hampstead, 5 in ch3 (mostly dialogue in ch3).
- **Two choices, one result**: 2 (ch2 199-200, ch3 438-439).
- **Repeated description across files**: the World Between Worlds (Hampstead 527-531 and ch2 241-245) uses the same pools "perfectly still, perfectly round/circular, each reflecting a different sky".

Fault totals by rule id across the three files (a row with two ids counts for each; 104 rows in all):
3.7 final-test rows (Decoration, Specificity, Earned, Interchangeability, Consequence; mostly stock exits and stock
phrases, not one rule) 18; 2.27 cinematic wallpaper 17; 2.2 vague interiority 10; 2.1 physical tells 9 (Hampstead 8,
ch3 1); 1.10 echo lines 8; 2.5 dialogue adverbs 6; 1.24 aphorisms 6; 2.26 stock lines 5; 2.4, 2.36, 2.31 4 each;
2.25, 1.25 3 each; all others 1-2.

</details>

