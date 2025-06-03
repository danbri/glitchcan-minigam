# BASEHREF: media/



-> intro

=== intro ===

# IMAGE: villaged/village_overview.png

The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations: the Whisperwind ATM.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

[[Follow the whispers.]] -> follow_whispers
[[Settle into village life and ignore the rumors.]] -> settle_in
=== settle_in ===
[[Image: elara_cottage.png]]
You decide to embrace the tranquility of Riverbend. Days turn into weeks filled with gardening, friendly chats with neighbors about the weather, and the comforting rhythm of village life. The whispers fade into the background noise.

[[Continue enjoying the peace.]] -> peaceful_life
[[A nagging curiosity resurfaces. Maybe just a little look around?]] -> intro
[[Question a friendly neighbor about local legends.]] -> question_neighbor_settled
=== peaceful_life ===
[[Image: peaceful_sunset.png]]
Years pass. You become a beloved member of Riverbend, your initial curiosity forgotten. The secret of the Whisperwind ATM remains undisturbed. You live a happy, if uneventful, life.
-> END

=== question_neighbor_settled ===
[[Image: neighbor_gardening.png]]
You chat with old Mrs. Gable, admiring her prize-winning roses. "They've been lovely this year, haven't they?" you say casually. "Anything else interesting blooming in Riverbend lately? Any old stories people still tell?"

Mrs. Gable smiles, her eyes crinkling. "Oh, dearie, every village has its tales. Mostly just to keep the young ones amused." She snips a deadhead. "Why do you ask?"

