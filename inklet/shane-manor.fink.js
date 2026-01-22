oooOO`
// Inspector Shane André-Louis: The Manor House Mystery
// ENRICHED VERSION - Deep Victoria Path with Evidence Chains
// Based on murder mystery design principles: fair play, contradiction mechanics, layered secrets

// ============================================
// CORE VARIABLES
// ============================================
VAR player_reputation = 50
VAR investigation_style = ""
VAR time_pressure = 5

// ============================================
// EVIDENCE TRACKING - Fair Play System
// Each piece of evidence must be FOUND, not told
// ============================================
VAR evidence_parentage_letters = false
VAR evidence_photographs = false
VAR evidence_muddy_boots = false
VAR evidence_victoria_chess = false
VAR evidence_will_changes = false
VAR evidence_threatening_letters = false
VAR evidence_locked_room_key = false
VAR evidence_coat_match = false

// Derived: count of Victoria evidence
VAR victoria_evidence_count = 0

// ============================================
// INTERVIEW/CONTRADICTION TRACKING
// ============================================
VAR victoria_interviewed = false
VAR victoria_lie_detected = false
VAR victoria_alibi = ""
VAR confronted_with_photos = false
VAR confronted_with_letters = false
VAR confronted_with_boots = false
VAR victoria_deflections = 0

// ============================================
// CHARACTER SECRET LAYERS
// Surface secrets vs deeper secrets
// ============================================
VAR discovered_charles_debt_paid = false
VAR discovered_ashford_secret = false
VAR discovered_victoria_knew_truth = false
VAR total_secrets_discovered = 0

// Chess integration
VAR chess_game_completed = false

# BASEHREF: media/shane/

-> start

// ============================================
// ACT 1: ARRIVAL
// ============================================

=== start ===

Inspector Shane André-Louis steps out of the black taxi into the November drizzle. Lightning flickers across the moors as Greystone Manor looms ahead like a brooding giant.

The Gothic towers pierce the storm clouds, their windows dark except for one - a study on the second floor where a shadow moves behind amber glass.

TAXI DRIVER: *nervously* Nasty business, this murder. Lord Pemberton was a right chess master, he was. Beat the county champion last month.

# IMAGE: desktop/manor_with_taxi_desktop.jpg

* [Question the driver about local gossip]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: What's the word in the village about the family?
    DRIVER: *glances at the manor nervously* Young Charles has been desperate lately - gambling debts to some nasty London types. But Miss Victoria... there's whispers about a terrible row yesterday. Something about old secrets. And that Blackwood boy has been skulking around after dark.
    -> arrival_continue

* [Observe the manor's architecture and security]
    ~ investigation_style = "observational"
    Victorian Gothic with modern additions - new locks on the windows, electric lighting recently installed. Someone was security-conscious. Recently.
    -> arrival_continue

* [Review your case notes methodically]
    ~ investigation_style = "procedural"
    Body discovered 8 AM by maid Mary Collins. Death estimated between midnight and 2 AM. Lord Pemberton, 58, found stabbed in locked study.
    -> arrival_continue

=== arrival_continue ===
The imposing front door opens before you can knock.
-> meet_butler

// ============================================
// ACT 1: BUTLER INTRODUCTION
// ============================================

=== meet_butler ===

ASHFORD: *with forced dignity, but voice cracking* Inspector André-Louis? I am Ashford, butler to the Pemberton household these thirty years. Thank heavens you've come.

His normally impeccable appearance shows cracks - collar askew, fresh ink stains on his cuffs, and his hands shake as he takes your coat. But there's something in his eyes... relief? Or fear?

ASHFORD: *voice drops to whisper* His Lordship was deeply troubled last night. Something about the family. He'd locked himself in the study for hours before... before it happened.

# IMAGE: desktop/entrance_hall_stairs_desktop.jpg

* [Put him at ease with gentle questioning]
    ~ player_reputation += 3
    ANDRÉ-LOUIS: Take your time, Mr. Ashford. I can see you cared deeply for Lord Pemberton.
    ASHFORD: *tears forming* Thirty years, Inspector. I've watched this family through joy and tragedy. And now this... I fear the truth will destroy what remains.

* [Press for specifics - what was Lord Pemberton investigating?]
    ~ investigation_style = "direct"
    ANDRÉ-LOUIS: What exactly had Lord Pemberton discovered? Be precise.
    ASHFORD: *hesitates* He'd been going through old papers. Family records. I saw him comparing documents, growing more agitated by the hour. He mentioned needing to speak with his solicitor urgently.

* [Notice his suspicious behavior]
    ~ investigation_style = "psychological"
    ANDRÉ-LOUIS: *studying the ink stains* You've been writing this morning, Mr. Ashford. After discovering your master's body. What correspondence was so urgent?
    ASHFORD: *stiffens* I... I was notifying the solicitor about postponing certain matters. Nothing more.

- ASHFORD: Where would you like to begin, Inspector? The household is quite shaken.

-> investigation_hub

// ============================================
// INVESTIGATION HUB - Central Navigation
// ============================================

=== investigation_hub ===
The grandfather clock in the hallway chimes.

{
    - time_pressure > 3: Time is on your side - for now.
    - time_pressure > 1: The hours slip away. Witnesses' memories fade.
    - time_pressure == 1: Last chance to gather evidence before you must act.
    - else: Time has run out. You must make your accusation now. -> forced_deduction
}

{victoria_evidence_count >= 3:<em>You have gathered substantial evidence regarding Victoria.</em>|}

Where will you investigate?

+ {time_pressure > 0} [Examine the crime scene - the study]
    -> crime_scene

+ {time_pressure > 0} [Interview Mary Collins - she found the body]
    -> interview_mary

+ {time_pressure > 0} [Gather the household for statements]
    -> gather_household

+ {time_pressure > 0 && not victoria_interviewed} [Interview Victoria directly]
    -> interview_victoria

+ {time_pressure > 0 && victoria_interviewed && (evidence_photographs || evidence_parentage_letters)} [Confront Victoria with evidence]
    -> confront_victoria

+ {victoria_evidence_count >= 3} [Make your accusation - you have enough evidence]
    -> deduction

+ {victoria_evidence_count < 3 && time_pressure <= 1} [Make your accusation - time is running out]
    -> deduction_weak

// ============================================
// CRIME SCENE - The Study
// ============================================

=== crime_scene ===
~ time_pressure--

The study door stands slightly ajar. Ashford produces a heavy brass key.

ASHFORD: This is the master key I used. Mary's key wouldn't turn - something was blocking the mechanism from inside.

# IMAGE: desktop/study_crime_scene_desktop.jpg

The oak-paneled study reeks of tobacco and something metallic. Lord Pemberton slumps forward over his mahogany desk, a silver letter opener protruding from between his shoulder blades.

Your trained eye catalogues the scene:

- Window slightly ajar despite the November cold
- Safe door hanging open, contents visible
- Chess game half-finished on the side table
- Fresh mud tracked near the window
- Heavy wooden chair wedged under the door handle
- Cut crystal brandy glass, barely touched

* [Examine the open safe carefully]
    -> examine_safe

* [Study the chess position]
    -> examine_chess

* [Investigate the muddy footprints]
    -> examine_footprints

* [Examine the locked room mechanism]
    -> examine_locked_room

+ [Return to the hallway]
    -> investigation_hub

// ============================================
// SAFE EXAMINATION - Expanded Evidence Chain
// ============================================

=== examine_safe ===

The safe door hangs open. Inside, you see:
- A bundle of cash - £500, completely untouched
- A sheaf of letters bound with string
- A will dated one week ago
- Several photographs
- A small wooden box

ANDRÉ-LOUIS: Money left behind. This wasn't robbery.

* [Examine the photographs closely]
    -> examine_photographs

* [Read the bound letters]
    -> examine_letters

* [Study the will]
    -> examine_will

* [Open the wooden box]
    -> examine_box

+ [Return to the study]
    -> crime_scene

=== examine_photographs ===
~ evidence_photographs = true
~ victoria_evidence_count++

You spread the photographs on the desk. Five images, taken at night with a concealed camera.

They show a figure in a dark coat approaching the manor through the garden gate. The face is obscured by shadow, but certain details are clear:

- A woman's silhouette
- A distinctive coat with fur trim at the collar
- The figure carries something - papers? A book?
- Time stamps show dates over the past month
- The final photograph: the figure at the study window, looking up

ANDRÉ-LOUIS: Lord Pemberton was watching someone. Documenting their movements. But who?

{evidence_coat_match: The coat matches the one you saw in Victoria's wardrobe.}

-> examine_safe

=== examine_letters ===
~ evidence_threatening_letters = true

You untie the string and spread the letters. Two distinct sets:

SET ONE - Threatening letters: Block-printed, crude. "PAY WHAT YOU OWE OR THE TRUTH COMES OUT." "YOUR SECRET DIES WITH YOU." "LAST WARNING."

ANDRÉ-LOUIS: Threatening, but vague. What secret? What debt?

SET TWO - Old correspondence: Yellowed paper, dated twenty-three years ago. You begin to read...

* [Read the old letters carefully]
    -> read_parentage_letters

* [Set them aside for now]
    -> examine_safe

=== read_parentage_letters ===
~ evidence_parentage_letters = true
~ victoria_evidence_count++

The letters are between Lord Pemberton and a solicitor named Hartwell.

<em>"...the child has been placed with the Ashworth family as arranged. The mother's identity will remain sealed. I trust your discretion in this matter, as the consequences of exposure would be severe..."</em>

<em>"...the Ashworth family have perished in the fire as reported. The girl Victoria survived. Per your instructions, I have arranged for her to become your ward. She knows nothing of her true origins..."</em>

<em>"...I must advise against your recent inquiries. The girl's biological father is a dangerous man. If he learns she survived, he may attempt to reclaim her - or worse. Some secrets are better left buried..."</em>

ANDRÉ-LOUIS: *setting down the letters* Victoria isn't just a foundling taken in by charity. She was deliberately placed here. Hidden. From whom?

A final letter, dated just three days ago:

<em>"My Lord - I regret to inform you that your inquiries have attracted attention. A man has been asking questions about the Ashworth fire. He knows the girl survived. I urge you to take precautions. - Hartwell"</em>

-> examine_safe

=== examine_will ===
~ evidence_will_changes = true
~ victoria_evidence_count++

The will is dated one week ago. You compare it with an older version tucked behind it.

ORIGINAL WILL (2 years ago): Victoria Ashworth as primary beneficiary - the estate, the manor, all holdings. Charles Pemberton gets £5,000 annual stipend. Mrs. Margaret Pemberton gets residence rights only. Ashford gets £500 and cottage tenancy.

NEW WILL (1 week ago): Victoria Ashworth REMOVED ENTIRELY. Charles Pemberton now primary beneficiary - the estate. Mrs. Margaret Pemberton gets £10,000 settlement. Ashford gets £2,000 and cottage ownership. A handwritten note reads: "See attached letter explaining reasons - to be read at will execution."

ANDRÉ-LOUIS: Lord Pemberton disinherited Victoria completely. One week ago. What did he discover?

The attached letter is missing.

-> examine_safe

=== examine_box ===

A small wooden box, locked. The key is missing.

You examine it closely - good quality, a woman's jewelry box. Initials carved on the lid: "E.M."

Not Victoria's initials. Not anyone in the household you've met.

ANDRÉ-LOUIS: E.M. Victoria's mother, perhaps? Elena... something?

The box rattles when shaken. Something inside.

* [Force the lock]
    You apply pressure carefully. The old lock gives way.
    Inside: a locket containing two photographs. A young woman with Victoria's eyes - gentle, afraid, beautiful. A man on the opposite side - hard-faced, military bearing, a scar across his jaw. The contrast is striking: victim and predator.

    On the back of the woman's photograph, faded ink: "Elena, 1880"
    On the back of the man's photograph: "Viktor Markov, 1879"

    ANDRÉ-LOUIS: Elena Markov. E.M. And Viktor... Victoria was named for her father. A man she was hidden from her entire life.

    -> examine_safe

* [Leave it for now - look for the key]
    The key might be elsewhere. Perhaps in Victoria's possession?
    -> examine_safe

// ============================================
// CHESS EXAMINATION
// ============================================

=== examine_chess ===

The chess board shows a masterful endgame. White has just sacrificed the queen - a brilliant, ruthless move.

ANDRÉ-LOUIS: The Pemberton Gambit. His signature. But look...

The black pieces show fresh fingerprints. And the positioning is wrong - someone unfamiliar with this set has been moving pieces.

# IMAGE: desktop/dining_room_formal_desktop.jpg

* [Study the position deeply]
    -> chess_minigame

* [Examine the fingerprints]
    -> chess_forensics

* [Look for game notation]
    -> chess_records

+ [Return to the study]
    -> crime_scene

=== chess_minigame ===
# MINIGAME: chess
~ chess_game_completed = true

You sit at the board, working through the position. The queen sacrifice demands a precise response...

After several minutes, you see it: the only winning line for white requires black to accept the sacrifice. But black refused. They saw the trap.

ANDRÉ-LOUIS: Whoever played black understood chess well enough to recognize the Pemberton Gambit. They knew his style. This was someone who had studied his games... or played against him many times.

~ victoria_evidence_count++
~ evidence_victoria_chess = true

-> chess_realization

=== chess_forensics ===

The fingerprints on the black pieces are smudged, hurried. Someone nervous. The white pieces show Lord Pemberton's prints - methodical, precise.

ANDRÉ-LOUIS: Two players. One calm, one agitated.

-> chess_realization

=== chess_records ===

Hidden beneath the board: a chess notation pad. Two handwritings.

Lord Pemberton's elegant script records the opening moves. A second hand - hurried, feminine - scratches out attempted responses with increasing frustration.

~ evidence_victoria_chess = true
~ victoria_evidence_count++

ANDRÉ-LOUIS: She was losing. And she knew it.

-> chess_realization

=== chess_realization ===

This wasn't a casual game. It was a confrontation. Lord Pemberton used chess to deliver a message: <em>I see through you. I am always three moves ahead.</em>

And then someone picked up the letter opener.

-> crime_scene

// ============================================
// FOOTPRINTS AND LOCKED ROOM
// ============================================

=== examine_footprints ===

The muddy prints lead from the window to the desk and back. Size 9 or 10 boots, with a distinctive wear pattern on the left heel.

ANDRÉ-LOUIS: Someone entered through this window. Or wanted us to think they did.

You examine the window frame. Fresh scratches on the latch - forced from outside? No... the scratches are theatrical. Too obvious. Made after the window was already open.

-> crime_scene

=== examine_locked_room ===
~ evidence_locked_room_key = true

You examine the door mechanism. A heavy oak door, brass lock, solid frame.

The chair lies on its side inside the room. Mary said it was wedged under the handle, but...

ANDRÉ-LOUIS: Wait.

You position the chair as it would have been. When the door was forced, the chair should have slid forward, toward the doorway. Instead, it fell backwards, into the room.

ANDRÉ-LOUIS: Someone placed this chair after the door was opened. The locked room was staged.

But how did the killer escape? You check the window again - too high to jump safely, and the mud shows no outward tracks.

Then you notice it: a second keyhole. A servant's entrance, concealed behind a bookshelf. And it's unlocked.

ANDRÉ-LOUIS: There was another way out. Someone knew about this door.

Who would know the manor's secrets so intimately?

-> crime_scene

// ============================================
// INTERVIEW: MARY COLLINS
// ============================================

=== interview_mary ===
~ time_pressure--

Mary Collins huddles in the servants' hall, clutching a rosary. Twenty-five, hollow-eyed, trembling.

MARY: *whisper* Inspector, I heard things last night. Terrible things.

# IMAGE: desktop/servants_hall_desktop.jpg

* [Ask about what she heard]
    ANDRÉ-LOUIS: Tell me everything. Every detail.
    MARY: They were arguing. Lord Pemberton and... and someone. A woman's voice, I think. She said, "You can't do this to me. Not after everything." And he said... *shudders* ...he said, "I know who you really are."

    {not victoria_interviewed: You make a note: Victoria must be interviewed directly.}
    -> mary_continue

* [Ask about the locked room]
    ANDRÉ-LOUIS: Tell me exactly what happened when you found the door.
    MARY: The key turned, but the door wouldn't budge. I pushed and pushed. When Mr. Ashford came, he put his shoulder to it. And when it opened, that chair... it fell backwards. Away from us. Like someone had just placed it there.
    -> mary_continue

* [Ask about Victoria specifically]
    ANDRÉ-LOUIS: What do you know about Miss Victoria?
    MARY: *hesitates* She's always been kind to me. But lately... she's been acting strange. Going out at night. I found mud on her boots last week, and she made me swear not to tell anyone.

    ~ evidence_muddy_boots = true
    ~ victoria_evidence_count++

    -> mary_continue

=== mary_continue ===

MARY: Inspector... there's something else. I saw Miss Victoria that night. Around eleven. She was carrying papers - looked like letters. She was crying.

* [What kind of letters?]
    MARY: Old ones. Yellowed. She said she'd found them in his Lordship's desk while he was at dinner. Said they changed everything.

    ANDRÉ-LOUIS: She knew. Before the murder, Victoria had already found the letters about her parentage.

    ~ discovered_victoria_knew_truth = true
    ~ total_secrets_discovered++

    -> investigation_hub

* [Which direction was she going?]
    MARY: Toward the study. She... she looked determined. Frightened too, but determined.
    -> investigation_hub

// ============================================
// INTERVIEW: VICTORIA - New Scene
// ============================================

=== interview_victoria ===
~ time_pressure--
~ victoria_interviewed = true

You find Victoria in the conservatory, staring at the rain-lashed windows. She doesn't turn as you enter.

VICTORIA: Inspector André-Louis. I wondered when you'd come for me.

She's pale, composed, but her hands grip the windowsill until her knuckles whiten.

VICTORIA: I suppose everyone's told you I'm the obvious suspect. The foundling with everything to lose.

* [Be direct - where were you last night?]
    ANDRÉ-LOUIS: I need to know your movements between 11 PM and 2 AM.

    VICTORIA: *still not turning* I was walking. The grounds, the garden. I couldn't sleep. I often can't.

    ~ victoria_alibi = "walking_grounds"

    -> victoria_interview_continue

* [Be sympathetic - this must be difficult]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: Miss Ashworth, I'm not here to accuse. I'm here to find the truth.

    VICTORIA: *finally turns, eyes red-rimmed* The truth. That's rich. No one in this house knows what truth means.

    -> victoria_interview_continue

* [Be psychological - you know more than you're saying]
    ~ investigation_style = "psychological"
    ANDRÉ-LOUIS: You're afraid, Miss Ashworth. Not of being accused - of something else. What do you know?

    VICTORIA: *stiffens* I don't know what you mean.

    -> victoria_interview_continue

=== victoria_interview_continue ===

VICTORIA: Lord Pemberton was the only father I ever knew. He took me in when I had no one. Why would I harm him?

{evidence_parentage_letters: You think of the letters. She was hidden here. Protected from someone.}

{evidence_will_changes: You think of the will. She was about to lose everything.}

* [Ask about her relationship with Lord Pemberton]
    ANDRÉ-LOUIS: Had anything changed recently? Between you and your guardian?

    VICTORIA: *long pause* He'd become... distant. These past weeks. Secretive. He watched me sometimes with an expression I'd never seen. Like he was afraid of me.

    -> victoria_interview_end

* [Ask about the argument Mary overheard]
    ANDRÉ-LOUIS: A witness heard you arguing with Lord Pemberton last night.

    VICTORIA: *sharp intake of breath* I... yes. We argued. About my future. He said things were going to change. That I needed to prepare myself.

    ANDRÉ-LOUIS: Prepare for what?

    VICTORIA: He wouldn't say. But the way he looked at me... like I was a stranger.

    -> victoria_interview_end

* {discovered_victoria_knew_truth} [Ask about the letters she found]
    ANDRÉ-LOUIS: You found letters in Lord Pemberton's desk. Before the murder.

    VICTORIA: *goes very still* Who told you that?

    ANDRÉ-LOUIS: What did they say, Miss Ashworth?

    VICTORIA: *voice cracking* They said I'm not who I thought I was. That my whole life has been a lie. That my real father is... is a monster. And Lord Pemberton knew. He knew all along.

    ~ victoria_lie_detected = true

    -> victoria_interview_end

=== victoria_interview_end ===

Victoria turns back to the window.

VICTORIA: I didn't kill him, Inspector. Whatever you think you know about me.

{evidence_photographs: You notice her coat hanging by the door. Fur trim at the collar. Distinctive.}

* {evidence_photographs} [Examine her coat]
    You walk to the coat, lifting it casually.

    ~ evidence_coat_match = true
    ~ victoria_evidence_count++

    ANDRÉ-LOUIS: Lovely coat. Distinctive.

    VICTORIA: *watching you carefully* A gift. From Lord Pemberton. Years ago.

    The same coat from the photographs. She is the figure at the garden gate.

    -> investigation_hub

* [That's all for now]
    ANDRÉ-LOUIS: Thank you, Miss Ashworth. We'll speak again.
    -> investigation_hub

// ============================================
// CONFRONT VICTORIA - Evidence Presentation
// ============================================

=== confront_victoria ===
~ time_pressure--

You find Victoria again. This time, you've come prepared.

ANDRÉ-LOUIS: Miss Ashworth. We need to talk about inconsistencies in your story.

VICTORIA: *wary* What inconsistencies?

+ {evidence_photographs && not confronted_with_photos} [Present the photographs]
    -> confront_photos

+ {evidence_parentage_letters && not confronted_with_letters} [Present the parentage letters]
    -> confront_letters

+ {evidence_muddy_boots && not confronted_with_boots} [Ask about the muddy boots]
    -> confront_boots

+ {confronted_with_photos && confronted_with_letters} [Press for the full truth]
    -> victoria_breaks

=== confront_photos ===
~ confronted_with_photos = true

You lay the photographs on the table.

ANDRÉ-LOUIS: Lord Pemberton was watching someone approach the manor at night. Someone in a distinctive coat.

Victoria stares at the images. Her face goes white.

ANDRÉ-LOUIS: That's your coat. You were sneaking out. Why?

VICTORIA: *long silence* ...I was meeting someone.

ANDRÉ-LOUIS: Who?

VICTORIA: A man. He contacted me months ago. Said he knew things about my past. About my real family. I thought... I thought if I could learn the truth myself, I could...

ANDRÉ-LOUIS: You could control the narrative. Before Lord Pemberton did.

VICTORIA: *whisper* Yes.

-> confront_victoria

=== confront_letters ===
~ confronted_with_letters = true

You produce the letters from the safe.

ANDRÉ-LOUIS: Your parentage isn't a mystery, Miss Ashworth. Not anymore.

Victoria reads the letters. Her hands tremble.

VICTORIA: He knew. From the beginning. He knew I was... that I was Viktor Markov's daughter. A criminal's child.

ANDRÉ-LOUIS: Markov. Russian? Connected to what?

VICTORIA: I don't know everything. Only what the man told me. My father is alive. He's been looking for me for twenty years. And Lord Pemberton... Lord Pemberton hid me from him. Protected me.

Her voice breaks.

VICTORIA: He protected me. And I...

ANDRÉ-LOUIS: And you what, Miss Ashworth?

-> confront_victoria

=== confront_boots ===
~ confronted_with_boots = true

ANDRÉ-LOUIS: Mary Collins found mud on your boots. Recently. You made her promise to keep silent.

VICTORIA: I... I went out that night. I admit it. But I didn't go to the study. I went to the garden gate - I was supposed to meet the man, Markov's agent. But he never came.

ANDRÉ-LOUIS: Can anyone verify that?

VICTORIA: *desperately* No. I was alone. But I swear to you, when I came back inside, Lord Pemberton was still alive. I heard him... I heard him in the study. With someone else.

ANDRÉ-LOUIS: Who?

VICTORIA: I don't know. The voice was... muffled. But they were arguing.

-> confront_victoria

=== victoria_breaks ===
~ victoria_deflections++

// TESTIMONY LOOP: Victoria deflects twice before breaking
{victoria_deflections == 1:
    Victoria's jaw tightens. She looks away.

    VICTORIA: I've already told you everything I know, Inspector. I was walking the grounds. I heard arguing. I went to bed.

    ANDRÉ-LOUIS: The evidence suggests otherwise.

    VICTORIA: *sharply* Then your evidence is wrong. I'm not going to confess to something I didn't do just because you've decided I'm convenient.
}

{victoria_deflections == 2:
    Victoria stands abruptly, knocking her chair back.

    VICTORIA: *voice rising* Stop! Just... stop. You keep pushing and pushing, but you don't understand anything about this family!

    ANDRÉ-LOUIS: Then help me understand.

    VICTORIA: *bitterly* Understanding won't bring him back. And it won't make me guilty of murder.

    She's cracking. One more push and the truth will come out.
}

+ {victoria_deflections == 1} [Press harder - you know she's lying]
    ANDRÉ-LOUIS: Miss Ashworth, three people have placed you near the study that night. Your coat appears in surveillance photographs. You have no alibi.
    -> victoria_breaks

+ {victoria_deflections == 1} [Back off - gather more evidence]
    Perhaps she needs more pressure. Or perhaps you need more proof.
    -> investigation_hub

+ {victoria_deflections == 2} [Mention what she said to Lord Pemberton]
    ANDRÉ-LOUIS: You called him a liar. A coward. Mary heard every word.
    -> victoria_breaks

+ {victoria_deflections == 2} [Mention Markov - her real father]
    ANDRÉ-LOUIS: Viktor Markov. Your biological father. The man you were hidden from your entire life.
    -> victoria_breaks

- {victoria_deflections >= 3}
// Third confrontation - she finally breaks
Victoria sits heavily, all composure gone.

VICTORIA: *whisper* You want the truth? Fine.

She looks up at you with raw desperation.

VICTORIA: I went to see him that night. After I came back from the garden. I confronted him with what I'd learned. We argued. He told me he was changing the will - disinheriting me - to protect me. He said if I had nothing, Markov would have no reason to use me.

ANDRÉ-LOUIS: And then?

VICTORIA: And then I left. I was angry, hurt... I said terrible things. But I did not kill him.

She grips your arm.

VICTORIA: When I left that study, he was alive. Someone else came after me. Someone who knew about the hidden door behind the bookshelf.

* [You mentioned a hidden door. How do you know about it?]
    VICTORIA: I grew up here, Inspector. I know every secret passage in this house.

    ANDRÉ-LOUIS: Who else would know?

    VICTORIA: *slowly* Ashford. Charles used to play hide and seek there as a child. And Mrs. Pemberton... she's been here longer than I have.

    -> pre_deduction

* [You're saying someone framed you?]
    VICTORIA: The muddy footprints. The locked room. The chess game - I don't even play chess, Inspector. Someone wanted you to look at me.

    ANDRÉ-LOUIS: Why?

    VICTORIA: Because I'm the obvious suspect. The outsider. The foundling with everything to lose.

    -> pre_deduction

* [I've heard enough. Time to make a decision.]
    -> pre_deduction

=== pre_deduction ===

The evidence swirls in your mind. Victoria had motive, means, and opportunity. But so did others. And there are inconsistencies...

-> deduction

// ============================================
// GATHER HOUSEHOLD
// ============================================

=== gather_household ===
~ time_pressure--

You assemble the household in the morning room. The tension crackles.

Present: Charles Pemberton (nervous, chain-smoking), Victoria Ashworth (pale and defiant), Mrs. Margaret Pemberton (watching Victoria like a hawk), Mary Collins (trembling), Ashford (unnaturally composed).

ANDRÉ-LOUIS: I need everyone's whereabouts between 11 PM and 2 AM.

# IMAGE: desktop/butler_questioning_desktop.jpg

CHARLES: *stubbing out cigarette* I was in my room. Reading. Alone.

VICTORIA: I was walking the grounds. I couldn't sleep.

MRS. PEMBERTON: I retired at ten and took a sleeping draught. I heard nothing until Mary's screams.

ASHFORD: I was securing the house. Checking locks. As I do every night.

MARY: I... I was in the servants' quarters. I heard arguing around midnight, but I didn't dare investigate.

* [Press Charles about his debts]
    ANDRÉ-LOUIS: Mr. Pemberton, I understand you've had financial difficulties.

    CHARLES: *flushes angrily* Ancient history. I've settled my debts.

    ANDRÉ-LOUIS: Settled them how? You have no income of your own.

    CHARLES: *glances at Mrs. Pemberton* A private arrangement. Family business.

    ~ discovered_charles_debt_paid = true
    ~ total_secrets_discovered++

    -> household_continue

* [Question Mrs. Pemberton's alibi]
    ANDRÉ-LOUIS: A sleeping draught, Mrs. Pemberton? Convenient.

    MRS. PEMBERTON: *coldly* I've suffered from insomnia since my husband's death. Dr. Morrison will confirm my prescription.

    -> household_continue

* [Watch Ashford's reaction]
    You observe the butler carefully. His composure is too perfect. Rehearsed.

    When Victoria speaks, his eyes flicker to her with something like... anguish? Guilt?

    -> household_continue

=== household_continue ===

MRS. PEMBERTON: *to Victoria* Well? Will you tell the Inspector about your midnight excursions? Or shall I?

VICTORIA: *standing suddenly* You know nothing about me!

MRS. PEMBERTON: I know what you are. A cuckoo in the nest. And now Edgar's dead because of you!

The room erupts. Accusations fly. And beneath it all, you sense layers of secrets pressing against the surface.

-> investigation_hub

// ============================================
// DEDUCTION - Evidence-Gated
// ============================================

=== deduction ===

You gather your thoughts. The evidence points in several directions.

{
    - victoria_evidence_count >= 4: You have built a strong case against Victoria.
    - victoria_evidence_count >= 2: You have circumstantial evidence against Victoria.
    - else: The evidence is thin, but time forces your hand.
}

# IMAGE: desktop/morning_room_table_desktop.jpg

+ {victoria_evidence_count >= 3} [Accuse Victoria - you have sufficient evidence]
    -> accuse_victoria_full

+ {evidence_victoria_chess || chess_game_completed} [Accuse Charles - the chess evidence implicates him]
    -> accuse_charles

+ {discovered_charles_debt_paid} [Accuse Mrs. Pemberton - she paid Charles's debts]
    -> accuse_mrs_pemberton

+ {evidence_locked_room_key && investigation_style == "psychological"} [Accuse Ashford - he knew about the hidden door]
    -> accuse_ashford

+ {total_secrets_discovered >= 2} [Present a conspiracy theory - multiple killers]
    -> conspiracy_theory

+ {victoria_interviewed && victoria_alibi == "walking_grounds"} [Accept Victoria's account - look for another killer]
    -> alternative_theory

=== deduction_weak ===
Time has run out. You must accuse with whatever evidence you have.

+ [Accuse Victoria based on circumstantial evidence]
    -> accuse_victoria_weak

+ [Accuse someone else]
    -> outside_theory

=== forced_deduction ===
The clock has struck. Witnesses are leaving. You must act now.
-> deduction_weak

// ============================================
// ACCUSATION: VICTORIA - Full Evidence
// ============================================

=== accuse_victoria_full ===

ANDRÉ-LOUIS: Miss Victoria Ashworth. The evidence against you is substantial.

The room falls silent. Victoria stands frozen.

ANDRÉ-LOUIS: You discovered your true parentage days before the murder. You knew Lord Pemberton was changing his will. You were seen arguing with him that night. Your coat appears in surveillance photographs. And you cannot account for your whereabouts during the time of death.

{evidence_locked_room_key: You also knew about the hidden servant's entrance behind the bookshelf.}

VICTORIA: *voice shaking* I told you - I didn't kill him.

* [Press harder - demand a confession]
    ANDRÉ-LOUIS: The facts speak for themselves. Lord Pemberton discovered your father is Viktor Markov, a dangerous criminal. He planned to disinherit you for your own protection. You killed him to preserve your inheritance and your secret.

    -> victoria_response_defiant

* [Offer sympathy - understand her position]
    ~ player_reputation += 2
    ANDRÉ-LOUIS: I believe you loved him. And I believe learning the truth about your past destroyed something in you. But the evidence is clear.

    -> victoria_response_broken

* [Present an alternative - she's protecting someone]
    ANDRÉ-LOUIS: Unless... you're protecting someone. You know who really killed Lord Pemberton.

    -> victoria_response_protective

=== victoria_response_defiant ===

VICTORIA: *drawing herself up* You have circumstantial evidence, Inspector. Nothing more. I was at that garden gate waiting for a man who never came. Someone else entered that study after me.

MRS. PEMBERTON: Lies! Who else would kill Edgar?

VICTORIA: *turning on her* Perhaps someone who's been embezzling from the estate for years? Someone who paid off Charles's gambling debts from the household accounts?

MRS. PEMBERTON: *goes pale* How dare you...

The accusation hangs in the air. Victoria may be guilty - or she may have just exposed another killer.

-> resolution_ambiguous

=== victoria_response_broken ===

Victoria's composure finally shatters. She sinks into a chair, weeping.

VICTORIA: I loved him. He was the only father I ever knew. And when I discovered he'd been lying to me my entire life... that I was the daughter of a monster... I felt everything I knew crumble.

ANDRÉ-LOUIS: What happened in that study?

VICTORIA: We argued. He said he was protecting me by cutting me off. That if I had nothing, Markov couldn't use me. I said terrible things. Called him a liar. A coward.

She looks up with hollow eyes.

VICTORIA: And then I left. I swear to you - I left him alive. Someone else came after me. Someone who wanted both of us destroyed.

-> resolution_tragic

=== victoria_response_protective ===

Victoria's eyes widen. For a moment, you see fear - and recognition.

VICTORIA: *very quietly* You're more perceptive than I expected, Inspector.

ANDRÉ-LOUIS: Who are you protecting?

She glances at Ashford. The butler has gone pale.

VICTORIA: Tell him. Or I will.

ASHFORD: *voice cracking* Miss Victoria, please...

VICTORIA: Inspector André-Louis, there's someone in this room who has watched over me my entire life. Someone who knew my mother - truly knew her - before I was ever born.

She looks at Ashford.

VICTORIA: He loved her. And when she died, he swore to protect me. Ask him why he really stayed at Greystone Manor for thirty years.

-> resolution_twist

// ============================================
// OTHER ACCUSATIONS (abbreviated for now)
// ============================================

=== accuse_victoria_weak ===
Without sufficient evidence, your accusation of Victoria creates doubt but no confession. The case remains open.
-> partial_resolution

=== accuse_charles ===
~ player_reputation += 8

The chess evidence reveals Charles's desperation. Under pressure, he confesses to killing his uncle in a moment of rage over his inheritance.

CHARLES: He called me weak. A failure. Said he'd rather leave everything to a foundling than to me. I... I didn't mean to...

-> resolution_charles

=== accuse_mrs_pemberton ===
~ player_reputation += 6

Your investigation of the financial irregularities exposes Mrs. Pemberton's embezzlement. She denies murder, but the evidence suggests she orchestrated events from the shadows.

-> resolution_mrs_pemberton

=== accuse_ashford ===
~ player_reputation += 7

Ashford's knowledge of the hidden door - and his emotional connection to Victoria - suggests a deeper motive. Under questioning, he reveals a secret that changes everything.

-> resolution_ashford

=== conspiracy_theory ===
~ player_reputation += 5

You present a theory of multiple conspirators. The household turns on each other, each exposing the others' secrets. The truth may never fully emerge.

-> resolution_conspiracy

=== alternative_theory ===

ANDRÉ-LOUIS: Miss Ashworth's account has inconsistencies - but so does everyone's. What if the killer came from outside?

You examine the evidence again. The threatening letters. The photographs. Viktor Markov's agent.

Someone was watching this house. Someone knew Victoria's secrets. And someone benefited from Lord Pemberton's death and Victoria's disgrace.

-> resolution_external

=== outside_theory ===
The evidence suggests an external conspiracy connected to Victoria's biological father. The case expands beyond the manor walls.
-> partial_resolution

// ============================================
// RESOLUTIONS
// ============================================

=== resolution_ambiguous ===
~ player_reputation += 4

The case closes without a clear confession. Victoria remains under suspicion, but Mrs. Pemberton's financial crimes cast doubt on any simple narrative.

Sometimes the truth is messier than fiction.

ENDING: SHADOWS OF DOUBT

-> manor_epilogue

=== resolution_tragic ===
~ player_reputation += 6

Victoria's confession of heartbreak - but not murder - leaves the case unresolved. Someone else killed Lord Pemberton. The question is whether you believe her.

{evidence_locked_room_key: The hidden door suggests another killer. But who?}

ENDING: THE BROKEN FAMILY

-> manor_epilogue

=== resolution_twist ===
~ player_reputation += 10
~ discovered_ashford_secret = true

ASHFORD: *stepping forward* It's true. Victoria's mother was... she was a woman I loved. Elena. We met before she fled Markov, before she knew what kind of man he truly was.

ANDRÉ-LOUIS: You helped her escape.

ASHFORD: I was young, foolish, desperately in love. When she realized she was carrying Markov's child, she begged me to help her disappear. I arranged everything - the Ashworth family, the false papers. And when she died in that fire...

His voice breaks.

ASHFORD: Lord Pemberton owed me a great debt from years before. I called it in. He took Victoria as his ward, and I stayed close - watching over her, protecting Elena's daughter as I'd promised.

Victoria stares at him with a mixture of shock and understanding.

ASHFORD: But when those letters came - when Markov's people started watching - Lord Pemberton panicked. He wanted to send Victoria away. Expose her to the very monster we'd spent twenty years hiding her from. I couldn't let that happen.

ANDRÉ-LOUIS: So you killed him?

ASHFORD: *broken* I went to reason with him. We argued. He said Victoria was a liability now, that her presence endangered the whole family. He was going to tell Markov's agents where to find her - trade her safety for his own. I... the letter opener was right there. Thirty years of loyal service, and in one moment...

VICTORIA: *whisper* You loved her. My mother.

ASHFORD: Every day since she died, I have looked at you and seen her face. Protecting you was the only way I could keep my promise to her.

ENDING: BLOOD AND LOYALTY

-> manor_epilogue

=== resolution_charles ===
~ player_reputation += 8

Charles confesses to manslaughter. His uncle's contempt, his gambling shame, the chess game that laid bare his inadequacy - it all led to that moment of violent desperation.

ENDING: THE PRODIGAL SON

-> manor_epilogue

=== resolution_mrs_pemberton ===
~ player_reputation += 6

Mrs. Pemberton's cold manipulation is exposed. Whether she committed murder herself or orchestrated events remains unclear, but her financial crimes ensure consequences.

ENDING: THE SPIDER'S WEB

-> manor_epilogue

=== resolution_ashford ===
~ player_reputation += 7

Ashford's confession reveals a man torn between duty and love. His devotion to Elena - Victoria's mother - never faded. He killed to protect the daughter of the woman he loved, honoring a promise made twenty years ago.

ENDING: THE FAITHFUL SERVANT

-> manor_epilogue

=== resolution_conspiracy ===
~ player_reputation += 5

The household's web of secrets is exposed, but no single killer emerges. Perhaps they all played their part. Perhaps the truth is lost in the tangle of lies.

ENDING: FAMILY SINS

-> manor_epilogue

=== resolution_external ===
~ player_reputation += 7

Your investigation extends beyond the manor. Viktor Markov's reach is long, and Lord Pemberton's death may be just the beginning of a larger game.

ENDING: THE LONG SHADOW

-> manor_epilogue

=== partial_resolution ===
~ player_reputation += 3

The case remains officially open. Your investigation provided valuable leads, but justice waits for another day.

ENDING: UNFINISHED BUSINESS

-> manor_epilogue

=== manor_epilogue ===
You leave Shane Manor behind, the weight of its secrets pressing on your mind. The case may be closed - or not - but something has changed in you.

+ [Return to your life] -> END
+ [As you walk the misty grounds, you notice a strange pool...] -> manor_portal

=== manor_portal ===
#BG:#203
The pool reflects not the grey sky above, but something else entirely - other worlds, other stories waiting to be told...

# FINK: world-between-worlds.fink.js
-> END
`
