# Maple Hollow: 86 faults (57.3 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`cozyverse/maple-hollow.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/cozyverse/maple-hollow.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/cozyverse/maple-hollow.fink.js)

**Result:** 86 faults; 57.3 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

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

