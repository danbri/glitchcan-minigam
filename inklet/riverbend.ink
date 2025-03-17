-> intro

=== intro ===
[[Image: village_overview.png]]
The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations: the Whisperwind ATM.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

[[Follow the whispers. (Go on)]] -> follow_whispers
[[Settle into village life and ignore the rumors. (Go back - to a simpler start)]] -> settle_in
[[Observe the villagers closely for any unusual behavior. (Detect/Engage)]] -> observe_villagers
=== settle_in ===
[[Image: elara_cottage.png]]
You decide to embrace the tranquility of Riverbend. Days turn into weeks filled with gardening, friendly chats with neighbors about the weather, and the comforting rhythm of village life. The whispers fade into the background noise.

[[Continue enjoying the peace. (Go on - to a peaceful end?)]] -> peaceful_life
[[A nagging curiosity resurfaces. Maybe just a little look around? (Go back - to the initial choice)]] -> intro
[[Question a friendly neighbor about local legends. (Detect/Engage)]] -> question_neighbor_settled
=== peaceful_life ===
[[Image: peaceful_sunset.png]]
Years pass. You become a beloved member of Riverbend, your initial curiosity forgotten. The secret of the Whisperwind ATM remains undisturbed. You live a happy, if uneventful, life.
-> END

=== question_neighbor_settled ===
[[Image: neighbor_gardening.png]]
You chat with old Mrs. Gable, admiring her prize-winning roses. "They've been lovely this year, haven't they?" you say casually. "Anything else interesting blooming in Riverbend lately? Any old stories people still tell?"

Mrs. Gable smiles, her eyes crinkling. "Oh, dearie, every village has its tales. Mostly just to keep the young ones amused." She snips a deadhead. "Why do you ask?"

