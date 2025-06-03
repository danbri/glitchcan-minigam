# BASEHREF: media/



-> intro

=== intro ===

# IMAGE: villaged/village_overview.png

The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations: the Whisperwind ATM.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

+ [Follow the whispers.] -> follow_whispers
+ [Settle into village life and ignore the rumors.] -> settle_in

=== settle_in ===
# IMAGE: villaged/elara_cottage.png
You decide to embrace the tranquility of Riverbend. Days turn into weeks filled with gardening, friendly chats with neighbors about the weather, and the comforting rhythm of village life. The whispers fade into the background noise.

+ [Continue enjoying the peace.] -> peaceful_life
+ [A nagging curiosity resurfaces. Maybe just a little look around?] -> intro
+ [Question a friendly neighbor about local legends.] -> question_neighbor_settled

=== peaceful_life ===
# IMAGE: villaged/peaceful_sunset.png
Years pass. You become a beloved member of Riverbend, your initial curiosity forgotten. The secret of the Whisperwind ATM remains undisturbed. You live a happy, if uneventful, life.
-> END

=== question_neighbor_settled ===
# IMAGE: villaged/neighbor_gardening.png
You chat with old Mrs. Gable, admiring her prize-winning roses. "They've been lovely this year, haven't they?" you say casually. "Anything else interesting blooming in Riverbend lately? Any old stories people still tell?"

Mrs. Gable smiles, her eyes crinkling. "Oh, dearie, every village has its tales. Mostly just to keep the young ones amused." She snips a deadhead. "Why do you ask?"

