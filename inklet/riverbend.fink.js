oooOO`
# BASEHREF: media/

-> intro

=== intro ===

# IMAGE: villaged/village_overview.png

The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

+ [Follow the whispers.] -> follow_whispers
+ [Settle into village life and ignore the rumors.] -> settle_in

=== settle_in ===
# IMAGE: villaged/elara_cottage.png
You decide to embrace the tranquility of Riverbend. Days turn into weeks filled with gardening, friendly chats with neighbors about the weather, and the comforting rhythm of village life. The whispers fade into the background noise.

+ [Continue enjoying the peace.] -> peaceful_life
+ [A nagging curiosity resurfaces. Maybe just a little look around?] -> intro

=== peaceful_life ===
# IMAGE: villaged/peaceful_sunset.png
Years pass. You become a beloved member of Riverbend, your initial curiosity forgotten. The secret remains undisturbed. You live a happy, if uneventful, life.
-> END

=== follow_whispers ===
# IMAGE: villaged/elara_listening_wind.png
Intrigued by the rumors, you decide to pay closer attention to the "whispers on the wind." You notice hushed conversations among some villagers, fleeting glances exchanged, and a general air of secrecy beneath the surface of everyday life.

+ [Try to eavesdrop on these hushed conversations.] -> eavesdrop
+ [Investigate the old mill that several people mentioned in hushed tones.] -> mill_direct

=== eavesdrop ===
# IMAGE: villaged/elara_hiding.png
You discreetly try to listen in on groups of villagers talking. Their voices often drop to a murmur, and they tend to stop talking or change the subject when you approach. You catch fragmented phrases: "...the flow must be maintained...", "...the balance...", "...not for outsiders..."

+ [Investigate the old mill that several people mentioned in hushed tones.] -> mill_direct

=== mill_direct ===
# IMAGE: villaged/elara_searching.png
You approach the old mill with determination. The structure looms before you, its broken wheel silent and still. Vines have claimed much of the stonework, and several windows are boarded up or broken entirely.

+ [Try the main door.] -> main_door

=== main_door ===
# IMAGE: villaged/elara_approaching_mill_day.png
The main door is heavy oak, weathered but surprisingly solid. When you push against it, it swings open with a protesting creak that echoes in the mill's interior.

+ [Step inside cautiously.] -> enter_mill

=== enter_mill ===
# IMAGE: villaged/inside_dilapidated_mill.png
You carefully step inside the mill. Dust motes dance in the faint light filtering through cracks in the walls. The air is damp and smells of decay. The old machinery stands silent and rusted.

But as you look more carefully, you notice something odd...

+ [Search for anything unusual.] -> search_mill

=== search_mill ===
# IMAGE: villaged/search_mill_interior.png
You examine the mill, looking for anything that doesn't fit – a modern lock, unusual wiring, a hidden room. Behind a crumbling wall, you notice something that makes your heart race...

+ [A sturdy metal door, seemingly out of place.] -> metal_door

=== metal_door ===
# IMAGE: villaged/metal_door.png
The metal door is set into the stone wall, surprisingly solid and well-maintained. It has a keypad lock – clearly modern technology in this ancient building.

+ [Look for any clues to the code nearby.] -> look_for_clues

=== look_for_clues ===
# IMAGE: villaged/look_for_clues.png
You carefully examine the area around the metal door for any symbols, numbers, or patterns that might hint at the keypad code. After several minutes of searching, you notice...

+ [Faint etchings on a nearby gear – Roman numerals?] -> roman_numerals

=== roman_numerals ===
# IMAGE: villaged/roman_numerals.png
The Roman numerals etched on the gear seem to represent the numbers 5, 8, and 12. Could this be part of the code?

+ [Try entering these numbers in order: 5-8-12.] -> correct_code

=== correct_code ===
# IMAGE: villaged/hidden_inscription.png
With a soft beep, the keypad accepts your code! The heavy metal door slides open with a hydraulic hiss, revealing a small, clean chamber. Inside is what appears to be an ATM machine, but unlike any you've seen before. Its interface glows with a soft blue light, and above the screen are the words "WHISPERWIND - River's Bounty."

You've discovered Riverbend's secret. What will you do with this knowledge?

+ [Use the ATM to see what happens.] -> use_atm

=== use_atm ===
# IMAGE: villaged/metal_door.png
The machine hums as you approach. The screen shows a simple message: "Welcome, Seeker. The river provides for those who respect its flow." A slot opens, and to your amazement, it dispenses several crisp hundred-dollar bills.

As you take the money, you notice Mrs. Gable standing in the doorway behind you. She doesn't seem surprised.

"So, you found it after all," she says. "Now you understand why we keep it secret. The Whisperwind gives, but it requires discretion. Will you join our circle of Guardians?"

+ [Accept the responsibility and join the Guardians.] -> join_guardians
+ [Politely decline and offer to keep the secret.] -> keep_secret

=== join_guardians ===
# IMAGE: villaged/metal_door.png
You accept Mrs. Gable's offer. Over the coming months, you learn the true history of the Whisperwind ATM - an inexplicable gift from the river that has sustained Riverbend for generations, allowing the village to thrive while maintaining its peaceful character.

As a Guardian, you help maintain the balance, ensuring the ATM's gifts are used wisely and its secret remains protected.

-> END

=== keep_secret ===
# IMAGE: villaged/elara_thinking.png
You decide that some secrets should remain just that - secrets. You promise Mrs. Gable you'll never speak of what you've found, and she rewards your discretion with trust and friendship.

Life in Riverbend continues, peaceful and idyllic, but now you understand the subtle undercurrent that sustains this tranquil village.

-> END
`
