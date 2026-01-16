# FINK Crawl Report

Generated: 2026-01-16T16:26:43.058Z

## Summary

| Total | OK | Failed | Not Found |
|-------|----|---------|-----------|
| 9 | 9 | 0 | 0 |

## toc.fink.js

**Path:** `inklet/toc.fink.js`  
**Status:** OK  
**Knots:** 17 | **Choices:** 23

### External FINK Links
- `../bagend.fink.js`
- `../bagend2.fink.js`
- `../hampstead.fink.js`
- `../mudslidemines.fink.js`
- `../riverbend.fink.js`
- `../../cozyverse/maple-hollow.fink.js`
- `../tml-2025-langlearn.fink.js`
- `../shane-manor.fink.js`

### Knot Connectivity

```
main_menu -> episodes_menu, minigames_menu, help_menu
episodes_menu -> hobbit_selected, hampstead_selected, maple_hollow_selected, mudslidemines_selected, riverbend_selected
minigames_menu -> ukrainian_selected, bagend2_selected
help_menu -> dev_guide_selected, shane_manor_selected, experiments_selected
hobbit_selected -> load_bagend
load_bagend -> external_story
bagend2_selected -> load_bagend2
load_bagend2 -> external_story
hampstead_selected -> external_story
mudslidemines_selected -> external_story
riverbend_selected -> external_story
maple_hollow_selected -> external_story
ukrainian_selected -> external_story
dev_guide_selected (terminal)
shane_manor_selected -> external_story
experiments_selected -> help_menu
external_story -> main_menu
```

---

## bagend.fink.js

**Path:** `inklet/bagend.fink.js`  
**Status:** OK  
**Knots:** 16 | **Choices:** 23

### Knot Connectivity

```
Bag_End -> Talk_To_Gandalf, Outside_Bag_End, Kitchen
Outside_Bag_End -> Bag_End, Hobbiton_Village, Trollshaws
Kitchen -> Talk_To_Thorin, Bag_End, Kitchen
Hobbiton_Village -> Outside_Bag_End, Green_Dragon, Trollshaws
Green_Dragon -> Hobbiton_Village, Green_Dragon
Trollshaws -> Hobbiton_Village, Troll_Cave, Troll_Clearing
Troll_Clearing -> Trollshaws, Troll_Clearing_Dawn
Troll_Clearing_Dawn -> Trollshaws, Troll_Cave, Troll_Clearing_Dawn
Troll_Cave -> Trollshaws, Troll_Cave_Explored
Troll_Cave_Explored -> Victorious_Return, return_to_trolls
return_to_trolls -> Troll_Clearing_Dawn, Troll_Clearing
Victorious_Return -> The_Adventure_Begins, Peaceful_Retirement
The_Adventure_Begins (terminal)
Peaceful_Retirement (terminal)
Talk_To_Gandalf -> Bag_End
Talk_To_Thorin -> Kitchen
```

---

## bagend2.fink.js

**Path:** `inklet/bagend2.fink.js`  
**Status:** OK  
**Knots:** 0 | **Choices:** 0

---

## hampstead.fink.js

**Path:** `inklet/hampstead.fink.js`  
**Status:** OK  
**Knots:** 37 | **Choices:** 1

### External FINK Links
- `bagend.fink.js`
- `mudslidemines.fink.js`
- `shane-manor.fink.js`
- `../cozyverse/maple-hollow.fink.js`
- `riverbend.fink.js`

### Knot Connectivity

```
splash (terminal)
intro -> bedsit
bedsit -> street
wardrobe -> wardrobe
street -> street
jobcentre -> postoffice
postoffice -> street, giro_fraud_video
giro_fraud_video -> fraud_aftermath
fraud_aftermath -> street_shameful
street_shameful -> street
oxfam -> oxfam
pub -> pub, diamond_pub_attempt
gallery_pass -> mansion_tip, gallery_pass, diamond_gallery_exhibit
mansion_tip (terminal)
mansion -> car
car -> street
estate -> housewarming
housewarming -> fraud_ending, victory, street
fraud_ending (terminal)
victory (terminal)
diamond_pawn -> jail
jail (terminal)
diamond_pub_attempt -> street
diamond_gallery_exhibit (terminal)
diamond_opening (terminal)
one_week_later (terminal)
artist_confrontation -> artist_challenge
artist_challenge -> artist_reveal
artist_reveal (terminal)
world_between_worlds (terminal)
pool_bagend (terminal)
pool_mines (terminal)
pool_manor (terminal)
pool_maple (terminal)
pool_riverbend (terminal)
world_rest (terminal)
world_end (terminal)
```

---

## mudslidemines.fink.js

**Path:** `inklet/mudslidemines.fink.js`  
**Status:** OK  
**Knots:** 12 | **Choices:** 22

### Knot Connectivity

```
Crash_Site_Clearing -> Overgrown_Path, Dark_Cave
Overgrown_Path -> Crash_Site_Clearing, Snake_Pit, Control_Room
Snake_Pit -> Overgrown_Path, Ancient_Grove
Dark_Cave -> Crash_Site_Clearing, Waterfall_Base
Control_Room -> Overgrown_Path, River_Ledge
Ancient_Grove -> Snake_Pit, Hidden_Shrine
Waterfall_Base -> Dark_Cave
River_Ledge -> Control_Room, River_Crossing
Hidden_Shrine -> Ancient_Grove
River_Crossing -> River_Ledge, Far_Shore
Far_Shore -> River_Crossing, Ancient_Vault
Ancient_Vault -> Far_Shore
```

