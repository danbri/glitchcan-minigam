oooOO`
// The Hobbit - ZX Spectrum Tribute
// A fair use tribute to the classic 1982 adventure game

// Start the player at Bag End
-> Bag_End

=== Bag_End ===
IMAGE: bag_end_exterior.png
You are in a comfortable hobbit-hole with a round green door. The hole is Bag End, home of Bilbo Baggins. Gandalf the wizard sits smoking a pipe.
+ [Talk to Gandalf]
    "My dear Bilbo," says Gandalf, "I am looking for someone to share in an adventure."
    "No thank you!" you reply hastily. "I don't want any adventures, thank you. Not today."
    Gandalf looks at you with raised eyebrows. "We shall see..."
    -> Bag_End
+ [Leave through the front door] -> Outside_Bag_End
+ [Go to the kitchen] -> Kitchen

=== Outside_Bag_End ===
IMAGE: adventure_path.png
You stand on the path outside your hobbit-hole. The green hills of Hobbiton stretch before you. A well-worn path leads East toward the village and North into the wilderness.
+ [Return inside] -> Bag_End
+ [Go East to the village] -> Hobbiton_Village
+ [Go North into the wilderness] -> Trollshaws

=== Kitchen ===
IMAGE: hobbit_pantry.png
This is a well-stocked hobbit kitchen with pantries full of food. A small window looks out onto the garden. Thorin Oakenshield sits at your table, looking impatient.
+ [Talk to Thorin]
    "Hmm, burglar?" Thorin examines you skeptically. "You don't look like much of a thief to me."
    "I'm not a burglar!" you protest. "I'm a respectable hobbit!"
    -> Kitchen
+ [Return to the main room] -> Bag_End
+ [Take some food]
    You put some cheese, bread, and apples in your pocket.
    // Add inventory logic later
    -> Kitchen

=== Hobbiton_Village ===
IMAGE: gandalf_at_door.png
The cheerful village of Hobbiton bustles with activity. Hobbits go about their business, some giving you curious looks. The Green Dragon Inn stands invitingly nearby.
+ [Return West to Bag End] -> Outside_Bag_End
+ [Enter the Green Dragon Inn] -> Green_Dragon
+ [Go North toward the wilderness] -> Trollshaws

=== Green_Dragon ===
IMAGE: green_dragon.jpg
The cozy interior of the Green Dragon Inn is filled with hobbits drinking ale and telling stories. The innkeeper nods to you from behind the bar.
+ [Talk to the innkeeper]
    "Heading out on an adventure, are you, Mr. Bilbo?" asks the innkeeper with a wink.
    "News travels fast," you mutter.
    "That it does. Mind those trolls in the woods north of here. They've been causing trouble."
    -> Green_Dragon
+ [Leave the inn] -> Hobbiton_Village

=== Trollshaws ===
IMAGE: trollshaws.jpg
The path leads into a dark wooded area. Massive boulders dot the landscape. You can hear strange grunting noises ahead. A cave entrance is visible to the East.
+ [Go South back to Hobbiton] -> Hobbiton_Village
+ [Go East to the cave] -> Troll_Cave
+ [Investigate the noises] -> Troll_Clearing

=== Troll_Clearing ===
IMAGE: troll_clearing.jpg
You enter a clearing where three enormous trolls sit around a fire. They appear to be arguing about how to cook you! The sun is starting to rise.
+ [Hide and wait]
    You hide behind a tree. As the trolls continue to argue, the first rays of dawn strike them. With horrified expressions, they freeze and turn to stone!
    -> Troll_Clearing_Dawn
+ [Run back to the path] -> Trollshaws

=== Troll_Clearing_Dawn ===
IMAGE: troll_statues.jpg
The clearing is quiet now. Three troll statues stand in comical poses, frozen in sunlight. A gleam of metal catches your eye near the largest troll.
+ [Examine the gleam]
    You discover a key and a short sword. The sword glows faintly blue.
    // Add inventory logic later
    -> Troll_Clearing_Dawn
+ [Return to the path] -> Trollshaws
+ [Go to the cave] -> Troll_Cave

=== Troll_Cave ===
IMAGE: troll_cave.jpg
The cave is dark and smells terrible. Piles of bones litter the floor. A chest sits in the corner. If the trolls are still active, this is extremely dangerous.
+ [Open the chest]
    {troll_status: You carefully open the chest. Inside you find a small hoard of gold coins and a curious map.}
    // Add inventory logic later
    -> Troll_Cave
+ [Leave the cave] -> Trollshaws

// Extra variables for tracking states
VAR troll_status = "alive" // Changes to "stone" after dawn
`