[[Just curious, it's a charming village.]] -> peaceful_life
[[Press gently, mentioning the 'whispers'.]] -> press_neighbor
[[Apologize for prying and change the subject.]] -> settle_in
=== press_neighbor ===
[[Image: mrs_gable_wary.png]]
"I've heard... little whispers," you say, lowering your voice slightly. "About something more to Riverbend than meets the eye."

Mrs. Gable's smile fades slightly. She straightens up, her gaze becoming a touch sharper. "Whispers are just the wind playing tricks, dear. Best not to pay them any mind." She returns to her roses, a subtle dismissal in her movements.

[[Drop the subject, she's clearly not going to talk.]] -> peaceful_life
[[Mention a specific detail you might have overheard.]] -> bluff_neighbor
[[Respect her privacy and thank her for the chat.]] -> settle_in
=== bluff_neighbor ===
[[Image: elara_thinking.png]]
"I thought I heard something about... a hidden grove?" you venture, making it up as you go. "And perhaps... unusual sounds at night?"

Mrs. Gable pauses, her trowel hovering over a rose bush. A flicker of something unreadable crosses her face. "A hidden grove? Now where would you have heard such a thing?" Her tone is carefully neutral.

[[Claim you overheard some children talking.]] -> children_talking
[[Admit you were just speculating based on the village's quiet nature.]] -> press_neighbor
=== children_talking ===
[[Image: children_playing.png]]
"Oh, you know how children are," you say with a light laugh. "Imaginations running wild. They mentioned a secret place... and maybe some whirring sounds?"

Mrs. Gable studies you for a moment, her expression still uncertain. "Children do have lively imaginations. There's no hidden grove, dear, and the only whirring you'll hear is the old mill down by the river." She returns to her gardening, but you sense her gaze lingers on you briefly.

[[Let the matter drop for now.]] -> peaceful_life
[[Casually ask if the old mill is still in use.]] -> inquire_mill
[[Thank her and leave.]] -> bluff_neighbor
=== inquire_mill ===
[[Image: old_mill.png]]
"The old mill," you say casually. "Is it still operational? I haven't seen much activity down that way."

Mrs. Gable shakes her head. "Not for years, dear. Fell into disrepair. Dangerous place, that. Best to stay away." Her tone is firm, almost warning you off.

[[Agree and move on.]] -> peaceful_life
[[Express curiosity about why it was never repaired.]] -> probe_mill
[[Thank her for the information.]] -> children_talking
=== probe_mill ===
[[Image: elara_questioning.png]]
"That's a shame," you say. "Such a landmark to fall into ruin. Was there ever any talk of fixing it up?"

Mrs. Gable sighs. "Some talk, years ago. But it was too costly, and the river currents shifted, made it impractical. Best forgotten, like many old things." There's a finality in her voice.

[[Accept her explanation.]] -> peaceful_life
[[Mention that you enjoy exploring old buildings.]] -> test_mill_interest
[[Thank her for her time and leave.]] -> inquire_mill
=== test_mill_interest ===
[[Image: elara_observing.png]]
"I do enjoy a bit of exploring," you say casually. "Old buildings have such character. I might take a walk down by the river sometime and have a look from the outside, of course."

Mrs. Gable's eyes narrow slightly. "It's really not safe, dear. Loose timbers, unstable foundations. Please, take my word for it, there's nothing to see but decay." Her concern feels a little too forceful.

[[Assure her you'll be careful (but secretly intend to go).]] -> plan_mill_visit
[[Apologize for causing concern and drop the subject.]] -> probe_mill
[[Ask if anyone in the village ever goes near the mill.]] -> direct_mill_question
=== direct_mill_question ===
[[Image: mrs_gable_stern.png]]
"Does anyone ever go near the old mill?" you ask directly.

Mrs. Gable's expression becomes stern. "No, dear. It's understood. A dangerous place, best left alone. Now, if you'll excuse me, these roses need my attention." She turns away, effectively ending the conversation.

[[Take the hint and leave.]] -> peaceful_life
[[Thank her for her honesty (but remain suspicious).]] -> test_mill_interest
[[Decide to investigate the mill despite her warnings.]] -> plan_mill_visit
=== plan_mill_visit ===
[[Image: elara_planning.png]]
Mrs. Gable's strong reaction only fuels your curiosity. You decide to pay the old mill a visit, despite her warnings. You'll need to be discreet.

[[Plan to go during the day, pretending to be exploring nature.]] -> mill_day_approach
[[Ask other villagers about the mill in a more general way.]] -> peaceful_life
=== follow_whispers ===
[[Image: elara_listening_wind.png]]
Intrigued by the rumors, you decide to pay closer attention to the "whispers on the wind." You notice hushed conversations among some villagers, fleeting glances exchanged, and a general air of secrecy beneath the surface of everyday life.

[[Try to eavesdrop on these hushed conversations. (Go on)]] -> eavesdrop
[[Dismiss the whispers as mere gossip and focus on getting to know the village. (Go back - to the intro, a less direct approach)]] -> intro
[[Look for places where secret meetings might occur. (Detect/Engage)]] -> seek_secret_place
=== eavesdrop ===
[[Image: elara_hiding.png]]
You discreetly try to listen in on groups of villagers talking. Their voices often drop to a murmur, and they tend to stop talking or change the subject when you approach. You catch fragmented phrases: "...the flow must be maintained...", "...the balance...", "...not for outsiders...".

[[Try to follow a villager who seems to be involved in these conversations. (Go on)]] -> follow_villager
[[Realize eavesdropping is ineffective and try a different approach. (Go back - to follow whispers)]] -> follow_whispers
=== follow_villager ===
[[Image: elara_following.png]]
You discreetly tail a villager you've noticed engaging in hushed conversations – perhaps the baker, who often seems to have secretive meetings in the early morning. He leads you through winding paths, eventually arriving at...

[[The old mill. (Go on)]] -> mill_day_approach
[[A seemingly ordinary cottage on the edge of the village. (Go back - to eavesdrop, the baker wasn't the right lead)]] -> eavesdrop
=== seek_secret_place ===
[[Image: elara_searching.png]]
You look for locations in Riverbend that seem out of the ordinary or could potentially house a secret – perhaps an overgrown part of the woods, a forgotten cellar, or the dilapidated old mill.

[[Investigate the old mill. (Go on)]] -> mill_day_approach
[[Explore the woods beyond the village. (Go back - to follow whispers)]] -> follow_whispers
=== mill_day_approach ===
[[Image: elara_approaching_mill_day.png]]
Under the guise of exploring nature, you approach the old mill during the day. It looks even more dilapidated up close – broken windows, rotting timbers, and an eerie silence surrounding it.

[[Venture inside the mill.]] -> inside_mill
[[Observe the exterior closely for any unusual features.]] -> mill_exterior
[[Decide it's too risky during the day and leave.]] -> plan_mill_visit

=== mill_night_approach ===
[[Image: elara_approaching_mill_day.png]]
Under the cover of darkness, you cautiously approach the old mill. The shadows play tricks on your eyes, and the sound of the river rushing nearby adds to the atmosphere of mystery.

[[Try to find a way inside.]] -> inside_mill
[[It's too dark and dangerous - return during daylight.]] -> plan_mill_visit

=== mill_exterior ===
[[Image: old_mill.png]]
As you walk around the mill's exterior, you notice it's in an advanced state of disrepair. Most windows are broken, and parts of the roof have caved in. The old waterwheel is still partially visible, though rotted and broken in several places.

[[Go inside anyway.]] -> inside_mill
[[Return to the village.]] -> peaceful_life
=== inside_mill ===
[[Image: inside_dilapidated_mill.png]]
You carefully step inside the mill. Dust motes dance in the faint light filtering through cracks in the walls. The air is damp and smells of decay. The old machinery stands silent and rusted.

[[Search for anything unusual.]] -> search_mill_interior
[[Decide it's too dangerous and leave.]] -> mill_exterior
=== search_mill_interior ===
[[Image: search_mill_interior.png]]
You examine the mill, looking for anything that doesn't fit – a modern lock, unusual wiring, a hidden room. Behind a crumbling wall, you notice...

[[A sturdy metal door, seemingly out of place.]] -> metal_door
[[Just more old machinery and debris.]] -> inside_mill
=== metal_door ===
[[Image: metal_door.png]]
The metal door is set into the stone wall, surprisingly solid and well-maintained. It has a keypad lock.

[[Look for any clues to the code nearby.]] -> look_for_clues
[[Decide to leave and come back better prepared.]] -> peaceful_life
=== look_for_clues ===
[[Image: look_for_clues.png]]
You carefully examine the area around the metal door for any symbols, numbers, or patterns that might hint at the keypad code. You notice...

[[Faint etchings on a nearby gear – Roman numerals?]] -> roman_numerals
[[Nothing obvious, just dust and decay.]] -> metal_door
[[A small, almost hidden inscription above the door.]] -> hidden_inscription
=== hidden_inscription ===
[[Image: hidden_inscription.png]]
The inscription is in an old dialect, but you can make out a few key words: "River's Bounty," "Whispering Wind," and a sequence of numbers that might be a date.

[[Try entering the numbers as the code.]] -> atm_discovered
[[Remember the Roman numerals on the gear and wonder if they are related.]] -> roman_numerals
=== roman_numerals ===
[[Image: roman_numerals.png]]
The Roman numerals etched on the gear seem to represent the numbers 5, 8, and 12. Could this be part of the code?

[[Try entering these numbers in order: 5-8-12.]] -> atm_discovered
[[Look for other gears or similar markings.]] -> look_for_clues

=== atm_discovered ===
[[Image: metal_door.png]]
With a soft beep, the keypad accepts your code! The heavy metal door slides open with a hydraulic hiss, revealing a small, clean chamber. Inside is what appears to be an ATM machine, but unlike any you've seen before. Its interface glows with a soft blue light, and above the screen are the words "WHISPERWIND - River's Bounty."

You've discovered Riverbend's secret. What will you do with this knowledge?

[[Use the ATM to see what happens.]] -> use_atm
[[Leave and keep the secret to yourself.]] -> keep_secret

=== use_atm ===
[[Image: metal_door.png]]
The machine hums as you approach. The screen shows a simple message: "Welcome, Seeker. The river provides for those who respect its flow." A slot opens, and to your amazement, it dispenses several crisp hundred-dollar bills.

As you take the money, you notice Mrs. Gable standing in the doorway behind you. She doesn't seem surprised.

"So, you found it after all," she says. "Now you understand why we keep it secret. The Whisperwind gives, but it requires discretion. Will you join our circle of Guardians?"

[[Accept the responsibility and join the Guardians.]] -> join_guardians
[[Decline politely and promise to keep the secret.]] -> keep_secret

=== join_guardians ===
[[Image: mrs_gable_nod.png]]
You accept Mrs. Gable's offer. Over the coming months, you learn the true history of the Whisperwind ATM - an inexplicable gift from the river that has sustained Riverbend for generations, allowing the village to thrive while maintaining its peaceful character.

As a Guardian, you help maintain the balance, ensuring the ATM's gifts are used wisely and its secret remains protected.

-> END

=== keep_secret ===
[[Image: elara_thinking.png]]
You decide that some secrets should remain just that - secrets. You promise Mrs. Gable you'll never speak of what you've found, and she rewards your discretion with trust and friendship.

Life in Riverbend continues, peaceful and idyllic, but now you understand the subtle undercurrent that sustains this tranquil village.

-> END
