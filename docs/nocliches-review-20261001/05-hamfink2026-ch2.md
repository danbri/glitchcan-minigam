# Hampstead chapter 2 (hamfink2026-ch2): 30 faults (18.6 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/demos/hamfink2026-ch2.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/hamfink2026-ch2.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/hamfink2026-ch2.fink.js)

**Result:** 30 faults; 18.6 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/demos/hamfink2026-ch2.fink.js

- Prose lines (approx): 161. Faults found: 30. Faults per 100 prose lines: 18.6.
- 28 lines of narration end in "!" (lines 31-206 especially); this is counted under Earned, not as separate faults.

### Scores

| test | score | reason |
|---|---|---|
| Specificity | 2 | The crystal dimension, the ancient shrine, the shadowy bandits and the picture-perfect village could appear unchanged in any portal story; the exceptions are the hole in the pocket, the bath-warm pool and the Ukrainian words. |
| Interchangeability | 3 | Few characters; the bandits speak stock lines, but the narration does not reuse body tells. |
| Consequence | 3 | The shard and the mugging change state, but "Try to run!" and "Offer to share" (199-200) go to the same knot with the same result. |
| Decoration | 2 | Most setting lines are glow and scale ("pure crystalline energy", "pulsing with golden light", "stretches infinitely") with no information. |
| Earned | 2 | Excitement is announced by exclamation marks and capitals ("INCREDIBLE!", "incredible power") instead of built; "Perhaps too perfect" announces the twist. |

Mean 2.4. Density 18.6 per 100 is 13.6 above 5, which is 2 full steps: minus 1.0. **Grade 1.4.**

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 31 | 2.27 / 2.35 | "a realm of pure crystalline energy!" | generic wallpaper, exclamation as excitement | one concrete thing the player sees first |
| 34 | 2.2 | "seem to hum in resonance with this place" | vague effect with "seem" | what the diamonds physically do |
| 37 | 2.27 | "The air itself sparkles. ... each pulsing with golden light." | glow wallpaper; "pulsing" repeated at 90 and in Hampstead | one specific property of a floating gem |
| 47 | 2.25 | "The portal flickers dangerously." | stock verb plus adverb; one of six "flicker" uses | show what the instability does (shrinks, drops a sound) |
| 69 | 2.27 | "stretches infinitely in all directions" | scale wallpaper; same as Hampstead 529 | cut; the list at 76-79 already sets the scene |
| 90 | 1.10 | "Each one pulses with incredible power. These are worth 1000x normal diamonds!" | echo of 37 and of the sign at 40 | cut |
| 119 | 3.7 Specificity | "An ancient shrine made of pure diamond" | stock "ancient" (also 78, Hampstead 529) | one detail of who built it or what is carved |
| 127 | 2.26 | "Take it, traveler." | stock fantasy address | cut the address |
| 138 | 2.2 | "It dissolves into your essence." | vague interiority | what the player feels or sees at once |
| 152 | 2.25 | "The portal flickers wildly! You dive through just in time!" | stock verb, adverb, "just in time" | one concrete close call |
| 155 | 2.36 | "the hillside overlooking the peaceful valley" | brochure word; no hillside or valley is set up in this file | name where the player is |
| 195 | 2.27 | "The glint of your wealth ... Shadowy figures emerge from the treeline." | stock menace; a treeline in a crystal dimension is not set up | who the figures are, one detail |
| 197 | 2.26 | "That's quite a haul you've got there, friend..." | stock bandit line | a line from these bandits |
| 199-200 | 3.7 Consequence | "[Try to run!]" / "[Offer to share]" | two choices, one outcome, no text difference | let each choice change the text or the state |
| 206 | 3.7 Specificity | "The bandits are too fast! They surround you in moments." | stock action summary | one action of one bandit |
| 224 | 2.27 | "A shimmering portal opens behind them" | stock portal adjective (5 "shimmer" uses across files) | what the player sees through it (the grimy street is good; lead with it) |
| 233 | 3.7 Specificity | "With nothing but a single diamond and your wits" | stock phrase | cut "and your wits" |
| 241 | 2.27 | "You find yourself in a quiet forest. ... leaves filtering golden light. The air is warm and still." | stock arrival and light wallpaper | one sound or one tree |
| 259 | 2.37 | "The words feel familiar." | familiarity word with nothing named (scanner hit, accepted) | cut; the reader knows the name |
| 279 | 2.27 | "torchlight flickering off wet stone walls, the glint of gems in the darkness" | stock dungeon set | one mine-specific detail (mud, a cart) |
| 281 | 3.7 Earned | "A place of danger and treasure." | stock pair; same as Hampstead 88, 563 | name the danger |
| 283 | 2.2 | "Something moves in the shadows." | stock "something" menace (scanner said 1.2; I accept it as 2.2) | what moves |
| 295 | 2.27 | "The mineshaft stretches ahead." | stock "stretches" (4 uses across files) | one detail of the shaft |
| 301 | 2.36 | "a picture-perfect English village" | brochure word | the list that follows is enough |
| 303 | 2.2 | "But something feels wrong." | "something" placeholder; the next two sentences show it | cut this sentence |
| 305 | 1.24 | "Where everyone has secrets." | stock tagline | one secret hinted |
| 317 | 1.10 | "Everything seems perfect. Perhaps too perfect." | echo line; stock foreshadowing | cut, or one wrong detail |
| 323 | 2.5 | "ripples strangely" | adverb carries the effect | the "no wind" clause already carries it; cut "strangely" |
| 329 | 1.24 | "The multiverse is strange indeed." | narrator aphorism | cut |
| 337 | 3.7 Decoration | "words flow into your mind..." | stock exit, same matched construction as the Hampstead pool exits | lead with the two Ukrainian words (339) |

Other notes (not counted): line 100 shows a bracketed placeholder "[MEGA MINIGAME! These gems are worth 1000x each!]"
to the player. The Bag End pool calls the place "Bag End" (259, 273) and "Burrow's End" (261) in the same knot;
Hampstead 549 says "Burrow's End". Lines 241-245 repeat the Hampstead World Between Worlds description (Hampstead
527-531) almost word for word.

Scanner hits rejected:
- 243 (1.28 "reflecting different skies"): the participle describes; it does not interpret. It is the Narnia allusion and also appears in Hampstead 531.

Scanner hits accepted: 259 (2.37), 283 (accepted under 2.2, not 1.2: there is no body part).

### Strengths

- 217: "...except a single ordinary diamond that slipped through a hole in your pocket." (a concrete cause for the one diamond)
- 222: "Try your luck in Hampstead, maybe? I hear there's opportunities there for the... resourceful." (the bandit's line does the chapter link)
- 269-271: "The water is warm, like a bath. You sink through it... and emerge, somehow dry" (two physical sensations in order)
- 293: "The cold hits you first. Then the smell of damp earth and old stone." (sensation before scenery)
- 339: "Привіт means hello. Дякую means thank you." (the destination's content, not a description of it)

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