+ [Just curious, it's a charming village.] -> peaceful_life
+ [Press gently, mentioning the 'whispers'.] -> press_neighbor
+ [Apologize for prying and change the subject.] -> settle_in

=== press_neighbor ===
# IMAGE: villaged/mrs_gable_wary.png
"I've heard... little whispers," you say, lowering your voice slightly. "About something more to Riverbend than meets the eye."

Mrs. Gable's smile fades slightly. She straightens up, her gaze becoming a touch sharper. "Whispers are just the wind playing tricks, dear. Best not to pay them any mind." She returns to her roses, a subtle dismissal in her movements.

+ [Drop the subject, she's clearly not going to talk.] -> peaceful_life
+ [Mention a specific detail you might have overheard.] -> bluff_neighbor
+ [Respect her privacy and thank her for the chat.] -> settle_in

=== bluff_neighbor ===
# IMAGE: villaged/elara_thinking.png
"I thought I heard something about... a hidden grove?" you venture, making it up as you go. "And perhaps... unusual sounds at night?"

Mrs. Gable's eyes narrow. She sets down her gardening shears with deliberate care. "Young lady, I don't know what you think you've heard, but I suggest you focus on the present rather than chasing shadows." Her tone is final.

+ [Back down and change the subject to gardening.] -> peaceful_life
+ [Persist with questions about the mill.] -> mill_approach

=== mill_approach ===
# IMAGE: villaged/children_playing.png
Despite Mrs. Gable's warnings, you find yourself drawn to the old mill at the edge of the village. Children play in the field nearby, their laughter carrying on the wind as they chase each other in endless games of tag.

You notice they give the mill a wide berth, never venturing too close to its crumbling walls.

+ [Approach the mill directly.] -> mill_direct
+ [Wait and observe the mill from a distance first.] -> mill_observe
+ [Ask the children about the mill.] -> ask_children

=== mill_observe ===
# IMAGE: villaged/old_mill.png
You find a comfortable spot on a nearby hillside and settle in to watch the mill. Hours pass. Nothing seems particularly unusual about the dilapidated structure, but you notice that even the birds seem to avoid perching on its broken eaves.

As the sun begins to set, you catch sight of a figure moving near the mill's entrance - someone in a dark cloak, moving with purpose.

+ [Follow the cloaked figure.] -> follow_figure
+ [Wait until they leave, then investigate.] -> mill_direct
+ [Head home - this feels too dangerous.] -> settle_in

=== ask_children ===
# IMAGE: villaged/elara_questioning.png
You approach a group of children playing with hoops and sticks. "Hello there! That's quite an old mill over there, isn't it?"

A freckled boy looks up. "Oh, that? Mummy says we mustn't go near. Says it's not safe 'cause of the broken bits." He points to the crumbling stone walls.

A girl with pigtails pipes up, "Tommy's brother went in once and came out all white-faced! Wouldn't say what he saw."

+ [Ask what Tommy's brother saw.] -> probe_children
+ [Thank them and move away from the mill.] -> settle_in
+ [Suggest they all go play somewhere safer.] -> protective_response

=== probe_children ===
# IMAGE: villaged/elara_observing.png
"What did Tommy's brother see?" you ask gently, crouching down to their level.

The children exchange glances. The freckled boy lowers his voice conspiratorially. "He said there were strange noises. Like... like machinery, but the mill hasn't worked for years and years."

"And lights!" adds the girl. "Blue lights that don't flicker like candles."

Their excitement is infectious, but you notice an adult approaching - a stern-looking woman who must be one of their mothers.

+ [Thank the children quickly and walk away.] -> mill_direct
+ [Greet the approaching adult normally.] -> meet_mother
+ [Quickly ask where Tommy lives.] -> find_tommy

=== meet_mother ===
# IMAGE: villaged/mrs_gable_stern.png
The woman reaches your group with a brisk stride. "Children, you know better than to bother visitors with your wild stories." She turns to you with a polite but firm smile. "I'm sorry if they've been filling your head with nonsense about the old mill. Children do love their ghost stories."

"Not to worry," you reply. "I was just admiring the historical architecture."

"Quite right. The mill's been abandoned for decades - too dangerous for exploration, I'm afraid. Structural integrity and all that." Her tone suggests the conversation is over.

+ [Accept her explanation and walk away.] -> settle_in
+ [Ask about the mill's history.] -> mill_history
+ [Mention you're new to the village and interested in local landmarks.] -> newcomer_approach

=== mill_history ===
# IMAGE: villaged/elara_planning.png
"I'm quite interested in local history," you say casually. "How long has the mill been abandoned?"

The woman's expression softens slightly. "Oh, since before I was born. My grandmother used to tell stories about it - apparently it was quite prosperous once, grinding grain for the whole region. But that was long ago."

"Any particular reason it was abandoned?"

Her smile becomes more forced. "Economics, I'd imagine. Modern mills made the old ones obsolete." She gathers the children with efficient movements. "Come along now, little ones. Supper time."

+ [Follow up about her grandmother's stories.] -> grandmother_stories
+ [Let them go and investigate the mill yourself.] -> mill_direct
+ [Thank her and head back to the village center.] -> settle_in

=== follow_whispers ===
# IMAGE: villaged/elara_listening_wind.png
Intrigued by the rumors, you decide to pay closer attention to the "whispers on the wind." You notice hushed conversations among some villagers, fleeting glances exchanged, and a general air of secrecy beneath the surface of everyday life.

+ [Try to eavesdrop on these hushed conversations.] -> eavesdrop
+ [Follow someone who seems to be part of these secret discussions.] -> follow_villager
+ [Ask direct questions about what people are whispering about.] -> direct_questions

=== eavesdrop ===
# IMAGE: villaged/elara_hiding.png
You discreetly try to listen in on groups of villagers talking. Their voices often drop to a murmur, and they tend to stop talking or change the subject when you approach. You catch fragmented phrases: "...the flow must be maintained...", "...the balance...", "...not for outsiders..."

+ [Try to follow a villager who seems to be involved in these conversations.] -> follow_villager
+ [Approach someone directly and ask what they're discussing.] -> direct_questions
+ [Investigate the old mill that several people mentioned in hushed tones.] -> mill_direct

=== follow_villager ===
# IMAGE: villaged/elara_following.png
You discreetly tail a villager you've noticed engaging in hushed conversations – perhaps the baker, who often seems to have secretive meetings in the early morning. He leads you through winding paths, eventually arriving at...

+ [The old mill.] -> mill_direct
+ [A hidden grove behind the village.] -> hidden_grove
+ [The riverbank where few people go.] -> riverbank

=== mill_direct ===
# IMAGE: villaged/elara_searching.png
You approach the old mill with determination. The structure looms before you, its broken wheel silent and still. Vines have claimed much of the stonework, and several windows are boarded up or broken entirely.

+ [Circle the building looking for a way in.] -> circle_mill
+ [Try the main door.] -> main_door
+ [Look for anyone else around before proceeding.] -> look_around

=== main_door ===
# IMAGE: villaged/elara_approaching_mill_day.png
The main door is heavy oak, weathered but surprisingly solid. When you push against it, it swings open with a protesting creak that echoes in the mill's interior.

+ [Step inside cautiously.] -> enter_mill
+ [Call out to see if anyone is inside.] -> call_inside
+ [Close the door and look for another entrance.] -> circle_mill

=== enter_mill ===
# IMAGE: villaged/elara_approaching_mill_day.png
Stepping across the threshold, you're immediately struck by how different the interior feels from what you expected. While the exterior is crumbling and overgrown, the inside is... cleaner somehow. Dust motes dance in shafts of sunlight, but there's an underlying sense of... maintenance? 

+ [Explore the main floor.] -> explore_main
+ [Look for stairs to other levels.] -> find_stairs
+ [Examine the old milling equipment.] -> examine_equipment

=== explore_main ===
# IMAGE: villaged/old_mill.png
You carefully step inside the mill. Dust motes dance in the faint light filtering through cracks in the walls. The air is damp and smells of decay. The old machinery stands silent and rusted.

But as you look more carefully, you notice something odd...

+ [Search for anything unusual.] -> search_mill
+ [Examine the machinery more closely.] -> examine_machinery
+ [Look for a way to the upper floors.] -> find_stairs

=== search_mill ===
# IMAGE: villaged/inside_dilapidated_mill.png
You examine the mill, looking for anything that doesn't fit – a modern lock, unusual wiring, a hidden room. Behind a crumbling wall, you notice something that makes your heart race...

+ [A sturdy metal door, seemingly out of place.] -> metal_door
+ [Fresh footprints in the dust.] -> footprints
+ [Strange markings on the wall.] -> wall_markings

=== metal_door ===
# IMAGE: villaged/search_mill_interior.png
The metal door is set into the stone wall, surprisingly solid and well-maintained. It has a keypad lock – clearly modern technology in this ancient building.

+ [Look for any clues to the code nearby.] -> look_for_clues
+ [Try some obvious combinations.] -> try_codes
+ [Search for another way around.] -> search_around

=== look_for_clues ===
# IMAGE: villaged/metal_door.png
You carefully examine the area around the metal door for any symbols, numbers, or patterns that might hint at the keypad code. After several minutes of searching, you notice...

+ [Faint etchings on a nearby gear – Roman numerals?] -> roman_numerals
+ [A sequence of worn spots on certain keys.] -> worn_keys
+ [A hidden message carved into the door frame.] -> hidden_message

=== roman_numerals ===
# IMAGE: villaged/look_for_clues.png
The Roman numerals etched on the gear seem to represent the numbers 5, 8, and 12. Could this be part of the code?

+ [Try entering these numbers in order: 5-8-12.] -> correct_code
+ [Try entering them in reverse: 12-8-5.] -> wrong_code
+ [Look for more clues before trying any combination.] -> more_clues

=== correct_code ===
# IMAGE: villaged/hidden_inscription.png
With a soft beep, the keypad accepts your code! The heavy metal door slides open with a hydraulic hiss, revealing a small, clean chamber. Inside is what appears to be an ATM machine, but unlike any you've seen before. Its interface glows with a soft blue light, and above the screen are the words "WHISPERWIND - River's Bounty."

You've discovered Riverbend's secret. What will you do with this knowledge?

+ [Use the ATM to see what happens.] -> use_atm
+ [Document this discovery and leave.] -> document_discovery
+ [Look for someone to ask about this.] -> find_someone

=== use_atm ===
# IMAGE: villaged/roman_numerals.png
The machine hums as you approach. The screen shows a simple message: "Welcome, Seeker. The river provides for those who respect its flow." A slot opens, and to your amazement, it dispenses several crisp hundred-dollar bills.

As you take the money, you notice Mrs. Gable standing in the doorway behind you. She doesn't seem surprised.

"So, you found it after all," she says. "Now you understand why we keep it secret. The Whisperwind gives, but it requires discretion. Will you join our circle of Guardians?"

+ [Accept the responsibility and join the Guardians.] -> join_guardians
+ [Ask for more explanation before deciding.] -> ask_explanation
+ [Politely decline and offer to keep the secret.] -> keep_secret

=== join_guardians ===
# IMAGE: villaged/metal_door.png
You accept Mrs. Gable's offer. Over the coming months, you learn the true history of the Whisperwind ATM - an inexplicable gift from the river that has sustained Riverbend for generations, allowing the village to thrive while maintaining its peaceful character.

As a Guardian, you help maintain the balance, ensuring the ATM's gifts are used wisely and its secret remains protected.

-> END

=== keep_secret ===
# IMAGE: villaged/metal_door.png
You decide that some secrets should remain just that - secrets. You promise Mrs. Gable you'll never speak of what you've found, and she rewards your discretion with trust and friendship.

Life in Riverbend continues, peaceful and idyllic, but now you understand the subtle undercurrent that sustains this tranquil village.

-> END