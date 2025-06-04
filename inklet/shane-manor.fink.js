oooOO`
// Inspector Shane André-Louis: The Manor House Mystery

VAR player_reputation = 50
VAR investigation_style = ""
VAR time_pressure = 3

# BASEHREF: media/shane/

-> start

=== start ===

Inspector Shane André-Louis steps out of the black taxi into the November drizzle. 

The Gothic towers of Greystone Manor pierce the grey sky ahead.

TAXI DRIVER: Nasty business, this. Lord Pemberton seemed a decent sort.

# IMAGE: desktop/manor_with_taxi_desktop.jpg

* [Question the driver about local gossip]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: What's the word in the village about the family?
    DRIVER: Young Master Charles has been about more lately. Money troubles, they say. And there's talk about the ward - Miss Victoria - and that Blackwood lad.
    
* [Observe the manor's architecture and security]
    ~ investigation_style = "observational"
    Victorian Gothic with modern additions - new locks on the windows, electric lighting recently installed. Someone was security-conscious.
    
* [Review your case notes methodically]
    ~ investigation_style = "procedural"
    Body discovered 8 AM by maid Mary Collins. Death estimated between midnight and 2 AM. Lord Pemberton, 58, found stabbed in locked study.

- The imposing front door opens before you can knock.

-> meet_butler

=== meet_butler ===

ASHFORD: Inspector André-Louis? I am Ashford, the butler. Thank heavens you've arrived so quickly.

The man is clearly shaken - his usually pristine collar slightly askew, hands trembling as he takes your coat.

ASHFORD: His Lordship... it's simply unprecedented. In thirty years of service, I've never...

You notice his demeanor - professional yet clearly rattled by the morning's events.

# IMAGE: desktop/entrance_hall_stairs_desktop.jpg

* [Put him at ease with gentle questioning]
    ~ player_reputation += 3
    ANDRÉ-LOUIS: Take your time, Mr. Ashford. I understand this must be deeply disturbing.
    ASHFORD: You're very kind, Inspector. His Lordship was... he was like family to us all.
    
* [Press for immediate facts]
    ~ investigation_style = "direct"
    ANDRÉ-LOUIS: I need the essential details. Who found the body? When? Has anyone else been in the study?
    ASHFORD: Mary found him at eight this morning. The door was locked from inside - we had to use the master key.
    
* [Observe his physical state for clues]
    ~ investigation_style = "psychological"
    His hands shake, but there's something else - a slight ink stain on his right cuff. Fresh. Most butlers would have changed after such a stain.

- ASHFORD: Where would you like to begin, Inspector?

{investigation_style == "direct":
    He straightens slightly, clearly preferring structure in this chaos.
}

-> investigation_choice

=== investigation_choice ===
ASHFORD: The household is quite shaken, as you might imagine. The study has been left exactly as we found it.

The grandfather clock in the hallway chimes eleven. {time_pressure > 1: Time is precious in any murder investigation. | You sense time slipping away - witnesses' memories fade and evidence grows cold.}

* [Examine the crime scene immediately]
    ANDRÉ-LOUIS: Take me to the study at once. The scene will tell us more than words can.
    -> crime_scene
    
* [Interview the person who found the body]
    ANDRÉ-LOUIS: I must speak with Mary Collins first. First-hand accounts are invaluable.
    -> interview_mary
    
* [Gather the household together for initial statements]
    ANDRÉ-LOUIS: Please assemble everyone who was in the house last night. I'll need to speak with them all.
    -> gather_household

=== crime_scene ===
~ time_pressure--

The study door stands slightly ajar. Ashford produces a heavy brass key.

ASHFORD: This is the master key I used. Mary's key wouldn't turn - something was blocking the mechanism from inside.

The oak-paneled study reeks of tobacco and something metallic. Lord Pemberton slumps forward over his mahogany desk, a silver letter opener protruding from between his shoulder blades.

Your trained eye immediately catalogues the scene:

OBSERVATIONS:
- Window slightly ajar despite the November cold
- Safe door hanging open, contents scattered
- Chess game half-finished on the side table
- Fresh mud tracked near the window
- Cut crystal brandy glass, barely touched
- Heavy wooden chair wedged under the door handle

# IMAGE: desktop/study_crime_scene_desktop.jpg

* [Examine the open safe first]
    -> examine_safe
    
* [Study the chess position]
    -> examine_chess
    
* [Investigate the muddy footprints]
    -> examine_footprints

=== examine_safe ===
The safe contains several intriguing items:
- £500 in cash, completely untouched
- A sheaf of threatening letters bound with string
- A will dated just one week ago
- Several photographs of someone approaching the house at night

ANDRÉ-LOUIS: {investigation_style == "observational": The photographs suggest Lord Pemberton was watching someone. | Interesting - money left behind rules out simple robbery.}

# IMAGE: desktop/study_library_combo_desktop.jpg

-> deduction

=== examine_chess ===
The chess board shows a game in progress - white has just played an aggressive queen sacrifice, a risky but brilliant move.

ANDRÉ-LOUIS: Charles plays chess, according to the driver. This could be significant.

The position suggests the game was interrupted suddenly - white was about to deliver checkmate in three moves.

# IMAGE: desktop/dining_room_formal_desktop.jpg

-> deduction

=== examine_footprints ===
The muddy prints lead from the window to the desk and back. Size 9 or 10 boots, with a distinctive wear pattern on the left heel.

ANDRÉ-LOUIS: Someone definitely entered through this window. But why leave such obvious tracks?

# IMAGE: desktop/manor_floor_plan_desktop.jpg

-> deduction

=== interview_mary ===
~ time_pressure--

Mary Collins sits in the servants' hall, a cup of untouched tea growing cold before her. She's perhaps twenty-five, with red-rimmed eyes and hands that won't stop shaking.

MARY: Oh, Inspector, it was horrible. I've never seen anything like it in my life.

* [Comfort her and ask gently about finding the body]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: Take your time, Miss Collins. I know this is difficult.
    MARY: I brought his morning tea at eight sharp, like always. But the door... the door wouldn't open properly.
    
* [Press for precise details about the locked door]
    ~ investigation_style = "methodical"
    ANDRÉ-LOUIS: I need you to be very specific about the door. Exactly what happened when you tried to enter?
    MARY: The key turned, but something was blocking it from inside. I could hear scraping when I pushed.

- MARY: I fetched Mr. Ashford when I couldn't get in. He had to put his shoulder to the door.

# IMAGE: desktop/servants_hall_desktop.jpg

-> deduction

=== gather_household ===
~ time_pressure--

You assemble the household in the morning room. The tension is palpable.

Present: Charles Pemberton (nephew), Victoria Ashworth (ward), Mrs. Pemberton (sister-in-law), Mary Collins (maid), Ashford (butler).

ANDRÉ-LOUIS: I understand this is a difficult time, but I need to establish everyone's whereabouts last night.

CHARLES: We had dinner together around seven. Uncle seemed agitated about something.

VICTORIA: *quietly* There was an argument after dinner. About money.

# IMAGE: desktop/butler_questioning_desktop.jpg

-> deduction

=== deduction ===
~ time_pressure--

The pieces are starting to come together. You've gathered enough evidence to form a theory.

The locked room mystery, the family tensions, the gambling debts, and the chess game all point to one conclusion.

# IMAGE: desktop/morning_room_table_desktop.jpg

* [Accuse Charles of the murder]
    -> accuse_charles
    
* [Suggest an outside intruder]
    -> outside_theory
    
* [Gather more evidence first]
    {time_pressure > 0: -> investigation_choice | -> time_up}

=== accuse_charles ===
ANDRÉ-LOUIS: Charles Pemberton, I believe you killed your uncle using your knowledge of this house to create an impossible locked-room mystery.

The assembled household gasps. Charles goes white.

ANDRÉ-LOUIS: The chess game proves you were in the study with him. That aggressive queen sacrifice - that's your style, not his. After stabbing him, you used the old servants' bell system to barricade the door from outside.

CHARLES: *breaking down* You don't understand the pressure I was under. Those gambling debts... Uncle could have helped, but he refused. I never meant to kill him!

-> resolution

=== outside_theory ===
ANDRÉ-LOUIS: The evidence suggests an outside intruder connected to Lord Pemberton's investigation into the gambling debts.

While compelling, this theory lacks the final proof needed for conviction. The case remains officially open.

-> partial_resolution

=== time_up ===
Unfortunately, too much time has passed. Key witnesses have begun to leave, and the trail grows cold.

The case remains unsolved, though your investigation provides valuable leads for the local constabulary.

-> END

=== resolution ===
~ player_reputation += 10

ASHFORD: Inspector André-Louis, your reputation is well-deserved. How did you see through the locked room deception?

ANDRÉ-LOUIS: The chess position was the key. Lord Pemberton was a careful, defensive player, but that aggressive queen sacrifice was the move of a younger, more desperate mind.

The case closes with Charles Pemberton confessing to manslaughter. Your reputation as a detective grows.

-> END

=== partial_resolution ===
Your theory proves compelling but incomplete. While justice isn't fully served, you've uncovered important truths about the Pemberton family.

-> END
`
