# Riverbend: 101 faults (42 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/riverbend.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/riverbend.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/riverbend.fink.js)

**Result:** 101 faults; 42 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

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

