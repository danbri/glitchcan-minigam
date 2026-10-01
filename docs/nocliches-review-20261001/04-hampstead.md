# Hampstead (the main episode): 49 faults (17.5 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/hampstead.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/hampstead.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/hampstead.fink.js)

**Result:** 49 faults; 17.5 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/hampstead.fink.js

- Prose lines (approx): 280. Faults found: 49. Faults per 100 prose lines: 17.5.
- Split: lines 27-371 (original-style Hampstead) have 16 faults; lines 378-660 (diamond storyline and World Between
  Worlds) have 33 faults.

### Scores

| test | score | reason |
|---|---|---|
| Specificity | 3 | The first half names real, local things (3-2-1 on TV, a £120 giro in crisp tens, the Duke of Cumberland, a 2CV, a mews), but the World Between Worlds and the pool knots use lines that could stand in any portal fantasy. |
| Interchangeability | 2 | Four different characters react with the same eye tell (clerk 161, volunteer 224, curator 423, artist 435), and the artist speaks only in stock villain lines (492, 504, 512). |
| Consequence | 4 | Choices change score and state, and the diamond endings carry named costs (two teeth, a criminal record, six months). |
| Decoration | 3 | Ornament without information is frequent in the second half: "otherworldly light", "impossible colors", "ancient beyond measure", five matched "X envelops you" pool exits. |
| Earned | 3 | Several knots announce their meaning instead of building it: "The universe notices acts of genuine kindness", "The diamond was never really yours", the closing lines about "the spaces between stories". |