---

## shane-manor.fink.js

**Path:** `inklet/shane-manor.fink.js`  
**Status:** OK  
**Knots:** 35 | **Choices:** 9

### Knot Connectivity

```
test_chess_position -> examine_chess
test_character_confrontation -> household_confrontation
test_multiple_endings -> deduction
start -> meet_butler
meet_butler -> investigation_choice
investigation_choice -> crime_scene, interview_mary, gather_household
crime_scene -> examine_safe, examine_chess, examine_footprints
examine_safe -> deduction
examine_chess (terminal)
examine_footprints -> deduction
chess_minigame -> chess_aftermath
chess_aftermath -> chess_realization, charles_chess_evidence, victoria_chess_evidence
charles_chess_evidence -> deduction
victoria_chess_evidence -> deduction
chess_forensics -> chess_realization
chess_records -> chess_realization
chess_realization -> deduction
interview_mary -> deduction
gather_household -> household_confrontation
household_confrontation -> deduction
deduction -> accuse_victoria, accuse_charles, accuse_mrs_pemberton, accuse_ashford, conspiracy_theory, outside_theory, investigation_choice, time_up
accuse_charles -> resolution_charles
outside_theory -> partial_resolution
time_up (terminal)
resolution (terminal)
accuse_victoria -> resolution_victoria
accuse_mrs_pemberton -> resolution_mrs_pemberton
accuse_ashford -> resolution_ashford
conspiracy_theory -> resolution_conspiracy
resolution_charles (terminal)
resolution_victoria (terminal)
resolution_mrs_pemberton (terminal)
resolution_ashford (terminal)
resolution_conspiracy (terminal)
partial_resolution (terminal)
```

---

## maple-hollow.fink.js

**Path:** `cozyverse/maple-hollow.fink.js`  
**Status:** OK  
**Knots:** 13 | **Choices:** 0

### Knot Connectivity

```
train_arrives -> spot_jake, go_to_bakery, stranger_kindness
spot_jake -> walk_together, go_to_bakery, lily_ambush
walk_together -> festival_prep, go_to_bakery, song_returns
go_to_bakery -> ask_about_jake, festival_prep, flour_disaster
stranger_kindness -> go_to_bakery, lights_of_rising, train_arrives
lily_ambush -> festival_prep, go_to_bakery, lights_of_rising
festival_prep -> song_returns, lily_ambush, lights_of_rising
song_returns -> lights_of_rising, go_to_bakery
flour_disaster -> festival_prep, lily_ambush, lights_of_rising
ask_about_jake -> festival_prep, lights_of_rising
lights_of_rising -> ending_love, ending_hope, train_arrives
ending_love (terminal)
ending_hope (terminal)
```

---

## riverbend.fink.js

**Path:** `inklet/riverbend.fink.js`  
**Status:** OK  
**Knots:** 16 | **Choices:** 17

### Knot Connectivity

```
intro -> follow_whispers, settle_in
settle_in -> peaceful_life, intro
peaceful_life (terminal)
follow_whispers -> eavesdrop, mill_direct
eavesdrop -> mill_direct
mill_direct -> main_door
main_door -> enter_mill
enter_mill -> search_mill
search_mill -> metal_door
metal_door -> look_for_clues
look_for_clues -> roman_numerals
roman_numerals -> correct_code
correct_code -> use_atm
use_atm -> join_guardians, keep_secret
join_guardians (terminal)
keep_secret (terminal)
```

---

## tml-2025-langlearn.fink.js

**Path:** `inklet/tml-2025-langlearn.fink.js`  
**Status:** OK  
**Knots:** 35 | **Choices:** 0

### Knot Connectivity

```
start -> bread_question, end
bread_question -> correct_bread, wrong_bread_1, wrong_bread_2, wrong_bread_3
correct_bread -> dairy_question
wrong_bread_1 -> dairy_question
wrong_bread_2 -> dairy_question
wrong_bread_3 -> dairy_question
dairy_question -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
dairy_correct_milk -> match_question
dairy_correct_cheese -> match_question
dairy_wrong_borscht -> match_question
dairy_wrong_bread -> match_question
match_question -> match_borscht
match_borscht -> match_varenyky
match_varenyky -> match_sausage
match_sausage -> fruit_question
fruit_question -> fruit_correct, fruit_wrong_cheese, fruit_wrong_bread, fruit_wrong_milk
fruit_correct -> grammar_intro
fruit_wrong_cheese -> grammar_intro
fruit_wrong_bread -> grammar_intro
fruit_wrong_milk -> grammar_intro
grammar_intro -> grammar_case_example
grammar_case_example -> case_practice_bread
case_practice_bread -> case_bread_correct, case_bread_wrong
case_bread_correct -> case_practice_cheese
case_bread_wrong -> case_practice_cheese
case_practice_cheese -> case_cheese_correct, case_cheese_wrong
case_cheese_correct -> case_practice_sausage
case_cheese_wrong -> case_practice_sausage
case_practice_sausage -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
sausage_correct -> grammar_review
sausage_wrong_nominative -> grammar_review
sausage_wrong_instrumental -> grammar_review
grammar_review -> tutorial_complete
tutorial_complete -> end
end (terminal)
```

---