[[Just curious, it's a charming village. (Go on)]] -> peaceful_life
[[Press gently, mentioning the 'whispers'. (Detect/Engage)]] -> press_neighbor
[[Apologize for prying and change the subject. (Go back - to settling in)]] -> settle_in
=== press_neighbor ===
[[Image: mrs_gable_wary.png]]
"I've heard... little whispers," you say, lowering your voice slightly. "About something more to Riverbend than meets the eye."

Mrs. Gable's smile fades slightly. She straightens up, her gaze becoming a touch sharper. "Whispers are just the wind playing tricks, dear. Best not to pay them any mind." She returns to her roses, a subtle dismissal in her movements.

[[Drop the subject, she's clearly not going to talk. (Go on)]] -> peaceful_life
[[Mention a specific detail you might have overheard (even if you didn't). (Detect/Engage - bluff)]] -> bluff_neighbor
[[Respect her privacy and thank her for the chat. (Go back - to settling in)]] -> settle_in
=== bluff_neighbor ===
[[Image: elara_thinking.png]]
"I thought I heard something about... a hidden grove?" you venture, making it up as you go. "And perhaps... unusual sounds at night?"

Mrs. Gable pauses, her trowel hovering over a rose bush. A flicker of something unreadable crosses her face. "A hidden grove? Now where would you have heard such a thing?" Her tone is carefully neutral.

[[Claim you overheard some children talking. (Go on - plausible deniability)]] -> children_talking
[[Admit you were just speculating based on the village's quiet nature. (Go back - to pressing gently)]] -> press_neighbor
[[Shift the topic to the unusual quiet at night, suggesting a hidden activity. (Detect/Engage - change tactic)]] -> quiet_night
=== children_talking ===
[[Image: children_playing.png]]
"Oh, you know how children are," you say with a light laugh. "Imaginations running wild. They mentioned a secret place... and maybe some whirring sounds?"

Mrs. Gable studies you for a moment, her expression still uncertain. "Children do have lively imaginations. There's no hidden grove, dear, and the only whirring you'll hear is the old mill down by the river." She returns to her gardening, but you sense her gaze lingers on you briefly.

[[Let the matter drop for now. (Go on)]] -> peaceful_life
[[Casually ask if the old mill is still in use. (Detect/Engage - gather information)]] -> inquire_mill
[[Thank her and leave, feeling you might have planted a seed of doubt (or suspicion). (Go back - to bluffing)]] -> bluff_neighbor
=== inquire_mill ===
[[Image: old_mill.png]]
"The old mill," you say casually. "Is it still operational? I haven't seen much activity down that way."

Mrs. Gable shakes her head. "Not for years, dear. Fell into disrepair. Dangerous place, that. Best to stay away." Her tone is firm, almost warning you off.

[[Agree and move on. (Go on)]] -> peaceful_life
[[Express curiosity about why it was never repaired. (Detect/Engage - probe further)]] -> probe_mill
[[Thank her for the information. (Go back - to children talking)]] -> children_talking
=== probe_mill ===
[[Image: elara_questioning.png]]
"That's a shame," you say. "Such a landmark to fall into ruin. Was there ever any talk of fixing it up?"

Mrs. Gable sighs. "Some talk, years ago. But it was too costly, and the river currents shifted, made it impractical. Best forgotten, like many old things." There's a finality in her voice.

[[Accept her explanation. (Go on)]] -> peaceful_life
[[Mention that you enjoy exploring old buildings (subtly hinting at the mill). (Detect/Engage - test boundaries)]] -> test_mill_interest
[[Thank her for her time and leave. (Go back - to inquiring about the mill)]] -> inquire_mill
=== test_mill_interest ===
[[Image: elara_observing.png]]
"I do enjoy a bit of exploring," you say casually. "Old buildings have such character. I might take a walk down by the river sometime and have a look from the outside, of course."

Mrs. Gable's eyes narrow slightly. "It's really not safe, dear. Loose timbers, unstable foundations. Please, take my word for it, there's nothing to see but decay." Her concern feels a little too forceful.

[[Assure her you'll be careful (but secretly intend to go). (Go on - setting up future action)]] -> plan_mill_visit
[[Apologize for causing concern and drop the subject. (Go back - to probing the mill)]] -> probe_mill
[[Ask if anyone in the village ever goes near the mill. (Detect/Engage - direct question)]] -> direct_mill_question
=== direct_mill_question ===
[[Image: mrs_gable_stern.png]]
"Does anyone ever go near the old mill?" you ask directly.

Mrs. Gable's expression becomes stern. "No, dear. It's understood. A dangerous place, best left alone. Now, if you'll excuse me, these roses need my attention." She turns away, effectively ending the conversation.

[[Take the hint and leave. (Go on)]] -> peaceful_life
[[Thank her for her honesty (but remain suspicious). (Go back - to testing mill interest)]] -> test_mill_interest
[[Decide to investigate the mill despite her warnings. (Detect/Engage - direct action)]] -> plan_mill_visit
=== plan_mill_visit ===
[[Image: elara_planning.png]]
Mrs. Gable's strong reaction only fuels your curiosity. You decide to pay the old mill a visit, despite her warnings. You'll need to be discreet.

[[Plan to go during the day, pretending to be exploring nature. (Go on)]] -> mill_day_approach
[[Decide a nighttime visit would be more secretive. (Go back - to direct mill question, considering the risk)]] -> mill_night_approach_choice
[[Ask other villagers about the mill in a more general way, trying to gauge their reactions. (Detect/Engage - information gathering)]] -> gather_mill_info
=== gather_mill_info ===
[[Image: elara_talking_villagers.png]]
Over the next few days, you casually bring up the old mill in conversations with other villagers. Most echo Mrs. Gable's warnings about its state of disrepair. Some seem vaguely uncomfortable with the topic. No one offers any stories or alternative explanations.

[[Conclude that the mill is indeed just a dangerous ruin and drop your investigation. (Go on)]] -> peaceful_life
[[Mrs. Gable's strong reaction still bothers you; you decide to visit the mill anyway. (Go back - to planning mill visit)]] -> plan_mill_visit
[[Look for the oldest residents of the village, hoping they might have different memories of the mill. (Detect/Engage - seeking historical perspective)]] -> seek_oldest_residents
=== seek_oldest_residents ===
[[Image: old_man_bench.png]]
You seek out the oldest inhabitants of Riverbend. Old Mr. Hemlock, who sits on a bench in the square most days, seems like a good start.

"Mr. Hemlock," you say kindly, "I was wondering about the old mill. It looks like it's been abandoned for a long time."

Mr. Hemlock's eyes, cloudy with age, gaze towards the river. "The mill... aye, a long time ago now. It served its purpose."

[[Ask what its purpose was. (Go on)]] -> mill_purpose
[[Mention its current state of disrepair. (Go back - to gathering mill info, focusing on observation)]] -> gather_mill_info
[[Ask if there are any stories or legends associated with it. (Detect/Engage - direct lore question)]] -> mill_legends
=== mill_purpose ===
[[Image: mr_hemlock_thinking.png]]
"It ground grain, mostly," Mr. Hemlock replies slowly. "For the whole village. Good flour it made." He pauses, a faint smile on his lips. "Strong as the river that powered it."

[[Ask why it was abandoned. (Go on)]] -> mill_abandonment
[[Comment on how important it must have been to the village. (Go back - to seeking oldest residents, emphasizing community)]] -> seek_oldest_residents
[[Ask if he remembers when it was still in operation. (Detect/Engage - seeking timeline)]] -> mill_operation_time
=== mill_abandonment ===
[[Image: broken_mill_wheel.png]]
"The river changed its course a bit, you see," Mr. Hemlock explains. "Made it harder to get a good flow. And then... well, things changed. People started getting their flour elsewhere. It just wasn't needed anymore." He shrugs, a gesture of the inevitability of time.

[[Accept his explanation. (Go on)]] -> peaceful_life (potentially)
[[Ask if there were any other reasons besides the river and changing needs. (Detect/Engage - probing for hidden reasons)]] -> other_mill_reasons
[[Mention that Mrs. Gable seemed quite concerned about people going near it. (Go back - to mill legends, connecting to current warnings)]] -> mill_legends
=== other_mill_reasons ===
[[Image: elara_listening_intently.png]]
"Were there any other reasons the mill was abandoned?" you press gently. "It seems like something the village would have tried harder to maintain, given its history."

Mr. Hemlock's gaze drifts away again, his brow furrowed slightly. "Things... are not always as they seem, young one. Some things are best left to fade." There's a hint of something more in his tone, a shadow in his eyes.

[[Press him further, sensing he knows more. (Go on)]] -> hemlock_knows_more
[[Apologize for prying and let the subject drop. (Go back - to mill abandonment)]] -> mill_abandonment
[[Mention the rumors you've heard about unusual things in Riverbend. (Detect/Engage - indirect approach)]] -> rumors_hint
=== hemlock_knows_more ===
[[Image: mr_hemlock_hesitant.png]]
"What do you mean, 'fade'?" you ask softly, leaning closer. "Was there more to the mill's story?"

Mr. Hemlock looks around the square, as if checking who might be listening. He lowers his voice. "There are secrets in Riverbend, child. Old secrets. Things best left undisturbed." He taps his temple with a gnarled finger. "Some knowledge... is a heavy burden."

[[Ask directly about the Whisperwind ATM. (Go on - direct confrontation)]] -> ask_about_atm
[[Tell him you've heard whispers of something extraordinary. (Detect/Engage - reinforcing rumors)]] -> reinforce_whispers
[[Reassure him you can be trusted with any secret. (Go back - to other mill reasons, emphasizing trust)]] -> trust_plea
=== ask_about_atm ===
[[Image: mr_hemlock_shocked.png]]
"Are you talking about the Whisperwind ATM?" you ask, your voice barely above a whisper.

Mr. Hemlock's eyes widen in surprise, a flicker of fear crossing his face. He grabs your arm, his grip surprisingly strong. "Hush, child! Where did you hear that name?" He looks around frantically. "You must never speak of that so openly!"

[[Tell him you just overheard it. (Go on - damage control)]] -> overheard_atm
[[Ask him to explain what it is. (Detect/Engage - seeking information despite his fear)]] -> explain_atm_now
[[Apologize for being so blunt and try a gentler approach. (Go back - to hemlock knows more, backtracking slightly)]] -> gentle_approach_atm
=== overheard_atm ===
[[Image: elara_nervous.png]]
"I... I just overheard some villagers talking," you stammer, trying to appear innocent. "They were whispering... I didn't understand what it meant."

Mr. Hemlock studies your face intently, his grip on your arm loosening slightly. "Be careful who you listen to, child. And be even more careful what you repeat." He sighs, the tension in his shoulders easing a fraction. "The Whisperwind... is a dangerous secret in the wrong hands."

[[Ask him to tell you the truth about it. (Go on)]] -> truth_about_whisperwind
[[Pretend to be no longer interested. (Go back - to hemlock knows more, feigning ignorance)]] -> feign_ignorance
[[Ask if the old mill has anything to do with the Whisperwind. (Detect/Engage - making a connection)]] -> mill_atm_link
=== truth_about_whisperwind ===
[[Image: mr_hemlock_confiding.png]]
Mr. Hemlock pulls you closer, his voice a low rumble. "The Whisperwind ATM... it's real. An ancient device, powered by the river's flow in a way no one truly understands anymore. It dispenses... well, it dispenses more money than you could ever imagine. Enough to change lives, to corrupt them."

[[Ask why the village keeps it a secret. (Go on)]] -> secret_reason
[[Ask if he has ever used it. (Detect/Engage - personal experience)]] -> used_the_atm
[[Express disbelief, thinking he's telling a tall tale. (Go back - to overheard atm, questioning his reliability)]] -> question_hemlock
=== secret_reason ===
[[Image: villagers_whispering.png]]
"It's kept secret for the village's own good," Mr. Hemlock explains. "Imagine what would happen if the outside world knew. We'd be overrun. Greed would tear Riverbend apart. The knowledge is only entrusted to a few, the Guardians, who ensure it's never abused."

[[Ask how one becomes a Guardian. (Go on)]] -> become_guardian
[[Ask if the free money has ever caused problems within the village. (Detect/Engage - internal conflicts)]] -> village_problems
[[Suggest that sharing the wealth could help the whole region. (Go back - to truth about whisperwind, offering an alternative perspective)]] -> share_wealth
=== become_guardian ===
[[Image: elara_considering.png]]
"The Guardians are chosen," Mr. Hemlock says, his gaze thoughtful. "Those who show wisdom, discretion, and a true love for Riverbend above all else. It's not a path one seeks, but one is chosen for."

[[Ask who the current Guardians are. (Go on)]] -> current_guardians
[[Ask if he was ever a Guardian. (Detect/Engage - his own role)]] -> hemlock_guardian_status
[[Express your desire to help protect the village's secret. (Go back - to secret reason, offering assistance)]] -> offer_help
=== current_guardians ===
[[Image: subtle_group.png]]
Mr. Hemlock looks around the square again, his eyes lingering on a few seemingly ordinary villagers – Mrs. Gable tending her garden, the baker delivering bread, the quiet man reading by the fountain. "They walk among us," he says softly. "You would likely never know them unless they chose to reveal themselves."

[[Try to guess who they are based on their behavior. (Go on)]] -> guessing_guardians
[[Ask if there's a way to identify them. (Detect/Engage - seeking a sign)]] -> guardian_sign
[[Ask if he is one of them. (Go back - to become guardian, direct question about his status)]] -> hemlock_guardian_status
=== guessing_guardians ===
[[Image: elara_observing_villagers.png]]
You subtly observe the villagers Mr. Hemlock seemed to notice. Mrs. Gable is certainly protective. The baker is always generous with his loaves. The quiet man seems very observant. But it's all just speculation.

[[Approach one of them and try to subtly hint at your knowledge. (Go on)]] -> hint_to_guardian
[[Decide it's too risky to approach them directly. (Go back - to current guardians, respecting their secrecy)]] -> respect_secrecy
[[Ask Mr. Hemlock for a more concrete clue. (Detect/Engage - requesting more information)]] -> concrete_clue
=== hint_to_guardian ===
[[Image: elara_talking_mrs_gable.png]]
You approach Mrs. Gable, admiring her roses again. "You seem to know a lot about Riverbend," you say casually. "Its history... and perhaps some of its more... unconventional aspects?" You watch her reaction closely.

[[Her reaction is cautious, repeating her earlier warnings. (Go on)]] -> gable_cautious_again
[[She seems to recognize your subtle hint, a knowing look in her eyes. (Detect/Engage - positive reaction)]] -> gable_knows
[[She looks confused and asks what you mean. (Go back - to guessing guardians, your hint was too obscure)]] -> hint_too_obscure
=== gable_cautious_again ===
[[Image: mrs_gable_unconvinced.png]]
Mrs. Gable's expression remains guarded. "Riverbend is a simple village, dear. Its history is written in its stones and its river. There are no unconventional aspects, just the quiet rhythm of life."

[[Press her gently, mentioning the old mill again. (Go on)]] -> press_gable_mill
[[Back off, realizing you might have been too forward. (Go back - to guessing guardians)]] -> respect_secrecy
[[Casually mention the "whispers" you've heard, seeing if she reacts differently this time. (Detect/Engage - testing her awareness)]] -> test_whispers_again
=== gable_knows ===
[[Image: mrs_gable_subtle_nod.png]]
A faint smile plays on Mrs. Gable's lips, and a knowing glint appears in her eyes. "Some of Riverbend's treasures are not so easily seen, are they, dear?" she says softly, her voice barely audible.

[[Ask her directly if she is a Guardian. (Go on)]] -> ask_guardian_direct
[[Try to subtly inquire about the Whisperwind ATM. (Detect/Engage - approaching the topic carefully)]] -> inquire_atm_subtly
[[Thank her for her subtle confirmation and leave, deciding to process this new information. (Go back - to hinting to guardian, feeling successful)]] -> process_confirmation
=== press_gable_mill ===
[[Image: mrs_gable_firm.png]]
"But the old mill..." you begin, "it seems like there's more to its story than just disrepair."

Mrs. Gable's tone becomes firm. "The mill is dangerous, dear. Please, let it be." Her eyes hold a warning.

[[Respect her warning and change the subject. (Go on)]] -> peaceful_life (likely ending this path)
[[Mention that Mr. Hemlock seemed to recall more about its history. (Detect/Engage - using Hemlock as leverage)]] -> mention_hemlock_gable
[[Decide to visit the mill despite her warnings. (Go back - to planning mill visit)]] -> plan_mill_visit
=== mention_hemlock_gable ===
[[Image: mrs_gable_surprised.png]]
"Mr. Hemlock was telling me a little about the mill," you say casually. "He seemed to remember it being quite important to the village."

A flicker of surprise crosses Mrs. Gable's face. "Mr. Hemlock... he has a long memory." Her tone is neutral, but you sense a shift.

[[Ask if Mr. Hemlock knows more about the "unconventional" aspects of Riverbend. (Go on)]] -> ask_hemlock_unconventional
[[Say that Mr. Hemlock seemed concerned about people going near the mill. (Detect/Engage - highlighting the warning)]] -> hemlock_warning_gable
[[Thank her for her time and leave, feeling you might have created a connection between her and Hemlock's knowledge. (Go back - to pressing gable mill)]] -> press_gable_mill
=== test_whispers_again ===
[[Image: mrs_gable_listening.png]]
"Those little whispers you hear on the wind..." you say, making eye contact with Mrs. Gable. "They seem to carry tales of more than just a quiet village."

Mrs. Gable studies you, her expression unreadable. "The wind carries many things, dear. Dreams, secrets... and sometimes just the rustling of leaves."

[[Try a more direct approach, mentioning the ATM again (now that you suspect she knows). (Go on)]] -> direct_atm_gable
[[Pretend you were just speaking poetically about the village's atmosphere. (Go back - to gable cautious again, diffusing the situation)]] -> gable_cautious_again
[[Ask if the wind ever whispers about a hidden source of prosperity. (Detect/Engage - more pointed question)]] -> pointed_whisper_gable
=== direct_atm_gable ===
[[Image: mrs_gable_serious.png]]
"I've heard whispers of something called the Whisperwind ATM," you say, your voice low and steady. "Is there any truth to that?"

Mrs. Gable's pleasant demeanor vanishes. Her eyes become serious, her gaze intense. "Who told you that?" Her voice is sharp, betraying a hint of alarm.

[[Tell her it was Mr. Hemlock. (Go on - revealing your source)]] -> blame_hemlock_gable
[[Refuse to say, protecting Mr. Hemlock. (Go back - to testing whispers again, being more evasive)]] -> evasive_gable
[[Try to downplay it as just a silly rumor you overheard. (Detect/Engage - damage control)]] -> downplay_rumor_gable
=== blame_hemlock_gable ===
[[Image: mrs_gable_thoughtful.png]]
"It was Mr. Hemlock who mentioned it," you say truthfully.

Mrs. Gable's expression softens slightly, replaced by a thoughtful frown. "Old Mr. Hemlock... sometimes his memories wander." She sighs. "Still, it's not a name that should be spoken lightly."

[[Ask her to confirm if it's real. (Go on)]] -> confirm_atm_gable
[[Express concern for Mr. Hemlock if he shouldn't be talking about it. (Detect/Engage - showing concern)]] -> concern_hemlock_gable
[[Ask if Mr. Hemlock is one of the Guardians. (Go back - to asking guardian direct, connecting the dots)]] -> ask_guardian_direct
=== confirm_atm_gable ===
[[Image: mrs_gable_nod.png]]
Mrs. Gable looks around discreetly before leaning in. "Yes," she whispers. "The Whisperwind is real. But you must understand, this knowledge carries a great responsibility."

[[Tell her you are responsible and want to learn more. (Go on)]] -> elara_responsible
[[Ask to see it. (Detect/Engage - direct request)]] -> request_see_atm
[[Ask why it's so important to keep it secret. (Go back - to secret reason, seeking her perspective)]] -> secret_reason_gable
=== intro ===
[[Image: village_overview.png]]
The village of Riverbend nestled beside its namesake river, seems peaceful. Smoke curls from chimney pots, children laugh in the square, and the gentle murmur of the water fills the air. But Riverbend holds a secret, a carefully guarded piece of knowledge passed down through generations: the Whisperwind ATM.

You are Elara, a newcomer to Riverbend, drawn by the quiet charm. However, whispers on the wind speak of something more... something extraordinary hidden within the seemingly ordinary.

[[Follow the whispers. (Go on)]] -> follow_whispers
[[Settle into village life and ignore the rumors. (Go back - to a simpler start)]] -> settle_in
[[Observe the villagers closely for any unusual behavior. (Detect/Engage)]] -> observe_villagers
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
[[Directly ask a villager what they were talking about. (Detect/Engage - direct confrontation)]] -> direct_question_eavesdrop
=== follow_villager ===
[[Image: elara_following.png]]
You discreetly tail a villager you've noticed engaging in hushed conversations – perhaps the baker, who often seems to have secretive meetings in the early morning. He leads you through winding paths, eventually arriving at...

[[The old mill. (Go on)]] -> mill_day_approach (if during day) OR mill_night_approach_choice (if night)
[[A seemingly ordinary cottage on the edge of the village. (Go back - to eavesdrop, the baker wasn't the right lead)]] -> eavesdrop
[[He notices you following him. (Detect/Engage - confrontation)]] -> baker_confronts
=== seek_secret_place ===
[[Image: elara_searching.png]]
You look for locations in Riverbend that seem out of the ordinary or could potentially house a secret – perhaps an overgrown part of the woods, a forgotten cellar, or the dilapidated old mill.

[[Investigate the old mill. (Go on)]] -> mill_day_approach
[[Explore the woods beyond the village. (Go back - to follow whispers)]] -> follow_whispers
[[Ask a local about any unusual or abandoned places in the area. (Detect/Engage)]] -> ask_about_abandoned
=== ask_about_abandoned ===
[[Image: elara_asking_local.png]]
You casually ask a friendly local about any old or unused buildings in the vicinity. They mention the old mill, of course, and perhaps an old root cellar behind the church, or a long-forgotten well in the north field.

[[Decide to investigate the old mill. (Go on)]] -> mill_day_approach
[[Check out the root cellar. (Go back - to seek secret place)]] -> seek_secret_place
[[Inquire further about why these places were abandoned. (Detect/Engage - probing for reasons)]] -> probe_abandonment
=== mill_day_approach ===
[[Image: elara_approaching_mill_day.png]]
Under the guise of exploring nature, you approach the old mill during the day. It looks even more dilapidated up close – broken windows, rotting timbers, and an eerie silence surrounding it.

[[Venture inside the mill. (Go on)]] -> inside_mill
[[Observe the exterior closely for any unusual features or signs of activity. (Go back - to plan mill visit or seek secret place)]] -> mill_exterior_observe
[[Decide it's too risky during the day and leave. (Detect/Engage - reconsidering strategy)]] -> plan_mill_visit
=== mill_night_approach_choice ===
[[Image: elara_planning_night.png]]
A nighttime visit to the mill would be more secretive, but also potentially more dangerous.

[[Proceed with the nighttime visit. (Go on)]] -> mill_night_approach
[[Decide a daytime exploration would be safer. (Go back - to plan mill visit)]] -> mill_day_approach
[[Gather more information about the mill and the surrounding area before going at night. (Detect/Engage - reconnaissance)]] -> gather_mill_info
=== mill_night_approach ===
[[Image: elara_approaching_mill_night.png]]
Under the cover of darkness, you cautiously approach the old mill. The shadows play tricks on your eyes, and the sound of the river rushing nearby adds to the atmosphere of mystery.

[[Try to find a way inside. (Go on)]] -> inside_mill_night
[[Circle the mill, looking for any signs of recent activity or light. (Go back - to mill night approach choice)]] -> mill_exterior_night_observe
[[Suddenly hear a noise inside. (Detect/Engage - unexpected event)]] -> noise_inside_mill
=== inside_mill ===
[[Image: inside_dilapidated_mill.png]]
You carefully step inside the mill. Dust motes dance in the faint light filtering through cracks in the walls. The air is damp and smells of decay. The old machinery stands silent and rusted.

[[Search for anything unusual. (Go on)]] -> search_mill_interior
[[Hear a sudden creaking sound. (Detect/Engage - warning sign)]] -> creaking_mill
[[Decide it's too dangerous and leave. (Go back - to mill day approach)]] -> mill_day_approach
=== search_mill_interior ===
[[Image: elara_searching_details.png]]
You examine the mill, looking for anything that doesn't fit – a modern lock, unusual wiring, a hidden room. Behind a crumbling wall, you notice...

[[A sturdy metal door, seemingly out of place. (Go on)]] -> metal_door
[[Just more old machinery and debris. (Go back - to inside mill)]] -> inside_mill
[[A faint humming sound coming from deeper within the mill. (Detect/Engage - auditory clue)]] -> humming_sound
=== metal_door ===
[[Image: elara_metal_door.png]]
The metal door is set into the stone wall, surprisingly solid and well-maintained. It has a keypad lock.

[[Try to guess the code. (Go on - risky attempt)]] -> guess_code
[[Look for any clues to the code nearby. (Detect/Engage - puzzle solving)]] -> look_for_clues
[[Decide to try and force the door open. (Go back - to search mill interior, considering other options)]] -> search_mill_interior
=== look_for_clues ===
[[Image: elara_looking_for_clues.png]]
You carefully examine the area around the metal door for any symbols, numbers, or patterns that might hint at the keypad code. You notice...

[[Faint etchings on a nearby gear – Roman numerals? (Go on)]] -> roman_numerals
[[Nothing obvious, just dust and decay. (Go back - to metal door)]] -> metal_door
[[A small, almost hidden inscription above the door. (Detect/Engage - a message?)]] -> hidden_inscription
=== hidden_inscription ===
[[Image: elara_reading_inscription.png]]
The inscription is in an old dialect, but you can make out a few key words: "River's Bounty," "Whispering Wind," and a sequence of numbers that might be a date.

[[Try entering the numbers as the code. (Go on)]] -> enter_date_code
[[Try to decipher the meaning of the inscription further. (Detect/Engage - deeper analysis)]] -> decipher_inscription
[[Remember the Roman numerals on the gear and wonder if they are related. (Go back - to look for clues, connecting observations)]] -> roman_numerals
=== roman_numerals ===
[[Image: elara_roman_numerals.png]]
The Roman numerals etched on the gear seem to represent the numbers 5, 8, and 12. Could this be part of the code?

[[Try entering these numbers in various orders. (Go on)]] -> try_roman_codes
[[Consider if these numbers relate to something else in the village. (Detect/Engage - village knowledge)]] -> roman_numeral_meaning
[[Look for other gears or similar markings. (Go back - to look for clues)]] -> look_for_clues
