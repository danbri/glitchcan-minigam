# Per Aspera (Drift City): 19 faults (8.2 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`drift-city/story/peraspera.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/drift-city/story/peraspera.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/drift-city/story/peraspera.fink.js)

**Result:** 19 faults; 8.2 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## drift-city/story/peraspera.fink.js

- Prose lines: approx 232. Faults: 19 counted (plus 3 dialogue items flagged, not counted). Faults per 100 prose lines: 8.2.

Scores:
- Specificity 3: most lines are specific to Titan and this band, but four revisit lines have the owner-named shape and
  four similes or descriptions name nothing ("goes like a first night", "slow as a heartbeat").
- Interchangeability 4: the barkeepers (Mags, Dex) get the stock bartender gesture twice, and Nuala gets two stock
  emotion beats ("A long breath", "for a long time"); all other characters speak in their own voice.
- Consequence 5: the found things change `pull`, the clock changes the heat and the ending; choices have effects.
- Decoration 4: a small number of details ornament ("smoke and brass", "the colour of a hundred years ago").
- Earned 4: the endings are built from the clues; one line claims a first that the story can contradict (line 322).
- Grade: mean 4.0; 8.2 per 100 is less than one full 5 above 5, no deduction. **Grade 4.0.**

Faults:

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 71 | 1.13, 2.27 (F2) | "Night on Ferry Street. Snow drifts through the neon" | The first line of the story opens on time, weather and neon before the reader acts. | Start with the bass case or with Nuala missing; move the snow later. |
| 77 | 1.13 (F4, counted once) | "Ferry Street, the snow still falling." | A shuffle option that is only weather; it is also the whole street text in cellar-entry. | Replace with something that changes or that a person does, as "A drone hums past with a crate" does. |
| 125 | 3.7 Interchangeability | "Mags says, and wipes the bar." (recorded text) | The default gesture of any barkeeper in any story. | A gesture only Mags makes, or none. |
| 173 | 3.7 Interchangeability | "Dex leans on the bar." | Second stock bartender gesture; same default as line 125 for a second character. | Cut, or give Dex his own action (he watches the pads in line 146). |
| 181 | 2.5 | "Dex says quietly," (recorded) | Dialogue-tag adverb; the line ("That's where you go to make your mind up") carries its own tone. | Drop "quietly", or show what he does while he says it. |
| 195 | 3.7 Specificity | "a low room full of smoke and brass" | The stock jazz-club picture; smoke in a sealed room behind an airlock on Titan is not explained. | Name what is in this room, or make the smoke a Titan fact. |
| 195 | owner-named shape | "players come and go and the tune goes on" | Close to the owner's own example of the shape to avoid ("The tune goes on."). | Say a fact about the jam (who plays, what tune, how long). |
| 198 | 2.37 | "Oskar is on the drums, as always," | Familiarity word with nothing named. | Say what "always" means (every night since when), or cut. |
| 200 | owner-named shape | "The Lantern Cellar. The jam goes on under the street." | Revisit line with a small mood twist and no fact; quoted again in foafos-entry and cellar-entry. | A revisit line that shows a change or a person. |
| 240 | owner-named shape | "The roof. The lamps wait along the parapet." | Lamps "wait": mood with no fact. | A fact (how many lamps, lit or not), or only "The roof." |
| 304 | 2.1 | "A long breath." (recorded) | Breath as an emotion tell; a fragment beat. | Let the next line ("Oskar kept it, didn't he.") carry it, or show a specific action with the reed. |
| 310 | 2.4 | "She holds the patch for a long time." (recorded) | Beat placeholder ("for a long moment" family). | What she does with the patch. |
| 322 | 3.7 Earned | "Nuala laughs for the first time tonight." (recorded) | If the setlist was shown first, she already laughed (line 297). The claim is not always true. | Remove "for the first time tonight", or make line 297 a different reaction. |
| 327 | 1.21 | "'Thank you,' she says, and she means it." (recorded) | Narrator asserts sincerity instead of showing it. | Show it by what she does next, or cut "and she means it". |
| 350 | 3.7 Specificity | "the wrong colour, the colour of a hundred years ago" | Names no colour; the reader cannot see it. | Name the colour. |
| 407 | owner-named shape | "The foot of the tether. The car waits." | Revisit line, mood with no fact. | A fact or a person (Ruth). |
| 424 | 1.5 | "Warm air. Grass. Beer." | Three fragments for effect. Defensible (senses arrive when the helmet comes off), but it is the construction. | Keep only if the owner wants it there; otherwise fold into one sentence with a specific sense. |
| 436 | 3.7 Specificity | "The first set goes like a first night." | Vague simile: says nothing about how the set goes. | What happens in the first set. |
| 451 | 3.7 Specificity | "slow as a heartbeat" | Stock simile in an otherwise specific physics passage. | A Titan comparison, or the tempo itself. |

Dialogue flagged, not counted (rubric 3.8: a character may say it):
- 133 "Half of them think Nuala hung the stars" (Mags, recorded): stock idiom, but Mags would say it.
- 367 "Oh, thank God," (Elder Harriet, recorded, file `elder-thankgod.mp3`): 2.30. A settler would say it; flag only.
- 164 "Earth's the past." (Dex, recorded): poster-like line (1.24), but Dex is reciting a creed.

Scanner hits:
- Agreed: 181 (2.5 "quietly").
- Rejected: 195 (1.1 ", then"): "forty steps down, then an airlock, then a low room" is a route through space, not two
  actions in a row; the airlock is a Titan fact. (Line 195 has two other faults, listed above.)

Choice labels and world-only text: every label names an action of the reader. "Look around" (5 times) is the text
route for the hotspots (F5) and is plain navigation; not counted. Hotspot labels ("a torn voucher in the gutter")
are plain and each has a `look_*` text route.

Strengths (lines that pass the specificity test):
- 74 "The first settlers named every airship Hindenburg, as a joke: with no oxygen in the air, nothing here can burn. ... The count has reached 1632, and nobody laughs at it now."
- 165 "You don't fill a star system with two-point-one."
- 283 "Twenty years in a suit ... I want to stand in rain. I want to play in a room that isn't a bubble. My sister has a garden."
- 394 "Harriet has time to say 'Tell them I was funnier than this' before the screen fills with kittens again."
- 460 "She wanted rain; you hope she gets it."

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

