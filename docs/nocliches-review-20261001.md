# .fink.js prose against "BANNED: The Definitive Guide": scores, 1 October 2026

Rubric: the `nocliches-fink-authoring` skill (`.claude/skills/nocliches-fink-authoring/SKILL.md`), which summarises
Parts 1 to 3 of the guide and adds rules for interactive fiction (F1 to F6). Part 4 is not used.
Method: a word scanner (`scan.mjs`) for a first pass, then six reviewers read every line of all 33 files. Nothing was
edited. Each detailed report below lists every fault as `line | rule | quoted text | why | direction for a fix`.

## Summary

- Story and demo files (fixtures and the duplicate `_tmp_shane-manor` left out): **608 faults in about 3,133 prose
  lines, 19 per 100 lines.**
- The scanner made 99 hits; the full read found about six times as many faults. Most faults are constructions,
  stock lines repeated across a file, and choice labels, which a word list cannot find.
- The best files are the newest ones: the radio quiz (2.5 per 100), the Drift City stories (8.2 per 100 each), the
  Hampstead chapter 3 (8.7) and the Ukrainian tutorial (8.0).
- The worst are Maple Hollow (57 per 100), Mudslide Mines (43), Riverbend (42), World Between Worlds (37) and Shane
  Manor (29). The guide's main point applies: the problem in these files is ACCUMULATION, the same stock line or tell
  on nearly every knot, not single bad lines.

## Grades (1 to 5; 5 = no problem found)

Files under 40 prose lines: the grade is not comparable. The first rubric took 0.5 off per 5 faults per 100 lines
even in a 5-line file, so one fault gave a grade near 1. The skill is now corrected (no deduction under 40 lines).

| file | prose lines | faults | per 100 | grade | note |
|---|---|---|---|---|---|
| inklet/demos/radio-foundation-quiz.fink.js | 393 | 10 | 2.5 | 4.2 | |
| inklet/tml-2025-langlearn.fink.js | 100 | 8 | 8.0 | 3.6 | |
| drift-city/story/peraspera.fink.js | 232 | 19 | 8.2 | 4.0 | |
| drift-city/story/lamplighter.fink.js | 207 | 17 | 8.2 | 4.0 | |
| inklet/demos/hamfink2026-ch3.fink.js | 287 | 25 | 8.7 | 3.6 | |
| inklet/toc.fink.js | 132 | 19 | 14.4 | 2.7 | menu copy: brochure words |
| inklet/hampstead.fink.js | 280 | 49 | 17.5 | 2.0 | the main episode |
| inklet/bagend.fink.js | 124 | 22 | 17.7 | 2.6 | |
| inklet/demos/diamond-cave.fink.js | 156 | 28 | 17.9 | 1.2 | |
| inklet/demos/hamfink2026-ch2.fink.js | 161 | 30 | 18.6 | 1.4 | |
| inklet/shane-manor.fink.js | 383 | 110 | 28.7 | 1.0 | |
| inklet/world-between-worlds.fink.js | 87 | 32 | 36.8 | 1.0 | |
| inklet/riverbend.fink.js | 243 | 101 | 42 | 1.0 | |
| inklet/mudslidemines.fink.js | 44 | 19 | 43.2 | 1.0 | |
| cozyverse/maple-hollow.fink.js | 150 | 86 | 57.3 | 1.0 | |
| inklet/skydock.fink.js | 34 | 5 | 14.7 | 4.2 | under 40 lines |
| inklet/demos/audio-demo.fink.js | 31 | 3 | 9.7 | 4.4 | under 40 lines |
| inklet/demos/foafos-tour.fink.js | 31 | 6 | 19.4 | 4.0 | under 40 lines |
| inklet/demos/dev-worldpools.fink.js | 29 | 12 | 41.4 | 2.4 | under 40 lines |
| drift-city/foafos-entry.fink.js | 12 | 3 | 25 | 3.8 | under 40; all 3 are quotes of peraspera/episodes |
| inklet/demos/status-demo.fink.js | 7 | 1 | 14.3 | 4.8 | under 40 lines |
| drift-city/story/episodes.fink.js | 5 | 1 | 20 | 4.4 | under 40 lines |
| drift-city/novel/cellar-entry.fink.js | 5 | 2 | 40 | 4.0 | under 40; both are quotes of peraspera |
| inklet/_tmp_shane-manor.fink.js | 379 | 106 | 28.0 | 1.0 | a near-copy of shane-manor; see g2 |

Fixtures (rule F6, not in the totals): storyrunner demo 4.4, peer 4.2, beside 4.8, annex 4.6, annexclash 5.0,
dream 4.6; dream-inner 4.6, dream-outer 4.4; validation test-variables 4.0. All are under 40 lines, so no density deduction.

## Patterns across the files (accumulation)

- **Light words as wallpaper (2.27):** glow, shimmer, gleam, glitter, sparkle, flicker. About 28 in the TOC/Bagend
  group, 12 "flicker" and 5 "shimmer" in the Hampstead files, 8 in Diamond Cave.
- **One template for every portal or pool exit:** "The [warm light / darkness / mist] [envelops / swallows /
  surrounds] you..." 10 in the Hampstead files, 6 in World Between Worlds, 5 in dev-worldpools.
- **Stock tells shared by characters (2.1, 2.5):** in Shane Manor, a voice cracks or breaks 6 times (2 characters),
  4 characters go pale, 3 have trembling hands; in Riverbend, "carefully" 9 times and hushed tones 7 times; "his eyes
  twinkle" (Bagend 256) and "her eyes twinkle" (Maple Hollow 127) are the same tell in two stories.
- **Ending clichés and aphorisms (2.31, 1.24):** about 10 in the TOC/Bagend group, 8 in the Hampstead files; Maple
  Hollow has 13 epigraphs (the reviewer could not match 5 of them to the author they name; check before keeping them).
- **Ellipsis as a beat:** about 33 in the TOC/Bagend group, 12 in the demos.
- **Choice labels (F1):** 7 labels in Maple Hollow are events, not what the reader does; Drift City's 12 "Look
  around" labels are the intended text route for hotspots and are not faults.
- **Drift City:** the two stories open on weather or time (1.13); Castellane's smile is his only tell (4 times);
  revisit lines of the form "Place. Small mood line." are the house shape the owner set, and the reviewer flagged
  only those with a mood verb doing no work.
- **Repeated or copied text:** the World Between Worlds pools are described in the same words in Hampstead and
  chapter 2; "Flocks of strange creatures await your command" is in toc and world-between-worlds.

## What I recommend (nothing is changed yet)

1. Decide what to do with `inklet/_tmp_shane-manor.fink.js` (a near-copy). It doubles the Shane Manor work.
2. Start where accumulation is worst and the story matters most: Hampstead (the main episode and the mandatory
   test journey), then Riverbend, Maple Hollow and World Between Worlds.
3. New prose goes through the skill before it lands; the scanner is only a first pass.
4. Rewrites are proposals for you to approve. The project rule against inventing player-facing prose still holds.

---

The detailed reports follow: g1 Drift City, g2 Shane Manor, g3 Hampstead, g4 Riverbend and the radio quiz, g5 TOC,
Bagend and five others, g6 demos and fixtures.

# No-clichés review, group 1: Drift City stories

Reviewer read every line of the five files (prose, choice labels, shuffles, conditional text, `# speech:` line text,
hotspot labels). Rubric: `.claude/skills/nocliches-fink-authoring/SKILL.md`. Prose-line counts are the scanner's.
Grade = mean of the five scores, minus 0.5 for each full 5 faults per 100 lines above 5, floored at 1.

## Authorship (rubric "Project rules")

- `drift-city/foafos-entry.fink.js` (comment, lines 5-6) and `drift-city/novel/cellar-entry.fink.js` (comment,
  lines 4-6) say that every line a reader sees is an exact quote from `story/episodes.fink.js` and
  `story/peraspera.fink.js`. cellar-entry says "Do not add prose the owner has not written".
- The drift-city skill ("Words on screen", owner, September 2026) treats these stories as stories the owner wrote.
  The story files have no per-line authorship note. The git commits are authored "Claude", made under owner direction.
- Result: treat all prose here as the owner's voice. Every fix below is a proposal to the owner, not an edit.
- Many Per Aspera lines have a recorded `# speech:` mp3 (ElevenLabs cast). A change to such a line also needs a
  new recording. The faults in recorded lines are marked "(recorded)".
- The Org's platitudes ("Every day is a gift", "Home is where the heart is", "Have you tried a warm drink?") are
  deliberate satire and canon (drift-city skill, "The Org, the Elders and the calendar bug"). They are not faults.
- The drift-city skill also records the owner's own complaint about "a short polished line with a small twist of
  mood that says nothing specific ('The tune goes on.')". Faults of that shape are marked "owner-named shape".

---

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
# No-clichés review, group 2: Shane Manor

Rubric: .claude/skills/nocliches-fink-authoring/SKILL.md. The two files were read only; no repository file was changed.
Authorship: the file header says "ENRICHED VERSION - Deep Victoria Path with Evidence Chains / Based on murder mystery
design principles". The file does not say who wrote the prose. This report does not treat it as the owner's own text, and does not claim that it is not.
Rule id "3.7" in the tables means one of the guide's final tests (Specificity, Earned ...) when no Part 1 or Part 2 id fits.
Line numbers are the file's own line numbers (the same as the scanner).

## inklet/shane-manor.fink.js

- Prose lines (approx): 383 (scanner count). Faults found: 110. Faults per 100 prose lines: 28.7.
- If you remove the stage-direction tags (2.5, 21 faults) and the body tells (2.1, 13 faults), 76 faults remain, 19.8 per 100. The grade does not change.

### Scores (5 = no problem)

