# The Lamplighter's Last Round (Drift City): 17 faults (8.2 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`drift-city/story/lamplighter.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/drift-city/story/lamplighter.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/drift-city/story/lamplighter.fink.js)

**Result:** 17 faults; 8.2 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## drift-city/story/lamplighter.fink.js

- Prose lines: approx 207. Faults: 17 counted (plus 2 dialogue items flagged, not counted). Faults per 100 prose lines: 8.2.

Scores:
- Specificity 4: the Titan and market details are specific (heat tariff, red D, wardrobe-sized radio); two stock similes and one told adjective.
- Interchangeability 3: Castellane is shown only by his smile (4 times), the crowd reacts in stock ways twice, and two lines are stock banter.
- Consequence 5: evidence shown at the vote decides the ending; deals change what is offered.
- Decoration 4: "a flask that isn't tea" is a detail that is never used.
- Earned 4: endings are built from clues; "Decide now." announces urgency, and "Walking away" contradicts the stall rule.
- Grade: mean 4.0; 8.2 per 100, no deduction. **Grade 4.0.**

Faults:

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 72 | 1.13 (F2) | "Dusk. Methane snow hisses on the heat lamps over your tea stall." | The story's first line opens on time and weather. Mild: the stall is in the same sentence and the hiss is specific. | Lead with the stall or with Wren's missing tea. |
| 119 | 3.7 Specificity | "glowing like a coal" | Stock simile; also odd on Titan, where nothing burns in the open. | A Titan or tea-stall comparison, or the colour. |
| 120 | 2.5 | "She lowers her voice." | Voice descriptor; the line ("Says she took something of theirs") already reads as gossip. | Cut, or a specific action of Bo's. |
| 189 | 3.7 Specificity | "Clerk Obi gathers papers at the rostrum, exhausted." | Told adjective; what shows it? | Show the tiredness, or cut "exhausted". |
| 221 | 3.7 Interchangeability | "in a good hat, as if expecting you" | Stock villain entrance. | What Castellane does that only he would do. |
| 234 | 3.7 Earned | "Walking away, you wonder: why the Assembly, not his works?" | You cannot leave the stall (line 75); Pip flies. The narrator also hands the reader the question. | Fix the movement (Pip turns away); let the reader find the question. |
| 238 | 2.6 | "The smile stays; the eyes change." | Stock "the smile does not reach the eyes". | One specific thing he does with the manifest. |
| 240 | 2.26 | "'We'll see,' you say." | Stock banter reply. | A line only this tea-stall keeper would say, or none. |
| 296 | 1.23 | "with a flask that isn't tea" | Damage as decoration: hints at drink, never used. | Use it, or name what is in the flask, or cut. |
| 329 | 2.37 | "wrapped in knitting you'd know anywhere: Wren's" | Familiarity phrase with nothing named. | Name what in the knitting is Wren's. ("warm as a teacup" in the same line is good.) |
| 346 | 2.26 | "Took you long enough." | Stock line. | A line that is Wren's own. |
| 367 | 1.12 | "The eggs glow brighter. Decide now." | Narration about the game's mechanics; urgency announced. | Show the pressure through the eggs or Wren. |
| 374 | 1.11 | "Wren cries and pretends not to." | Action at once negated; a known default. Borderline: the rest of the line is strong. | Show how she hides it. |
| 402 | 3.7 Interchangeability | "Castellane's smile holds, just." | Third smile beat for the same character (224, 238, 402). | A different reaction from him. |
| 407 | 1.17 | "Nobody moves." | Stock stillness reaction. | One specific person's reaction. |
| 412 | 3.7 Interchangeability | "Heads turn to you." | Stock crowd reaction. ("Well, do they?" before it is good.) | Cut; the question already turns the room. |
| 447 | 3.7 Interchangeability | "Castellane takes it with a warm smile" | Fourth smile beat for Castellane. | A different action. |

Dialogue flagged, not counted:
- 161 "Listen to the scale, not your hopes." (Tam): 1.4 "not X, but Y" form; Tam is a monk and may speak this way.
- 363 "People surprise you." (Wren): close to a poster aphorism (1.24); Wren would say it.

