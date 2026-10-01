# Diamond Cave (demo): 28 faults (17.9 per 100 lines)

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/demos/diamond-cave.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/diamond-cave.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/diamond-cave.fink.js)

**Result:** 28 faults; 17.9 faults per 100 prose lines.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

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

