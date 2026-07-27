/* bagend.fink.js
   Merged from bagend v1 and v2.
   - Rich state tracking from v2
   - Nice dialogue preserved from v1
   - Fixed Troll_Clearing IMAGE tag placement
   - July 2026: the serial numbers filed off. The furniture is folklore —
     a cozy burrow, a wizard at the door, trolls caught by the dawn (that
     one is straight out of the Eddas) — but the NAMES were borrowed, and
     they've gone home. Filename kept so every # FINK: link still works.
*/

oooOO`
// ==== Burrow's End ====
// Start the player at the burrow; richer state via Ink variables & lists.
# BASEHREF: media/bagend/
# FINK RENDERHINT X-PAGED-BEATS
-> The_Burrow

// ===== Global variables =====
VAR troll_status = "alive"
VAR has_taken_food = false
VAR talked_to_wizard = false
VAR talked_to_dwarf = false
VAR visited_kitchen = false
VAR has_key = false
VAR has_sword = false
VAR has_map = false
VAR committed_to_adventure = false
VAR talked_to_innkeeper = false
VAR has_treasure = false

// Define possible inventory items, then start inventory empty.
LIST Inventory = cheese, bread, apples, key, sword, map
~ Inventory = ()

// ===== Knots =====

== The_Burrow ==

A comfortable burrow with a round green door. Yours. A tall wizard sits by your fire, smoking a pipe he was not offered.
# IMAGE: ../coverart/bagend_entrance_img_9445.jpeg
+ {not talked_to_wizard} [Talk to the Wizard] -> Talk_To_Wizard
+ [Leave through the front door] -> Outside_The_Burrow
+ [Go to the kitchen] -> Kitchen

== Outside_The_Burrow ==

# IMAGE: adventure_path.svg
The path outside your burrow. Green hills roll east toward the village; a rougher track runs north into the wild.
+ [Return inside] -> The_Burrow
+ [Go East to the village] -> Mossbottom_Village
+ [Go North into the wilderness] -> Troll_Woods

== Kitchen ==

# IMAGE: hobbit_pantry.svg
{visited_kitchen:
    Back in your kitchen. The Dwarf is still at your table, stroking his beard.
- else:
    A well-stocked kitchen: full pantries, a window on the garden — and a stern dwarf at your table, looking impatient.
}
~ visited_kitchen = true

+ {not talked_to_dwarf} [Talk to the Dwarf] -> Talk_To_Dwarf
+ [Return to the main room] -> The_Burrow
+ {not has_taken_food} [Take some food]
    Cheese, bread, apples — into your pockets. You suspect you'll be glad of them.
    ~ has_taken_food = true
    ~ Inventory += cheese
    ~ Inventory += bread
    ~ Inventory += apples
    -> Kitchen

== Mossbottom_Village ==

# IMAGE: gandalf_at_door.svg
Mossbottom bustles. Neighbours nod; a few stare. The Drowsy Dragon inn stands invitingly near.
+ [Return West to the burrow] -> Outside_The_Burrow
+ [Enter the Drowsy Dragon] -> Drowsy_Dragon
+ [Go North toward the wilderness] -> Troll_Woods

== Drowsy_Dragon ==

# IMAGE: green_dragon.svg
Inside: ale, stories, and a fire that has never once gone out. The innkeeper nods from behind the bar.

+ {not talked_to_innkeeper} [Talk to the innkeeper]
    "Off on an adventure, are you, Mr. Digweed?" The innkeeper winks.
    "News travels fast," you mutter.
    "That it does. Mind the trolls in the woods up north — trouble lately."
    ~ talked_to_innkeeper = true
    -> Drowsy_Dragon

{talked_to_innkeeper:
    The innkeeper polishes a mug and lets you be.
}

+ [Leave the inn] -> Mossbottom_Village

== Troll_Woods ==

# IMAGE: trollshaws.svg
The path darkens under old trees. Boulders everywhere. Grunting, somewhere ahead. A cave mouth gapes to the east.
+ [Go South back to the village] -> Mossbottom_Village

// Gate the cave until trolls are stone; offer a teasing approach otherwise.
+ {troll_status == "stone"} [Go East to the cave] -> Troll_Cave
+ {troll_status != "stone"} [Approach the cave]
    A few steps toward the cave, and the troll voices come closer. Not while they're still about.
    -> Troll_Woods

+ {troll_status != "stone"} [Investigate the noises] -> Troll_Clearing

== Troll_Clearing ==

// IMAGE tag MUST come first, before any conditional redirects
# IMAGE: troll_clearing.svg

// If trolls already stone, redirect to dawn scene
{troll_status == "stone":
    -> Troll_Clearing_Dawn
}

Three enormous trolls sit around a fire, arguing about how best to cook you. The sky is beginning to pale.
+ [Hide and wait]
    You slip behind a tree. The trolls argue on — until the first light of dawn strikes them. They freeze, appalled, and turn to stone.
    ~ troll_status = "stone"
    -> Troll_Clearing_Dawn
+ [Run back to the path] -> Troll_Woods

== Troll_Clearing_Dawn ==

# IMAGE: troll_statues.svg
Quiet now. Three troll statues in comical poses, frozen in sunlight.
{not has_key:
    Metal glints near the largest.
    + [Examine the gleam]
        A key — and a short sword that glows faint blue in your hand.
        ~ has_key = true
        ~ has_sword = true
        ~ Inventory += key
        ~ Inventory += sword
        -> Troll_Clearing_Dawn
- else:
    The trolls are silent. Nothing else of value here.
}
+ [Return to the path] -> Troll_Woods
+ [Go to the cave] -> Troll_Cave

== Troll_Cave ==

# IMAGE: troll_cave.svg
Dark, and it smells terrible. Bones on the floor. A chest in the corner.
{troll_status == "alive": No telling how many live here. Tread softly.}
+ [Open the chest]
    {troll_status == "stone" && has_key && not has_map:
        The key turns. Inside: gold coins, and a curious map marking a road to the Far Mountain. The adventure truly begins.
        ~ has_map = true
        ~ has_treasure = true
        ~ Inventory += map
    }
    {troll_status == "stone" && has_map:
        Open and empty now, save for dust.
    }
    {troll_status == "stone" && not has_key:
        Locked tight. It wants a key.
    }
    {troll_status == "alive":
        Locked — and the trolls sound close. Not now.
    }
    -> Troll_Cave_Explored
+ [Leave the cave] -> Troll_Woods

== Troll_Cave_Explored ==

# IMAGE: troll_cave.svg
{troll_status == "stone" && has_map:
    Treasure in your pockets, a map in your hand. Quite the burglar after all. The cave seems smaller now.
}
{troll_status == "stone" && not has_map:
    The chest stays shut. Perhaps you missed something back at the clearing.
}
{troll_status == "alive":
    Dangerous while the trolls are about. Leave quickly.
}
+ [Return to the trolls] -> return_to_trolls
+ {has_treasure} [Head home with your treasure] -> Victorious_Return

== return_to_trolls ==
{troll_status == "stone":
    -> Troll_Clearing_Dawn
- else:
    -> Troll_Clearing
}

== Victorious_Return ==

# IMAGE: bag_end_exterior.svg
You come home at sunset, pockets heavy with troll gold. The Wizard sits on your doorstep, smiling as if he knew.

"So," he says. "Still want no part in adventures?"

You pat your pocket and look to the horizon. "Perhaps... there are greater ones yet to come."

+ [Begin planning the journey to the Far Mountain]
    ~ committed_to_adventure = true
    -> The_Adventure_Begins
+ [Stay content with your small victory] -> Peaceful_Retirement

== The_Adventure_Begins ==

# IMAGE: adventure_path.svg
With the Wizard's guidance and the map in your hand, you set out. The road to the Far Mountain runs long, and strange.

Your career as a burglar has only begun...

Nearby, a pool shimmers like molten emerald. A fox eyes a pair of ducklings greedily. The water seems to reflect a different sky...

+ [Dive into the pool] -> portal_dive
+ [Continue on the road] -> END

== portal_dive ==
# BG:#020
The cool water closes over you. For a moment you cannot breathe, cannot think—

Then you surface in a place between all places.

# FINK: world-between-worlds.fink.js
-> END

== Peaceful_Retirement ==

# IMAGE: hobbit_pantry.svg
One adventure is quite enough for a respectable burrower. You hide the gold in the pantry and go back to your garden and your meals.

On clear evenings, you look toward the mountains and wonder what might have been...

+ [Settle into quiet contentment] -> END
+ [One evening, a strange pool appears in your garden...] -> portal_dive

== Talk_To_Wizard ==

# IMAGE: gandalf_at_door.svg
"My dear fellow," says the Wizard, "I am looking for someone to share in an adventure."

"No thank you!" you reply, rather fast. "No adventures. Not today."

"We shall see..." He puffs his pipe. There is a fresh scratch on your green door.

+ {not talked_to_wizard} [Ask about the mark on the door]
    "A burglar's mark," he says airily. "It means: good house to burgle."
    "BURGLE?!" you splutter. "This is a respectable household!"
    ~ talked_to_wizard = true
    -> The_Burrow
+ {not talked_to_wizard} [Ask about the adventure]
    "That's more like it." His eyes twinkle. "A dragon wants dealing with, and a treasure recovering. Perfectly straightforward."
    "A DRAGON?!" You nearly drop your tea.
    ~ talked_to_wizard = true
    -> The_Burrow
+ [Return to your comfortable armchair] -> The_Burrow
{talked_to_wizard:
    The Wizard simply smiles and returns to his pipe.
}

== Talk_To_Dwarf ==

# IMAGE: hobbit_pantry.svg
"Burglar?" The Dwarf looks you over. "You don't look like much of a thief."

"I'm not!" you protest. "I'm a respectable burrower!"

He strokes his magnificent beard. "Perhaps. But the Wizard says your people move quietly, and have quick fingers."

+ [Show you can be stealthy]
    You creep round your own kitchen and pocket a small cake without a sound.
    "Hm," the Dwarf admits. "Perhaps you'll do."
    ~ talked_to_dwarf = true
    -> Kitchen
+ [Insist you're not burglar material]
    "I pay my taxes, tend my garden, and have never had an adventure in my life!"
    "Exactly what we need," he says grimly. "Someone unexpected."
    ~ talked_to_dwarf = true
    -> Kitchen
+ [Ask about the treasure]
    His eyes gleam. "A hoard under the Far Mountain — gold beyond counting, and at its heart a gem beyond price. A dragon sleeps on all of it."
    Your own eyes widen despite yourself. That does sound rather exciting...
    ~ talked_to_dwarf = true
    -> Kitchen
`
