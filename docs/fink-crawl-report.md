# FINK Crawl Report

Generated: 2026-01-16T16:56:32.321Z

**Method:** inkjs runtime with knot signature matching

## Summary

| Total | OK | Failed |
|-------|----|---------|
| 9 | 9 | 0 |

## toc.fink.js

**Knots:** 17 | **Choices:** 28

### Knot Connectivity

```
main_menu -> episodes_menu, minigames_menu, help_menu
episodes_menu -> hobbit_selected, hampstead_selected, maple_hollow_selected, mudslidemines_selected, riverbend_selected
minigames_menu -> ukrainian_selected, bagend2_selected
help_menu -> shane_manor_selected, experiments_selected
hobbit_selected -> load_bagend, load_bagend2, external_story
load_bagend -> main_menu
bagend2_selected -> load_bagend, load_bagend2, external_story
load_bagend2 -> main_menu
hampstead_selected -> load_bagend, load_bagend2, external_story
mudslidemines_selected -> load_bagend, load_bagend2, external_story
riverbend_selected -> load_bagend, load_bagend2, external_story
maple_hollow_selected -> load_bagend, load_bagend2, external_story
ukrainian_selected -> load_bagend, load_bagend2, external_story
shane_manor_selected -> load_bagend, load_bagend2, external_story
experiments_selected -> help_menu
external_story -> main_menu
```

## bagend.fink.js

**Knots:** 16 | **Choices:** 36

### Knot Connectivity

```
Bag_End -> Talk_To_Gandalf, Outside_Bag_End, Kitchen
Outside_Bag_End -> Bag_End, Hobbiton_Village, Trollshaws
Kitchen -> Peaceful_Retirement, Bag_End
Hobbiton_Village -> Outside_Bag_End, Green_Dragon, Trollshaws
Green_Dragon -> Hobbiton_Village
Trollshaws -> Hobbiton_Village, Troll_Cave, Troll_Clearing, return_to_trolls
Troll_Clearing -> Trollshaws
Troll_Clearing_Dawn -> Trollshaws, Troll_Cave
Troll_Cave -> Trollshaws
Troll_Cave_Explored -> Troll_Clearing, return_to_trolls, Victorious_Return
return_to_trolls -> Trollshaws
Victorious_Return -> The_Adventure_Begins, Peaceful_Retirement
Talk_To_Gandalf -> Bag_End
```

## bagend2.fink.js

**Knots:** 16 | **Choices:** 36

### Knot Connectivity

```
Bag_End -> Talk_To_Gandalf, Outside_Bag_End, Kitchen
Outside_Bag_End -> Bag_End, Hobbiton_Village, Trollshaws
Kitchen -> Talk_To_Thorin, Bag_End
Hobbiton_Village -> Outside_Bag_End, Green_Dragon, Trollshaws
Green_Dragon -> Hobbiton_Village
Trollshaws -> Hobbiton_Village, Troll_Cave, Troll_Clearing, return_to_trolls
Troll_Clearing -> Trollshaws
Troll_Clearing_Dawn -> Trollshaws, Troll_Cave
Troll_Cave -> Trollshaws
Troll_Cave_Explored -> Troll_Clearing, return_to_trolls
return_to_trolls -> Trollshaws
Victorious_Return -> The_Adventure_Begins, Peaceful_Retirement
Talk_To_Gandalf -> Bag_End
```

## hampstead.fink.js

**Knots:** 37 | **Choices:** 83

### Knot Connectivity

