oooOO`
// Inspector Shane André-Louis: The Manor House Mystery
// Enhanced version with rich character development and minigame integration

VAR player_reputation = 50
VAR investigation_style = ""
VAR time_pressure = 3
VAR chess_game_completed = false
VAR primary_suspect = ""

# BASEHREF: media/shane/
// NOTE: Keep tag lines beginning with '#' to simple alphanumeric words and spaces.
// Complex separators like '|' or punctuation can break Ink compilation in validation.

-> start

// TESTING KNOTS - Direct Web Links for CI and Debugging
=== test_chess_position ===
# MENU Direct Link Test
# MENU TARGET chess_minigame
# MENU DESC Jump to Chess Minigame Scene
This is a direct link test for CI and debugging purposes.
-> examine_chess

=== test_character_confrontation ===
# MENU Direct Link Test
# MENU TARGET household_confrontation
# MENU DESC Jump to Character Confrontation Scene  
This is a direct link test for CI and debugging purposes.
-> household_confrontation

=== test_multiple_endings ===
# MENU Direct Link Test
# MENU TARGET deduction
# MENU DESC Jump to Multiple Endings Scene
This is a direct link test for CI and debugging purposes.
-> deduction

=== start ===

Inspector Shane André-Louis steps out of the black taxi into the November drizzle. Lightning flickers across the moors as Greystone Manor looms ahead like a brooding giant.

The Gothic towers pierce the storm clouds, their windows dark except for one - a study on the second floor where a shadow moves behind amber glass.

TAXI DRIVER: *nervously* Nasty business, this murder. Lord Pemberton was a right chess master, he was. Beat the county champion last month. Strange though... *lowers voice* heard he'd been getting death threats about his ward Victoria's inheritance.

# IMAGE: desktop/manor_with_taxi_desktop.jpg

* [Question the driver about local gossip]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: What's the word in the village about the family?
    DRIVER: *glances at the manor nervously* Young Charles has been desperate lately - gambling debts to some nasty London types. But Miss Victoria... there's whispers she and Lord Pemberton had a terrible row yesterday. Something about her real parents. And that Blackwood boy has been skulking around the grounds after dark.
    
* [Observe the manor's architecture and security]
    ~ investigation_style = "observational"
    Victorian Gothic with modern additions - new locks on the windows, electric lighting recently installed. Someone was security-conscious.
    
* [Review your case notes methodically]
    ~ investigation_style = "procedural"
    Body discovered 8 AM by maid Mary Collins. Death estimated between midnight and 2 AM. Lord Pemberton, 58, found stabbed in locked study.

- The imposing front door opens before you can knock.

-> meet_butler

=== meet_butler ===

ASHFORD: *with forced dignity, but voice cracking* Inspector André-Louis? I am Ashford, butler to the Pemberton household these thirty years. Thank heavens you've come. 

His normally impeccable appearance shows cracks - collar askew, fresh ink stains on his cuffs, and his hands shake as he takes your coat. But there's something in his eyes... relief?

ASHFORD: *voice drops to whisper* His Lordship... he discovered something terrible last night. Something about the family... about Miss Victoria's true parentage. He was going to change his will this very morning.

# IMAGE: desktop/entrance_hall_stairs_desktop.jpg

* [Put him at ease with gentle questioning]
    ~ player_reputation += 3
    ANDRÉ-LOUIS: Take your time, Mr. Ashford. I can see you cared deeply for Lord Pemberton.
    ASHFORD: *tears forming* More than cared, Inspector. I raised Master Charles from a boy. Watched Miss Victoria grow from a frightened orphan into... into someone who might have killed the man who saved her. *immediately looks stricken* Forgive me, I shouldn't have...
    
* [Press for details about the will change]
    ~ investigation_style = "direct" 
    ~ primary_suspect = "victoria"
    ANDRÉ-LOUIS: What exactly did Lord Pemberton discover about Miss Victoria? Why change the will now?
    ASHFORD: *reluctantly* Old letters, Inspector. Hidden in his safe. Proof that she... that she might not be who we thought. The inheritance, the legitimacy of her claim... it all hung in the balance.
    
* [Notice his suspicious behavior]
    ~ investigation_style = "psychological"
    ANDRÉ-LOUIS: *studying the ink stains* You've been writing this morning, Mr. Ashford. After discovering your master's body. What correspondence was so urgent?
    ASHFORD: *stiffens* I... I was notifying the solicitor about postponing the will reading. Nothing more.

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
The chess board reveals a masterful endgame position. White has just sacrificed the queen - a move so brilliant and ruthless it takes your breath away.

ANDRÉ-LOUIS: *studying the position* This isn't just any chess game. This is a master's signature move - the Pemberton Gambit. I've seen it in tournament records.

But wait... the white pieces show fresh fingerprints, and there's something odd about the positioning. The black king is in check, but someone was playing for both sides.

# IMAGE: desktop/dining_room_formal_desktop.jpg

* [Test your chess skills on this exact position] -> chess_minigame
* [Analyze the fingerprints on the pieces] -> chess_forensics  
* [Look for chess notation or game records] -> chess_records

=== examine_footprints ===
The muddy prints lead from the window to the desk and back. Size 9 or 10 boots, with a distinctive wear pattern on the left heel.

ANDRÉ-LOUIS: Someone definitely entered through this window. But why leave such obvious tracks?

# IMAGE: desktop/manor_floor_plan_desktop.jpg

-> deduction

=== chess_minigame ===
~ chess_game_completed = true

ANDRÉ-LOUIS: *concentrating deeply* Let me work through this position...

You sit at the chess board, feeling the weight of the investigation. The position is complex - a queen sacrifice that should lead to mate in three moves, but only if played perfectly.

# MENU Play Chess Minigame
# MENU URL codepen io danbri pen azOvvGX
# MENU DESC Opens Mamikon Mini Chess in new tab

*After completing the chess puzzle...*

{chess_game_completed:
    ANDRÉ-LOUIS: Extraordinary! This isn't just any game - it's the infamous Pemberton Gambit that won the county championship. But here's the crucial detail: the winning move requires accepting the queen sacrifice. Whoever was playing black refused to take the queen. They knew it was a trap.
    
    This changes everything. The killer understood chess deeply enough to recognize a master's trap. That narrows our suspects significantly.
}

-> chess_realization

=== chess_forensics ===
~ primary_suspect = "charles"

Examining the pieces under your magnifying glass reveals multiple sets of fingerprints, but one detail stands out: the black king has been moved recently, but clumsily - not by someone comfortable with the piece's weight and balance.

ANDRÉ-LOUIS: Someone unfamiliar with these particular chess pieces moved the black king. But Lord Pemberton's chess set is custom-weighted. Only family members would know how to handle them properly.

-> chess_realization

=== chess_records ===
~ primary_suspect = "victoria" 

Hidden beneath the board, you find a chess notation pad with two different handwritings. The first, elegant and flowing, records the opening moves. The second, hurried and angry, scratches out several attempted responses.

ANDRÉ-LOUIS: Two players, but one was clearly frustrated. The elegant hand matches Lord Pemberton's writing style. The angry scrawl... this is revealing.

-> chess_realization

=== chess_realization ===
The chess evidence is painting a complex picture. This wasn't a game between Lord Pemberton and an intruder - it was a family confrontation that turned deadly.

-> deduction

=== interview_mary ===
~ time_pressure--

Mary Collins huddles in the servants' hall, clutching a rosary with white knuckles. She's perhaps twenty-five, with the hollow stare of someone who's seen too much death too young.

MARY: *voice barely a whisper* Inspector, there's something I haven't told anyone. Last night... I heard them arguing. Lord Pemberton and someone else. Terrible things were said about bastards and inheritance and... and murder. But the voice... *shivers* I couldn't tell if it was Master Charles or Miss Victoria. They sound so alike when they're angry.

* [Ask about the argument she overheard]
    ~ primary_suspect = "family_quarrel"
    ANDRÉ-LOUIS: This argument - what exactly did you hear? Every detail could be crucial.
    MARY: *clutching her rosary tighter* Someone said, "You can't disinherit me now, not after what I've done for this family." And Lord Pemberton... his voice was so cold: "I know who you really are. The truth will come out." Then there was shouting about keys and safes and... and how some secrets are worth killing for.
    
* [Press for details about the locked room]
    ~ investigation_style = "methodical"
    ANDRÉ-LOUIS: Tell me about finding the body. Every detail of how that door behaved.
    MARY: *nodding rapidly* The key turned easy enough, but when I pushed... it was like someone had wedged a chair under the handle from inside. But Inspector, here's what's strange - when Mr. Ashford forced it open, that chair fell backwards, away from the door. Like it had been placed there after...

- MARY: I fetched Mr. Ashford when I couldn't get in. He had to put his shoulder to the door.

# IMAGE: desktop/servants_hall_desktop.jpg

-> deduction

=== gather_household ===
~ time_pressure--

You assemble the household in the morning room. The tension crackles like electricity before a storm. Each person sits as far from the others as possible.

Present: Charles Pemberton (nervous, chain-smoking), Victoria Ashworth (pale and defiant), Mrs. Pemberton (watching Victoria like a hawk), Mary Collins (trembling), Ashford (unnaturally composed).

ANDRÉ-LOUIS: I need everyone's whereabouts between 11 PM and 2 AM last night.

CHARLES: *stubbing out cigarette aggressively* I was in my room, reading. Alone. Had to be alone after that bloody awful dinner conversation about... *glances at Victoria* about family legitimacy.

VICTORIA: *standing suddenly, voice rising* I was walking the grounds! I couldn't bear being in the same house as people who think I'm some kind of... of impostor!

MRS. PEMBERTON: *coldly* Sit down, child. Your theatrics won't hide the fact that you had the most to lose from Edgar's discoveries. We all heard you threatening him.

MARY: *voice barely audible* I saw someone by the garden gate around midnight. A figure in a dark coat. Could have been anyone...

ASHFORD: *too controlled* I was securing the house for the night. Checking locks, as always. His Lordship insisted on extra precautions lately.

# IMAGE: desktop/butler_questioning_desktop.jpg

-> household_confrontation

=== household_confrontation ===
The family tensions are erupting before your eyes. This isn't just grief - it's years of buried resentment and fear boiling over.

VICTORIA: *to Mrs. Pemberton* You've poisoned him against me from the beginning! Made him question whether I deserved his kindness!

MRS. PEMBERTON: Deserved? You were a nameless foundling! Edgar's charity case! And now we learn you may have been planted here by enemies of this family!

CHARLES: *bitterly* Rich, coming from you, Aunt Margaret. We all know about your London debts, your secret correspondence with Father's business rivals.

The accusations fly fast and vicious. Each person here had motive, means, and opportunity. The question isn't who could have killed Lord Pemberton - it's who didn't want to.

-> deduction

=== deduction ===
~ time_pressure--

The case is a web of motives, lies, and family secrets. Each piece of evidence points in different directions, and the truth depends on which theory you choose to pursue.

Based on your investigation style and the evidence you've gathered, several theories emerge:

# IMAGE: desktop/morning_room_table_desktop.jpg

{ primary_suspect == "victoria":
  + [Accuse Victoria of the murder] -> accuse_victoria
}

{ primary_suspect == "charles" or chess_game_completed:
  + [Accuse Charles using the chess evidence] -> accuse_charles
}

{ primary_suspect == "family_quarrel":
  + [Accuse Mrs. Pemberton of orchestrating the murder] -> accuse_mrs_pemberton
}

{ investigation_style == "psychological":
  + [Expose Ashford's secret involvement] -> accuse_ashford
}

+ [Present the conspiracy theory - multiple killers] -> conspiracy_theory

+ [Suggest an outside intruder theory] -> outside_theory
    
{ time_pressure > 0:
  + [Gather more evidence first] -> investigation_choice
}

{ time_pressure <= 0:
  + [The case grows cold] -> time_up
}

=== accuse_charles ===
ANDRÉ-LOUIS: Charles Pemberton, I believe you killed your uncle in a moment of desperate fury.

The assembled household gasps. Charles goes white as chalk.

{chess_game_completed:
    ANDRÉ-LOUIS: The chess position tells the whole story. Your uncle was teaching you his famous gambit, but when you realized he was demonstrating how easily he could trap and destroy you just like he planned to do with your inheritance you snapped. The letter opener was within reach, and thirty seconds later, you were an orphan again.
    
    CHARLES: *voice breaking* He said I was weak, that I'd gambled away my birthright. That he'd rather leave everything to a foundling than a failure. I... I didn't mean to...
}

{ not chess_game_completed:
    ANDRÉ-LOUIS: The muddy footprints, the open window, the chair wedged under the door were all staging to suggest an outside intruder. But you made one mistake: the chess position. Your uncle would never have played such an aggressive opening against you unless he was trying to make a point about your own reckless nature.
    
    CHARLES: *breaking down* You don't understand the pressure I was under. Those gambling debts... Uncle could have helped, but he refused. I never meant to kill him!
}

-> resolution_charles

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

=== accuse_victoria ===
ANDRÉ-LOUIS: Miss Victoria Ashworth, I believe the truth about your parentage drove you to murder your guardian.

Victoria's defiant mask crumbles as the accusation hits home.

ANDRÉ-LOUIS: Lord Pemberton discovered you weren't the orphaned daughter of his dear friend - you were planted here by his business enemies to eventually inherit and destroy the estate from within. Last night, he confronted you with the evidence, and you killed him to keep your secret.

VICTORIA: *tears streaming* You don't understand! I grew up believing I was his ward, his beloved surrogate daughter! When he showed me those letters... proving I was raised by criminals to destroy him... I couldn't let him throw me out! This is the only family I've ever known!

-> resolution_victoria

=== accuse_mrs_pemberton ===
ANDRÉ-LOUIS: Mrs. Margaret Pemberton, you orchestrated your brother-in-law's death to protect your own secrets.

Mrs. Pemberton's composed facade cracks slightly, but she remains seated primly.

ANDRÉ-LOUIS: You've been embezzling from the estate for years to pay your London gambling debts. When Lord Pemberton discovered your theft and threatened exposure, you manipulated the family tensions to create multiple suspects - then struck while everyone was distracted by Victoria's parentage scandal.

MRS. PEMBERTON: *coldly* Prove it, Inspector. You'll find no evidence of my involvement.

-> resolution_mrs_pemberton

=== accuse_ashford ===
ANDRÉ-LOUIS: Mr. Ashford, your thirty years of loyal service hide a darker truth.

The butler's mask of grief finally slips, revealing something calculating beneath.

ANDRÉ-LOUIS: You've been Lord Pemberton's secret accomplice in investigating Victoria's background. But when you discovered she was innocent of the conspiracy you both suspected, you realized your master would expose your own embezzlement of the household accounts. You killed him to prevent your own disgrace.

ASHFORD: *quietly* Thirty years of faithful service, and he would have destroyed me over a few hundred pounds taken to care for my sick sister. I couldn't let him ruin me.

-> resolution_ashford

=== conspiracy_theory ===
ANDRÉ-LOUIS: Ladies and gentlemen, this was not the work of one person. Multiple members of this household conspired to murder Lord Pemberton.

The room erupts in shocked denials, but you raise your hand for silence.

ANDRÉ-LOUIS: Charles provided the motive and access. Victoria created the distraction with her parentage crisis. Mrs. Pemberton supplied the financial pressure. And Ashford enabled it all with his knowledge of the house. You each played your part in this elaborate revenge.

The weight of accusation hangs heavy as each person looks at the others with new suspicion.

-> resolution_conspiracy

=== resolution_charles ===
~ player_reputation += 10

The case closes with Charles confessing to manslaughter in a moment of family rage. Your methodical investigation and {chess_game_completed: chess analysis | psychological insights} cracked the case.

-> END

=== resolution_victoria ===
~ player_reputation += 8

Victoria's confession reveals a tragic victim of circumstance who became a killer to preserve the only family she'd ever known. A complex resolution to a complex case.

-> END

=== resolution_mrs_pemberton ===
~ player_reputation += 6

Mrs. Pemberton's cold manipulation is exposed, though proving her guilt remains challenging. Justice may be incomplete, but truth has been served.

-> END

=== resolution_ashford ===
~ player_reputation += 7

The trusted servant's betrayal shocks the household. His confession leads to recovery of the embezzled funds and closure for the family.

-> END

=== resolution_conspiracy ===
~ player_reputation += 5

Your conspiracy theory creates doubt but lacks definitive proof. The case may haunt this family forever, but you've exposed their web of secrets.

-> END

=== partial_resolution ===
Your theory proves compelling but incomplete. While justice isn't fully served, you've uncovered important truths about the case.

-> END
`
