# Shane Manor (and the _tmp copy): 110 faults (28.7 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/shane-manor.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/shane-manor.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/shane-manor.fink.js)
- [`inklet/_tmp_shane-manor.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/_tmp_shane-manor.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/_tmp_shane-manor.fink.js)

**Result:** 110 faults; 28.7 faults per 100 prose lines.

**Decision for the owner:** `inklet/_tmp_shane-manor.fink.js` is a near-copy of `shane-manor.fink.js` (see its section below). Keep it or delete it before anyone fixes both.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

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

<details><summary>Patterns across the files in this review group</summary>

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

</details>

