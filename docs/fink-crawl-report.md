# FINK Crawl Report

Generated: 2026-01-16T17:40:17.805Z

**Source:** local
**Start:** `inklet/toc.fink.js`

## Summary

| Total | OK | Failed |
|-------|----|---------|
| 9 | 9 | 0 |

## Related Documentation

- [Hampstead Story Graph Analysis](./hampstead-story-graph-analysis.md) - Design analysis of hub structure and cross-episode links
- [3D Map Ideas](./3dmap-idea.md) - Visual/spatial representation concepts

## toc.fink.js

**Knots:** 17 | **Choices:** 28 | **Islands:** 14

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `episodes_menu`
- `minigames_menu`
- `hobbit_selected`
- `bagend2_selected`
- `load_bagend2`
- `hampstead_selected`
- `mudslidemines_selected`
- `riverbend_selected`
- `maple_hollow_selected`
- `ukrainian_selected`
- `dev_guide_selected`
- `shane_manor_selected`
- `experiments_selected`
- `external_story`

### Knot Connectivity

```
main_menu -> episodes_menu, minigames_menu, help_menu
episodes_menu -> hobbit_selected, hampstead_selected, maple_hollow_selected, mudslidemines_selected, riverbend_selected
minigames_menu -> ukrainian_selected, bagend2_selected
help_menu -> shane_manor_selected, experiments_selected
hobbit_selected -> load_bagend
load_bagend -> main_menu
bagend2_selected -> load_bagend
load_bagend2 -> main_menu
hampstead_selected -> load_bagend
mudslidemines_selected -> load_bagend
riverbend_selected -> load_bagend
maple_hollow_selected -> load_bagend
ukrainian_selected -> load_bagend
shane_manor_selected -> load_bagend
experiments_selected -> help_menu
external_story -> main_menu
```

## bagend.fink.js

**Knots:** 16 | **Choices:** 36 | **Islands:** 11

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `Kitchen`
- `Green_Dragon`
- `Troll_Clearing_Dawn`
- `Troll_Cave`
- `Troll_Cave_Explored`
- `return_to_trolls`
- `Victorious_Return`
- `The_Adventure_Begins`
- `Peaceful_Retirement`
- `Talk_To_Gandalf`
- `Talk_To_Thorin`

### Knot Connectivity

```
Bag_End -> Talk_To_Gandalf, Outside_Bag_End, Kitchen
Outside_Bag_End -> Bag_End, Hobbiton_Village, Trollshaws
Kitchen -> Peaceful_Retirement, Bag_End
Hobbiton_Village -> Outside_Bag_End, Green_Dragon, Trollshaws
Green_Dragon -> Hobbiton_Village
Trollshaws -> Hobbiton_Village, Troll_Cave, Troll_Clearing
Troll_Clearing -> Trollshaws
Troll_Clearing_Dawn -> Trollshaws, Troll_Cave
Troll_Cave -> Trollshaws
Troll_Cave_Explored -> Troll_Clearing, Victorious_Return
return_to_trolls -> Trollshaws
Victorious_Return -> The_Adventure_Begins, Peaceful_Retirement
Talk_To_Gandalf -> Bag_End
```

## bagend2.fink.js

**Knots:** 16 | **Choices:** 36 | **Islands:** 11

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `Kitchen`
- `Green_Dragon`
- `Troll_Clearing_Dawn`
- `Troll_Cave`
- `Troll_Cave_Explored`
- `return_to_trolls`
- `Victorious_Return`
- `The_Adventure_Begins`
- `Peaceful_Retirement`
- `Talk_To_Gandalf`
- `Talk_To_Thorin`

### Knot Connectivity

```
Bag_End -> Talk_To_Gandalf, Outside_Bag_End, Kitchen
Outside_Bag_End -> Bag_End, Hobbiton_Village, Trollshaws
Kitchen -> Talk_To_Thorin, Bag_End
Hobbiton_Village -> Outside_Bag_End, Green_Dragon, Trollshaws
Green_Dragon -> Hobbiton_Village
Trollshaws -> Hobbiton_Village, Troll_Cave, Troll_Clearing
Troll_Clearing -> Trollshaws
Troll_Clearing_Dawn -> Trollshaws, Troll_Cave
Troll_Cave -> Trollshaws
Troll_Cave_Explored -> Troll_Clearing
return_to_trolls -> Trollshaws
Victorious_Return -> The_Adventure_Begins, Peaceful_Retirement
Talk_To_Gandalf -> Bag_End
```

## hampstead.fink.js

**Knots:** 37 | **Choices:** 83 | **Islands:** 30

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `intro`
- `wardrobe`
- `postoffice`
- `giro_fraud_video`
- `fraud_aftermath`
- `street_shameful`
- `mansion_tip`
- `mansion`
- `car`
- `estate`
- `housewarming`
- `fraud_ending`
- `victory`
- `diamond_pawn`
- `jail`
- `diamond_pub_attempt`
- `diamond_gallery_exhibit`
- `diamond_opening`
- `one_week_later`
- `artist_confrontation`
- `artist_challenge`
- `artist_reveal`
- `world_between_worlds`
- `pool_bagend`
- `pool_mines`
- `pool_manor`
- `pool_maple`
- `pool_riverbend`
- `world_rest`
- `world_end`

