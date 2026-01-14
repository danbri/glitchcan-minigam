oooOO`
// Test FINK file for variable system
// Demonstrates state persistence like the Hampstead wardrobe scenario

VAR has_clothes = false
VAR is_wearing_clothes = false
VAR clothes_description = "smart outfit"

-> wardrobe_start

=== wardrobe_start ===
IMAGE: hobbit_pantry.png
You stand before a wardrobe. {has_clothes: You can see a ${clothes_description} hanging inside.}

+ [Open the wardrobe] -> wardrobe_open
+ [Look around the room] -> room_look
+ [Leave] -> END

=== wardrobe_open ===
IMAGE: hobbit_pantry.png
You open the wardrobe. Inside you find a smart outfit hanging on a hook.

+ [Take the clothes ~ has_clothes = true] -> take_clothes
+ [Close the wardrobe] -> wardrobe_start
+ [Leave] -> END

=== room_look ===
IMAGE: village_overview.png
You look around the room. {has_clothes: You're holding a ${clothes_description}.} {is_wearing_clothes: You're smartly dressed in your ${clothes_description}.}

+ [Check the wardrobe] -> wardrobe_start
+ [Put on clothes] -> wear_clothes
+ [Leave] -> END

=== wear_clothes ===
IMAGE: peaceful_sunset.png
{has_clothes: You put on the smart outfit. You look much more presentable now!} {is_wearing_clothes: You're already wearing the ${clothes_description}.}

+ [Look in mirror ~ is_wearing_clothes = true] -> mirror_look
+ [Remove clothes ~ is_wearing_clothes = false] -> remove_clothes
+ [Return to room] -> room_look

=== take_clothes ===
IMAGE: adventure_path.png
You take the smart outfit from the wardrobe. {has_clothes: You're now holding the ${clothes_description}!}

+ [Continue] -> wardrobe_open

=== mirror_look ===
IMAGE: peaceful_sunset.png
You look at yourself in the mirror. {is_wearing_clothes: The ${clothes_description} suits you perfectly!}

+ [Continue] -> room_look

=== remove_clothes ===
IMAGE: village_overview.png
You take off the clothes and fold them carefully. {has_clothes: You're now holding the ${clothes_description} again.}

+ [Continue] -> room_look
`