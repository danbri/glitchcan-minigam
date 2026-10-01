# test fixtures (low priority, rule F6): 14 faults

Part of the October 2026 prose review: [summary](../nocliches-review-20261001.md), issue #883.

**Files:**
- [`inklet/apps/storyrunner/*.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/apps/storyrunner/*.fink.js)
- [`inklet/demos/dream-inner.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/dream-inner.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/dream-inner.fink.js)
- [`inklet/demos/dream-outer.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/demos/dream-outer.fink.js) · [play it](https://danbri.github.io/glitchcan-minigam/inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/dream-outer.fink.js)
- [`inklet/validation/tests/test-variables.fink.js`](https://github.com/danbri/glitchcan-minigam/blob/master/inklet/validation/tests/test-variables.fink.js)

**Result:** 14 faults in short test files (each under 40 prose lines).

These files test platform mechanisms (rule F6), so they are not in the project score. Fix them only if a fixture is shown to readers.

**Materials:**
- [the skill (rubric)](https://github.com/danbri/glitchcan-minigam/blob/master/.claude/skills/nocliches-fink-authoring/SKILL.md)
- [the full report](https://github.com/danbri/glitchcan-minigam/blob/master/docs/nocliches-review-20261001.md)

## The review (line numbers as of commit 4fadf5b)

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