### Knot Connectivity

```
splash -> intro
bedsit -> wardrobe
wardrobe -> bedsit
street -> jobcentre, oxfam, pub, gallery_pass
jobcentre -> street
postoffice -> street
giro_fraud_video -> fraud_aftermath
street_shameful -> jobcentre, oxfam, pub, gallery_pass
oxfam -> street
pub -> street
gallery_pass -> street
mansion_tip -> mansion, street
mansion -> street
car -> jobcentre, oxfam, pub, gallery_pass
estate -> street
housewarming -> jobcentre, oxfam, pub, gallery_pass
diamond_pub_attempt -> jobcentre, oxfam, pub, gallery_pass
diamond_gallery_exhibit -> diamond_opening
diamond_opening -> one_week_later
one_week_later -> artist_confrontation
world_between_worlds -> world_rest
world_rest -> world_end
```

## mudslidemines.fink.js

**Knots:** 12 | **Choices:** 23 | **Islands:** 3

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `Waterfall_Base`
- `Hidden_Shrine`
- `Ancient_Vault`

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

**Knots:** 16 | **Choices:** 17 | **Islands:** 15

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `settle_in`
- `peaceful_life`
- `follow_whispers`
- `eavesdrop`
- `mill_direct`
- `main_door`
- `enter_mill`
- `search_mill`
- `metal_door`
- `look_for_clues`
- `roman_numerals`
- `correct_code`
- `use_atm`
- `join_guardians`
- `keep_secret`

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

**Knots:** 13 | **Choices:** 29 | **Islands:** 12

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `spot_jake`
- `walk_together`
- `go_to_bakery`
- `stranger_kindness`
- `lily_ambush`
- `festival_prep`
- `song_returns`
- `flour_disaster`
- `ask_about_jake`
- `lights_of_rising`
- `ending_love`
- `ending_hope`

### Knot Connectivity

```
festival_prep -> song_returns
lights_of_rising -> ending_hope, train_arrives
```

## tml-2025-langlearn.fink.js

**Knots:** 35 | **Choices:** 98 | **Islands:** 34

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `bread_question`
- `correct_bread`
- `wrong_bread_1`
- `wrong_bread_2`
- `wrong_bread_3`
- `dairy_question`
- `dairy_correct_milk`
- `dairy_correct_cheese`
- `dairy_wrong_borscht`
- `dairy_wrong_bread`
- `match_question`
- `match_borscht`
- `match_varenyky`
- `match_sausage`
- `fruit_question`
- `fruit_correct`
- `fruit_wrong_cheese`
- `fruit_wrong_bread`
- `fruit_wrong_milk`
- `grammar_intro`
- `grammar_case_example`
- `case_practice_bread`
- `case_bread_correct`
- `case_bread_wrong`
- `case_practice_cheese`
- `case_cheese_correct`
- `case_cheese_wrong`
- `case_practice_sausage`
- `sausage_correct`
- `sausage_wrong_nominative`
- `sausage_wrong_instrumental`
- `grammar_review`
- `tutorial_complete`
- `end`

### Knot Connectivity

```
start -> bread_question
bread_question -> correct_bread, wrong_bread_1, wrong_bread_2, wrong_bread_3
correct_bread -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
wrong_bread_1 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
wrong_bread_2 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
wrong_bread_3 -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
dairy_question -> dairy_correct_milk, dairy_correct_cheese, dairy_wrong_borscht, dairy_wrong_bread
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
grammar_case_example -> case_bread_correct, case_bread_wrong
case_practice_bread -> case_bread_correct, case_bread_wrong
case_bread_correct -> case_cheese_correct, case_cheese_wrong
case_bread_wrong -> case_cheese_correct, case_cheese_wrong
case_practice_cheese -> case_cheese_correct, case_cheese_wrong
case_cheese_correct -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
case_cheese_wrong -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
case_practice_sausage -> sausage_wrong_nominative, sausage_correct, sausage_wrong_instrumental
```

## shane-manor.fink.js

**Knots:** 35 | **Choices:** 51 | **Islands:** 34

### Islands (External Entry Points)

These knots have no incoming edges - likely cross-episode links:

- `test_chess_position`
- `test_character_confrontation`
- `test_multiple_endings`
- `meet_butler`
- `investigation_choice`
- `crime_scene`
- `examine_safe`
- `examine_chess`
- `examine_footprints`
- `chess_minigame`
- `chess_aftermath`
- `charles_chess_evidence`
- `victoria_chess_evidence`
- `chess_forensics`
- `chess_records`
- `chess_realization`
- `interview_mary`
- `gather_household`
- `household_confrontation`
- `deduction`
- `accuse_charles`
- `outside_theory`
- `time_up`
- `resolution`
- `accuse_victoria`
- `accuse_mrs_pemberton`
- `accuse_ashford`
- `conspiracy_theory`
- `resolution_charles`
- `resolution_victoria`
- `resolution_mrs_pemberton`
- `resolution_ashford`
- `resolution_conspiracy`
- `partial_resolution`

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

