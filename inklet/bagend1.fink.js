oooOO`
// The Hobbit - ZX Spectrum Tribute
// A fair use tribute to the classic 1982 adventure game

// Start the player at Bag End
-> Bag_End

=== Bag_End ===
IMAGE: bag_end_exterior.svg
You are in a comfortable hobbit-hole with a round green door. The hole is Bag End, home of Bilbo Baggins. Gandalf the wizard sits smoking a pipe.
+ [Talk to Gandalf] -> Talk_To_Gandalf
+ [Leave through the front door] -> Outside_Bag_End
+ [Go to the kitchen] -> Kitchen

=== Outside_Bag_End ===
IMAGE: adventure_path.svg
You stand on the path outside your hobbit-hole. The green hills of Hobbiton stretch before you. A well-worn path leads East toward the village and North into the wilderness.
+ [Return inside] -> Bag_End
+ [Go East to the village] -> Hobbiton_Village
+ [Go North into the wilderness] -> Trollshaws

=== Kitchen ===
IMAGE: hobbit_pantry.svg
This is a well-stocked hobbit kitchen with pantries full of food. A small window looks out onto the garden. Thorin Oakenshield sits at your table, looking impatient.
+ [Talk to Thorin] -> Talk_To_Thorin
+ [Return to the main room] -> Bag_End
+ [Take some food]
    You put some cheese, bread, and apples in your pocket.
    // Add inventory logic later
    -> Kitchen

=== Hobbiton_Village ===
IMAGE: gandalf_at_door.svg
The cheerful village of Hobbiton bustles with activity. Hobbits go about their business, some giving you curious looks. The Green Dragon Inn stands invitingly nearby.
+ [Return West to Bag End] -> Outside_Bag_End
+ [Enter the Green Dragon Inn] -> Green_Dragon
+ [Go North toward the wilderness] -> Trollshaws

=== Green_Dragon ===
IMAGE: green_dragon.svg
The cozy interior of the Green Dragon Inn is filled with hobbits drinking ale and telling stories. The innkeeper nods to you from behind the bar.
+ [Talk to the innkeeper]
    "Heading out on an adventure, are you, Mr. Bilbo?" asks the innkeeper with a wink.
    "News travels fast," you mutter.
    "That it does. Mind those trolls in the woods north of here. They've been causing trouble."
    -> Green_Dragon
+ [Leave the inn] -> Hobbiton_Village

=== Trollshaws ===
IMAGE: trollshaws.svg
The path leads into a dark wooded area. Massive boulders dot the landscape. You can hear strange grunting noises ahead. A cave entrance is visible to the East.
+ [Go South back to Hobbiton] -> Hobbiton_Village
+ [Go East to the cave] -> Troll_Cave
+ [Investigate the noises] -> Troll_Clearing

=== Troll_Clearing ===
IMAGE: troll_clearing.svg
You enter a clearing where three enormous trolls sit around a fire. They appear to be arguing about how to cook you! The sun is starting to rise.
+ [Hide and wait]
    You hide behind a tree. As the trolls continue to argue, the first rays of dawn strike them. With horrified expressions, they freeze and turn to stone!
    ~ troll_status = "stone"
    -> Troll_Clearing_Dawn
+ [Run back to the path] -> Trollshaws

=== Troll_Clearing_Dawn ===
IMAGE: troll_statues.svg
The clearing is quiet now. Three troll statues stand in comical poses, frozen in sunlight. A gleam of metal catches your eye near the largest troll.
+ [Examine the gleam]
    You discover a key and a short sword. The sword glows faintly blue.
    // Add inventory logic later
    -> Troll_Clearing_Dawn
+ [Return to the path] -> Trollshaws
+ [Go to the cave] -> Troll_Cave

=== Troll_Cave ===
IMAGE: troll_cave.svg
The cave is dark and smells terrible. Piles of bones litter the floor. A chest sits in the corner. If the trolls are still active, this is extremely dangerous.
+ [Open the chest]
    {troll_status == "stone": You carefully open the chest. Inside you find a small hoard of gold coins and a curious map showing the path to the Lonely Mountain. The adventure truly begins!}
    {troll_status == "alive": The chest is locked tight, and you can hear the trolls arguing nearby. Too dangerous to investigate while they're still active!}
    -> Troll_Cave_Explored
+ [Leave the cave] -> Trollshaws

=== Troll_Cave_Explored ===
IMAGE: troll_cave.svg
{troll_status == "stone": With treasure in your pockets and a map to guide you, you've proven yourself a true burglar. The cave no longer seems so frightening.}
{troll_status == "alive": The cave remains dangerous while the trolls are active. Best to leave quickly.}
+ [Return to the trolls] -> {troll_status == "stone": Troll_Clearing_Dawn | Troll_Clearing}
+ [Head back to Hobbiton with your treasure] -> Victorious_Return

=== Victorious_Return ===
IMAGE: bag_end_exterior.svg
You return to Bag End as the sun sets, your pockets heavy with troll gold and your mind filled with the wonders you've seen. Gandalf sits on your doorstep, smoking his pipe with a knowing smile.

"So, Bilbo," he says, "still think you want no part in adventures?"

You pat the treasure in your pocket and gaze toward the horizon. "Perhaps... there are greater adventures yet to come."

+ [Begin planning the journey to the Lonely Mountain] -> The_Adventure_Begins
+ [Stay content with your small victory] -> Peaceful_Retirement

=== The_Adventure_Begins ===
IMAGE: adventure_path.svg
With Gandalf's guidance and the treasure map as your guide, you set off toward greater adventures. The path to the Lonely Mountain stretches before you, filled with dangers and wonders beyond imagination.

Your story as a burglar has only just begun...

-> END

=== Peaceful_Retirement ===
IMAGE: hobbit_pantry.svg
You decide that one adventure is quite enough for a respectable hobbit. You hide the troll treasure in your pantry and return to your quiet life of gardening and meals.

Sometimes, on clear evenings, you look toward the mountains and wonder what might have been...

-> END

=== Talk_To_Gandalf ===
IMAGE: gandalf_at_door.svg
"My dear Bilbo," says Gandalf, "I am looking for someone to share in an adventure."

"No thank you!" you reply hastily. "I don't want any adventures, thank you. Not today."

Gandalf looks at you with raised eyebrows. "We shall see..." He puffs thoughtfully on his pipe, and you notice a strange mark scratched on your green door.

+ [Ask about the mark on the door]
    "Oh, that's just a burglar mark," Gandalf says casually. "It means this is a good house to burgle."
    "BURGLE?!" you splutter. "I'll have you know this is a respectable household!"
    -> Bag_End
+ [Return to your comfortable armchair] -> Bag_End
+ [Ask about the adventure]
    "Ah, now that's more like it!" Gandalf's eyes twinkle. "There's a dragon needs dealing with, and a treasure to be recovered. Perfectly straightforward."
    "A DRAGON?!" you exclaim, nearly dropping your tea.
    -> Bag_End

=== Talk_To_Thorin ===
IMAGE: hobbit_pantry.svg
"Hmm, burglar?" Thorin examines you skeptically. "You don't look like much of a thief to me."

"I'm not a burglar!" you protest. "I'm a respectable hobbit!"

Thorin strokes his magnificent beard thoughtfully. "Perhaps... but Gandalf speaks highly of your people. He says you move quietly and have quick fingers."

+ [Show you can be stealthy]
    You creep around the kitchen as quietly as possible, managing to pocket a small cake without making a sound.
    "Impressive," admits Thorin. "Perhaps you'll do after all."
    -> Kitchen
+ [Insist you're not burglar material]
    "I'm perfectly respectable!" you declare. "I pay my taxes, tend my garden, and have never been on an adventure in my life!"
    Thorin nods grimly. "Exactly what we need. Someone unexpected."
    -> Kitchen
+ [Ask about the treasure]
    Thorin's eyes gleam. "The treasure of Erebor, stolen by the dragon Smaug. Gold beyond counting, and the Arkenstone - the Heart of the Mountain."
    Your own eyes widen despite yourself. That does sound rather exciting...
    -> Kitchen

// Extra variables for tracking states
VAR troll_status = "alive" // Changes to "stone" after dawn
`