| test | score | reason |
|---|---|---|
| Specificity | 2 | The case facts are specific (sums in the two wills, the chair that fell backwards, the ink on Ashford's cuffs), but the atmosphere, the emotions and all nine endings use stock genre phrases ("looms like a brooding giant", "web of secrets", "justice waits for another day"). |
| Interchangeability | 1 | Victoria, Ashford, Mary and Mrs. Pemberton show fear and shock in the same way (whisper, voice cracks, goes pale, stiffens, trembles); if you remove the names, you cannot tell who reacts. |
| Consequence | 3 | Evidence choices set variables and open routes, but some hooks have no result (the shadow in the study window at line 64, the "Blackwood boy" at line 73), and six of the nine endings give the result in one summary paragraph. |
| Decoration | 2 | Much of the description decorates and does not clarify: gothic weather, "something metallic", "the tension crackles", "layers of secrets pressing against the surface". |
| Earned | 2 | Breaks and confessions are announced, not built ("She's cracking. One more push and the truth will come out."; "he reveals a secret that changes everything"; Charles confesses in one sentence of summary). |

Mean 2.0. Accumulation: 28.7 per 100 is 23.7 above 5, which is 4 full steps of 5, so subtract 2.0. Result 0.0, floored: **grade 1.0**.

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 62 | 2.27 | "Lightning flickers across the moors as Greystone Manor looms ahead like a brooding giant" | Stock gothic wallpaper; "brooding giant" decorates. Also drizzle and lightning together. | Keep Shane stepping out; give one detail of this house that matters later. |
| 64 | 2.27 | "The Gothic towers pierce the storm clouds ... a shadow moves behind amber glass" | Wallpaper. The shadow in the study is a hook that the story does not use again (the body is already there). | Cut it, or make the shadow a clue that the story pays off. |
| 66 | 2.5 | "TAXI DRIVER: *nervously*" | Adverb tag tells the tone. | Let the driver's words carry it. |
| 73 | 2.5 | "*glances at the manor nervously*" | Second "nervously" in two lines. | Give one specific action, or none. |
| 81 | 1.18 | label "Review your case notes methodically" | Precision word in a choice label. | Name what the reader checks. |
| 96 | 2.5 | "*with forced dignity, but voice cracking*" | Voice descriptor (Ashford's voice cracks again at 982 and breaks at 1080). | Show his dignity failing through what he says or does. |
| 98 | 2.2 | "there's something in his eyes... relief? Or fear?" | "Something in his eyes" with a guessed emotion; Ashford gets the same construction at 845. | Say what Shane sees him do. |
| 100 | 2.5 | "*voice drops to whisper*" | Voice descriptor (scanner hit, agreed). | Let the line be short and private by its words. |
| 107 | 1.27 | "through joy and tragedy" | False range; no events are named. | Name one event Ashford saw. |
| 114 | F1 | label "Notice his suspicious behavior" | The label gives the reader the conclusion before the reader sees anything. | Name the action ("Ask about the ink on his cuffs"). |
| 117 | 2.1 | "ASHFORD: *stiffens*" | Stock body tell; Victoria has the same at 537. | A tell that is Ashford's own. |
| 131-132 | 2.38 | "Time is on your side - for now." / "The hours slip away." | Stock time phrases on the hub line. | Use the clock: what hour it is, who has left. |
| 175 | 3.7 Specificity | "reeks of tobacco and something metallic" | "Something metallic" is the stock code for blood in crime prose. | Name the smell, or omit it. |
| 177 | 2.6 | "Your trained eye catalogues the scene:" | Scanner said 1.12; the better id is 2.6 ("cataloguing" is in the gaze list) plus competence claimed. | Go straight to the list. |
| 278 | 1.24 | "Some secrets are better left buried..." | Poster aphorism inside a solicitor's letter. | A solicitor's specific warning. |
| 280 | 1.29 | "Victoria isn't just a foundling taken in by charity." | "Not just X" construction. | State what she is. |
| 318 | 1.5 | "gentle, afraid, beautiful" | Three adjectives for effect; a photograph cannot show most of them. | One detail of the picture. |
| 318 | 2.34 | "The contrast is striking: victim and predator." | Narrator interprets the image for the reader. | Cut; the scar and the bearing do the work. |
| 337 | 2.35 | "a masterful endgame ... a brilliant, ruthless move" | Puffery adjectives. (Also: a "gambit" is an opening, not an endgame.) | Describe the position. |
| 374 | 1.18 | "smudged, hurried ... methodical, precise" | Precision words given to fingerprints, which cannot show method (scanner hit, agreed). | What the prints physically show. |
| 376 | 1.10 | "Two players. One calm, one agitated." | Echo: repeats line 374 and adds nothing. | Cut, or make Shane infer something new. |
| 389 | 1.7 | "She was losing. And she knew it." | "And" sentence for rhythm; stock line. | Say what in the notes shows it. |
| 395 | 1.4 | "This wasn't a casual game. It was a confrontation." | "Not X, but Y". | Name it once. |
| 395 | 1.24 | "I am always three moves ahead." | Stock chess aphorism. | A message that only Pemberton would send. |
| 411 | 3.7 Earned | "the scratches are theatrical. Too obvious." | Asserted; the reader is not shown what makes them false. | Give the physical sign (paint, splinters, direction). |
| 445 | 1.5 | "Twenty-five, hollow-eyed, trembling." | Three fragments; "trembling" is Mary's label again at 805. | One thing Mary does. |
| 447 | 2.5 | "MARY: *whisper*" | Voice tag; four whispers in the file (447, 663, 755, 1092). | Drop the tag. |
| 452 | 1.10 | "Tell me everything. Every detail." | Echo line. | One sentence. |
| 453 | 3.7 Specificity | "You can't do this to me. Not after everything." / "I know who you really are." | Stock overheard-argument lines. | Lines that only these two would say about the will and the letters. |
| 485 | 1.25 | "Said they changed everything." | Epic phrase (scanner hit, agreed; it is reported speech, so flagged, not banned). Same phrase family at 1019 and 1155. | What the letters changed. |
| 510 | 3.7 Specificity | "I wondered when you'd come for me." | Stock suspect greeting. | A greeting that shows how Victoria thinks. |
| 512 | 2.1 | "her knuckles whiten" | Stock tell (scanner hit, agreed). | Her own gesture. |
| 516-533 | F1 | labels "Be direct" / "Be sympathetic" / "Be psychological" | Labels read as a menu of styles, not what the reader says or does. | Name the question or the act. |
| 537 | 2.1 | "VICTORIA: *stiffens*" | Same tell as Ashford at 117. | A tell that is Victoria's own. |
| 543 | 3.7 Specificity | "the only father I ever knew" | Stock phrase; repeated at 958. | A memory that only she has. |
| 552 | 2.4 | "*long pause*" | Beat placeholder. | What she does during the pause, or cut. |
| 559 | 2.1 | "*sharp intake of breath*" | Breath tell. | Cut; "I... yes." carries it. |
| 563 | 1.21 | "the way he looked at me... like I was a stranger" | Communication claimed, not shown. | One thing he did. |
| 570 | 2.1 | "*goes very still*" | Listed tell (scanner hit, agreed). | Cut or replace with her action. |
| 574 | 2.5 | "*voice cracking*" | Voice descriptor (third crack or break in the file). | Drop. |
| 574 | 3.7 Specificity | "my whole life has been a lie" | Stock phrase; "entire/whole life" appears 5 times (323, 574, 746, 958, 984). | What, in her life, was false. |
| 594 | 1.10 | "Lovely coat. Distinctive." | "Distinctive" is used 5 times (240, 407, 586, 594, 649); here it echoes line 586. | Use a different detail of the coat. |
| 596 | 2.6 | "*watching you carefully*" | Gaze descriptor with adverb. | Cut. |
| 639 | 2.5 | "*quietly*" | Adverb tag. | Cut. |
| 651 | 2.1 | "Her face goes white." | Pale tell; "pale" or "white" for 4 people (Victoria 512, 651, 805; Mrs. Pemberton 948; Ashford 978). | Her action. |
| 655 | 2.4 | "*long silence*" | Silence as a beat. | Cut, or show what she does. |
| 661 | 3.7 Specificity | "You could control the narrative." | Modern idiom in a period story. | A period phrase or plain words. |
| 663 | 2.5 | "*whisper* Yes." | Voice tag. | Cut. |
| 674 | 2.1 | "Her hands tremble." | Stock tell; trembling or shaking for 3 people (Ashford 98, Mary 445/805, Victoria 674/922). | What her hands do with the letters. |
| 682 | 2.5 | "Her voice breaks." | Voice descriptor (scanner hit, agreed). | Let the next line show it. |
| 699 | 2.5 | "*desperately*" | Adverb tag. | Cut. |
| 712 | 2.1 | "Victoria's jaw tightens." | Listed tell (scanner hit, agreed). | Her own response. |
| 718 | 2.5 | "*sharply*" | Adverb tag. | Cut. |
| 724 | 2.5 | "*voice rising*" | Voice descriptor; the next words already shout. | Cut. |
| 728 | 2.5 | "*bitterly*" | Adverb tag. | Cut. |
| 730 | 1.12 | "She's cracking. One more push and the truth will come out." | Narration about the scene's mechanics; announces the next beat. | Show one sign that she is near the edge. |
| 738 | 1.10 | "Perhaps she needs more pressure. Or perhaps you need more proof." | Mirrored echo pair. | One sentence. |
| 746 | 1.10 | "The man you were hidden from your entire life." | Repeats line 323 nearly word for word. | Say something new about Markov. |
| 753 | 1.22 | "all composure gone" | Restraint with nothing named; "composure" for Victoria 3 times (512, 753, 956). | What she does when it goes. |
| 755 | 2.5 | "*whisper*" | Voice tag. | Cut. |
| 757 | 2.3 | "raw desperation" | Intensity default (scanner hit, agreed). | What her face or hands do. |
| 763 | 3.7 Specificity | "I said terrible things." | Vague; at 962 she names them ("liar. A coward."). | Use the specific words here too. |
| 774 | 2.5 | "*slowly*" | Adverb tag. | Cut. |
| 783 | 1.10 | "The foundling with everything to lose." | Repeats line 514 word for word. | Develop or cut. |
| 792 | 2.2 | "The evidence swirls in your mind." | Vague interiority. | Name the inconsistency Shane cannot fit. |
| 803 | 2.2 | "The tension crackles." | Vague atmosphere (air-thickens family). | Show one person's act. |
| 805 | 3.7 Specificity | "watching Victoria like a hawk" | Stock simile. | What Mrs. Pemberton does. |
| 824 | 2.5 | "*flushes angrily*" | Adverb tag. | "flushes" alone, or cut. |
| 838 | 2.10 | "*coldly*" | Temperature as emotion, as a tag. | Cut. |
| 843 | 3.7 Earned | "His composure is too perfect. Rehearsed." | Asserted; no observed detail. | One detail that shows rehearsal. |
| 845 | 2.2 | "his eyes flicker to her with something like... anguish? Guilt?" | "Something like" + flicker (2.25); same construction as 98 for the same man. | What Shane sees. |
| 857 | 1.21 | "The room erupts. Accusations fly." | The exchange is claimed, not shown. | Give two of the accusations. |
| 857 | 2.2 | "layers of secrets pressing against the surface" | Vague interiority; "secrets" used as atmosphere 6 times in narration (434, 857, 1026, 1036, 1130, 1155). | Cut. |
| 867 | 3.7 Specificity | "You gather your thoughts. The evidence points in several directions." | Filler before the choice. | Go to the status line. |
| 916 | 2.1 | "The room falls silent. Victoria stands frozen." | Silence + freezes. | Cut, or one reaction. |
| 922 | 2.5 | "*voice shaking*" | Voice descriptor. | Cut. |
| 931 | 2.2 | "destroyed something in you" | "Something in you breaks" family (in dialogue; flagged). | Say what it destroyed. |
| 942 | 2.1 | "*drawing herself up*" | Posture tell (spine straightens family). | Cut. |
| 948 | 2.1 | "*goes pale*" | Pale tell (see 651). | Her words carry it. |
| 950 | 1.15 | "The accusation hangs in the air." | Listed construction (scanner hit, agreed). | Show who answers first. |
| 956 | 2.13 / 1.22 | "Victoria's composure finally shatters." | Scanner said 2.4 ("finally"); the fault is the breaking phrase and composure label. | "She sinks into a chair, weeping" already shows it; cut the first sentence. |
| 958 | 1.10 | "He was the only father I ever knew." | Repeats 543. | Cut or vary. |
| 958 | 2.2 | "I felt everything I knew crumble." | Vague interiority. | Name one thing she no longer believes. |
| 964 | 2.1 | "with hollow eyes" | Eye tell; "hollow-eyed" was Mary at 445. | Cut. |
| 972 | 2.4 | "Victoria's eyes widen. For a moment, you see fear" | Beat placeholder plus eye tell (scanner hit, agreed). | Her action. |
| 974 | 2.5 | "*very quietly*" | Adverb tag. | Cut. |
| 978 | 2.1 | "The butler has gone pale." | Pale tell (fourth person). | Ashford's own reaction. |
| 982 | 2.5 | "*voice cracking*" | Voice descriptor (Ashford, second time). | Cut. |
| 1003 | 3.7 Earned | "Under pressure, he confesses to killing his uncle in a moment of rage" | The confession is a summary; no scene, no pressure shown. | A short scene, or say plainly that this ending is unwritten. |
| 1012 | 3.7 Specificity | "orchestrated events from the shadows" | Stock; "orchestrated events" again at 1112. | What she did. |
| 1019 | 1.25 | "he reveals a secret that changes everything" | Epic tone, and the secret is not told. | Name the secret. |
| 1026 | 3.7 Earned | "The household turns on each other ... The truth may never fully emerge." | Summary in place of a scene. | Same as 1003. |
| 1036 | 1.5 | "Someone was watching ... Someone knew ... And someone benefited" | Triple anaphora for effect. | One concrete clue. |
| 1053 | 1.24 | "Sometimes the truth is messier than fiction." | Poster aphorism. | Cut. |
| 1055-1150 | 3.7 Specificity | ending titles "SHADOWS OF DOUBT", "THE BROKEN FAMILY", "BLOOD AND LOYALTY", "THE SPIDER'S WEB", "FAMILY SINS", "THE LONG SHADOW", "UNFINISHED BUSINESS" ... | Stock title set (one fault for the set). "THE PRODIGAL SON" is used for a nephew. | Titles drawn from this case's objects (the coat, the gambit, the locket). |
| 1078 | 1.5 | "I was young, foolish, desperately in love." | Stock triple. | One thing he did then. |
| 1080 | 2.5 | "His voice breaks." | Voice descriptor (scanner hit, agreed). | Cut. |
| 1084 | 2.2 | "a mixture of shock and understanding" | Vague interiority. | What Victoria does. |
| 1090 | 2.13 | "ASHFORD: *broken*" | Breaking word as a tag. | Cut. |
| 1092 | 2.5 | "VICTORIA: *whisper*" | Voice tag. | Cut. |
| 1103 | 1.5 | "His uncle's contempt, his gambling shame, the chess game that laid bare his inadequacy" | Triple for effect, summary of motive. | A scene line from Charles. |
| 1112 | 2.10 | "Mrs. Pemberton's cold manipulation" | Temperature as emotion. | What she manipulated. |
| 1121 | 3.7 Specificity | "a man torn between duty and love" | Stock phrase. | Cut; 1074-1094 already shows it. |
| 1130 | 1.10 | "web of secrets ... Perhaps they all played their part. Perhaps the truth is lost in the tangle of lies." | Stock metaphors in a mirrored pair. | One concrete unresolved fact. |
| 1139 | 2.31 | "may be just the beginning of a larger game" | Ending cliché. | End on a specific open fact. |
| 1148 | 2.31 | "justice waits for another day" | Ending cliché. | Same. |
| 1155 | 2.2 | "the weight of its secrets pressing on your mind" | Vague interiority (scanner hit, agreed). | One thing Shane takes away. |
| 1155 | 2.31 | "something has changed in you" | Ending cliché ("Everything had changed" family). | Name the change or cut. |
| 1158 | F1 | label "As you walk the misty grounds, you notice a strange pool..." | The label is narration, not what the reader chooses. | Name the act ("Go to the pool"). |
| 1162 | 1.4 | "not the grey sky above, but something else entirely - other worlds, other stories waiting to be told" | "Not X, but Y" (scanner hit, agreed); vague. | Say what the pool shows. |

Fault count by rule id: 2.5 = 21, 3.7 = 16 (12 Specificity, 4 Earned), 2.1 = 13, 2.2 = 9, 1.10 = 8, 1.5 = 5, 2.4 = 3, 2.31 = 3, 1.24 = 3, F1 = 3, 2.13 = 2 (one shared with 1.22), and 2 each of 1.4, 1.18, 1.21, 1.25, 2.6, 2.10, 2.27; 1 each of 1.7, 1.12, 1.15, 1.22, 1.27, 1.29, 2.3, 2.34, 2.35, 2.38. Total 110. ("Terrible things" is used 3 times: 447, 763, 962; only 763 is counted.)

### Scanner hits rejected

| line | scanner id | reason for rejection |
|---|---|---|
| 407 | 1.27 | "from the window to the desk and back" is a literal path of footprints, not a false range. |
| 529 | 2.4 | "*finally turns*": she has refused to turn since line 508, so "finally" marks a real change, not a filler transition. ("eyes red-rimmed" is a mild tell, not counted.) |

Scanner hits re-labelled but kept: 177 (1.12 to 2.6), 956 (2.4 to 2.13/1.22). All other 13 scanner hits are agreed and are in the table.

### Not cliché faults (outside this rubric, noted for the owner)

- 171 vs 460: Ashford says "Mary's key wouldn't turn"; Mary says "The key turned, but the door wouldn't budge."
- 734: "three people have placed you near the study" - the story gives one witness (Mary).
- 742: "You called him a liar. A coward. Mary heard every word." - Mary's account (453) has other words; Victoria says "liar ... coward" only later (962).
- 62, 988: "Greystone Manor"; 1155: "Shane Manor".
- 880: "the chess evidence implicates him [Charles]", but 384 records a "feminine" second hand.

### Strengths (lines that pass the specificity test)

- 116: "You've been writing this morning, Mr. Ashford. After discovering your master's body." - a deduction from a seen detail (the ink stains).
- 424: the chair "should have slid forward ... Instead, it fell backwards, into the room." - a physical reason the reader can check.
- 294-296: the two wills with sums and named beneficiaries - concrete stakes.
- 811 + 828: Charles "*stubbing out cigarette*" and "*glances at Mrs. Pemberton*" - his act shows who paid his debts without a statement.
- 779: "I don't even play chess, Inspector." - one line turns the chess evidence.

## inklet/_tmp_shane-manor.fink.js

- Diff with shane-manor.fink.js: 1152 lines against 1166. 8 lines are changed (each "-> END" in _tmp is "-> manor_epilogue" in the other file, at the ends of the eight resolution knots) and 14 lines of shane-manor.fink.js are not in _tmp: "# MINIGAME: chess" (line 358) and the 13 lines of the manor_epilogue and manor_portal knots plus their divert (1152-1164). _tmp has no line that the other file does not have, except the 8 "-> END" diverts.
- Older or newer: _tmp does not have the chess minigame tag or the epilogue, so it looks like the OLDER copy. Git does not confirm it: the clone is shallow, and `git log --oneline -3` gives the same single commit (3bf5e9c, 2026-09-01, the shallow boundary) for both files. Both files are tracked.
- Lines to score: the 8 changed lines are diverts, not prose, so they have no faults. _tmp's prose is the same as shane-manor.fink.js minus the epilogue, so it has the same faults minus lines 1155 (2 faults), 1158 (1) and 1162 (1).
- Prose lines (approx): 379 (scanner). Faults: 106. Per 100: 28.0.
- Scores: the same as shane-manor.fink.js (Specificity 2, Interchangeability 1, Consequence 3, Decoration 2, Earned 2), for the same reasons. Mean 2.0, minus 2.0 for accumulation: **grade 1.0**.
- Scanner hits: its 15 hits are the 17 hits above without 1155 and 1162; the same judgements apply (407 and 529 rejected).

## Patterns across these files

(Counts are for shane-manor.fink.js; _tmp has the same counts, as the differing lines contain no tells.)
- Stage-direction adverbs and voice descriptors: 21 tags. Voice cracks, breaks or shakes 6 times for 2 characters (Ashford 96, 982, 1080; Victoria 574, 682, 922). Whisper 5 times for 3 characters (Ashford 100, Mary 447, Victoria 663, 755, 1092).
- Pale or white: 4 characters, 6 times (Victoria 512, 651, 805; Mrs. Pemberton 948; Ashford 978; "goes white"/"gone pale"/"pale and defiant").
- Trembling, shaking hands: 3 characters (Ashford 98, Mary 445 and 805, Victoria 674).
- "Stiffens": 2 characters (Ashford 117, Victoria 537).
- Guessed emotion in the eyes ("something in his eyes... relief? Or fear?", "something like... anguish? Guilt?"): Ashford, 2 times.
- "Composure" or "composed": Victoria 3 times (512, 753, 956), Ashford 2 (805, 843).
- Repeated lines: "the only father I ever knew" 2 times (543, 958); "the foundling with everything to lose" 2 (514, 783); "hidden from ... entire life" 2 (323, 746); "entire/whole life" 5; "terrible things" 3; "Distinctive" 5; "monster" for Markov 3 (574, 958, 1086).
- "Changed/changes everything" family: 3 (485, 1019, 1155).
- "Secrets" as atmosphere in narration: 6 (434, 857, 1026, 1036, 1130, 1155).
- Endings: 9 resolution knots; 6 of them (Charles, Mrs. Pemberton, Ashford short route, conspiracy, external, partial) give the outcome as one paragraph of summary; 7 of 9 end on a stock phrase or stock title.
# No-clichés review, group 3: Hampstead and the hamfink2026 chapters

Rubric: `.claude/skills/nocliches-fink-authoring/SKILL.md` (Parts 1-3 of the source guide; Part 4 not used).
Prose-line counts are from the scanner (`nocliches-scan.txt`). Line numbers are file lines.
Grade = mean of the five scores, minus 0.5 for each full 5 faults per 100 lines above 5, floored at 1.

Authorship: the git history in this clone is shallow (one commit holds all 663 lines of `hampstead.fink.js`), so I
cannot say which lines the owner wrote. The first half of Hampstead (lines 27-371: bedsit, giro, Oxfam, Duke of
Cumberland, mews) has the terse room-description style of the 1984 Spectrum game it remakes and may be the owner's
voice. The diamond and World Between Worlds half (lines 378-660) has a different, more generic voice. I score both,
and I give the fault split by half below.

None of these files are fixtures (F6). The source-code text in ch2 `source_info` (lines 352-375) and the ch3 credits
(lines 671-693) are meta text; I read them and found no faults that I count.

---

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
# No-clichés review: riverbend and radio-foundation-quiz

Rubric: .claude/skills/nocliches-fink-authoring/SKILL.md. Source: "BANNED: The Definitive Guide", Parts 1-3.
Rule ids are the rubric's (1.x, 2.x, F#). "3.7-S", "3.7-C", "3.7-E", "3.7-D" mean a fault against the final test for
Specificity, Consequence, Earned or Decoration that has no narrower rule id.
Authorship: the git history in this clone is shallow (one commit, 2026-09-01, Dan Brickley, for both files). The
reviewer cannot tell from the repository if the owner wrote this text. The line-3 comment of riverbend says
"Merged from riverbend-orig.ink". If the text is the owner's, these are proposals to the owner, not edits.
Line numbers are file lines.

## inklet/riverbend.fink.js

- Prose lines (approx): 243 (scanner count; most lines are full paragraphs or choice labels)
- Faults found: 101
- Faults per 100 prose lines: 42

### Scores

| test | score | reason |
|---|---|---|
| Specificity | 2 | Most description is stock village and old-mill furniture (chimney smoke, children laughing, a cloaked figure, dust motes, a creaking door) that could go unchanged into any mystery. |
| Interchangeability | 2 | Mrs. Gable's tells (eyes narrow two times, sighs, "unreadable", "quietly", "curtly", "firmly") belong to any guarded elder, and the same "footsteps, she stands in the doorway" entrance occurs on three branches. |
| Consequence | 2 | Many choices go to the same knot (settle_in about 25 times; three pairs of options both go to search_mill), the journal has no effect, and the reveal is given as summary ("Mrs. Gable explains that"). |
| Decoration | 2 | Adjectives and similes ornament ("like moths to flame", "as if it were a window to another place" for a real portal, "peaceful and idyllic"); few details give the reader information. |
| Earned | 2 | Line 14 names the secret (the Whisperwind ATM) before any search, and the plaque (433), the pool (36), "the balance" (525) and "the true history" (523) are each stated but not prepared. |

Grade: mean 2.0; density 42 per 100 is 37 above 5, which is 7 full steps of 5, so minus 3.5; result -1.5, floored at **1.0**.

### Faults

| line | rule id | quoted text (short) | why it fails here | direction for a fix |
|---|---|---|---|---|
| 14 | 1.13 | "The village of Riverbend nestled beside its namesake river" | The first knot opens on place and weather sounds; Elara (the player) is not in it until line 16 (F2: a beat is short). | Open on Elara doing something in the village. |
| 14 | 2.36 | "nestled" | Brochure word; the sentence is also ungrammatical ("nestled ..., seems peaceful"). | Give the real position of the village (which bank, what bridge). |
| 14 | 2.27 / 3.7-S | "Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air" | Stock village wallpaper; three generic items that could be any village. | One detail that only Riverbend has. |
| 14 | 1.7 / 3.7-E | "But Riverbend holds a secret ... the Whisperwind ATM" | Gives away the mystery's answer in the first paragraph; the investigation then cannot surprise. "But" opens for rhythm. | Keep the ATM for the reveal; show one odd fact instead. |
| 16 | 1.14 / 2.36 | "drawn by the quiet charm" | Attraction as physics plus a brochure word; no reason Elara came is given. | Name why Elara moved here. |
| 16 | 2.33 / 3.7-S | "something extraordinary hidden within the seemingly ordinary" | AI vocabulary ("seemingly") and a vague claim that names nothing. | Name what the whispers are about. |
| 23 | 2.36 | "embrace the tranquility of Riverbend" | Brochure diction. | Say what Elara does in a quiet week. |
| 23 | 2.38 | "Days turn into weeks" | Time-skip filler. | Cut, or show one day. |
| 23 | 2.37 | "the comforting rhythm of village life" | Familiarity word ("rhythm") with no routine named. | Name the routine, or cut. |
| 33 | 2.38 | "Years pass." | Time-skip filler (second of four in the file). | Show one concrete change after the years. |
| 33 | 2.31 | "You live a happy, if uneventful, life." | Ending cliché; nothing is changed or named. | End on a specific image of the life. |
| 36 (528, 540) | F1 / 3.7-E | "[One day, you notice a strange pool by the riverbank...]" | The label narrates an event, not an action of the reader; the pool has no preparation in the story. Counted once (F4). | Make the label an action; seed the pool earlier. |
| 40 | 2.5 | "you say casually" | Dialogue-tag adverb. | Let the line carry the tone. |
| 42 | 2.1 | "her eyes crinkling" | Stock physical tell. | Use a gesture that is Mrs. Gable's own (the shears, the roses). |
| 50 | 2.5 / 3.7-S | "lowering your voice slightly" / "more to Riverbend than meets the eye" | Voice descriptor plus a stock idiom. | Let Elara name what she heard. |
| 52 | 2.1 / 2.25 | "Mrs. Gable's smile fades slightly" | Stock tell with a transition verb. | Show what she does. |
| 52 | 2.6 | "her gaze becoming a touch sharper" | Gaze word. | Cut; her line carries the warning. |
| 52 | 1.21 | "a subtle dismissal in her movements" | Communication claimed, not shown. | Name the movement (she turns her back). |
| 62 | 2.1 | "Mrs. Gable's eyes narrow." | Stock tell; occurs again at 182. | One tell that is hers, or none. |
| 62 | 2.5 / 1.18 | "with deliberate care" | Precision/voice descriptor ("deliberate"). | Show the action plainly. |
| 62 | 2.5 / 3.7-S | "Her tone is final." / "chasing shadows" | Tone told after a line that already shows it; stock idiom in her speech. | Cut the tone sentence. |
| 69 | 1.14 | "you find yourself drawn to the old mill" | Attraction as physics; removes the player's choice (scanner agrees). | Make it a decision. |
| 77 | 2.38 | "Hours pass." | Time-skip filler (third). | Say what Elara sees in those hours, or cut. |
| 79 | 3.7-S | "someone in a dark cloak, moving with purpose" | Stock mystery figure and stock phrase. | One feature that identifies the figure later. |
| 87 | 1.18 / 2.7 | "They move with practiced ease" | Listed precision phrase (scanner agrees). | Say what the movement is (they know where the nettles are). |
| 87 | 2.5 | "carefully follow ... look around carefully" | "carefully" two times in one paragraph; it is the guide's quick-scan word and occurs 9 times in this file. | Show caution through an action, or cut. |
| 87 | 1.1 | "they pause, look around carefully, then slip inside" | ", then" choreography with no psychology (scanner agrees). | Keep one action that matters. |
| 97 | 1.21 | "They exchange quick glances." / "a bit too quickly" | Communication claimed; first of five "glances" in the file. | Show what the villagers say or do. |
| 107 | 2.5 | "you say casually" | Second "casually". | Cut the adverb. |
| 109 | 2.1 | "An older man strokes his chin." | Stock tell. | Give him an action of his own, or cut. |
| 113 | 1.9 | "His smile becomes more forced." | A smile that is not quite a smile. | Show the evasion in his words. |
| 120 | 2.2 / 1.21 | "fleeting glances exchanged, and a general air of secrecy beneath the surface of everyday life" | Vague interiority and claimed communication. | Name one overheard thing or one person who stops talking. |
| 128 | 2.5 | "Their voices often drop to a murmur" | Voice descriptor; "hushed/low tones" occurs 7 times in the file. | Show the stop in the talk. |
| 132 | 2.5 / 3.7-E | "the old mill that several people mentioned in hushed tones" | Repeats "hushed tones"; the mill is not in the overheard text at 128. | Put the mill in the fragments at 128. |
| 144 | 2.27 | "dappled sunlight filters through ancient oaks" | Light wallpaper. | One detail of this grove. |
| 144 | 2.5 | "speaking in low tones" | Accumulation of hushed/low tones. | Cut. |
| 146 | 1.3 | "They notice you. Silence falls." | Silence as an actor (scanner agrees). | Say who stops and what they do. |
| 154 | 1.4 / 2.5 | "Her tone is not unkind, but firm." | "Not X, but Y" plus tone told (scanner agrees). | Let her line show it. |
| 162 | 1.21 | "exchanging glances with the others" | Second "exchange glances". | Show the decision. |
| 164 | 1.24 | "It can be a blessing or a curse." | Poster aphorism. | A line that only Mrs. Gable would say. |
| 164 / 204 / 481 | 1.10 / interchangeability | "You've shown resourcefulness, I'll give you that." / "You're persistent, I'll give you that." / "you've certainly proven yourself resourceful" | The same compliment three times on different branches. | Vary or cut. |
| 171 | 1.10 | "blessed - or cursed" | Echoes 164 at once. | Cut one. |
| 171 | 2.33 | "from seemingly nowhere" | AI vocabulary (scanner agrees). | State the fact. |
| 171 | 3.7-C | "Mrs. Gable explains that Riverbend has been blessed ..." | The central reveal is told in reported summary. | Show the explanation as her speech or as a thing Elara sees. |
| 182 | 2.1 | "Mrs. Gable's eyes narrow." | Second use of the same tell. | Different response, or none. |
| 184 | 2.5 | "watching you carefully" | "carefully" again. | Cut the adverb. |
| 193 | 2.5 | "says Mrs. Gable curtly" | Dialogue-tag adverb. | Cut. |
| 195 | 1.7 / 1.21 | "But you notice one of the younger villagers glancing nervously" | "But" opener; fourth glance. | Show the young villager's action. |
| 204 | 1.24 | "some secrets are kept for good reason" | Poster aphorism; repeated at 535. | Name the reason she means. |
| 221 | 2.5 | "they speak in hushed tones" | Accumulation. | Cut. |
| 229 | 1.1 | "The two villagers freeze, then the baker sighs." | ", then" choreography (scanner agrees). | Keep the one action that shows the baker. |
| 231 | 3.7-S | "like moths to flame" | Dead simile. | A comparison from the baker's own trade, or cut. |
| 240 | 1.28 / 1.10 | "They seem to be debating whether to reveal something to you." | Explains the fragments the reader just read. | Cut. |
| 258 | 2.5 | "with determination" | Emotion told. | Cut. |
| 258 | 2.27 / 3.7-S | "The structure looms before you" / "Vines have claimed much of the stonework" | Stock ruin description. | One fact about this mill. |
| 274 | 2.5 | "You scan the area carefully." | "carefully" again. | Cut the adverb. |
| 274 | 1.10 | "Someone has been here recently - perhaps very recently." | Echo line; the second clause adds nothing. | Say how recent (the mud is still wet). |
| 282 | 3.7-S | "a protesting creak that echoes" | Stock old-door sound. | Cut or make specific. |
| 290 | 1.3 | "Silence answers you" | Silence as an actor (scanner did not find it). | Go straight to the hum. |
| 301 | 2.5 | "You carefully step inside" | "carefully" again. | Cut. |
| 301 | 2.27 | "Dust motes dance in the faint light filtering through cracks" | Light wallpaper. | Cut; line 303 has the useful detail. |
| 301 | 3.7-S | "The air is damp and smells of decay." | Stock smell. | A smell that is a clue (oil, as at 303). |
| 319 | 2.5 | "The steps creak ominously" | Adverb telling mood. | Say which steps are missing. |
| 336 | 3.7-S | "its pages yellowed with age" | Stock old-journal description. | Cut or make specific. |
| 338-339 | 3.7-C | "Take the journal" / "Leave the journal" both -> search_mill | The choice changes nothing. | Track the journal or merge the options. |
| 346-347 | 3.7-C | "Look for a key" / "Leave it alone" both -> search_mill | The choice changes nothing. | Merge or branch. |
| 353-354 | 3.7-C | "Search the mill for a key" / "Look for another entrance" both -> search_mill | The choice changes nothing. | Merge or branch. |
| 343 / 384 | 1.10 | "completely out of place in this ancient structure" / "clearly modern technology in this ancient building" | Same observation repeated about two locks. | Say it once. |
| 358 | 2.1 | "something that makes your heart race..." | Physical tell; "something" then a menu (scanner agrees). | Let the found thing carry the effect. |
| 360 | 2.33 | "[A sturdy metal door, seemingly out of place.]" | AI vocabulary in a choice label, third "out of place" (scanner agrees). | "A metal door in the stone wall." |
| 368 | 3.7-S | "looks subtly different from the rest" | Vague; what is different is not said. | Name the difference. |
| 384 | 1.10 | "surprisingly solid" | Same words as the oak door at 282. | Vary or cut. |
| 407 | 2.5 | "You carefully examine the area" | "carefully" again. | Cut. |
| 433 | 3.7-E | "you recall seeing it on a plaque in the village square" | The plaque is not in any earlier knot. | Put the plaque in the square scenes. |
| 457 | 3.7-S | "unlike any you've seen before" / "hydraulic hiss" / "glows with a soft blue light" | Stock reveal phrases; "ATM machine" is redundant. | Say what is different about it. |
| 459 | 1.12 | "You've discovered Riverbend's secret. What will you do with this knowledge?" | Narration about the story's own beat. | Cut; let the choices ask. |
| 467 | 2.35 / 1.25 | "Evidence of this incredible discovery." | Puffery fragment. | Cut. |
| 469 | 2.6 | "her expression unreadable" | Gaze word (scanner agrees). | Show what she does. |
| 469 / 479 / 510 | interchangeability | footsteps, then Mrs. Gable in the doorway | The same entrance on three branches. | Give each branch its own arrival. |
| 471 | 2.5 | "she says quietly" | Dialogue-tag adverb (scanner agrees). | Cut. |
| 471 | 1.10 | "what do you intend to do with that knowledge?" | Repeats the narrator's question at 459. | Keep one. |
| 479 | 3.7-S | "As if summoned by your thoughts" | Stock phrase. | Cut. |
| 488 | 2.5 | "you say firmly" | Dialogue-tag adverb. | Cut. |
| 490 | 3.7-S | "Exposing it would only bring chaos." | Stock warning; no consequence named. | Name the consequence she fears. |
| 497 | 2.33 | "seemingly from nowhere" | Second "seemingly from nowhere" (scanner agrees). | Cut "seemingly". |
| 497 | 1.10 | "Mrs. Gable explains: the Whisperwind ATM appeared ..." | The reveal is given a second time in summary (also 523). | Give new facts each time, or one reveal. |
| 499 | 2.35 / 2.36 | "a place of peace and prosperity" | Puffery. | Name one use of the money. |
| 508 | 3.7-S | "to your amazement" / "crisp hundred-dollar bills" | Told reaction and stock "crisp"; dollars do not fit the English-village voice ("dearie", roses, council). | One real detail of the notes. |
| 523 | 2.38 | "Over the coming months" | Time-skip filler. | Show one task. |
| 523 | 2.35 | "allowing the village to thrive while maintaining its peaceful character" | Brochure puffery. | Cut. |
| 523 | 3.7-E | "you learn the true history" | Announced; the history is never given. | Give one fact of it, or cut. |
| 525 | 2.37 / 1.28 | "you help maintain the balance, ensuring the ATM's gifts are used wisely" | "the balance" (also 128, 221, 490) and "the flow" are never named; trailing participle interprets. | Name the balance once. |
| 525 | 1.29 / 2.31 | "You've found not just a home in Riverbend, but a purpose." | "Not only ... but" plus ending cliché (scanner gave 1.4). | End on a specific act. |
| 535 | 1.24 / 1.10 | "some secrets should remain just that - secrets" | Aphorism; repeats 204. | Name what Elara decides. |
| 537 | 2.36 | "peaceful and idyllic" / "this tranquil village" | Brochure words (scanner agrees). | Cut. |
| 537 | 2.2 | "the subtle undercurrent that sustains" | Vague interiority. | Name what Elara now sees. |
| 537 | 2.31 | "you fancy you can hear it speaking of ancient mysteries and hidden gifts" | Stock closing line. | End on a concrete thing. |
| 544 | 3.7-S | "The pool's surface shimmers with impossible colors." | Stock magic description. | Name one colour or effect. |
| 544 | 1.14 | "You feel drawn to it" | Attraction as physics (scanner agrees). | A decision by Elara. |
| 544 | 3.7-D | "as if it were a window to another place entirely" | Simile for an object that is a real portal; ornament only. | Cut. |
| 77, 258, 290, 343, 384 | 1.26 | "the dilapidated structure", "the structure", "the empty structure", "this ancient structure", "this ancient building" | Rotating descriptors for the mill. | "the mill". |

### Scanner hits rejected

| line | rule id | reason |
|---|---|---|
| 82 | 1.1 | "Wait until they leave, then investigate." The order is the content of the choice. |
| 89 | 1.1 | "Wait a moment, then follow them in." The order is the content of the choice. |
| 187 | 1.1 | "Wait until they're gone, then examine the stone." The order is the content of the choice. |
| 366 | 1.27 | "from the entrance to a spot behind the old grinding stones" is literal direction, not a false range. |

Scanner hit at 525 accepted under 1.29 (not 1.4). All other scanner hits accepted (14, 16, 69, 87, 87, 146, 154, 171, 229, 358, 360, 469, 471, 497, 537, 544).

### Strengths

- 42: "She snips a deadhead." A real gardening action that shows her dismissal.
- 77: "even the birds seem to avoid perching on its broken eaves" A specific sign, not a mood word.
- 238: "...Mrs. Gable says the output has been declining..." An overheard fragment with real information.
- 249: "A few people suddenly remember urgent appointments and hurry away." Evasion shown by action, with humour.
- 303: "the floor has been swept clean in places, and there are fresh oil stains near some of the gears." A clue the reader can use.

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
# No-clichés review, group 5: TOC, Burrow's End, World Between Worlds, Ukrainian, Maple Hollow, Skydock, Mudslide Mines

Method: rubric `.claude/skills/nocliches-fink-authoring/SKILL.md`, guide Parts 1-3. I read every line of each file.
Prose-line counts are the scanner's counts (`nocliches-scan.txt`), so the densities can be compared with other groups.
Grade = mean of five scores, minus 0.5 for each full 5 faults per 100 lines above 5, floored at 1.

Rule ids: guide numbers (1.x, 2.x), project additions (F1-F6), and "3.7-S / 3.7-I / 3.7-C / 3.7-D / 3.7-E" when a line fails
one of the final tests (Specificity, Interchangeability, Consequence, Decoration, Earned) and no numbered rule names the fault.

Authorship: this clone has a squashed history (one commit by Dan Brickley, 2026-09-01, for six of the seven files; the TOC has
later Claude commits for the Drift City rows). I cannot tell which lines the owner wrote. Some TOC lines read as the owner's
voice (lines 9, 26 second sentence, 58, 139); I score them like all others, as the rubric says.

None of these files is a platform fixture (F6). The TOC is navigation copy and is judged as that.

---

## inklet/toc.fink.js

- Prose lines: 132 (scanner). Faults: 19. Faults per 100 prose lines: 14.4.
- Scores:
  - Specificity 3: about half of the episode blurbs are generic ("Collect gems, solve puzzles, and escape!"); the Drift City, Waterworld and Skydock blurbs are specific.
  - Interchangeability 3: the "Features X, Y and Z" formula appears three times and could describe any game.
  - Consequence 4: most menu copy says honestly what a row opens; the Help page promises help that the page then says does not exist.
  - Decoration 3: "constellation", "shimmering", "chocolate-box-perfect" ornament without information.
  - Earned 3: "classic" twice, "serves as a hub connecting all FINK adventures" (it links five of eight episodes).
  - Mean 3.2; density 14.4 is 9.4 above 5, one full 5 → minus 0.5. **Grade 2.7.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 26 | 3.7-S | "Choose your adventure!" | Stock opener for any game menu; the next sentence ("half-finished in a different way") is the real line | Keep the second sentence alone, or name what the reader picks between |
| 54 | 2.36 | "Get help with using the FINK system, understanding controls, and troubleshooting common issues." | Help-page brochure copy; line 58 says nothing is documented yet, so it promises what is not there | Say what this page actually holds (two links and test stories) |
| 69-70 | 3.7-D | "a constellation of interactive fiction" | Metaphor decorates; "a set of" or a count says more | Give the count and the hub's job |
| 70 | 2.14 | "AI models finding their footing" | Stock grounding idiom; the list after the colon already says the subject | Cut the idiom; let the list carry it |
| 86 | 2.35 | "A nod to the classic 1982 text adventures." | "classic" asserts status; first of two uses | Name the game or the feature it borrows |
| 86 | 2.36 | "Features inventory tracking, conversation gating, and state management." | Developer feature list in a reader-facing blurb | Move to the dev guide, or say what the reader does (carry food, talk your way past) |
| 97 | 3.7-S | "Awaken in a shimmering underground cavern. Collect gems, solve puzzles, and escape!" | Generic dungeon blurb; verb triple (1.6) with no detail of this cave | Name one thing only this cave has |
| 97 | 2.36 | "Features minigame integration and multi-chapter story progression." | Second "Features" list | Same as line 86 |
| 117 | 2.33 | "Navigate the challenging social dynamics of 1980s London." | Scanner hit, agreed: "navigate" (social) and "dynamics" are AI vocabulary | Name one social situation in the story |
| 117 | 2.35 | "inspired by the classic 80s game" | Second "classic"; the game is not named | Name the game, or cut "classic" |
| 150 | 2.36 | "Discover the secrets of a chocolate-box-perfect village" | Back-cover blurb opener plus a picturesque idiom | One concrete village detail and one concrete secret-shape |
| 150 | 1.3 / 2.16 | "a conspiracy of silence" | Stock phrase; silence as the actor | Say who keeps quiet about what |
| 161 | 2.36 | "reconnect with old flames, and find your way home. Warmth points track your journey." | Romance-blurb stock phrases in a triple; "journey" is filler | Say what happens and what the warmth score changes |
| 182 | 1.10 | "Command your wizard flock ... Flocks of strange creatures await your command." | Second sentence repeats the first (command/command, flock/flocks); same sentence is reused in world-between-worlds line 123 | Keep one sentence; add what the flocks do |
| 245 | 2.35 | "serves as a hub connecting all FINK adventures" | "serves as" puffery; "all" is not true (the hub links five episodes) | Name the stories it links |
| 267 | 2.36 | "Features evidence chains, contradiction mechanics, fair-play clue system, and multiple layered endings." | Third "Features" list; "layered" again in line 269 | Keep for developers only, or say what the player does with evidence |
| 279 | 2.33 / 2.34 | "works-in-progress showcasing different gameplay mechanics and visual styles" | Scanner hit, agreed: "showcasing" | State what the links are |
| 279 | 1.10 | "A collection of experimental games, prototypes, and technical demonstrations. These are works-in-progress ..." | The second sentence says the first again | Keep one sentence |
| 328 | 2.36 | "for rapid prototyping and easy sharing" | Brochure reason; the reader needs where things are, not why | "Most are on CodePen; the rest are on this site." |

Scanner hits rejected: none (both hits, lines 117 and 279, agreed).

Notes outside the cliché rules (not counted): line 117 says "No images." and line 119 then sets an IMAGE tag. Lines 285, 313
and 323 escape the opening `**` but not the closing `**`, so the reader may see literal asterisks.
Choice labels are navigation ("Episodes", "enter Burrow's End"); F1 accepts that in a menu. Capitalisation is not
consistent ("enter" vs "Enter").

Strengths:
- 9: "Enter the Finkiverse. Everything isn't here yet." (honest, specific to this project)
- 26: "Each episode is half-finished in a different way."
- 108: "A city on Titan, under an orange sky. ... Each has its own narrator; only the city is shared."
- 128: "Gossip is the true fuel of the post-terrestrial economy. That and gemstones." (the second sentence undercuts the aphorism)
- 206: "dodge eels and rampant fatbergs, and follow the ghost whale to a pirate captain's chest."

---

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

## inklet/world-between-worlds.fink.js

- Prose lines: 87. Faults: 32. Faults per 100 prose lines: 36.8.
- Scores:
  - Specificity 2: the pools are described in stock fantasy terms, and each pool's description is said twice.
  - Interchangeability 2: six entry lines use one template ("The X [surrounds] you...").
  - Consequence 3: the hub routes correctly; "rest" and "drift" end where they began, but the text says otherwise.
  - Decoration 2: whispering leaves, beckoning shadows, glowing and shimmering everywhere (glow 5, shimmer 4).
  - Earned 3: "spend eternity", "where will you be?" are announced, not built.
  - Mean 2.4; density 36.8 is 31.8 above 5, six full 5s → minus 3.0; floored. **Grade 1.0.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 16 | 1.13 / F2 | "A vast, quiet wood stretches in all directions." | Opens on landscape before the reader acts; the first line is all many readers see | Start with what the reader is doing or notices first |
| 16 | 3.7-D | "ancient beyond measure, their leaves whispering secrets in a language older than words" | Stock personification; "secrets" recurs at 150 | One plain observed detail of the trees |
| 20 | 2.27 | "glows with warm light; distant green hills shimmer within" | Light wallpaper | What is seen in the pool, plainly |
| 21 | 2.27 | "stone walls and shadows beckon" | "shadows play/beckon" wallpaper | Name what is in the shadows |
| 20-25 | 1.31 / 1.6 | six lines "The [adj] pool [verbs] with X; Y [verbs]." | One sentence shape six times | Vary the syntax or cut to the distinguishing detail |
| 25 | 2.27 | "pulses with arcade lights and pixel glow" | Glow as wallpaper | Name one game seen in it |
| 27-32 | 1.26 / F1 | [Approach] [Peer into] [Examine] [Study] [Look into] [Approach] | Elegant variation: six verbs for one action | Use one verb, or let the pool's name do the work |
| 39 | 1.10 | "The golden pool shows rolling green hills ... Smoke rises from a chimney." | Repeats line 20 and the smoke of line 23 | Give only the new detail (the wizard at the door) |
| 42 | 3.7-I | "The warm light envelops you..." | Stock transition, first of six on one template | One transition line per world that names something of that world |
| 53 | 3.7-I | "The darkness swallows you..." | Same template | As line 42 |
| 61 | 1.10 / 3.7-S | "a grand but crumbling manor house. Ravens circle its chimneys." | Repeats line 22's ravens; "grand but crumbling" is stock gothic | Keep the one new detail (the lit window) |
| 64 | 3.7-I | "The mist closes around you..." | Same template | As line 42 |
| 71 | 2.36 | "a cozy village nestled in autumn woods" | Scanner hit, agreed: "nestled" is figurative brochure; "cozy" is told | Show what makes it cosy (the cat is a start) |
| 71 | 1.10 | "Smoke rises from cottages." | Third smoke line (23, 39) | Cut |
| 74 | 3.7-I | "Warmth surrounds you..." | Same template | As line 42 |
| 81 | 1.10 | "a wide river winding through marshland" | Repeats line 24 | Keep herons and the boat only |
| 84 | 3.7-I | "The current takes you..." | Same template | As line 42 |
| 91 | 2.27 | "pulses with neon light. Pixelated shapes dance across its surface" | Neon as wallpaper; repeats line 25 | Keep the list of ghosts, gems, creatures |
| 94 | 3.7-I | "The pixels swirl around you..." | Same template (sixth) | As line 42 |
| 102 | 2.27 / 2.2 | "a glowing space ... Each one hums with potential adventure." | Vague; "hums with potential" says nothing | Name one cabinet |
| 113 | 3.7-S | "Gems scatter before you, waiting to be collected..." | Stock; "waiting" is the first of four await/waiting uses | Say what the game is |
| 118 | 3.7-S | "The cave entrance yawns before you..." | Stock cave verb | As line 113 |
| 123 | 3.7-S | "Flocks of strange creatures await your command..." | Stock; same sentence as toc line 182 | Say what the flocks are or do |
| 128 | 3.7-S | "The maze materializes around you..." | Stock | As line 113 |
| 137 | 2.27 | "the glow of games surrounding you" | Glow wallpaper | Cut, or one concrete sound/sight |
| 150 | 3.7-E | "The quiet wood holds more secrets than just the pools." | Promises secrets; the knot then offers only Inventory | Say what is here (an inventory) |
| 157 | 1.3 / 2.16 | "The quiet is absolute." | Silence as an actor | What does the reader hear or not hear? |
| 157 | 2.17 | "Time moves differently here - or perhaps not at all." | Time-stretch cliché, hedged | Cut, or show it (a leaf that does not fall) |
| 159 | 2.2 / 1.12 | "you sense that each pool connects to a different world, a different story" | Vague interiority, then narration about the story mechanism | Cut; the reader already knows from line 18 |
| 159 | 1.25 | "You could spend eternity exploring them all." | Epic tone for a rest choice | Cut |
| 168 | 3.7-E | "When you open them again, where will you be?" | Rhetorical question; the only answer is the same glade | Make the question true (a different pool comes forward) or cut |
| 197 | 2.31 / 3.7-S | "Your pockets are empty. Adventures await!" | Stock cheer; fourth "await/waiting" | Point to where items come from |

Scanner hits rejected: none (one hit, line 71, agreed).

Note: 14 trailing ellipses in 87 prose lines; most of them end a stock transition (F4: they count as one pattern).

Strengths:
- 18: "pools - perfectly still, perfectly round, each reflecting a different sky." (from the Lewis source, and it does work)
- 50: "The distant clang of pickaxes echoes from somewhere deep below."
- 81: "Herons stand motionless. A small boat is tied to a dock."
- 133: "One cabinet stands apart, dripping. The screen shows green water and old brick — a drowned dock, waiting."
- 144: "The pirate captain's chest sits by the flooded cabinet, still dripping dock water. {waterworld_treasure} points of drowned London history"

---

## inklet/tml-2025-langlearn.fink.js (Ukrainian language learning)

- Prose lines: 100. Faults: 8. Faults per 100 prose lines: 8.0.
- Scores:
  - Specificity 4: the teaching content is exact (words, case forms, endings); only the opener and the praise are generic.
  - Interchangeability 3: the feedback interjections ("Nope!" four times, "Oops!", "Not quite!") could come from any quiz.
  - Consequence 3: the praise and the "finished" message do not depend on what the reader did.
  - Decoration 5: no ornament.
  - Earned 3: "Awesome!", "Great job!", "Well done!" are given whatever the score.
  - Mean 3.6; density 8.0 is 3.0 above 5, no full 5 → no penalty. **Grade 3.6.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 8 | 3.7-I | "Welcome to your Ukrainian Food Words tutorial! Let's learn a few basics. Ready?" | Stock tutorial opener | Say what the reader will be able to do after (order bread, say "I eat cheese") |
| 33, 37, 41, 88, 98, 135 | 3.7-I (accumulation) | "Oops!" "Not quite!" "Nope!" x4 | Stock interjections; the useful part is the correction after them | Lead with the correction |
| 147 | 3.7-E | "Awesome! Now that you know some food words" | Shown after wrong answers too | Use `correct_answers` to vary it, or drop the praise |
| 237 | 3.7-E | "✅ Great job!" | Shown whatever the case answers were | As line 147 |
| 256 | 3.7-E | "🎉 Well done! You finished" | Shown at 0 correct | Make it conditional on the score |
| 259 | 3.7-S | "Keep practicing and soon you'll be ready for more cases" | Stock encouragement | Name the next lesson or cut |
| 264 | 1.10 | "You've finished this brief Ukrainian food vocabulary tutorial." | Repeats line 256 straight after it | Keep "До побачення! (Goodbye!)" only |
| 264 | 3.7-C | same line, reached from "Not right now." (line 12) | A reader who declined at the start is told they finished | Separate goodbye for the decline path |

Scanner hits: none.

Note outside the cliché rules (not counted): line 163 teaches "Яблуко зелене" (green), the recap at line 242 shows "Яблуко велике" (big).

Strengths:
- 67: "\"Борщ\" is a beet soup, not a dairy product."
- 187: "\"Хліб\" remains the same in the accusative case (masculine inanimate nouns often do)."
- 225: "Feminine nouns ending in \"-а\" often change to \"-у\" in the accusative case."
- 229: "That’s the nominative form. In this sentence, we need the accusative: \"ковбасу\"."
- 233: "\"Ковбасою\" is instrumental case — not used here."

---

## cozyverse/maple-hollow.fink.js (Maple Hollow: Aslan Rising)

- Prose lines: 150. Faults: 86. Faults per 100 prose lines: 57.3.
- Scores:
  - Specificity 2: a few exact lines (the clock five minutes slow, stress-baking, a surprised ghost); most beats are stock small-town romance.
  - Interchangeability 1: every romantic tell is the stock one (eyes meet twice, hands brush, fingers find, fingers intertwine, twinkle, face softens).
  - Consequence 3: `warmth` gates text and choices, but the endings announce the change in aphorisms.
  - Decoration 1: 13 Narnia-style epigraphs sit between beats in a story with no fantasy element; several are not Lewis quotes.
  - Earned 1: the endings are the guide's own examples ("And that is enough", "A beginning, not an ending", "I'm finally home").
  - Mean 1.6; density 57.3 → minus 5.0; floored. **Grade 1.0.**

The story is in third person ("Emma") with second-person imperative choice labels; the house mode is second person present (F3).
The title says "Aslan Rising"; Aslan appears only in the epigraphs.

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 15 | 2.37 | "brakes with a familiar screech" | Scanner hit, agreed; line 17 already does this job specifically | Cut "familiar" |
| 19 | 3.7-S | "Not since Jake." | Stock backstory tease | One fact about what happened |
| 23 | 2.1 / F3 | [Step onto the platform, heart pounding] | Scanner hit, agreed: stock tell in a choice label | Name what the reader does |
| 25 | 2.1 / 1.2 / 1.1 | "The cold bites—then something else catches her breath—" | Breath catches; "something" unnamed; "then" choreography | Say what she sees |
| 38 | 1.7 | "And there he is." | Stock reveal; repeated at line 83 | Start with Jake doing something |
| 40 | 2.21 | "Their eyes meet." | Stock; again at line 266 | What does each one do next? |
| 42 | 1.25 / 2.17 | "Three years collapse into nothing." | Epic time cliché | Show one thing from three years ago |
| 44 | 3.7-D | "\"Courage, dear heart,\" Aslan whispers through the snow." | Lewis quote (Dawn Treader) as a voice in a realist scene; decoration (first of 13 epigraphs) | Cut the epigraphs, or make Aslan a real element |
| 46 | F1 | [Walk toward him—let the past be past] | Stock phrase in label | Name the action only |
| 48 | 3.7-I | "Her feet move before her mind does." | Stock | Cut |
| 48 | 2.6 / 2.25 | "His guarded face softens." | Gaze word plus transition verb | What does his face do? |
| 49 | 1.21 | "Just her name. But the way he says it." | The way is claimed, never shown | Describe the way |
| 52 | 1.24 | "Some wounds outlast three years." | Poster aphorism | Cut, or name the wound |
| 54 | F1 | [A snowball catches Jake in the chest] | Label is an event, not something the reader does | Name the reader's action |
| 62 | 2.37 | "the old rhythm returning" | Familiarity word; scanner missed it | Name the rhythm (who walks on which side) |
| 66 | 2.1 | "He clears his throat." | Stock tell (mild) | Cut |
| 68 | 1.24 | "— In Narnia, the ice always melts eventually." | Invented aphorism, not a Lewis quote I can match | Cut |
| 75 | 1.25 | "She does want. That's the terrifying part." | Stock romance line | Say what she fears |
| 79 | 2.25 | "His face flickers—disappointment? Understanding?" | Transition verb, emotion unresolved | What does he do? |
| 81 | F1 | [The truck radio crackles to life] | Event as label; stock phrase | Reader's action ("Turn on the radio") |
| 83 | 1.7 / 3.7-S | "And there it is. *Their* song, from that summer." | Repeats line 38's pattern; the song and summer are never named | Name the song or one fact about that summer |
| 94 | 1.24 / 2.29 | "— \"There is nothing like a cup of tea—or fresh bread—to set the world right.\"" | Invented epigraph; tea as filler | Cut |
| 96 | 2.10 | "The kitchen's warmth seeps into her bones." | Temperature as emotion | Cut; line 92 does the work |
| 101 | 1.21 | "Her mother's knowing smile says everything." | Guide's own example | What does the mother say? |
| 105 | 1.24 | "Some conversations go easier with busy hands." | Aphorism | Show the conversation |
| 107 | F1 | [Accidentally knock over the flour] | Choosing an accident | "Reach for the bowl" |
| 117 | 3.7-E | "She barely recognizes her old neighbor." | She names her at once in the same line | Cut, or show the slow recognition |
| 119 | 3.7-I | "The town's been waiting. *Someone* especially." | Stock coy hint | Say who |
| 121 | 3.7-D | "— \"Aslan is on the move.\"" | Real Lewis quote as decoration (2 of 13) | Cut |
| 127 | 2.1 | "Her eyes twinkle." | Stock; same as bagend line 256 | A gesture of Grandma June's own |
| 127 | 1.24 | "Some hearts don't forget, even when heads try." | Aphorism | Cut |
| 130 | F1 | [Return to the platform—too much, too fast] | Stock phrase; repeated at 175 | Name the action |
| 137 | 3.7-S | "Lily's grown into a hurricane. ... all gangly limbs and unstoppable enthusiasm." | Stock metaphor and stock teen description | One thing Lily does |
| 141 | 3.7-I | "trying to look annoyed and failing" | Stock | What does he do? |
| 143 | 1.24 | "— \"Even the smallest person can change the course of the future.\"" | A Tolkien film line inside a Narnia frame | Cut |
| 153 | F1 | [Grandma June appears with perfect timing] | Event as label | Reader's action |
| 161 | 3.7-S | "The square transforms under a hundred hands." | Stock | Keep the sawdust line, cut this |
| 169 | 3.7-D | "— \"Once a King or Queen of Narnia, always a King or Queen.\"" | Real quote as decoration (5 of 13) | Cut |
| 171 | 3.7-I | [Let their hands brush reaching for the same light] | Stock romance beat; "Let" makes it passive | Name what Emma does |
| 173 | 3.7-I | "Neither pulls away." | Stock | Show what they do instead |
| 175 | F1 | [Step back—this is moving too fast] | Second "too fast" (130) | Name the action |
| 178 | F1 / 1.1 | [The lights flicker, then blaze golden] | Scanner hit, agreed: event as label, "then" choreography | Reader's action |
| 179 | 2.2 / 1.2 | "Something *happens*—a warmth with nothing to do with the cold." | Vague interiority | Say what she notices |
| 179 | 2.27 | "The lights glow from within." | Light wallpaper | Cut |
| 187 | 3.7-S | "drifts from somewhere—a radio, a phone, someone humming—" | The narrator does not know its own scene; contradicts the truck-radio route | Pick one source |
| 189 | 1.5 | "\*That\* song." | Fragment for effect; third unnamed reference | Name it |
| 195 | 1.24 | "— \"You have listened to fears, child. Now hear the truth.\"" | Epigraph I cannot match to Lewis | Cut |
| 197 | 1.3 / 2.16 | "wrapping them in white silence" | Silence as actor | Cut |
| 199 | F1 | [Hum along—let the memory live] | Stock phrase in label | "Hum along" |
| 201 | 1.1 | "Their voices blend, hesitant, then sure." | Scanner hit, agreed: stock arc | What do they sing? |
| 208 | 3.7-I | "Her fingers find his." | Stock (the next sentence is good) | Keep "Cold skin, warm grip." |
| 216 | 1.28 | "Her mother laughs—deep, healing—" | "healing" interprets the laugh | Describe the laugh |
| 218 | 1.10 | "\"Some things never change, Emma Rose.\"" | Echoes line 96 "This, at least, hasn't changed." | Cut one |
| 220 | 3.7-D | "— \"Laugh and fear not, dear heart.\"" | Adapted Lewis line as decoration | Cut |
| 224 | 3.7-S | "The kitchen descends into beautiful chaos." | Stock phrase | One thing that happens in the fight |
| 226 | F1 / 3.7-C | [The flour war spills outside] | Event label; the result has Lily charge IN, not the fight going out | Make label and result agree |
| 229 | F1 | [Grandma June arrives for a taste test] | Event as label | Reader's action |
| 236 | 3.7-S | "Like clockwork." | Stock idiom (mild); the quoted question before it is good | Cut |
| 242 | 3.7-D | "— \"You would not have called to me unless I had been calling to you.\"" | Real quote (Silver Chair) as decoration | Cut |
| 248 | F1 | [Stay and process this] | Therapy register in a label | Name the action |
| 249 | 2.4 / 2.29 / 1.5 | "She needs a moment. A cup of tea." | Beat placeholder, tea filler, fragments | What does she do? |
| 249 | 2.2 | "The world just tilted." | Vague interiority | Cut |
| 255 | 2.2 | "but something else is happening" | Vague; the next line says what | Cut the clause |
| 257 | 2.16 | "The crowd falls silent." | Stock (mild) | Who reacts how? |
| 261 | 3.7-I | "Of course he is." | Stock | Cut |
| 263 | 3.7-D | "— \"I am the great Bridge Builder. I call you across.\"" | Real quote as decoration | Cut |
| 266 | 2.21 / 3.7-D | "Their eyes meet in the impossible light." | Second "eyes meet" (40); "impossible light" ornament | What does Jake do? |
| 267-268 | 1.10 | "\"Emma, I never stopped—\" \"I know.\" ... \"I know.\"" | Stock exchange with a doubled line | A line only these two would say |
| 271 | 2.27 | "The lights paint their faces gold and green." | Light wallpaper; "paint" again at 316 | Cut |
| 273 | 1.4 / 2.31 | "A beginning, not an ending." | Not X but Y; ending cliché | Cut |
| 276-277 | 1.24 / 2.31 | "Some journeys home take longer than others. And that's okay." | Aphorism plus ending cliché | End on an action |
| 280 | 1.24 | "— \"Welcome home, dear heart. Welcome home.\"" | Invented epigraph, doubled | Cut |
| 282 | 1.12 | [Take his hand—write the next chapter together] | Story mechanics in a label | "Take his hand" |
| 284 | 1.12 / F1 | [Smile at the lights—savor this moment] | "this moment" is mechanics talk | "Watch the lights" |
| 286 | 3.7-C | [Start a new path from here] | It restarts the story at the train; the label does not say so | "Start again" |
| 292 | 3.7-I | "Their fingers intertwine beneath the aurora." | Stock | Cut, or a specific gesture |
| 294 | 1.4 | "\"Stay,\" Jake says. Not a question. A wish." | Not X, Y | Cut the second half |
| 296 | 2.31 | "\"I'm home,\" Emma answers. \"I'm finally home.\"" | Ending cliché in dialogue (allowed in speech, flagged) | Something only Emma would say |
| 298 | 1.24 | "— \"All shall be well. ...\"" | Julian of Norwich, not Lewis, inside the Aslan frame | Cut |
| 300 | 2.1 / 1.28 | "Grandma June dabs her eyes. ... watches her daughter finally stop running." | Stock tell; the narrator interprets the ending | Show what the mother does |
| 302 | 2.27 | "The lights of Maple Hollow burn bright against the winter sky." | Wallpaper last line | End on a person |
| 316 | 3.7-S / 2.27 | "the aurora paint the sky, surrounded by the town that raised her" | Stock phrase; "paint" again | One named person beside her |
| 318 | 1.5 | "For conversations not yet had. For wounds not yet healed. For love not yet spoken." | Three fragments for effect | Name one conversation |
| 320 | 1.24 | "— \"There are no accidents. All is meant.\"" | Epigraph I cannot match to Lewis | Cut |
| 322 | 2.31 | "But tonight she is home. And that is enough." | The guide's own ending example | End on an action |
| whole file | F3 | third person "Emma" with imperative labels | Not the house mode; labels and prose disagree on who the reader is | Choose one person throughout |

Scanner hits rejected (as the rule the scanner gave):
- 139 (2.4 "Finally!"): dialogue exclamation, not a transition. The line is good.
- 296 (2.4 "finally home"): not a transition; I flag the line as 2.31 instead.
- 300 (2.4 "finally stop running"): not a transition; I flag the line as 2.1 / 1.28 instead.

Accepted scanner hits: 15, 23, 178, 201.

Epigraph check: of the 13 epigraph lines, five match Lewis as far as I can tell (44, 121, 169, 242, 263), one is adapted (220,
"Laugh and fear not, creatures"), one is Tolkien film dialogue (143), one is Julian of Norwich (298), and five I cannot match
(68, 94, 195, 280, 320). The owner should check these before the story credits them to Aslan.

Strengths:
- 17: "the same clock above the station door, still five minutes slow."
- 31: "She used to catch them with him, counting the points, making wishes."
- 124: "Your mother's been stress-baking for a week."
- 214: "Emma stands at the epicenter, a very surprised ghost."
- 236: "'Heard anything from Emma?' Like clockwork." (the quoted question, not the idiom)

---

## inklet/skydock.fink.js (Skydock Scuttlebutt)

- Prose lines: 34. Faults: 5. Faults per 100 prose lines: 14.7.
- Scores:
  - Specificity 5: the lines belong to this station (THE JOVIAL NEWT, bread for beer, gems that were STAMPED).
  - Interchangeability 4: the veterans have one voice between them, but it is a particular voice.
  - Consequence 4: trades and diamonds change what the veterans say; the route home is promised, not reached (it is a frame).
  - Decoration 4: one wallpaper line at the close.
  - Earned 4: "The room goes quiet" announces weight the diamonds already carry.
  - Mean 4.2. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.2.**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 33 | 1.4 | "That's not a rumour, that's ECONOMICS." | Not X, Y; in dialogue, where the guide allows it if the speaker would say it (flagged, mild) | Keep if it is this veteran's joke |
| 50 | 2.29 | "The veterans look up from their tea." | Tea as filler (mild) | A mess-hall object of this station |
| 58 | 2.16 | "The room goes quiet." | Stock reaction | Who does what when the diamonds land? |
| 72 | 2.27 | "The skydock hums on without you." | "the city hummed" wallpaper | Cut, or a specific station sound |
| 72 | 1.10 | "Somewhere below, a manor keeps its own hours; somewhere further, the whispers keep doing the rounds." | Mirrored halves; the second repeats line 18's "doing the rounds" | Keep the manor half |

Considered and not counted: line 16 "Gossip is the true fuel of ..." is the shape of a poster aphorism (1.24), but the next
sentence undercuts it and it is the story's premise. Line 62 "A start." is a veteran rating progress, not an ending cliché.
Scanner hits: none.

Strengths:
- 29: "Jacked straight into somebody's dreams. Dreams of PLACES. Old places. Earth places."
- 31: "Half the shop orders never go home — they go over the Newt's counter for a pint. That trade is older than the station."
- 35: "they say the gems in those were never mined. They were STAMPED."
- 55: "Bread for beer, and no terminal takes a cut."
- 59: "\"That,\" says the oldest veteran, \"is ticket-shaped.\" She slides one back to you."

---

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
# Group 6: demos and fixtures. Cliché review

Rubric: .claude/skills/nocliches-fink-authoring/SKILL.md. Grade = mean of five scores, minus 0.5 for each full 5 faults per 100 prose lines above 5, floor 1.
Prose-line counts are the scanner's counts. Rule "3.1" is the guide's accumulation test (the same default used again and again). "3.7-S/D/C/E" is a fault found by the final test of that name (Specificity, Decoration, Consequence, Earned) that has no narrower rule id.
Authorship: the git history in this clone is shallow. I could not find who wrote these lines. All fix directions are proposals for the owner. I changed no file.
Small-file note: in a file with fewer than 10 prose lines, one fault gives a density above 10 per 100. The accumulation penalty is then large. Read those grades with this fact in mind.

---

## Demo content

## inklet/demos/diamond-cave.fink.js
- Prose lines: 156. Faults: 28. Faults per 100 prose lines: 17.9.
- Scores:
  - Specificity 2: Most of the cave text (awaken in a cavern, something stirs, realm of pure energy, peaceful valley) can go into a different cave story with no change.
  - Interchangeability 2: The two tells (heart pounding, exhale with relief) belong to any character.
  - Consequence 3: The gem count changes the state, but the "stirring" threat and the highlighted number do not cause anything.
  - Decoration 2: Eight sparkle and light words and seven trailing ellipses decorate. They give the reader no new information.
  - Earned 2: The narration announces excitement with 17 lines that use "!", and it says "Excellent work!". The text does not build to these moments.
- Grade: mean 2.2, density 17.9 (2 full steps of 5 above 5, minus 1.0) = **1.2**

| line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| 16 | 2.27 | "Crystals gleam in the darkness, casting prismatic light across damp stone walls" | Light wallpaper in the first beat, before the reader does anything (F2) | Start on what the reader touches or needs. Make the light do one thing for the reader, or cut it |
| 18 | 1.5 | "No gems, no keys, nothing." | A three-part fragment for rhythm. It repeats the sentence before it | Keep "Your pockets are empty." and cut the fragment |
| 29 | 1.25 | "The gem-studded alcove beckons - your only hope of escape." | Epic tone for a menu reminder. "beckons" is stock | Say plainly what is still to do |
| 36 | 3.1 | "An alcove filled with glittering gems" | Sparkle-word accumulation (8 in the file: 16 x2, 36, 69, 111, 156, 172, 181) | Give the gems one specific property (colour, size, how they sit in the rock) and use it again |
| 47 | 1.25 | "Your voice echoes endlessly." | Overstatement. Nothing in the cave is endless | Give the echo a size: how many times it comes back, or how long it takes |
| 49 | 1.2 | "Something stirs in the darkness. Perhaps silence would have been wiser." | The guide flags "something" when the writer does not name the thing. Here the second sentence is a stock narrator aside | Give a sound or a movement that the reader can identify. Cut the aside |
| 55 | 2.1 | "heart pounding" | Stock physical tell in second person (F3) | Show what the reader does while hiding, or cut it |
| 57 | 2.31 | "Whatever it was has moved on... for now." | A stock "for now" threat. The threat does not come back. In the other branch (62) the same stirring is only a bat | Make the two branches agree, or let the threat come back |
| 64 | 2.1 | "You exhale with relief." | A tell that also names the emotion | Cut it. "Just a bat." already carries the relief |
| 69 | 3.1 | "The alcove sparkles with countless gems embedded in the walls!" | Sparkle accumulation, "countless", and a "!" in narration | Name how many gems the reader can reach, or what is difficult about them |
| 84 | 2.4 | "You focus your attention on the gem-studded walls..." | A trailing ellipsis as a beat placeholder (7 prose instances: 57, 84, 145, 172, 181, 225, 237) | End on an action |
| 94 | 3.7-S | "Excellent work!" | Generic praise from the narrator. It fits any game | Report what the reader now holds. Line 94 already does this after the praise |
| 98 | 1.10 | "you NEED them to escape!" | The goal is said again. Lines 20, 75, 107, 130, 134 and 145 also say it | Say it once, at the inscription. Then use a different reminder |
| 111 | 3.1 | "They glow brilliantly!" | Sparkle accumulation | Use one concrete reaction of the door, for example a sound or a click |
| 119 | 3.7-D | "It feels warm in your hand." | A stock detail for a magic object. Nothing comes of it | Cut it, or let the warmth matter later |
| 127 | 3.7-C | "Curiously, the number {diamonds} seems highlighted." | A set-up with no result. "Curiously" and "seems" make it weaker | Remove it, or let the symbols count something the reader uses |
| 130 | 1.24 | "Beyond lies the key to freedom." | A poster phrase and a pun ("key"), inside a stock inscription | Make the inscription a plain instruction in the cave's own counting system |
| 134 | 1.10 | "You definitely need to collect more gems from the alcove." | It repeats the inscription in the line above | Cut it |
| 137 | F1 | "[Understood.]" | A menu acknowledgment. It does not name what the reader does | Name the action, for example going back to the gems |
| 156 | 2.27 | "daylight streaming in from above!" | Stock light phrase with "!" | Say what the reader sees through the door |
| 162 | 2.36 | "a hillside overlooking a peaceful valley" | Brochure scenery | Give one detail of this place that is not in other places |
| 172 | 1.7 | "But wait... ... Legends speak of MEGA DIAMONDS worth 1000x more!" | "But wait" is an advert opener, with an ellipsis and a stock "Legends speak of" | Show the portal. Let the score figure carry the incentive |
| 181 | 1.25 | "a realm of pure crystalline energy..." | Epic fantasy tone with no content | Say one thing that the reader sees or feels on the other side |
| 225 | 2.25 | "A TV on the wall flickers to life..." | A stock transition verb phrase | Say what is on the screen |
| 229 | 1.28 | "The surreal glitch effect disorients you." | The narrator tells the reader's reaction and labels the effect | Describe the glitch. Let the reader be disoriented |
| 237 | 3.7-S | "Flames consume the old mill..." | A stock phrase | Name one specific thing that is on fire |
| 241 | 3.7-E | "The heat is unbearable." | Told, not shown, and nothing follows from it | Show what the heat does to the reader, or cut it |
| 313 | 3.7-D | "deep ominous rumble" | "ominous" tells the mood of a sound test | Describe the sound only |

- Scanner hits that I agree with: 49 (1.2, under the guide's "something" trigger) and 55 (2.1).
- Scanner hits that I rejected: 35 and 142 (1.19 "iron door"). The iron door is a literal material of a literal door. It is not a texture metaphor.
- Strengths:
  - 307 "Fire crackling to your left... machinery throbbing to your right." This line tells the listener where to hear each layer, so it does a job.
  - 62 "A bat swoops past your head and disappears into the darkness." This is a concrete event.
  - 269 "Queen moves first. The king tries to escape or capture. There's a forced win!" These are the rules, stated plainly.
  - 142 "The passage ends at a locked iron door. The lock looks complex." This is plain and it gives information.

## inklet/demos/audio-demo.fink.js
- Prose lines: 31. Faults: 3. Faults per 100 prose lines: 9.7.
- Scores:
  - Specificity 4: Most lines name exact mechanisms (BASEHREF, gain node, AudioContext). Two lines are slogans.
  - Interchangeability 5: The demo has no characters, so there are no tells.
  - Consequence 5: Each knot changes what the reader hears.
  - Decoration 4: One vague image ("instead of fighting").
  - Earned 4: The slogan lines announce a point that the explanation then makes.
- Grade: mean 4.4. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.4.**

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
- Grade: mean 4.0. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.0.**

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
- Grade: mean 2.4. Under 40 prose lines: no density deduction (skill, step 3). **Grade 2.4.**

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
- Grade: mean 4.8. Under 40 prose lines: no density deduction (skill, step 3). **Grade 4.8.**

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

## Fixtures (F6: not counted in the project score)

| file | prose lines | faults | per 100 | Spec | Interch | Conseq | Decor | Earned | mean | penalty | grade |
|---|---|---|---|---|---|---|---|---|---|---|---|
| inklet/apps/storyrunner/demo.fink.js | 25 | 3 | 12.0 | 4 | 5 | 5 | 4 | 4 | 4.4 | 0 | 4.4 |
| inklet/apps/storyrunner/peer.fink.js | 6 | 2 | 33.3 | 4 | 5 | 5 | 3 | 4 | 4.2 | 0 | 4.2 |
| inklet/apps/storyrunner/beside.fink.js | 9 | 1 | 11.1 | 5 | 5 | 5 | 4 | 5 | 4.8 | 0 | 4.8 |
| inklet/apps/storyrunner/annex.fink.js | 8 | 2 | 25.0 | 4 | 5 | 5 | 5 | 4 | 4.6 | 0 | 4.6 |
| inklet/apps/storyrunner/annexclash.fink.js | 2 | 0 | 0 | 5 | 5 | 5 | 5 | 5 | 5.0 | 0 | 5.0 |
| inklet/apps/storyrunner/dream.fink.js | 6 | 1 | 16.7 | 4 | 5 | 5 | 4 | 5 | 4.6 | 0 | 4.6 |
| inklet/demos/dream-inner.fink.js | 3 | 1 | 33.3 | 5 | 5 | 5 | 4 | 4 | 4.6 | 0 | 4.6 |
| inklet/demos/dream-outer.fink.js | 7 | 2 | 28.6 | 4 | 5 | 5 | 4 | 4 | 4.4 | 0 | 4.4 |
| inklet/validation/tests/test-variables.fink.js | 29 | 2 | 6.9 | 3 | 4 | 4 | 5 | 4 | 4.0 | 0 | 4.0 |

Reasons for the scores below 5:
- demo: Specificity 4, because "taste of somewhere older" is vague. Decoration 4 and Earned 4, because "For one long minute, the film is everything" announces an effect.
- peer: Decoration 3, because "hums with old light" decorates. Specificity 4 and Earned 4, because "a different dock, a different tale" is a slogan.
- beside: Decoration 4, because "into somewhere the chart does not admit to" is vague.
- annex: Specificity 4, because the object on the sill has no name. Earned 4, because "not here a moment ago" repeats the demo's door line.
- dream: Specificity 4 and Decoration 4, because "The dock dissolves. You are somewhere older" is a stock dream transition.
- dream-inner: Decoration 4 and Earned 4, because "The dream thins." is the third "thins" in this group.
- dream-outer: Specificity 4, because "drift down" is stock. Decoration 4 and Earned 4, because of the fragment joke at line 18.
- test-variables: Specificity 3, because the compliments are generic. Interchangeability 4. Consequence 4, because line 37 says you put the outfit on, but no variable records it.

| file:line | rule id | quoted text | why it fails here | direction for a fix |
|---|---|---|---|---|
| demo:27 | 2.17 | "For one long minute, the film is everything." | Time-stretch stock phrase and epic tone | Say what the film shows |
| demo:74 | 1.10 | "The shaft is still the shaft." | A tautology that adds nothing. Line 60 also has "only a door after all" | Cut it, or show one changed detail |
| demo:117 | 3.1 | "with the taste of somewhere older" | "somewhere" accumulation (demo 97, 117; beside 36; dream 20) and "the taste of" (also dream-outer 14) | Bring back one concrete thing from the dream |
| peer:26 | 1.5 | "a different dock, a different tale." | A slogan fragment | Show one detail that makes the dock different |
| peer:35 | 3.7-D | "The arcade hums with old light." | "hums" again (demo 97, and the "humming doorway" label used three times) and "old light" is vague | Name the arcade's light source |
| beside:36 | 3.1 | "into somewhere the chart does not admit to" | "somewhere" accumulation | Say what the margin note leads to |
| annex:22 | 1.10 | "The annex was not here a moment ago." | It echoes demo:52 "The door was not there a moment ago" | Keep one of the two lines |
| annex:25 | 1.2 | "Something small and bright is on the sill." | "something" with no name. The object is a diamond | Name it |
| dream:20 | 3.1 | "The dock dissolves. You are somewhere older" | Stock dream transition, and "somewhere" accumulation | Use one strange concrete detail. Line 20 already has one: "light comes from under the floor" |
| dream-inner:10 | 3.1 | "The dream thins." | "thins" accumulation | Use a plain end line |
| dream-outer:13 | 3.1 | "You drift down into the dream." | "drift down" is also in foafos-tour:22 | Use a different verb, or a concrete action |
| dream-outer:18 | 1.5 | "Morning. The kettle is real. Probably." | Fragment rhythm for a joke, and a domestic filler object (2.29) | Use one sentence |
| test-variables:37 | 3.7-S | "You look much more presentable now!" | Generic praise | Say what changed |
| test-variables:51 | 3.7-S | "The {clothes_description} suits you perfectly!" | A generic compliment | Same as above |

- Scanner hits that I rejected: demo:37 and demo:89 (2.4 "[Close your eyes for a moment]"). This label names the reader's own action, and the moment is a real dream, so F1 is satisfied.
- Not cliché faults, but visible defects that I saw (structure, for the fink skill):
  - test-variables: lines 12, 20, 28, 36, 44, 50 and 56 have "IMAGE:" with no "#". The reader sees this text as prose.
  - test-variables: the choice labels at 23, 39 and 40 show "~ has_clothes = true" (and similar) as label text. They do not set the variable.
  - dev-worldpools: choices 21-25 and the "Step into" choices have no brackets, so ink prints each label again after the choice.
- Fixture strengths:
  - demo:21 "You come to in a flooded lift shaft. Water to your knees, a torch on a hook."
  - beside:40 "Seven fathoms at the mouth, three at the steps. Someone has written a number in the margin and circled it twice."
  - beside:45 "The chart folds along creases that were already there."
  - dream:25 "Coins, or scales. You cannot tell, and the counting does not hold: {diamonds}."
  - dream-inner:6 "Everything is paper here. The birds are cut from timetables."

---

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