```
splash -> intro
intro -> bedsit
bedsit -> wardrobe, street, street_shameful, car, housewarming, diamond_pub_attempt
wardrobe -> bedsit
street -> jobcentre, oxfam, pub, gallery_pass, street_shameful, car, housewarming, diamond_pub_attempt
jobcentre -> street, street_shameful, car, housewarming, diamond_pub_attempt
postoffice -> street, street_shameful, car, housewarming, diamond_pub_attempt
giro_fraud_video -> fraud_aftermath
street_shameful -> jobcentre, oxfam, pub, gallery_pass, street, car, housewarming, diamond_pub_attempt
oxfam -> street, street_shameful, car, housewarming, diamond_pub_attempt
pub -> street, street_shameful, car, housewarming, diamond_pub_attempt
gallery_pass -> mansion_tip, street, street_shameful, car, housewarming, diamond_pub_attempt
mansion_tip -> mansion, street, street_shameful, car, housewarming, diamond_pub_attempt
mansion -> street, street_shameful, car, housewarming, diamond_pub_attempt
car -> jobcentre, oxfam, pub, gallery_pass, street, street_shameful, housewarming, diamond_pub_attempt
estate -> street, street_shameful, car, housewarming, diamond_pub_attempt
housewarming -> jobcentre, oxfam, pub, gallery_pass, street, street_shameful, car, diamond_pub_attempt
diamond_pub_attempt -> jobcentre, oxfam, pub, gallery_pass, street, street_shameful, car, housewarming
diamond_gallery_exhibit -> diamond_opening
diamond_opening -> one_week_later
one_week_later -> artist_confrontation
artist_reveal -> world_between_worlds
world_between_worlds -> world_rest
pool_bagend -> world_between_worlds
pool_mines -> world_between_worlds
pool_manor -> world_between_worlds
pool_maple -> world_between_worlds
pool_riverbend -> world_between_worlds
world_rest -> world_between_worlds, world_end
```

## mudslidemines.fink.js

**Knots:** 12 | **Choices:** 23

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

## riverbend.fink.js

**Knots:** 16 | **Choices:** 17

### Knot Connectivity

```
intro -> follow_whispers, settle_in
settle_in -> peaceful_life, intro
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
```

## maple-hollow.fink.js

**Knots:** 13 | **Choices:** 29

### Knot Connectivity

```
walk_together -> song_returns
festival_prep -> song_returns
lights_of_rising -> ending_hope, train_arrives
```

## tml-2025-langlearn.fink.js

**Knots:** 35 | **Choices:** 98

### Knot Connectivity

```
start -> bread_question
bread_question -> correct_bread, wrong_bread_1, wrong_bread_2, wrong_bread_3, dairy_question
correct_bread -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread, match_question, match_borscht
wrong_bread_1 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread, match_question, match_borscht
wrong_bread_2 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread, match_question, match_borscht
wrong_bread_3 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread, match_question, match_borscht
dairy_question -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread, match_question, match_borscht
dairy_correct_milk -> match_varenyky
dairy_correct_cheese -> match_varenyky
dairy_wrong_borscht -> match_varenyky
dairy_wrong_bread -> match_varenyky
match_question -> match_varenyky
match_borscht -> match_varenyky
match_varenyky -> match_sausage
match_sausage -> fruit_question
fruit_question -> fruit_correct, fruit_wrong_cheese, fruit_wrong_bread, fruit_wrong_milk
fruit_correct -> grammar_case_example
fruit_wrong_cheese -> grammar_case_example
fruit_wrong_bread -> grammar_case_example
fruit_wrong_milk -> grammar_case_example
grammar_intro -> grammar_case_example
grammar_case_example -> case_bread_correct, case_bread_wrong, case_practice_cheese
case_practice_bread -> case_bread_correct, case_bread_wrong, case_practice_cheese
case_bread_correct -> case_cheese_correct, case_cheese_wrong, case_practice_sausage
case_bread_wrong -> case_cheese_correct, case_cheese_wrong, case_practice_sausage
case_practice_cheese -> case_cheese_correct, case_cheese_wrong, case_practice_sausage
case_cheese_correct -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
case_cheese_wrong -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
case_practice_sausage -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
```

## shane-manor.fink.js

**Knots:** 35 | **Choices:** 51

### Knot Connectivity

```
test_chess_position -> chess_minigame, chess_forensics, chess_records
test_character_confrontation -> conspiracy_theory, outside_theory
test_multiple_endings -> conspiracy_theory, outside_theory
crime_scene -> examine_safe, examine_chess, examine_footprints
examine_safe -> conspiracy_theory, outside_theory
examine_chess -> chess_minigame, chess_forensics, chess_records
examine_footprints -> conspiracy_theory, outside_theory
chess_minigame -> accuse_charles, conspiracy_theory, outside_theory
chess_aftermath -> conspiracy_theory, outside_theory
charles_chess_evidence -> conspiracy_theory, outside_theory
victoria_chess_evidence -> conspiracy_theory, outside_theory
chess_forensics -> accuse_charles, conspiracy_theory, outside_theory
chess_records -> accuse_victoria, conspiracy_theory, outside_theory
chess_realization -> conspiracy_theory, outside_theory
gather_household -> conspiracy_theory, outside_theory
household_confrontation -> conspiracy_theory, outside_theory
deduction -> conspiracy_theory, outside_theory
```

