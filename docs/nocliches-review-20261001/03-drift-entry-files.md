# Drift City entry files (episodes, foafos-entry, cellar-entry): 6 faults, mostly quotes of Per Aspera

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`drift-city/story/episodes.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/drift-city/story/episodes.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/drift-city/story/episodes.fink.js)
- [`drift-city/foafos-entry.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/drift-city/foafos-entry.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/drift-city/foafos-entry.fink.js)
- [`drift-city/novel/cellar-entry.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/drift-city/novel/cellar-entry.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/drift-city/novel/cellar-entry.fink.js)

**Result:** 6 faults in three short files (each under 40 prose lines).

Most faults here are exact quotes of lines in Per Aspera or the episodes hub; fix them at the source and the quotes follow.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

## drift-city/story/episodes.fink.js

- Prose lines: approx 5 (3 prose lines, 2 labels). Faults: 1. Faults per 100 prose lines: 20.

Scores:
- Specificity 3: line 9 is a tagline that could open any anthology.
- Interchangeability 4: no character tells; the tagline is generic.
- Consequence 5: a menu; each line leads to its story.
- Decoration 5: the summaries are plain.
- Earned 5: nothing is claimed that the stories do not give.
- Grade: mean 4.4. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.4.**

Faults:

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 9 | 1.5 | "one city under an orange sky, many nights, many people." | Rhythm triad for effect; it names nothing about this city. | One fact about Drift City only (the methane snow, the floating club). |

Rejected: line 9 "Each story has its own narrator and its own night; only the city is shared." This talks about
stories (1.12), but on a story-select page that is its function. Not counted.
Scanner: no hits.

Strengths:
- 15 "You send your old drone out into the methane snow to find her."
- 20 "You play upright bass, and the band leader has taken a seat home to Earth."

---

## drift-city/foafos-entry.fink.js

- Prose lines: approx 12. Faults: 3 (all are exact quotes of lines faulted in the source files). Faults per 100 prose lines: 25.

Scores:
- Specificity 3: the door tagline and the cellar line say nothing specific.
- Interchangeability 4: the bar-wiping gesture.
- Consequence 4: the Mags excerpt leads only back to the door (acceptable for an entry page).
- Decoration 4: the cellar mood line.
- Earned 4: the excerpts are coherent; the Mags excerpt drops `mags-2` but the peraspera summary covers it.
- Grade: mean 3.8. Under 40 prose lines: no density deduction (skill, step 3). **Grade 3.8.** Fix these at the source
  (episodes, peraspera); this file must then be re-quoted.

Faults:

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 13 | 1.5 | "one city under an orange sky, many nights, many people." | Quote of episodes:9. | Fix in episodes.fink.js, then re-quote. |
| 29 | 3.7 Interchangeability | "Mags says, and wipes the bar." | Quote of peraspera:125. | Fix in peraspera, re-quote (and re-record). |
| 34 | owner-named shape | "The Lantern Cellar. The jam goes on under the street." | Quote of peraspera:200; it is the only text on the cellar link. | Fix in peraspera, re-quote. |

Scanner: no hits.

Strengths:
- 28 "nine stools, a heater that ticks, and a price list older than the dome. You crack your helmet seal. The air smells of hops and hot metal."

---

## drift-city/novel/cellar-entry.fink.js

- Prose lines: approx 5. Faults: 2 (both exact quotes of peraspera). Faults per 100 prose lines: 40.

Scores:
- Specificity 3: two of the three prose lines are weather or mood only.
- Interchangeability 5: no characters.
- Consequence 4: an entry point; the street knot only leads back to the cellar.
- Decoration 4: "the jam goes on" ornaments.
- Earned 4: nothing claimed.
- Grade: mean 4.0. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.0.** The file is three prose
  lines. Fix at the source.

Faults:

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 14 | owner-named shape | "The Lantern Cellar. The jam goes on under the street." | Quote of peraspera:200. | Fix in peraspera, re-quote. |
| 18 | 1.13 (F2) | "Ferry Street, the snow still falling." | Quote of peraspera:77; here it is the whole text of the street knot, so the reader sees only weather before the choice. | Fix in peraspera, re-quote. |

Scanner: no hits.

Strengths:
- 9 "Ferry Street. Snow settles on your case." (the case makes it this reader's street).

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

