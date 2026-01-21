oooOO`
// Riverbend - Village Mystery
// Merged from riverbend-orig.ink (rich branching) + riverbend.fink.js (FOLEY audio)
# BASEHREF: media/riverbend/

-> intro

=== intro ===

# IMAGE: village_overview.png
# FOLEY: water(pan:-0.5, vol:0.4, drip:0.2)
# FOLEY: wind(pan:0.3, vol:0.3, gust:0.3)

The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations: the Whisperwind ATM.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

+ [Follow the whispers.] -> follow_whispers
+ [Settle into village life and ignore the rumors.] -> settle_in

=== settle_in ===
# IMAGE: elara_cottage.png
You decide to embrace the tranquility of Riverbend. Days turn into weeks filled with gardening, friendly chats with neighbors about the weather, and the comforting rhythm of village life. The whispers fade into the background noise.

+ [Continue enjoying the peace.] -> peaceful_life
+ [A nagging curiosity resurfaces. Maybe just a little look around?] -> intro
+ [Question a friendly neighbor about local legends.] -> question_neighbor_settled

=== peaceful_life ===
# IMAGE: peaceful_sunset.png
# FOLEY: stop
# FOLEY: wind(pan:0, vol:0.2, gust:0.1)
Years pass. You become a beloved member of Riverbend, your initial curiosity forgotten. The secret of the Whisperwind ATM remains undisturbed. You live a happy, if uneventful, life.
-> END

=== question_neighbor_settled ===
# IMAGE: neighbor_gardening.png
You chat with old Mrs. Gable, admiring her prize-winning roses. "They've been lovely this year, haven't they?" you say casually. "Anything else interesting blooming in Riverbend lately? Any old stories people still tell?"

Mrs. Gable smiles, her eyes crinkling. "Oh, dearie, every village has its tales. Mostly just to keep the young ones amused." She snips a deadhead. "Why do you ask?"

+ [Just curious, it's a charming village.] -> peaceful_life
+ [Press gently, mentioning the 'whispers'.] -> press_neighbor
+ [Apologize for prying and change the subject.] -> settle_in

=== press_neighbor ===
# IMAGE: mrs_gable_wary.png
"I've heard... little whispers," you say, lowering your voice slightly. "About something more to Riverbend than meets the eye."

Mrs. Gable's smile fades slightly. She straightens up, her gaze becoming a touch sharper. "Whispers are just the wind playing tricks, dear. Best not to pay them any mind." She returns to her roses, a subtle dismissal in her movements.

+ [Drop the subject, she's clearly not going to talk.] -> peaceful_life
+ [Mention a specific detail you might have overheard.] -> bluff_neighbor
+ [Respect her privacy and thank her for the chat.] -> settle_in

=== bluff_neighbor ===
# IMAGE: elara_thinking.png
"I thought I heard something about... a hidden grove?" you venture, making it up as you go. "And perhaps... unusual sounds at night?"

Mrs. Gable's eyes narrow. She sets down her gardening shears with deliberate care. "Young lady, I don't know what you think you've heard, but I suggest you focus on the present rather than chasing shadows." Her tone is final.

+ [Back down and change the subject to gardening.] -> peaceful_life
+ [Persist with questions about the mill.] -> mill_approach

=== mill_approach ===
# IMAGE: village_overview.png
Despite Mrs. Gable's warnings, you find yourself drawn to the old mill at the edge of the village. Villagers go about their business in the square, but you notice they give the mill a wide berth, never venturing too close to its crumbling walls.

+ [Approach the mill directly.] -> mill_direct
+ [Wait and observe the mill from a distance first.] -> mill_observe
+ [Ask some villagers about the mill.] -> ask_villagers

=== mill_observe ===
# IMAGE: old_mill.png
You find a comfortable spot on a nearby hillside and settle in to watch the mill. Hours pass. Nothing seems particularly unusual about the dilapidated structure, but you notice that even the birds seem to avoid perching on its broken eaves.

As the sun begins to set, you catch sight of a figure moving near the mill's entrance - someone in a dark cloak, moving with purpose.

+ [Follow the cloaked figure.] -> follow_figure
+ [Wait until they leave, then investigate.] -> mill_direct
+ [Head home - this feels too dangerous.] -> settle_in

=== follow_figure ===
# IMAGE: old_mill.png
You carefully follow the cloaked figure, keeping to the shadows. They move with practiced ease through the overgrown path to the mill. At the entrance, they pause, look around carefully, then slip inside.

+ [Wait a moment, then follow them in.] -> enter_mill
+ [Circle around to find another entrance.] -> circle_mill
+ [This is too risky - head back to the village.] -> settle_in

=== ask_villagers ===
# IMAGE: village_overview.png
You approach a group of villagers chatting by the well. "Excuse me, I'm new here. What's the story with that old mill?"

They exchange quick glances. "Just an old ruin," says one man, a bit too quickly. "Dangerous structure. Best stay away."

"The council's been meaning to tear it down for years," adds a woman. "Nothing interesting there."

+ [Accept their explanation and walk away.] -> settle_in
+ [Press for more details about the mill's history.] -> mill_history
+ [Thank them and investigate the mill yourself.] -> mill_direct

=== mill_history ===
# IMAGE: elara_thinking.png
"I'm quite interested in local history," you say casually. "How long has the mill been abandoned?"

An older man strokes his chin. "Oh, since before I was born. My grandmother used to tell stories about it - apparently it was quite prosperous once, grinding grain for the whole region. But that was long ago."

"Any particular reason it was abandoned?"

His smile becomes more forced. "Economics, I'd imagine. Modern mills made the old ones obsolete." He tips his hat and moves away.

+ [Let it go and head back home.] -> settle_in
+ [Investigate the mill yourself.] -> mill_direct

=== follow_whispers ===
# IMAGE: village_overview.png
Intrigued by the rumors, you decide to pay closer attention to the "whispers on the wind." You notice hushed conversations among some villagers, fleeting glances exchanged, and a general air of secrecy beneath the surface of everyday life.

+ [Try to eavesdrop on these hushed conversations.] -> eavesdrop
+ [Follow someone who seems to be part of these secret discussions.] -> follow_villager
+ [Ask direct questions about what people are whispering about.] -> direct_questions

=== eavesdrop ===
# IMAGE: village_overview.png
You discreetly try to listen in on groups of villagers talking. Their voices often drop to a murmur, and they tend to stop talking or change the subject when you approach. You catch fragmented phrases: "...the flow must be maintained...", "...the balance...", "...not for outsiders..."

+ [Try to follow a villager who seems to be involved in these conversations.] -> follow_villager
+ [Approach someone directly and ask what they're discussing.] -> direct_questions
+ [Investigate the old mill that several people mentioned in hushed tones.] -> mill_direct

=== follow_villager ===
# IMAGE: village_overview.png
You discreetly tail a villager you've noticed engaging in hushed conversations - the baker, who often seems to have secretive meetings in the early morning. He leads you through winding paths, eventually arriving at...

+ [The old mill.] -> mill_direct
+ [A hidden grove behind the village.] -> hidden_grove
+ [The riverbank where few people go.] -> riverbank

=== hidden_grove ===
# IMAGE: peaceful_sunset.png
The baker leads you to a secluded grove, where dappled sunlight filters through ancient oaks. In the center stands a moss-covered stone with strange markings. Several villagers are gathered here, speaking in low tones.

They notice you. Silence falls.

+ [Apologize and leave quickly.] -> settle_in
+ [Ask what this place is.] -> grove_confrontation
+ [Stand your ground and observe.] -> grove_observe

=== grove_confrontation ===
# IMAGE: mrs_gable_wary.png
"This is a private gathering," says Mrs. Gable, stepping forward. Her tone is not unkind, but firm. "How did you find this place?"

+ [Admit you followed the baker.] -> admit_following
+ [Claim you were just walking and stumbled upon it.] -> lie_about_grove
+ [Ask about the strange stone.] -> ask_about_stone

=== admit_following ===
# IMAGE: neighbor_gardening.png
You confess to following the baker. Mrs. Gable sighs, exchanging glances with the others.

"Curiosity," she says. "It can be a blessing or a curse. You've shown resourcefulness, I'll give you that. Perhaps... perhaps it's time we told you about the Whisperwind."

+ [Listen to what she has to say.] -> learn_secret
+ [This feels like a trap - leave now.] -> settle_in

=== learn_secret ===
# IMAGE: village_overview.png
Mrs. Gable explains that Riverbend has been blessed - or cursed, depending on your view - with an inexplicable gift: an ATM hidden in the old mill that produces money from seemingly nowhere. The village has guarded this secret for generations.

"We call ourselves the Guardians," she says. "We ensure the gift is used wisely and never abused."

+ [Ask to see this ATM.] -> mill_direct
+ [This sounds crazy - politely excuse yourself.] -> settle_in

=== lie_about_grove ===
# IMAGE: mrs_gable_wary.png
"Just walking," you say with what you hope is an innocent smile. "Lovely spot."

Mrs. Gable's eyes narrow. "Indeed. Well, we were just leaving. I suggest you do the same."

The group disperses, but you notice several of them watching you carefully as they go.

+ [Head back to the village.] -> settle_in
+ [Wait until they're gone, then examine the stone.] -> examine_stone

=== ask_about_stone ===
# IMAGE: hidden_inscription.png
"What are those markings?" you ask, pointing to the stone.

"Old symbols," says Mrs. Gable curtly. "From before the village was founded. Meaningless now."

But you notice one of the younger villagers glancing nervously at the mill in the distance.

+ [Let it go for now.] -> settle_in
+ [Head toward the mill.] -> mill_direct

=== grove_observe ===
# IMAGE: peaceful_sunset.png
You stand your ground, watching. The villagers resume their discussion in even lower tones, occasionally glancing your way. After a few minutes, they begin to disperse.

Mrs. Gable approaches you. "You're persistent, I'll give you that. But some secrets are kept for good reason."

+ [Ask what secret.] -> grove_confrontation
+ [Nod and leave.] -> settle_in

=== examine_stone ===
# IMAGE: hidden_inscription.png
Once alone, you examine the stone more closely. The markings are weathered but still visible - a series of symbols that look almost like numbers. Roman numerals, perhaps?

At the base of the stone, barely visible, are the letters: V - VIII - XII

+ [Remember these numbers and head to the mill.] -> mill_direct
+ [Head back to the village to research these symbols.] -> settle_in

=== riverbank ===
# IMAGE: village_overview.png
# FOLEY: water(pan:0, vol:0.6, drip:0.3)
The baker leads you to a quiet stretch of riverbank, far from the village. Here, the water runs clear and deep. He meets with another villager, and they speak in hushed tones about "the flow" and "maintaining balance."

+ [Reveal yourself and ask what they're discussing.] -> riverbank_confrontation
+ [Stay hidden and keep listening.] -> riverbank_listen
+ [Leave quietly and investigate the mill instead.] -> mill_direct

=== riverbank_confrontation ===
# IMAGE: neighbor_gardening.png
You step out of hiding. The two villagers freeze, then the baker sighs.

"Another curious newcomer," he says. "The village attracts them like moths to flame."

+ [Ask about the Whisperwind.] -> learn_secret
+ [Apologize and leave.] -> settle_in

=== riverbank_listen ===
# IMAGE: village_overview.png
You strain to hear more. "...the machine needs maintenance...", "...Mrs. Gable says the output has been declining...", "...perhaps we should show the newcomer..."

They seem to be debating whether to reveal something to you.

+ [Step forward and introduce yourself.] -> riverbank_confrontation
+ [Leave and investigate the mill.] -> mill_direct

=== direct_questions ===
# IMAGE: village_overview.png
You approach a group of villagers directly. "Excuse me, I've noticed people whispering about something. What's the big secret in Riverbend?"

The group falls silent. A few people suddenly remember urgent appointments and hurry away.

"No secrets here," says the remaining villager, a shopkeeper. "Just a quiet village. Now, can I interest you in some fresh bread?"

+ [Buy some bread and drop the subject.] -> settle_in
+ [Investigate the mill on your own.] -> mill_direct

=== mill_direct ===
# IMAGE: old_mill.png
You approach the old mill with determination. The structure looms before you, its broken wheel silent and still. Vines have claimed much of the stonework, and several windows are boarded up or broken entirely.

+ [Circle the building looking for a way in.] -> circle_mill
+ [Try the main door.] -> main_door
+ [Look for anyone else around before proceeding.] -> look_around

=== circle_mill ===
# IMAGE: old_mill.png
You walk around the mill's perimeter. The walls are thick stone, showing centuries of weathering. On the far side, you find a small window that's been left slightly ajar - possibly an oversight, or perhaps intentionally.

+ [Climb through the window.] -> enter_mill
+ [Go back and try the main door instead.] -> main_door
+ [This feels wrong - head back to the village.] -> settle_in

=== look_around ===
# IMAGE: old_mill.png
You scan the area carefully. The mill seems deserted, but you notice fresh footprints in the mud leading to the main entrance. Someone has been here recently - perhaps very recently.

+ [Follow the footprints to the main door.] -> main_door
+ [Wait and watch to see if anyone emerges.] -> mill_observe
+ [This could be dangerous - head back.] -> settle_in

=== main_door ===
# IMAGE: old_mill.png
The main door is heavy oak, weathered but surprisingly solid. When you push against it, it swings open with a protesting creak that echoes in the mill's interior.

+ [Step inside cautiously.] -> enter_mill
+ [Call out to see if anyone is inside.] -> call_inside
+ [Close the door and look for another entrance.] -> circle_mill

=== call_inside ===
# IMAGE: old_mill.png
"Hello? Is anyone there?" Your voice echoes through the empty structure. Silence answers you... then, faintly, you hear a mechanical hum from somewhere below.

+ [Step inside to investigate the sound.] -> enter_mill
+ [This is too strange - leave now.] -> settle_in

=== enter_mill ===
# IMAGE: inside_dilapidated_mill.png
# FOLEY: stop
# FOLEY: wind(pan:0, vol:0.2, gust:0.1, pitch:0.7)
# FOLEY: rumble(vol:0.15, pitch:0.5)

You carefully step inside the mill. Dust motes dance in the faint light filtering through cracks in the walls. The air is damp and smells of decay. The old machinery stands silent and rusted.

But as you look more carefully, you notice something odd - the floor has been swept clean in places, and there are fresh oil stains near some of the gears.

+ [Search for anything unusual.] -> search_mill
+ [Examine the machinery more closely.] -> examine_machinery
+ [Look for a way to the upper floors.] -> find_stairs

=== examine_machinery ===
# IMAGE: inside_dilapidated_mill.png
You examine the old milling equipment. Most of it is rusted beyond repair, but some pieces show signs of recent maintenance. One gear in particular catches your eye - it's been cleaned and oiled, and has strange markings etched into its surface.

+ [Examine the markings on the gear.] -> roman_numerals
+ [Continue searching the mill.] -> search_mill
+ [Look for stairs to other levels.] -> find_stairs

=== find_stairs ===
# IMAGE: inside_dilapidated_mill.png
You find a rickety staircase leading up to what was once the grain storage. The steps creak ominously, and several are missing entirely. Going up seems risky.

You also notice a trapdoor in the floor, partially hidden under old sacking.

+ [Risk the stairs to the upper level.] -> upper_level
+ [Investigate the trapdoor.] -> trapdoor
+ [Continue searching the main floor.] -> search_mill

=== upper_level ===
# IMAGE: inside_dilapidated_mill.png
You carefully climb the stairs, testing each step before putting your full weight on it. The upper level is largely empty, filled with dust and bird droppings. But through a crack in the floorboards, you can see a faint blue glow from below.

+ [Go back down and find the source of the glow.] -> search_mill
+ [Search the upper level more thoroughly.] -> search_upper

=== search_upper ===
# IMAGE: inside_dilapidated_mill.png
You search the upper level but find little of interest - just old grain sacks and nesting materials from long-departed birds. However, you do find a small journal, its pages yellowed with age. The last entry reads: "The code is the founding date. V-VIII-XII. May the Whisperwind protect us all."

+ [Take the journal and head back down.] -> search_mill
+ [Leave the journal and investigate the blue glow below.] -> search_mill

=== trapdoor ===
# IMAGE: inside_dilapidated_mill.png
You pull aside the sacking and find a sturdy trapdoor with a modern padlock - completely out of place in this ancient structure. The lock looks expensive and recently installed.

+ [Try to force the lock.] -> force_lock
+ [Look for a key or combination.] -> search_mill
+ [Leave it alone and search elsewhere.] -> search_mill

=== force_lock ===
# IMAGE: metal_door.png
You tug at the padlock, but it's solid. Without tools, you won't be able to break it. Perhaps there's another way in - or a key hidden somewhere.

+ [Search the mill for a key.] -> search_mill
+ [Look for another entrance to whatever is below.] -> search_mill

=== search_mill ===
# IMAGE: search_mill_interior.png
You examine the mill, looking for anything that doesn't fit - a modern lock, unusual wiring, a hidden room. Behind a crumbling wall, you notice something that makes your heart race...

+ [A sturdy metal door, seemingly out of place.] -> metal_door
+ [Fresh footprints in the dust.] -> footprints
+ [Strange markings on the wall.] -> wall_markings

=== footprints ===
# IMAGE: inside_dilapidated_mill.png
The footprints lead from the entrance to a spot behind the old grinding stones. Someone has been coming here regularly - the prints overlap in places, suggesting repeated visits.

Following them, you find yourself facing a section of wall that looks subtly different from the rest.

+ [Examine the wall more closely.] -> metal_door
+ [Follow the footprints back outside.] -> settle_in

=== wall_markings ===
# IMAGE: hidden_inscription.png
The markings on the wall appear to be old graffiti, but among the scratched initials and dates, you notice a repeated symbol - something that looks like a stylized wind spiral.

Beneath one of the spirals, someone has scratched: "V-VIII-XII"

+ [Remember these numbers and keep searching.] -> metal_door
+ [This is getting too strange - leave.] -> settle_in

=== metal_door ===
# IMAGE: metal_door.png
The metal door is set into the stone wall, surprisingly solid and well-maintained. It has a keypad lock - clearly modern technology in this ancient building.

+ [Look for any clues to the code nearby.] -> look_for_clues
+ [Try some obvious combinations.] -> try_codes
+ [Search for another way around.] -> search_around

=== try_codes ===
# IMAGE: metal_door.png
You try some obvious combinations - 1234, 0000, 1111. Nothing works. The keypad beeps disapprovingly with each failed attempt.

+ [Look for clues to the real code.] -> look_for_clues
+ [Try a few more random combinations.] -> wrong_code
+ [Give up and leave.] -> settle_in

=== search_around ===
# IMAGE: inside_dilapidated_mill.png
You search for another way past the metal door, but the walls are solid stone. Whatever is behind that door, they've made sure this is the only way in.

+ [Go back and look for clues to the code.] -> look_for_clues
+ [Give up for now.] -> settle_in

=== look_for_clues ===
# IMAGE: inside_dilapidated_mill.png
You carefully examine the area around the metal door for any symbols, numbers, or patterns that might hint at the keypad code. After several minutes of searching, you notice...

+ [Faint etchings on a nearby gear - Roman numerals?] -> roman_numerals
+ [A sequence of worn spots on certain keys.] -> worn_keys
+ [A hidden message carved into the door frame.] -> hidden_message

=== roman_numerals ===
# IMAGE: roman_numerals.png
The Roman numerals etched on the gear seem to represent the numbers 5, 8, and 12. Could this be part of the code?

+ [Try entering these numbers in order: 5-8-12.] -> correct_code
+ [Try entering them in reverse: 12-8-5.] -> wrong_code
+ [Look for more clues before trying any combination.] -> more_clues

=== worn_keys ===
# IMAGE: metal_door.png
You look closely at the keypad. Certain keys - 5, 8, 1, and 2 - show more wear than the others. The combination must use these numbers.

+ [Try 5-8-1-2.] -> correct_code
+ [Try 1-2-5-8.] -> wrong_code
+ [Look for more clues about the order.] -> roman_numerals

=== hidden_message ===
# IMAGE: hidden_inscription.png
Carved into the door frame, almost invisible unless you're looking for it, are the words: "The founding date opens all doors."

The founding date of Riverbend... you recall seeing it on a plaque in the village square: May 8th, 512 AD. Or in numbers: 5-8-12.

+ [Enter 5-8-12.] -> correct_code
+ [This seems too easy - look for other clues.] -> more_clues

=== more_clues ===
# IMAGE: inside_dilapidated_mill.png
You search more thoroughly and find several references to the same numbers: V-VIII-XII. It's clearly the code. The founding date of Riverbend: May 8th, 512 AD.

+ [Enter 5-8-12 on the keypad.] -> correct_code
+ [Leave without entering the code.] -> settle_in

=== wrong_code ===
# IMAGE: metal_door.png
The keypad emits an angry buzz. Wrong combination. After three failed attempts, a red light begins blinking - some kind of lockout or alarm.

+ [Try to figure out the correct code quickly.] -> roman_numerals
+ [Leave before someone comes to investigate.] -> settle_in

=== correct_code ===
# IMAGE: hidden_inscription.png
# FOLEY: stop
# FOLEY: machinery(vol:0.5, throb:1.5, pitch:0.8)

With a soft beep, the keypad accepts your code! The heavy metal door slides open with a hydraulic hiss, revealing a small, clean chamber. Inside is what appears to be an ATM machine, but unlike any you've seen before. Its interface glows with a soft blue light, and above the screen are the words "WHISPERWIND - River's Bounty."

You've discovered Riverbend's secret. What will you do with this knowledge?

+ [Use the ATM to see what happens.] -> use_atm
+ [Document this discovery and leave.] -> document_discovery
+ [Look for someone to ask about this.] -> find_someone

=== document_discovery ===
# IMAGE: elara_thinking.png
You take out your phone and photograph the strange ATM, the chamber, everything. Evidence of this incredible discovery.

As you're finishing, you hear footsteps behind you. Mrs. Gable stands in the doorway, her expression unreadable.

"I see you found it," she says quietly. "The question now is: what do you intend to do with that knowledge?"

+ [Promise to keep the secret.] -> keep_secret
+ [Ask to understand more before deciding.] -> ask_explanation
+ [Threaten to expose the secret unless they explain.] -> threaten_expose

=== find_someone ===
# IMAGE: metal_door.png
You step back from the ATM, unsure what to do. As if summoned by your thoughts, you hear footsteps. Mrs. Gable appears in the doorway.

"Well," she says, "you've certainly proven yourself resourceful. Not many find their way in here."

+ [Ask her to explain everything.] -> ask_explanation
+ [Demand to know what this is about.] -> threaten_expose

=== threaten_expose ===
# IMAGE: mrs_gable_wary.png
"Tell me everything," you say firmly, "or I'm going to the authorities with this."

Mrs. Gable sighs. "The authorities? My dear, they already know. Who do you think helps us maintain the... balance?" She gestures to the ATM. "This has sustained our village for generations. Exposing it would only bring chaos."

+ [Listen to her full explanation.] -> ask_explanation
+ [This is too much - leave and forget you saw anything.] -> keep_secret

=== ask_explanation ===
# IMAGE: neighbor_gardening.png
Mrs. Gable explains: the Whisperwind ATM appeared in Riverbend over a century ago, its origin unknown. It produces money - real, valid currency - seemingly from nowhere. The village formed the Guardians to manage this gift responsibly.

"We use it to help those in need, to maintain the village, to ensure Riverbend remains a place of peace and prosperity. But we must be careful - too much, too fast, would attract attention."

+ [This is incredible. Can I join the Guardians?] -> join_guardians
+ [This feels wrong. I should leave.] -> keep_secret

=== use_atm ===
# IMAGE: metal_door.png
# FOLEY: machinery(vol:0.6, throb:1.0, pitch:0.9)

The machine hums as you approach. The screen shows a simple message: "Welcome, Seeker. The river provides for those who respect its flow." A slot opens, and to your amazement, it dispenses several crisp hundred-dollar bills.

As you take the money, you notice Mrs. Gable standing in the doorway behind you. She doesn't seem surprised.

"So, you found it after all," she says. "Now you understand why we keep it secret. The Whisperwind gives, but it requires discretion. Will you join our circle of Guardians?"

+ [Accept the responsibility and join the Guardians.] -> join_guardians
+ [Ask for more explanation before deciding.] -> ask_explanation
+ [Politely decline and offer to keep the secret.] -> keep_secret

=== join_guardians ===
# IMAGE: peaceful_sunset.png
# FOLEY: stop
# FOLEY: wind(pan:0, vol:0.3, gust:0.2)

You accept Mrs. Gable's offer. Over the coming months, you learn the true history of the Whisperwind ATM - an inexplicable gift from the river that has sustained Riverbend for generations, allowing the village to thrive while maintaining its peaceful character.

As a Guardian, you help maintain the balance, ensuring the ATM's gifts are used wisely and its secret remains protected. You've found not just a home in Riverbend, but a purpose.

-> END

=== keep_secret ===
# IMAGE: peaceful_sunset.png
# FOLEY: stop
# FOLEY: wind(pan:0, vol:0.3, gust:0.2)

You decide that some secrets should remain just that - secrets. You promise Mrs. Gable you'll never speak of what you've found, and she rewards your discretion with trust and friendship.

Life in Riverbend continues, peaceful and idyllic, but now you understand the subtle undercurrent that sustains this tranquil village. Sometimes, when the wind whispers through the streets, you fancy you can hear it speaking of ancient mysteries and hidden gifts.

-> END
`
