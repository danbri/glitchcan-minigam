# **Inspector Shane André-Louis: The Manor House Mystery**
*Written in Ink*

```ink
VAR player_reputation = 50
VAR evidence_found = ()
VAR suspects_met = ()
VAR investigation_style = ""
VAR time_pressure = 3

LIST Evidence = muddy_footprints, open_safe, gambling_debts, new_will, 
                chair_barricade, surveillance_photos, threatening_letters,
                chess_position, locked_door, family_tensions, bloody_letter_opener,
                brandy_glass, servants_bell_system

LIST Suspects = charles_pemberton, victoria_ashworth, james_blackwood, 
               mary_collins, ashford_butler, mrs_pemberton

LIST Deductions = inside_job, outside_intruder, crime_of_passion, 
                 financial_motive, inheritance_scheme, gambling_connection

=== start ===
Inspector Shane André-Louis steps out of the black taxi into the November drizzle. His colleagues at Scotland Yard call him "Andalou" - a nickname that stuck after someone noticed his crime scene sketches had an oddly surreal quality, like frames from an art film.

The Gothic towers of Greystone Manor pierce the grey sky ahead.

TAXI DRIVER: Nasty business, this. Lord Pemberton seemed a decent sort.

* [Question the driver about local gossip]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: What's the word in the village about the family?
    DRIVER: Young Master Charles has been about more lately. Money troubles, they say. And there's talk about the ward - Miss Victoria - and that Blackwood lad.
    ~ evidence_found += family_tensions
    ~ suspects_met += (charles_pemberton, victoria_ashworth, james_blackwood)
    
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

~ suspects_met += ashford_butler

* [Put him at ease with gentle questioning]
    ~ player_reputation += 3
    ANDRÉ-LOUIS: Take your time, Mr. Ashford. I understand this must be deeply disturbing.
    ASHFORD: You're very kind, Inspector. His Lordship was... he was like family to us all.
    
* [Press for immediate facts]
    ~ investigation_style = "direct"
    ANDRÉ-LOUIS: I need the essential details. Who found the body? When? Has anyone else been in the study?
    ASHFORD: Mary found him at eight this morning. The door was locked from inside - we had to use the master key.
    ~ evidence_found += locked_door
    
* [Observe his physical state for clues]
    ~ investigation_style = "psychological"
    His hands shake, but there's something else - a slight ink stain on his right cuff. Fresh. Most butlers would have changed after such a stain.

- ASHFORD: Where would you like to begin, Inspector?

{ investigation_style == "direct":
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

~ evidence_found += chair_barricade

The oak-paneled study reeks of tobacco and something metallic. Lord Pemberton slumps forward over his mahogany desk, a silver letter opener protruding from between his shoulder blades.

~ evidence_found += bloody_letter_opener

Your trained eye immediately catalogues the scene:

OBSERVATIONS:
- Window slightly ajar despite the November cold
- Safe door hanging open, contents scattered
- Chess game half-finished on the side table
- Fresh mud tracked near the window
- Cut crystal brandy glass, barely touched
- Heavy wooden chair wedged under the door handle

~ evidence_found += (open_safe, chess_position, muddy_footprints, brandy_glass)

* [Examine the open safe first]
    -> examine_safe
    
* [Study the chess position - it might reveal Lord Pemberton's last visitor]
    -> examine_chess
    
* [Investigate the muddy footprints by the window]
    -> examine_footprints
    
* [Check how the chair barricade worked]
    -> examine_barricade

=== examine_safe ===
The safe contains several intriguing items:
- £500 in cash, completely untouched
- A sheaf of threatening letters bound with string
- A will dated just one week ago
- Several photographs of someone approaching the house at night

~ evidence_found += (gambling_debts, new_will, surveillance_photos)

ANDRÉ-LOUIS: {investigation_style == "observational": The photographs suggest Lord Pemberton was watching someone. | Interesting - money left behind rules out simple robbery.}

* [Read the threatening letters]
    The letters mention gambling debts owed to "certain parties" in London. Amounts ranging from £200 to £500 - serious money.
    One letter warns: "Pay up or face consequences beyond mere embarrassment."
    
* [Examine the new will carefully]
    The will shows a dramatic change - if Charles Pemberton should predecease his uncle, everything goes to Victoria Ashworth rather than Mrs. Pemberton.
    A codicil added in different ink mentions "recent disturbing behavior."
    
* [Study the surveillance photographs]
    The photos show a figure in dark clothing approaching through the garden. The person appears to know the layout well - avoiding the graveled paths that would crunch underfoot.

- -> crime_scene_deduction

=== examine_chess ===
The chess board shows a game in progress - white has just played a aggressive queen sacrifice, a risky but brilliant move.

{suspects_met ? charles_pemberton:
    ANDRÉ-LOUIS: Charles plays chess, according to the driver. This could be significant.
}

The position suggests the game was interrupted suddenly - white was about to deliver checkmate in three moves.

~ evidence_found += chess_position

* [Consider who might play such an aggressive style]
    This is not the careful, defensive play of an older man. Someone younger, more reckless, made this move.
    
* [Look for clues about when the game was played]
    The pieces are slightly dusty except for the recently moved queen. This game happened within the last day or two.

- -> crime_scene_deduction

=== examine_footprints ===
The muddy prints lead from the window to the desk and back. Size 9 or 10 boots, with a distinctive wear pattern on the left heel.

~ evidence_found += muddy_footprints

ANDRÉ-LOUIS: Someone definitely entered through this window. But why leave such obvious tracks?

* [Follow the trail more carefully]
    The prints overlay each other - whoever this was made multiple trips between window and desk. Searching for something specific.
    
* [Examine the window mechanism]
    The window catch is broken - recently, by the look of fresh wood splinters. But it was broken from the inside, not outside.

- -> crime_scene_deduction

=== examine_barricade ===
The heavy oak chair was wedged firmly under the door handle. But there's something odd about its position.

~ evidence_found += servants_bell_system

Behind the chair, you notice an old servants' bell pull - a rope system that runs through the walls to summon staff.

ANDRÉ-LOUIS: Interesting. These old bell systems run throughout the house...

* [Test if the bell pull could move the chair]
    With the right leverage, someone could potentially pull the chair into position from another room connected to the bell system.
    
* [Check where the bell system leads]
    The rope disappears into the wall, heading toward what must be the servants' quarters.

- -> crime_scene_deduction

=== crime_scene_deduction ===
~ time_pressure--

{evidence_found ? (open_safe, muddy_footprints, chair_barricade):
    The scene tells a complex story - an apparent break-in, but with sophisticated attempts to create a locked room mystery.
}

{evidence_found ? (chess_position, new_will):
    Personal connections and family tensions seem central to this crime.
}

ASHFORD: {evidence_found ? servants_bell_system: Have you finished examining the bell system, Inspector? | What have you concluded from the scene, Inspector?}

{time_pressure <= 1:
    ASHFORD: Inspector, I hate to press, but the family is growing quite anxious. They've been waiting in the morning room.
}

* [Interview Mary Collins, who found the body]
    -> interview_mary
    
* [Question the family members about last night]
    -> gather_household
    
* [Examine the servants' bell system more thoroughly]
    -> investigate_bells
    
* {evidence_found ? (new_will, gambling_debts)} [Confront Charles Pemberton with the evidence]
    -> confront_charles

=== interview_mary ===
~ time_pressure--

Mary Collins sits in the servants' hall, a cup of untouched tea growing cold before her. She's perhaps twenty-five, with red-rimmed eyes and hands that won't stop shaking.

~ suspects_met += mary_collins

MARY: Oh, Inspector, it was horrible. I've never seen anything like it in my life.

* [Comfort her and ask gently about finding the body]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: Take your time, Miss Collins. I know this is difficult.
    MARY: I brought his morning tea at eight sharp, like always. But the door... the door wouldn't open properly.
    
* [Press for precise details about the locked door]
    ~ investigation_style = "methodical"
    ANDRÉ-LOUIS: I need you to be very specific about the door. Exactly what happened when you tried to enter?
    MARY: The key turned, but something was blocking it from inside. I could hear scraping when I pushed.
    
* [Ask about Lord Pemberton's recent mood and behavior]
    ANDRÉ-LOUIS: Had his Lordship seemed troubled lately? Any changes in his routine?
    MARY: He'd been staying up later, writing letters. And he'd been asking odd questions about who came and went.

- MARY: I fetched Mr. Ashford when I couldn't get in. He had to put his shoulder to the door.

{evidence_found ? family_tensions:
    * [Ask about tensions between family members]
        MARY: There was shouting at dinner last night. Master Charles and his Lordship arguing about money again.
        ANDRÉ-LOUIS: Again?
        MARY: It's been going on for weeks. And Miss Victoria's been crying a lot lately.
}

{evidence_found ? surveillance_photos:
    * [Show her the surveillance photographs]
        MARY: *gasps* That looks like... but surely not. Who would Lord Pemberton be watching?
        ANDRÉ-LOUIS: You recognize the figure?
        MARY: The coat looks familiar, but I couldn't say for certain.
}

* [Ask about her own movements last night]
    ANDRÉ-LOUIS: Where were you between midnight and two in the morning?
    MARY: In my room, fast asleep. The other girls can vouch for me - Sarah heard me snoring.

- -> mary_insights

=== mary_insights ===
MARY: Inspector, there's something else. Yesterday evening, I saw Master Charles in the garden quite late. Past eleven o'clock.

~ evidence_found += (charles_pemberton, late_night_garden)

* [Press for more details about Charles in the garden]
    MARY: He was walking back and forth under Lord Pemberton's study window. Like he was working up courage for something.
    
* [Ask if she saw anyone else outside]
    MARY: No sir, but I did hear the study window open around midnight. I thought it odd given the cold.

- ANDRÉ-LOUIS: You've been very helpful, Miss Collins.

-> investigation_choice_two

=== investigation_choice_two ===
{time_pressure <= 0:
    The morning is slipping away. In murder cases, delay can mean the difference between justice and a perfect crime.
}

{suspects_met ? mary_collins && evidence_found ? (family_tensions, locked_door):
    Your investigation is building a picture of family discord and an impossible crime. Time to dig deeper.
}

* [Question Charles Pemberton about his inheritance expectations]
    -> interview_charles
    
* [Speak with Victoria Ashworth about the family tensions]
    -> interview_victoria
    
* [Investigate the servants' bell system Mary mentioned]
    -> investigate_bells
    
* {evidence_found ? (new_will, gambling_debts, surveillance_photos)} [Gather everyone for the revelation]
    -> final_deduction

=== interview_charles ===
Charles Pemberton paces the morning room like a caged animal. He's perhaps thirty, well-dressed but with the hollow look of a man under financial pressure.

~ suspects_met += charles_pemberton

CHARLES: Inspector, thank God you're here. This whole business is a nightmare.

{evidence_found ? family_tensions:
    ANDRÉ-LOUIS: I understand you and your uncle argued last night.
    CHARLES: *stiffens* Who told you that? We had a discussion about family matters, nothing more.
}

* [Ask directly about his financial situation]
    ~ investigation_style = "direct"
    ANDRÉ-LOUIS: Mr. Pemberton, are you currently in debt?
    CHARLES: I... that's hardly relevant to my uncle's death, surely?
    
* [Inquire about his chess game with Lord Pemberton]
    {evidence_found ? chess_position:
        ANDRÉ-LOUIS: You play chess with your uncle regularly?
        CHARLES: *surprised* How did you... yes, we played yesterday evening. He was winning, as usual.
        ANDRÉ-LOUIS: Actually, the position suggests white was about to deliver checkmate. You were winning.
    }
    
* [Confront him about being seen in the garden]
    {evidence_found ? late_night_garden:
        ANDRÉ-LOUIS: You were seen in the garden quite late last night. Past eleven o'clock.
        CHARLES: *pales* I... I needed air. The argument with Uncle had upset me.
    }

- CHARLES: Look, Inspector, I know how this looks. The debts, the arguments... but I didn't kill him.

{evidence_found ? gambling_debts:
    * [Press him about the threatening letters]
        ANDRÉ-LOUIS: Your uncle received threatening letters about gambling debts. Your gambling debts.
        CHARLES: *collapses into chair* How did he... I never meant for him to get involved.
        ~ Deductions += financial_motive
}

{evidence_found ? new_will:
    * [Reveal the change in the will]
        ANDRÉ-LOUIS: Did you know your uncle changed his will last week?
        CHARLES: Changed it how?
        ANDRÉ-LOUIS: If anything happens to you, everything goes to Victoria instead of your mother.
        CHARLES: *genuine shock* That's... that's impossible. Why would he...?
}

-> charles_revelation

=== charles_revelation ===
CHARLES: Inspector, I'll be completely honest. Yes, I owe money to some very unpleasant people in London. Yes, I've been pressing Uncle for help.

{evidence_found ? servants_bell_system:
    ANDRÉ-LOUIS: You know about the old servants' bell system in this house?
    CHARLES: Of course. We played with those ropes as children. You could pull them from anywhere on the connected floors.
    ~ Deductions += inside_job
}

* [Ask about his whereabouts at the time of death]
    CHARLES: I was in my room from about midnight onward. I'd had too much brandy after our argument.
    ANDRÉ-LOUIS: Can anyone verify that?
    CHARLES: I... no. I was alone.

* [Question his reaction to the will change]
    CHARLES: If Uncle really changed his will like that, he must have thought I was becoming desperate. Was he... was he afraid of me?

- -> final_choice

=== final_choice ===
The pieces of the puzzle are falling into place. You have enough evidence to form a theory about Lord Pemberton's death.

{evidence_found ? (servants_bell_system, chair_barricade, late_night_garden, gambling_debts):
    The locked room mystery, Charles's desperate financial situation, and his knowledge of the bell system point to an elaborate inside job.
    ~ Deductions += inside_job
}

{evidence_found ? (muddy_footprints, surveillance_photos, threatening_letters):
    The evidence could suggest an outside intruder connected to the gambling debts.
    ~ Deductions += outside_intruder
}

{evidence_found ? (new_will, family_tensions, chess_position):
    Personal motives and family secrets suggest this was about more than money.
    ~ Deductions += inheritance_scheme
}

* {Deductions ? inside_job} [Accuse Charles of an elaborate locked-room murder]
    -> accuse_charles
    
* {Deductions ? outside_intruder} [Theorize about an outside killer]
    -> outside_killer_theory
    
* [Gather more evidence before making accusations]
    -> investigate_more

=== accuse_charles ===
ANDRÉ-LOUIS: Charles Pemberton, I believe you killed your uncle and used your childhood knowledge of this house to create an impossible locked-room mystery.

The assembled household gasps. Charles goes white.

ANDRÉ-LOUIS: You argued with your uncle about money. He refused to help with your gambling debts. In desperation, you confronted him again later that night.

{evidence_found ? chess_position:
    ANDRÉ-LOUIS: The chess game proves you were in the study with him. The aggressive winning position - that's your style, not his.
}

{evidence_found ? servants_bell_system:
    ANDRÉ-LOUIS: After stabbing him, you used the old servants' bell rope to pull the chair into position from outside the room, creating the locked door illusion.
}

{evidence_found ? muddy_footprints:
    ANDRÉ-LOUIS: You broke the window from inside and tracked mud back and forth to suggest an outside intruder.
}

CHARLES: *breaking down* You don't understand the pressure I was under. Those men in London... they would have killed me. Uncle could have helped, but he was more concerned with protecting his precious reputation.

ANDRÉ-LOUIS: And when he changed his will to exclude you if anything happened, you panicked.

CHARLES: I never meant to kill him! We argued, he threatened to disinherit me completely, and I just... the letter opener was right there...

-> resolution

=== resolution ===
~ player_reputation += 10

ASHFORD: Inspector André-Louis, your reputation is well-deserved. How did you see through the locked room deception?

ANDRÉ-LOUIS: The chess position was the key. Lord Pemberton was a careful, defensive player - I could tell from his study, his habits. But that aggressive queen sacrifice? That was the move of a younger, more desperate mind.

{evidence_found ? servants_bell_system:
    ANDRÉ-LOUIS: Combined with Charles's intimate knowledge of the bell-rope system, it became clear how he created his 'impossible' crime.
}

The case closes with Charles Pemberton confessing to manslaughter. The gambling debts and family pressures that drove him to desperate measures serve as a reminder that even in the grand manor houses of England, human nature remains desperately, tragically predictable.

NEWSPAPER HEADLINE: "BRILLIANT DETECTIVE SOLVES IMPOSSIBLE MURDER"
"Inspector André-Louis Unravels Locked Room Mystery at Greystone Manor"

Your reputation as a detective grows. Soon, another telegram will arrive with another mystery to solve...

-> END

=== investigate_more ===
{time_pressure <= 0:
    Unfortunately, you've spent too much time deliberating. Key witnesses have begun to leave, and the trail grows cold. Sometimes in detective work, decisiveness matters as much as deduction.
    
    The case remains unsolved, though your thorough investigation provides enough evidence for the local constabulary to continue the investigation.
    
    -> END
}

You decide to investigate further before making your final accusation...

-> investigation_choice_two

=== outside_killer_theory ===
Your theory about an outside killer connected to the gambling debts proves compelling, but lacks the final evidence needed for conviction. The case remains officially open, though Charles's financial troubles are exposed and he faces other legal consequences.

Sometimes the truth is more complex than any single theory can capture...

-> END
```

This Ink script demonstrates:

1. **Complex variable tracking** - Evidence, suspects, time pressure, reputation
2. **Meaningful choices** - Each decision affects what clues you find and how the story unfolds  
3. **Multiple story paths** - Different investigation styles lead to different revelations
4. **Conditional content** - Text and choices adapt based on previous decisions
5. **List operations** - Evidence and deductions combine in sophisticated ways
6. **Realistic consequences** - Time pressure and reputation affect outcomes
7. **Multiple endings** - Different deduction paths lead to different resolutions

The story maintains the Christie-style mystery structure while showcasing Ink's power for creating truly interactive detective fiction.​​​​​​​​​​​​​​​​