Mean 3.0. Density 17.5 per 100 is 12.5 above 5, which is 2 full steps of 5: minus 1.0. **Grade 2.0.**

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 88 | 2.2 | "feels heavy with possibility... and danger" | weight as vague interiority; names two abstractions, shows neither | name one concrete thing the player could do or fear with the diamond |
| 140 | 3.7 Decoration | "Queues coil like serpents." | stock simile; tells nothing about this post office | one specific detail of the queue (who, what they carry) |
| 161 | 2.1 | "The clerk's eyes narrow." | stock suspicion tell; first of four eye tells in the file | let the clerk's line or an action (checks a ledger, keeps the slip) carry it |
| 163 | 2.25 | "a TV on the wall flickers to life" | stock transition verb; first of six "flicker" uses in the file | say what the screen shows first |
| 175 | 2.1 | "cheeks burning" | stock shame tell | a specific action of this player in shame |
| 179 | 2.1 | "Your hands are shaking." | stock fear tell, third reaction in a row in this knot | cut, or one concrete consequence of the shaking |
| 182 | 3.7 Decoration | "That cheap tie suddenly feels like a noose." | stock simile | what the tie does now (the player loosens it, takes it off) |
| 186 | (continuity) | "march toward the door" | line 175 already put the player outside; not a cliché rule, but an error | fix the location |
| 190 | 1.10 | "Nobody believes you. Not even you." | echo line; the second sentence turns the first into a stock quip | cut the second sentence, or show one reaction |
| 195 | 2.10 | "The neon rain feels colder now. People seem to stare." | temperature as emotion, plus "seem" vagueness | one person who does stare, and what they do |
| 224 | 2.1 | "The volunteer's eyes widen." | eye tell, second of four | the "Blimey!" line already carries it; cut the tell |
| 228 | 2.2 | "You feel lighter, somehow." | vague interiority with "somehow" | cut, or one concrete result |
| 228 | 1.24 | "The universe notices acts of genuine kindness." | poster aphorism; narrator moralises | cut; the +2 score is the consequence |
| 240 | 1.21 | "Camaraderie blossoms" | claims the social result without showing it | one exchange in the round that leads to the card |
| 258 | 2.27 | "casts long reflections in the rain" | cinematic wallpaper before any person | one concrete thing in the gallery window |
| 338 | 2.1 | "Pippa gasps." | stock shock tell | something Pippa says or does that is hers |
| 372 | F1 / 2.2 | "[Sense a strange shimmer in the air...]" | choice label is a vague sensation, not an act; "shimmer" is a stock portal signal (5 uses across these files) | name what the reader does (follow, touch, step toward) |
| 394 | 2.17 | "Time stretches like taffy." | time-stretched phrase; the taffy twist is still the stock | the cell's mattress line is good; replace this with one thing that happens over six months |
| 398 | 1.24 | "The diamond was never really yours." | aphoristic ending line | end on the consequence (the record, the zero prospects) |
| 406 | 1.21 | "The regulars exchange dark glances." | communication claimed, not shown | one regular's action or line |
| 423 | 2.1 | "The curator's eyes light up." | eye tell, third of four | the curator's dialogue already carries it |
| 433 | 2.5 | "Critics murmur appreciatively." | adverb carries the tone | one critic's overheard remark |
| 448 | 1.10 | "Your diamond is gone. Vaporised." | echo; line 439 already showed the vaporising | cut the restatement |
| 471 | 2.6 | "an enigmatic smile" | stock gaze/expression word | what the artist does that makes them hard to read |
| 473 | 2.1 | "They see you and freeze." | stock freeze tell (3 uses across the files) | a specific reaction of this artist |
| 478 | 2.5 | "they say evasively" | adverb; the line is already evasive | cut "evasively" |
| 486 | 1.5 / 2.2 | "Something is wrong. The way light bends around them. The slight shimmer at the edges." | "something" placeholder, then fragments for effect | one plain sentence: what the player sees |
| 488 | 2.5 | "you say slowly" | adverb tag | cut |
| 490 | 2.1 | "Their smile falters." | stock tell | an action of the artist |
| 492 | 2.26 | "Clever. Too clever." | stock villain line | a line only this artist (who names art works) would say |
| 504 | 2.26 | "I'm afraid you've seen too much." | stock villain line | as above |
| 506 | 3.7 Decoration | "pulsing with otherworldly light" | stock glow; reused at 634 and in ch2 (37, 90) | one concrete property of a mega diamond |
| 510 | 2.27 | "glimpses of endless forest, impossible colors" | fantasy wallpaper | one specific thing seen through the portal |
| 512 | 2.26 | "Perhaps we'll meet again in the spaces between." | stock villain exit | a line in the artist's own art-world voice |
| 527 | 1.17 | "a place of impossible stillness" | stillness as effect, with "impossible" intensifier | what the player hears or does not hear |
| 529 | 1.25 | "ancient beyond measure, ... whispers from a thousand realities" | epic tone, wallpaper | one tree, one sound |
| 535 | 2.2 | "Your old life feels very far away now." | vague interiority | cut, or name one thing from the old life |
| 555 | 3.7 Decoration | "The warm light envelops you..." | stock exit; one of five matched pool exits (555, 569, 583, 611, 625) | let each exit show one first sensation of the destination |
| 563 | 3.7 Earned | "There's treasure down there — and danger." | stock pairing; same as line 88 and ch2 281 | name the danger |
| 569 | 3.7 Decoration | "The darkness swallows you..." | stock exit, second of five | as 555 |
| 575 | 2.27 | "grand but crumbling manor... Ravens circle... One window glows with candlelight." | gothic stock set, any haunted-house story | one detail particular to Shane Manor |
| 577 | 2.2 / 1.10 | "Something happened there. Something that wants to be discovered." | "something" placeholder, echoed | one clue from the Shane story |
| 603 | 2.36 | "a cozy village nestled in autumn woods" | brochure words (scanner hit, accepted) | the cat and the smoke are good; drop "cozy" and "nestled" |
| 605 | 1.5 | "It looks peaceful. Safe. The kind of place where nothing terrible ever happens." | fragments for effect; stock foreshadowing | cut, or one odd detail that undercuts the calm |
| 611 | 3.7 Decoration | "Warmth surrounds you..." | stock exit, third of five | as 555 |
| 619 | 2.36 | "cool and inviting. Adventures await downstream." | brochure language | one thing downstream |
| 634 | 1.10 | "pulse gently with otherworldly light. Each one contains a frozen moment" | echo of 506, plus decoration | cut, or one new property |
| 636 | 2.31 | "But that's a problem for another day." | stock ending phrase | end on the artist's trail |
| 638 | 2.31 / 1.12 | "For now, you rest in the space between all stories." | "for now" ending, narration about stories | an action of resting |
| 652 | 1.24 / 1.12 | "that's the thing about the spaces between stories — they're always there, waiting." | poster aphorism about story mechanics | end on the tally, or a concrete last image |

Other notes (not counted as cliché faults): line 384 "a interdimensional" is a grammar error.

Scanner hits rejected:
- 288 (1.19 "wrought-iron gate"): literal material of a gate, not a texture default.
- 380 (1.1 ", then"): "examines ... then makes a phone call" is plot order, and the order is the point.
- 394 (1.19 "Cold steel bars"): literal prison bars. (I accepted 2.17 on the same line for "Time stretches".)
- 425 (1.19 "velvet pedestal"): literal display velvet in a gallery.
- 500 (1.1 ", then"): "human, then something else, then human again" describes a flicker sequence; the order is the content.

Scanner hit accepted: 603 (2.36 nestled).

### Strengths

- 106: "The lift drops fifty-eight and a half metres — the escalators never dared come out here." (real fact, one joke, could not be in another story)
- 116: "Somewhere far below, {robbin_birds} small birds are riding the trains together." (the minigame result becomes an image)
- 410: "When you wake, the diamond is gone, along with your wallet and two teeth." (a cost with a number)
- 443: "Security escorts them out. The curator shrugs. 'Conceptual artists. What can you do?'" (the reaction belongs to this curator)
- 591: "The still surface carries a faint smell of static and spilt beer." (a sensory detail no other pool has)

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

