# small demos (audio-demo, foafos-tour, dev-worldpools, status-demo): 22 faults

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/demos/audio-demo.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/audio-demo.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/audio-demo.fink.js)
- [`inklet/demos/foafos-tour.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/foafos-tour.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/foafos-tour.fink.js)
- [`inklet/demos/dev-worldpools.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/dev-worldpools.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/dev-worldpools.fink.js)
- [`inklet/demos/status-demo.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/status-demo.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/status-demo.fink.js)

**Result:** 22 faults; all under 40 lines faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## inklet/demos/audio-demo.fink.js
- Prose lines: 31. Faults: 3. Faults per 100 prose lines: 9.7.
- Scores:
  - Specificity 4: Most lines name exact mechanisms (BASEHREF, gain node, AudioContext). Two lines are slogans.
  - Interchangeability 5: The demo has no characters, so there are no tells.
  - Consequence 5: Each knot changes what the reader hears.
  - Decoration 4: One vague image ("instead of fighting").
  - Earned 4: The slogan lines announce a point that the explanation then makes.
- Grade: mean 4.4, density 9.7 (0 full steps above 5) = **4.4**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 27 | 1.5 | "Three tracks, one story, crossfaded by the platform." | A fragment list for rhythm | Use one plain sentence about what the reader will hear |
| 50 | 1.10 | "one tag, one bed." | It repeats "no playlist and no next/previous" in slogan form | Cut it |
| 62 | 1.4 | "the levels sit together instead of fighting" | A not-X-but-Y form with a vague image. A shared context does not explain the levels | State the real reason (one destination, one gain structure), or cut the clause |

- Scanner hits: none.
- I considered line 65 ("an instruction, not a URL") and did not count it. This contrast is precise disambiguation, not a 1.4 fault.
- Strengths:
  - 37-39 "The tag did it: the engine resolved the filename against this story's BASEHREF, fetched it, decoded it..." These are exact steps.
  - 48-50 "FinkAudio keeps one background source and crossfades when a new AUDIO tag arrives."
  - 59-61 "The wind is FinkFoley — oscillators and filtered noise, no file at all."
  - 29-30 "a browser will not let any page make a sound until you have touched it once."
  - 73 "One tag stops both engines."

## inklet/demos/foafos-tour.fink.js
- Prose lines: 31. Faults: 6. Faults per 100 prose lines: 19.4.
- Scores:
  - Specificity 4: Most lines name real controls (⊞, ▦, FULL/SPLIT/PIP, SET diamonds 42).
  - Interchangeability 4: The "thins" and "breath" images are generic dream language.
  - Consequence 5: Each section changes the shell state.
  - Decoration 3: Breath, thinning and "politely" decorate a technical tour.
  - Earned 4: The opening triad announces the theme before the tour shows it.
- Grade: mean 4.0, density 19.4 (2 full steps, minus 1.0) = **3.0**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 7 | 1.5 | "Everything you can see is a window, every window is a process, and everything that happens is an event." | A rhythmic triad slogan in the first beat | Keep one claim, the one that the tour shows first |
| 16 | 2.25 | "watch the colours shift as reality thins" | "shift" and "reality thins" are vague | Name the colour change that the reader will see |
| 23 | 2.17 | "the outer story resumed exactly where it held its breath" | A "held its breath" stock phrase. Line 17 "mid-breath" sets it up. I counted it once | Say "exactly where you left it". The next sentence already gives the mechanism |
| 44 | 1.7 | "And if you open... this tab's game will politely fall silent" | An "And" opener for rhythm (also at 23), and "politely" decorates | Start with "If". Cut "politely" |
| 48 | 3.1 | "The tour thins." | "thins" again (16, 48, and dream-inner 10) | Use a plain exit line |
| 52 | 3.8 | "Everything is not here yet." | The sentence has two possible meanings. "Not everything is here yet" is the likely intention | Fix the word order |

- Scanner hit at line 23: I agree that it is a fault. I classify it as 2.17, not 1.25.
- I considered line 28 "something is singing" and did not count it. The game shows the singer at once, so the line earns it.
- Strengths:
  - 27 "The ✕ hands quitting to the game's own paper dialog — the shell never just kills a guest that owns its exit."
  - 32 "The escalator hauls you back up to the tour."
  - 38 "bump one, the other holds still, yet the granted counter events cross."
  - 43 "Your session is ephemeral until you SAVE it with a passphrase; then it is encrypted at rest and survives reloads."
  - 50 "Mind the gap." This is a correct allusion for a Hampstead exit.

## inklet/demos/dev-worldpools.fink.js
- Prose lines: 29. Faults: 12. Faults per 100 prose lines: 41.4.
- This file's wood and pool text is the same as text in inklet/world-between-worlds.fink.js and inklet/hampstead.fink.js. I found "ancient beyond measure" and "cozy village nestled" in all three files. Make each fix at the source and in its copies.
- Scores:
  - Specificity 2: Stock fantasy scenery (an ancient wood, rolling green hills, ravens on a crumbling manor, a cozy village).
  - Interchangeability 2: All five exits use the same template.
  - Consequence 4: Each pool loads a real story.
  - Decoration 2: Most adjectives ornament the text.
  - Earned 2: "ancient beyond measure" announces scale.
- Grade: mean 2.4, density 41.4 (7 full steps, minus 3.5) = floor **1.0**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 17 | 1.13 | "A vast, quiet wood stretches in all directions." | The beat opens on landscape before the reader acts (F2) | Start with where the reader stands or what they do |
| 17 | 1.25 | "The trees are ancient beyond measure." | Epic overstatement | Give one detail that shows age |
| 19 | 1.5 | "perfectly still, perfectly round, each reflecting a different sky" | A triad rhythm with "perfectly" two times. The image is borrowed (the Wood between the Worlds) | Keep "each reflecting a different sky". Cut the rest |
| 21-25 | 1.26 | "Approach / Peer into / Examine / Study / Look into" | Five verbs for one action (look at a pool). Only the variation changes | Use one verb. Let the pool name carry the difference |
| 30 | 3.7-S | "rolling green hills and round doors set into hillsides" | Stock Shire scenery | Use one detail that is specific to this Bagend story |
| 34 | 3.1 | "The warm light envelops you..." | Exit template, instance 1 of 5: "[The X] [verb] you..." | Make each exit differ in kind, or use one plain line |
| 44 | 3.1 | "The darkness swallows you..." | Template 2/5. "swallows" is stock (the guide lists "swallowed by the quiet") | As above |
| 50 | 3.7-S | "a grand but crumbling manor house. Ravens circle its chimneys." | Stock gothic scenery | Use a detail that is specific to Shane Manor (for example, the chess) |
| 54 | 3.1 | "The mist closes around you..." | Template 3/5 | As above |
| 60 | 2.36 | "a cozy village nestled in autumn woods" | Brochure words ("nestled", "cozy") | Use a Maple Hollow detail |
| 64 | 3.1 | "Warmth surrounds you..." | Template 4/5 | As above |
| 74 | 3.1 | "The current takes you..." | Template 5/5 | As above |

- Scanner hit at line 60 (2.36): I agree.
- Strengths:
  - 40 "The dark pool shows torchlit tunnels and glittering ore veins." This line tells the reader what Mudslide Mines is.
  - 70 "a wide river winding through marshland". This is plain. It is the least stock of the five pool lines.

## inklet/demos/status-demo.fink.js
- Prose lines: 7. Faults: 1. Faults per 100 prose lines: 14.3.
- Scores:
  - Specificity 5: The birds and the half tank are the status values, shown as things.
  - Interchangeability 5: There are no tells.
  - Consequence 4: Line 35 is fixed text, and it becomes false on repeat.
  - Decoration 5: Each detail reports a variable.
  - Earned 5: There is no announcement.
- Grade: mean 4.8, density 14.3 (1 full step, minus 0.5) = **4.3**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 35 | F4 | "That is one more than yesterday." | The same line shows on each crossing, so after the first crossing it is not true | Use {crossings}, or a line that is true on each visit |

- Scanner hits: none.
- I considered line 29 "The engine coughs" and did not count it. It is a common idiom, but it is a concrete sound.
- Strengths:
  - 17 "Three birds on the wire, and half a tank."
  - 24 "Another one drops in. The wire sags."
  - 29 "the needle drops."

---

<details><summary>Patterns across the files in this review group</summary>

## Patterns across these files

1. Accumulation (3.1) is the most frequent fault: 14 counted faults.
2. The sparkle and light vocabulary in diamond-cave: 8 instances (shimmering x2, gleam, glittering, sparkles, glow brilliantly, daylight streaming, crystalline).
3. Trailing ellipsis as a beat placeholder (2.4): 12 prose instances (diamond-cave 7, dev-worldpools 5). I did not count the "Loading..." UI lines.
4. The "[The X] [verb] you..." exit template: 5 of 5 pool exits in dev-worldpools.
5. "darkness" is in diamond-cave 4 times (16, 23, 49, 62) and in dev-worldpools once.
6. Dream language reused across the dream files:
   - "somewhere" (else/older): 4 (demo 97, 117; beside 36; dream 20)
   - "thins": 3 (foafos-tour 16, 48; dream-inner 10)
   - "drift down": 2 (foafos-tour 22, dream-outer 13)
   - "the taste of": 2 (demo 117, dream-outer 14)
   - "breath" as a resume metaphor: 2 in prose (foafos-tour 17, 23), and more in the comments of demo, dream and dream-outer
   - "hum/humming": 2 in prose and 3 in labels
7. Exclamation marks in diamond-cave: 17 lines have "!". The narration announces excitement and does not show it (Earned).
8. Restating the goal (1.10) in diamond-cave: the need for 5 gems is stated 7 times (20, 75, 98, 107, 130, 134, 145).
9. Fragment and slogan rhythm (1.5): 6 instances (diamond-cave 18, audio-demo 27, foafos-tour 7, dev-worldpools 19, peer 26, dream-outer 18).
10. Stock tells (2.1): 2, both in diamond-cave (55, 64).
11. Technical explanation (audio-demo, foafos-tour) is mostly free of these faults. Faults gather in the stock fantasy scenery (diamond-cave, dev-worldpools).
12. Rule-id counts for all counted faults: 3.1 = 14, 1.5 = 6, 3.7-S = 6, 1.10 = 5, 1.25 = 4, 3.7-D = 3, 2.1 = 2, 2.27 = 2, 1.7 = 2, 1.2 = 2. All other rule ids have 1 fault each.

</details>