Scanner hits:
- Rejected: 146 (1.1): "She tuned it to one of their scales, then left in a hurry" is Tam's report of events; "in a hurry" is the information.
- Rejected: 325 (1.1): "Dozens of fliers circle, then drift down to the forest" gives the direction the next choice uses.
- Rejected: 455 (1.1): "Sato comes before dawn, then her colleagues, then the newsfeeds" is escalation; the growth of the crowd is the point of the ending.

Choice labels and world-only text: all labels name an action. The tuning choices are a listening puzzle and are
specific. "Look around" (7 times) is the text route; not counted. Hotspot labels plain, each with a text route.
The "breathing" motif (157, 165, 175, 253, 407) is the puzzle key, not a repeated default.

Strengths:
- 200 "The grid is two hundred years old and patched with tape, but it's cheaper on paper. It'll pass. Nobody argues in person any more."
- 276 "Bo's noodles got me through a winter."
- 309 "She means it kindly, which is worse."
- 355 "This one was stamped for scrap. I took it out of a bin."
- 432 "The Lumen proposal goes back to committee to die ... She isn't there to hear it; she's up a tree."

---

<details><summary>Patterns across the files in this review group</summary>

## Patterns across these files

Counts are of distinct source lines; quotes in foafos-entry and cellar-entry are given in brackets.

- **Revisit line "Place. Small mood line." (owner-named shape):** 4 in peraspera (195 part, 200, 240, 407)
  [+3 quotes: foafos-entry 34, cellar-entry 14 and, as weather, 18]. Lamplighter's revisit lines are mostly functional
  ("The river. Mei and her ferry."); peraspera's carry a mood verb ("goes on", "wait", "waits").
- **Weather or time first (1.13):** both stories open on it (peraspera 71 "Night ... Snow drifts", lamplighter 72
  "Dusk. Methane snow"), plus the weather shuffle option (peraspera 77) [+cellar-entry 18]. Also knot openers that are
  only a time fragment: "Dusk." (L72), "Dawn." (L388), "Midnight." (episodes 20 [+foafos 24]). The fragments in the
  episode summaries are acceptable; the two story openings are the cost.
- **Castellane's smile as his only tell:** 4 (lamplighter 224, 238, 402, 447). Counted 3; 224 is a revisit line.
- **Stock bartender gesture:** 2 characters (Mags 125 "wipes the bar", Dex 173 "leans on the bar") [+foafos 29].
- **Stock similes:** 3 ("glowing like a coal" L119, "slow as a heartbeat" P451, "goes like a first night" P436).
- **Stock emotion beats for Nuala:** 2 ("A long breath." P304, "for a long time" P310), plus "and she means it" (P327).
  Lamplighter 309 uses "She means it kindly, which is worse", where the phrase does work; the same verb in P327 does not.
- **Stock crowd reaction:** 2 (lamplighter 407 "Nobody moves.", 412 "Heads turn to you.").
- **Stock banter:** 2 (lamplighter 240 "We'll see", 346 "Took you long enough").
- **"lit from inside / within":** 2 (P78 Warmhouse, L344 treehouse). Not counted; note only.
- **"Look around" choice label:** 12 (5 peraspera, 7 lamplighter). This is the deliberate text route for hotspots (F5);
  it is navigation, not a fault.

Total counted faults in the five files: 42 (19 + 17 + 1 + 3 + 2), of which 5 are quotes of other faults. Distinct
faulted source lines: 37.

Count by rule id (counted faults, quotes included):
- 3.7 Interchangeability (stock gesture/reaction): 7
- 3.7 Specificity (vague or stock simile/description): 6
- owner-named shape (drift-city skill, "Words on screen"): 6
- 1.13 weather/time first: 4
- 1.5 triad: 3
- 2.5, 2.26, 2.37, 3.7 Earned: 2 each
- 1.11, 1.12, 1.17, 1.21, 1.23, 2.1, 2.4, 2.6: 1 each

</details>

