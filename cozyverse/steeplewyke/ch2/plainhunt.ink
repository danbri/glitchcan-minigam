// Steeple Wyke, chapter 2: Plain Hunt. A death in the bell tower in ten graphic-novel pages (index.html, pages.json).
// The host and the patterns are chapter 1's (../v2/, and the photo-novel skill): "# page: N" turns the page, "# panel:
// X" moves the view, a tap on a panel diverts to that panel's knot, "# voice: id" plays a take (media/vo/<id>-N.mp3),
// a line that starts "Name:" is that person speaking.
// After the body (page 3) the inquiries knot is a hub: four visits of five places (pages 4 to 8), in any order. Page 9
// is the puzzle: which bell went silent in the dark, and who was ringing it that night. Page 10 is the accusation.
// Two routes prove it, and either is enough: the ringing (rows, swap, lie, dark, the bell found on page 9) and the
// board (proof, quiz, typeface, brush, swapped). evidence() counts both.
// The ringing rows are plain hunt on five; tools/rows.mjs makes them and checks the text here against the rule.
// The canary and the scarecrow in Sam's clothes are the wrong notes (nocliches skill, rule F7): never explained.
VAR rows = false
VAR swap = false
VAR lie = false
VAR dark = false
VAR proof = false
VAR quiz = false
VAR typeface = false
VAR brush = false
VAR text = false
VAR swapped = false
VAR bell4 = false
VAR named4 = false
VAR guesses = 0
VAR asked_dilys = false
VAR asked_band = false
VAR visits = 0
VAR seen_win = false
VAR seen_barn = false
VAR seen_plough = false
VAR seen_school = false
VAR seen_board = false
VAR accused = ""
VAR ending = ""
// The village remembers (chapter 1's memory, the same key): rel_<who> is your standing now, was_<who> what it was
// when this reading began. Chapter 2 adds Win and Dr Achebe.
VAR rel_toby = 0
VAR rel_margaret = 0
VAR rel_dilys = 0
VAR rel_quaile = 0
VAR rel_win = 0
VAR rel_achebe = 0
VAR was_toby = 0
VAR was_margaret = 0
VAR was_dilys = 0
VAR was_quaile = 0
VAR was_win = 0
VAR was_achebe = 0

-> p1

// ---------------------------------------------------------------- page 1: the tower, Tuesday evening
=== p1 ===
# page: 1
# panel: page
{p1 > 1:
    {p1 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p1-again
    The tower, Tuesday evening.
}
{p1 == 1:
    # voice: p1-open
    St Aldhelm's, a Tuesday in October, twenty past seven. Three months after the Marrow Show, the interim vicar has talked you into learning to ring the bells.
}
+ [Meet the tower captain] -> p1_win
+ [Look up at the tower] -> p1_tower

=== p1_tower ===
# panel: tower
# voice: p1a-1
Rooks go round the spire. Up in the ringing chamber, a light is on.
# voice: p1a-2
The bicycle rack by the lychgate is empty. Hugh Daventry rings the treble, edits the parish magazine and sets the Wednesday quiz at the Plough. He usually leaves his bicycle there by a quarter past.
+ [Meet the vicar] -> p1_achebe
+ [Meet the tower captain] -> p1_win

=== p1_achebe ===
# panel: achebe
{p1_achebe > 1:
    # voice: p1b-again
    Achebe: Win's waiting for you, Sergeant.
    -> p1_achebe_choices
}
# voice: p1b-1
Achebe: Sergeant Adeyemi. You came. I told Margaret forty per cent.
# voice: p1b-2
Sam: What did Margaret say?
# voice: p1b-3
Achebe: She said you'd come if you'd said you would.
# voice: p1b-4
The Reverend Dr Ruth Achebe has been the interim vicar since August. Before she was ordained she priced pension risk for an insurer in Croydon.
-> p1_achebe_choices
= p1_achebe_choices
+ [Meet the tower captain] -> p1_win

=== p1_win ===
# panel: win
{p1_win > 1:
    # voice: p1c-again
    Win: Bench. Feet in.
    -> p1_win_choices
}
# voice: p1c-1
Win: You're the policeman. I'm Win. Tower captain.
# voice: p1c-2
She is seventy-eight. She speaks a little too loudly, and she watches your mouth while you answer. A reporter's notebook and a pencil hang on a string round her neck.
# voice: p1c-3
Win: You sit on the bench with your feet in, and you don't touch a rope. A bell can lift a grown man to the ceiling.
-> p1_win_choices
= p1_win_choices
+ [Ask what plain hunt is] -> p1_napkin

=== p1_napkin ===
# panel: napkin
{p1_win == 0: -> p1_win}
# voice: p1d-1
On the back of a napkin from the Plough she writes out the first thing every ringer learns.
# voice: p1d-2
Win: Plain hunt. Five bells. In one row the pairs swap: one with two, three with four. In the next, two with three, four with five. Then the first again.
1 2 3 4 5
2 1 4 3 5
2 4 1 5 3
4 2 5 1 3
4 5 2 3 1
5 4 3 2 1
5 3 4 1 2
3 5 1 4 2
3 1 5 2 4
1 3 2 5 4
1 2 3 4 5
# voice: p1d-3
Win: Ten rows and you're back in rounds. Hugh rings the treble. If he isn't here by half past, we ring on five.
# voice: p1d-4
Sam: There are six ropes.
# voice: p1d-5
Win: Six bells. On five, the tenor stays down.
+ [Put the napkin in your pocket and go up] -> p2

// ---------------------------------------------------------------- page 2: the ringing chamber
=== p2 ===
# page: 2
# panel: page
{p2 > 1:
    {p2 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p2-again
    The ringing chamber.
}
{p2 == 1:
    # voice: p2-open
    The ringing chamber, up fourteen stone steps: six ropes with striped woollen grips, a bench, a tea tray and a blackboard. Five ringers, and one rope tied up out of reach.
}
+ [Read the blackboard] -> p2_list
+ [Sit on the bench and watch] -> p2_ropes

=== p2_tea ===
# panel: tea
# voice: p2a-1
Margaret Pike pours tea from a flask on the windowsill. She puts out two cups, looks at the second one, and puts it back in the basket.
{was_margaret <= -1:
    # voice: p2a-cold
    She hands you a cup without looking at you.
- else:
    # voice: p2a-2
    Margaret: Sergeant. Milk's in the jam jar.
}
+ [Read the blackboard] -> p2_list
+ [Sit on the bench and watch] -> p2_ropes

=== p2_list ===
# panel: list
# voice: p2b-1
On the blackboard, in Hugh's square capitals: Tuesday. One, Hugh. Two, Margaret. Three, Dilys. Four, Win. Five, Jeremy. Six, Ruth.
{was_dilys <= -1:
    # voice: p2b-cold
    Dilys: Hugh's not come. Win'll sort us out.
- else:
    ~ swap = true
    # voice: p2b-2
    Dilys: Hugh's not come, so we all move up one. Margaret, you're on the treble. Ruth, you sit this one out.
    # voice: p2b-3
    Dilys: Don't change the board, love. Hugh likes to rub it out himself.
}
+ [Sit on the bench and watch] -> p2_ropes

=== p2_ropes ===
# panel: ropes
{p2_ropes > 1:
    # voice: p2c-again
    The ropes go up and down. Win's lips move as she counts.
    -> p2_ropes_wait
}
# voice: p2c-1
Win: Look to. Treble's going. She's gone.
# voice: p2c-2
The bells start overhead, loud enough to feel through the bench. Five people stand in a circle, each watching somebody else's rope.
# voice: p2c-3
Jeremy Cole, the antiques dealer, stands nearest the door, under the light switch. At five past eight, between two pieces, he reads his phone and puts it away.
-> p2_ropes_wait
= p2_ropes_wait
+ [Wait] -> p2_dark

=== p2_dark ===
# panel: dark
{p2_ropes == 0: -> p2_ropes}
# voice: p2d-1
At a quarter past eight, the lights go out.
# voice: p2d-2
The ringing goes on in the dark, and goes wrong: a bell is missing from the pattern, or two are. Below you, through the floor, there is a thud and a short metal rattle.
# voice: p2d-3
Forty seconds by your watch, and the lights come back. Everybody is where they were.
# voice: p2d-4
Jeremy: That switch does it every winter. You have to hold it up.
# voice: p2d-5
Win calls Stand, and the bells stop. Dr Achebe goes down the stair first, to put the kettle on.
# voice: p2d-6
Then she shouts your name.
+ [Run down the stair] -> p3

// ---------------------------------------------------------------- page 3: the vestry
=== p3 ===
# page: 3
# panel: page
{p3 > 1:
    {p3 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p3-again
    The vestry, at the foot of the stair.
}
{p3 == 1:
    # voice: p3-open
    Hugh Daventry is at the foot of the tower stair, where it comes down into the vestry. Dr Achebe is kneeling beside him. She looks up and shakes her head.
}
+ [Look at the stair] -> p3_stair
+ [Look at his hand] -> p3_proof

=== p3_stair ===
# panel: stair
# voice: p3a-1
His bicycle clips are still on. His torch lies on the bottom step, still lit.
# voice: p3a-2
The stair is stone, narrow, and turns to the left. Fourteen steps up to the ringing chamber door.
{text == false:
    ~ text = true
    # voice: p3a-3
    Achebe: He texted the band at five past eight. On my way up. Something to say about the board. H.
}
# voice: p3a-4
Achebe: I came down for the kettle and he was here. I haven't moved him.
+ [Look at his hand] -> p3_proof
+ [Wait for Quaile] -> p3_quaile

=== p3_proof ===
# panel: proof
{p3_stair == 0: -> p3_stair}
~ proof = true
# voice: p3b-1
His right hand is closed on the corner of a page, torn off. Printed on it: Peal board, a corre. And at the bottom, H.D.
# voice: p3b-2
Sam: A proof. For the parish magazine.
# voice: p3b-3
Sam: Somebody has the rest of that page.
+ [Wait for Quaile] -> p3_quaile

=== p3_quaile ===
# panel: quaile
{p3_quaile > 1:
    # voice: p3c-again
    Quaile: One question for the band, Sam, then they go home.
    -> p3_quaile_choices
}
# voice: p3c-1
Quaile arrives eleven minutes later, in a raincoat over pyjamas.
# voice: p3c-2
Quaile: I was in the bath, Sam. Tell me it's an accident.
# voice: p3c-3
Sam: It might be.
# voice: p3c-4
Quaile: Then why did you ring me and not just an ambulance?
# voice: p3c-5
Sam: I rang both, ma'am.
# voice: p3c-6
Quaile: Old man, stone stair, lights out. The coroner will say he fell, and the coroner sits on Friday. The band are cold and want their beds. You can ask them one thing tonight.
-> p3_quaile_choices
= p3_quaile_choices
+ [Question the band] -> p3_band

=== p3_band ===
# panel: band
{p3_quaile == 0: -> p3_quaile}
// revisited once a question has been asked (a tap before Quaile arrives goes through the guard first)
{asked_band:
    # voice: p3d-again
    The band waits in their coats. They have answered one question, and would like to go home.
    -> p3_home
}
# voice: p3d-1
The band waits in the vestry in their coats: Win, Dilys, Margaret, Jeremy. Nobody sits down.
-> p3_band_choices
= p3_band_choices
+ [Ask whether anyone left the chamber] -> p3_left
+ [Ask Dilys about her phone] -> p3_phone
+ [Ask who rang which bell] -> p3_which

=== p3_left ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
# voice: p3e-1
Dilys: In the dark? Nobody could have found the door, love.
# voice: p3e-2
Jeremy: We rang straight through, Sergeant. Ask Win.
# voice: p3e-3
Win: What?
+ [Let them go home] -> p3_home

=== p3_phone ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
~ asked_dilys = true
# voice: p3f-1
Dilys: I record every practice for my sister Glenys. She's in Perth. Rang here for thirty years, before her knees went.
# voice: p3f-2
Dilys: She listens over her breakfast and marks us out of ten.
{was_dilys <= -1:
    # voice: p3f-cold
    Dilys: You can have it when I've decided whether I like you yet. Ask me tomorrow.
- else:
    # voice: p3f-3
    Dilys: I'll send it to her tonight. You'll have her marks by morning.
}
+ [Let them go home] -> p3_home

=== p3_which ===
# panel: band
{p3_band == 0: -> p3_band}
~ asked_band = true
{was_margaret <= -1:
    # voice: p3g-cold
    Margaret: Ask Win, Sergeant. She'll tell you. Loudly.
    # voice: p3g-cold2
    Win is already putting her coat on.
- else:
    ~ swap = true
    # voice: p3g-1
    Margaret: We moved up one, because Hugh hadn't come. I had the treble. It was my first time on the treble.
    # voice: p3g-2
    Margaret: Gerald never let me ring. He said it was bad for the hands.
}
+ [Let them go home] -> p3_home

=== p3_home ===
{morning > 0: -> inquiries}
-> morning

// ---------------------------------------------------------------- Wednesday: the inquiries, four visits of five
=== morning ===
# voice: morning
Wednesday. You sleep for four hours, and wake to your phone.
{was_dilys >= 1 || (asked_dilys && was_dilys >= 0):
    ~ rows = true
    # voice: morning-rows
    An email from Dilys, forwarded from Perth, with the subject line Not your best.
}
{was_toby >= 1:
    ~ dark = true
    # voice: morning-drone
    A video from Toby Pike, sent at six. He was flying a drone over the schoolhouse on Tuesday night, and thought you might like it.
}
-> inquiries

=== inquiries ===
{visits >= 4: -> evening}
{visits:
- 0:
    # voice: hub-0
    Quaile: The coroner sits on Friday. Five people to see and time for four. Where first?
- 3:
    # voice: hub-3
    Quaile: One more, then the vicarage. Dr Achebe says she's made a spreadsheet.
- else:
    # voice: hub-n
    Quaile: Where next?
}
+ {not seen_win} [Go to Win Haskett's cottage] -> p4
+ {not seen_barn} [Call on Jeremy Cole at his barn] -> p5
+ {not seen_plough} [Go to the quiz at the Plough] -> p6
+ {not seen_school} [Find Toby Pike at the old schoolhouse] -> p7
+ {not seen_board} [Look at the peal board in the tower] -> p8
+ {visits >= 2} [Go to the vicarage and think] -> p9

=== evening ===
# voice: evening
Quaile: That's the day gone. Vicarage, Sam.
+ [Go to the vicarage] -> p9

=== function standing(n) ===
{
- n >= 2: ~ return "a friend"
- n == 1: ~ return "warm"
- n == 0: ~ return "no opinion yet"
- n == -1: ~ return "wary"
- else: ~ return "cold"
}

// the ringing and the board, both counted: either route can hold an accusation
=== function evidence() ===
~ temp n = 0
{rows:
    ~ n += 1
}
{swap:
    ~ n += 1
}
{lie && swap:
    ~ n += 1
}
{dark:
    ~ n += 1
}
{named4:
    ~ n += 2
}
{proof:
    ~ n += 1
}
{quiz && typeface:
    ~ n += 1
}
{typeface:
    ~ n += 1
}
{brush:
    ~ n += 1
}
{swapped:
    ~ n += 1
}
~ return n

// ---------------------------------------------------------------- page 4: Win's cottage
=== p4 ===
# page: 4
# panel: page
{not seen_win:
    ~ visits += 1
    ~ seen_win = true
}
{p4 > 1:
    {p4 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p4-again
    Win's cottage.
}
{p4 == 1:
    # voice: p4-open
    Win Haskett's cottage, the last in Church Row. A brass bell for a knocker, which she cannot hear, and beside it a button that makes a lamp flash inside.
}
+ [Press the button] -> p4_win
+ [Read the sign on the door] -> p4_cottage

=== p4_cottage ===
# panel: cottage
# voice: p4a-1
A card in the window, in capitals: Shoes off. This means you.
+ [Take your shoes off] -> p4_shoes
+ [Press the button] -> p4_win

=== p4_shoes ===
{p4_shoes == 1:
    ~ rel_win += 1
    # memory: win +1 You took your shoes off at Win's door. She will remember that.
}
-> p4_win

=== p4_win ===
# panel: win4
{p4_win > 1:
    # voice: p4b-again
    Win taps the notepad and looks at the clock.
    -> p4_win_choices
}
{was_win >= 1 || p4_shoes > 0:
    # voice: p4b-warm
    Win: Socks. Good. Sit there.
- else:
    # voice: p4b-1
    Win: Come in. Tea's stewed. Sit there, not there.
}
# voice: p4b-2
Quaile takes out her hearing aid and puts it down by the teapot.
# voice: p4b-4
Win tears one page off the notepad for your questions and pushes it across the table.
-> p4_win_choices
= p4_win_choices
+ {p4_bell == 0 && p4_tuesday == 0} [Write: Which bell do you ring?] -> p4_bell
+ {p4_bell == 0 && p4_tuesday == 0} [Write: What happened on Tuesday?] -> p4_tuesday
+ [Look at her phone] -> p4_phone

=== p4_bell ===
# panel: notes
{p4_win == 0: -> p4_win}
# voice: p4c-1
She writes a large 4, underlines it twice, and adds: Forty-one years.
# voice: p4c-3
Underneath, Quaile writes: Is the tea always like this? Win writes: Yes.
+ [Look at her phone] -> p4_phone
+ [Leave her to her flowers] -> inquiries

=== p4_tuesday ===
# panel: notes
{p4_win == 0: -> p4_win}
~ swap = true
# voice: p4d-1
Win writes for a long time.
# voice: p4d-2
Hugh never came. Moved up one. Plain hunt on five, tenor down. I had the 3. Lights out at 8.14. Could not see the ropes, so I kept mine going and counted.
# voice: p4d-3
Underneath, underlined: Somebody dropped out. Ask Dilys for Glenys's tape.
+ [Look at her phone] -> p4_phone
+ [Leave her to her flowers] -> inquiries

=== p4_phone ===
# panel: phone
{p4_win == 0: -> p4_win}
~ text = true
# voice: p4e-1
Her phone, on the mantelpiece by the clock. The band's group, Tuesday, five past eight. Hugh: On my way up. Something to say about the board. H.
# voice: p4e-2
Win: I read it when I got home. Phones stay in coats in my tower.
+ [Leave her to her flowers] -> inquiries

// ---------------------------------------------------------------- page 5: Jeremy's barn
=== p5 ===
# page: 5
# panel: page
{not seen_barn:
    ~ visits += 1
    ~ seen_barn = true
}
{p5 > 1:
    {p5 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p5-again
    The barn on the Cirencester road.
}
{p5 == 1:
    # voice: p5-open
    Cole Antiques: a stone barn on the Cirencester road, full of other people's chairs. Over the door, a sign: Restored with Sympathy.
}
+ [Find Jeremy Cole] -> p5_jeremy
+ [Look round the barn] -> p5_barn

=== p5_barn ===
# panel: barn
# voice: p5a-1
Every chair has a price on a brown luggage label. The cheapest is four hundred pounds.
# voice: p5a-2
A radio on the workbench is playing the shipping forecast.
+ [Find Jeremy Cole] -> p5_jeremy

=== p5_jeremy ===
# panel: jeremy
{p5_jeremy > 1:
    # voice: p5b-again
    Jeremy: Anything else, Sergeant? I have a dresser coming at two.
    -> p5_jeremy_choices
}
# voice: p5b-1
Jeremy: Sergeant. Inspector. I heard this morning. Hugh and I didn't always agree, but he was good company on quiz nights.
# voice: p5b-3
He wipes his hands on a cloth that has gold on it. He has time for one question before the dresser.
-> p5_jeremy_choices
= p5_jeremy_choices
+ {p5_where == 0 && p5_board == 0} [Ask where he was at a quarter past eight] -> p5_where
+ {p5_where == 0 && p5_board == 0} [Ask about the peal board] -> p5_board
+ [Look at the trestle at the back] -> p5_brush

=== p5_where ===
# panel: jeremy
{p5_jeremy == 0: -> p5_jeremy}
~ lie = true
# voice: p5c-1
Jeremy: On the five, ringing, every blow, start to finish. Five is my bell. Ask anyone in the band.
# voice: p5c-2
Jeremy: When the lights went I kept going. You do. Rope's in your hands.
+ [Look at the trestle at the back] -> p5_brush
+ [Go out past his van] -> p5_van

=== p5_board ===
# panel: jeremy
{p5_jeremy == 0: -> p5_jeremy}
# voice: p5d-1
Jeremy: The Jubilee board? Found it in a barn at Bibury, under a tarpaulin. The tower's own, taken down in the sixties. Restored with sympathy.
# voice: p5d-2
Jeremy: The parish paid nine thousand pounds, out of the roof fund. A pub in Bath offered me twelve.
# voice: p5d-3
Quaile: The roof fund has had a hard year.
+ [Look at the trestle at the back] -> p5_brush
+ [Go out past his van] -> p5_van

=== p5_brush ===
# panel: brush
{p5_jeremy == 0: -> p5_jeremy}
~ brush = true
# voice: p5e-1
On a trestle at the back, a board under a dust sheet, and a sign-writer's brush across a pot of gold size. The gold is still wet.
# voice: p5e-2
Under the sheet: a peal board, half lettered. Jubilee, eighteen ninety-seven. These letters have small feet on them, like the lettering on old shop fronts.
# voice: p5e-3
Jeremy: A commission. Another church. I'm not at liberty.
+ [Go out past his van] -> p5_van

=== p5_van ===
# panel: van
{p5_jeremy == 0: -> p5_jeremy}
# voice: p5f-1
His van says Cole Antiques in gold, in plain round letters with no feet at all.
+ [Leave him to his dresser] -> inquiries

// ---------------------------------------------------------------- page 6: the Plough, quiz night
=== p6 ===
# page: 6
# panel: page
{not seen_plough:
    ~ visits += 1
    ~ seen_plough = true
}
{p6 > 1:
    {p6 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p6-again
    The Plough, quiz night.
}
{p6 == 1:
    # voice: p6-open
    The Plough. The quiz goes ahead: Hugh set the questions on Sunday, and the landlord reads them out from Hugh's sheet. Six teams and a fire.
}
+ [Listen to the questions] -> p6_quiz
+ [Look behind the bar] -> p6_photo

=== p6_fire ===
# panel: fire
# voice: p6a-1
The fire has been lit since four. The dog in front of it has not moved since five.
+ [Listen to the questions] -> p6_quiz

=== p6_quiz ===
# panel: quiz
~ quiz = true
# voice: p6b-1
Landlord: Round two. Question seven. In what year did Monotype release the typeface Gill Sans?
# voice: p6b-2
At the bar, the landlord shows you Hugh's answer sheet. Against question seven, in pencil: Nineteen twenty-eight. And under it, smaller: Then look up in the tower.
# voice: p6b-3
Quaile: He was going to ask the whole village. Then tell them the answer in print.
+ [Look behind the bar] -> p6_photo
+ [Find Dilys's team] -> p6_dilys

=== p6_photo ===
# panel: photo
# voice: p6c-1
Behind the bar, a photograph of Hugh at last year's quiz, in a bow tie, with the microphone.
# voice: p6c-2
Landlord: He never let the same team win twice running. Said it was bad for the village.
+ [Listen to the questions] -> p6_quiz
+ [Find Dilys's team] -> p6_dilys

=== p6_dilys ===
# panel: dilys
{p6_dilys > 1:
    # voice: p6d-again
    Dilys: Shush, love, it's the music round.
    -> p6_dilys_done
}
{rows:
    # voice: p6d-1
    Dilys: Glenys rang me at six this morning to ask if she's evidence.
- else:
    {asked_dilys:
        # voice: p6d-2
        Dilys: I was cross with you last night. I'm less cross now. Here.
        ~ rows = true
        {p6_dilys == 1:
            ~ rel_dilys += 1
            # memory: dilys +1 You asked Dilys twice, and nicely. She will remember that.
        }
        # voice: p6d-3
        She forwards you an email from Perth. The subject line is Not your best.
    - else:
        # voice: p6d-4
        Dilys: My sister's got a recording of Tuesday, if anyone had thought to ask. Nobody did. Here.
        ~ rows = true
        # voice: p6d-3
        She forwards you an email from Perth. The subject line is Not your best.
    }
}
-> p6_dilys_done
= p6_dilys_done
+ [Leave the quiz] -> inquiries

// ---------------------------------------------------------------- page 7: the old schoolhouse
=== p7 ===
# page: 7
# panel: page
{not seen_school:
    ~ visits += 1
    ~ seen_school = true
}
{p7 > 1:
    {p7 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p7-again
    The old schoolhouse.
}
{p7 == 1:
    # voice: p7-open
    The old schoolhouse, closed since nineteen ninety-one, with a For Sale board. Toby Pike is flying a drone over it for the brochure.
}
+ [Talk to Toby] -> p7_toby
+ [Look at the playground] -> p7_swing

=== p7_school ===
# panel: school
# voice: p7e-1
Tall church windows, a bell turret with no bell in it, and a board by the gate: Pike and Lowe, For Sale. Above the roof a drone hangs in the wind, filming.
+ [Talk to Toby] -> p7_toby

=== p7_swing ===
# panel: swing
# voice: p7a-1
One swing left in the playground. The chains have been painted so many times they no longer clink.
+ [Talk to Toby] -> p7_toby

=== p7_toby ===
# panel: toby
{p7_toby > 1:
    # voice: p7b-again
    Toby: Still here, Sergeant. Still selling.
    -> p7_toby_choices
}
{was_toby <= -1:
    # voice: p7b-cold
    Toby: The sergeant who took my phone off me. I'm working.
- else:
    {was_toby >= 1:
        # voice: p7b-warm
        Toby: Did you get the video? I sent it at six. I don't sleep, I'm selling a school.
    - else:
        # voice: p7b-1
        Toby: Sergeant! Come to buy a schoolhouse? Four bedrooms, original features, a bell nobody's allowed to ring.
    }
}
-> p7_toby_choices
= p7_toby_choices
+ {was_toby <= -1 && p7_sorry == 0} [Say sorry for last summer] -> p7_sorry
+ {was_toby > -1 || p7_sorry > 0} [Ask what his drone saw on Tuesday] -> p7_drone

=== p7_sorry ===
{p7_sorry == 1:
    ~ rel_toby += 1
    # memory: toby +1 You said sorry to Toby for last summer. He will remember that.
}
# voice: p7c-1
Toby: Oh. Right. Well. I was going to send you something anyway. Probably.
-> p7_toby

=== p7_drone ===
# panel: drone
{p7_toby == 0: -> p7_toby}
~ dark = true
# voice: p7d-1
On his controller, Tuesday night, the church from the air, for the brochure's Village Life page.
# voice: p7d-2
Eight thirteen: a man wheels a bicycle through the lychgate. Eight fourteen: the ringing chamber window goes dark. Eight fifteen: it lights again. Nobody comes out of the church door until twenty past.
# voice: p7d-3
Sam: So whoever it was never left the building.
# voice: p7d-4
Toby: Can I still use the bit before eight?
+ [Leave him to his buyers] -> inquiries

// ---------------------------------------------------------------- page 8: the peal board
=== p8 ===
# page: 8
# panel: page
{not seen_board:
    ~ visits += 1
    ~ seen_board = true
}
{p8 > 1:
    {p8 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p8-again
    The ringing chamber, by daylight.
}
{p8 == 1:
    # voice: p8-open
    The ringing chamber by daylight. Dr Achebe is waiting with a magnifying glass from the vestry, and on the wall, the Jubilee board.
}
+ [Look at the board] -> p8_board
+ [Talk to Dr Achebe] -> p8_achebe

=== p8_board ===
# panel: board
# voice: p8a-1
Black, with gold letters. Saint Aldhelm's. On the Diamond Jubilee of Her Majesty Queen Victoria, the twenty-second of June, eighteen ninety-seven, a peal of five thousand and forty changes. Six names.
# voice: p8a-2
Achebe: The parish bought it in March. Mr Cole found it in a barn. Hugh unveiled it. Hugh was not happy about something, and wouldn't say what.
+ [Look closely with the glass] -> p8_glass
+ [Talk to Dr Achebe] -> p8_achebe

=== p8_glass ===
# panel: glass
{p8_board == 0: -> p8_board}
~ typeface = true
# voice: p8b-1
Under the glass the letters are clean and round. The R kicks its leg out straight. The small g has two loops, like spectacles.
# voice: p8b-2
Quaile: My father had a railway timetable in those letters. He kept it in the downstairs toilet.
{quiz:
    # voice: p8b-3
    Sam: Gill Sans. Nineteen twenty-eight. On a board from eighteen ninety-seven.
- else:
    # voice: p8b-4
    Sam: They don't look Victorian.
}
# voice: p8b-5
Achebe: Mr Cole told us he had regilded them.
+ [Talk to Dr Achebe] -> p8_achebe
+ [Look at the treble rope] -> p8_motes

=== p8_achebe ===
# panel: achebe8
{p8_achebe > 1:
    # voice: p8c-again
    Achebe: Anything else up here, Sergeant? I have a funeral to plan.
    -> p8_achebe_choices
}
# voice: p8c-1
Achebe: On base rates, Inspector, it is usually the person who found him. That's me. I'd put myself at eleven per cent.
# voice: p8c-2
Quaile: And the others?
# voice: p8c-3
Achebe: They were all in the dark with me. I can't give odds on people I couldn't see.
-> p8_achebe_choices
= p8_achebe_choices
+ {p8_you == 0} [Ask what she makes of you] -> p8_you
+ [Look at the treble rope] -> p8_motes
+ [Leave the tower] -> inquiries

=== p8_you ===
# panel: achebe8
{p8_achebe == 0: -> p8_achebe}
{p8_you == 1:
    ~ rel_achebe += 1
    # memory: achebe +1 You asked Dr Achebe what she made of you. She will remember that.
}
{was_margaret <= -1:
    # voice: p8d-cold
    Achebe: You, Sergeant? You'll still be here at Christmas. You keep turning up to things you were only asked to once.
- else:
    # voice: p8d-1
    Achebe: You, Sergeant? You'll still be here at Christmas. Margaret has asked you to Sunday lunch, and you haven't said no.
    # voice: p8d-2
    Sam: How do you know that?
    # voice: p8d-3
    Achebe: She told me. She's bought a second chair.
}
+ [Look at the treble rope] -> p8_motes
+ [Leave the tower] -> inquiries

=== p8_motes ===
# panel: motes
# voice: p8e-1
Dust in the light from the louvres. The ropes are tied up for the week, all but the treble.
# voice: p8e-2
The treble rope hangs free, and holding it, as if waiting to be told Look to, is a scarecrow in a navy mac and brown city shoes.
# voice: p8e-3
Achebe: It was here when I unlocked this morning. I thought one of the band had brought it up.
+ [Leave the tower] -> inquiries

// ---------------------------------------------------------------- page 9: the rows (Wednesday night, the vicarage)
=== p9 ===
# page: 9
# panel: page
{p9 > 1:
    {p9 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p9-again
    The vicarage kitchen.
}
{p9 == 1:
    # voice: p9-open
    The vicarage kitchen, eleven at night. Dr Achebe has a spreadsheet open and the kettle on. Quaile has her shoes off.
}
-> p9_choices
= p9_choices
+ {rows && not bell4} [Read Glenys's email] -> p9_email
+ {bell4 && not named4} [Work out who rang that bell] -> p9_who
+ [Go through your notebook] -> p9_notes
+ [Ask Quaile what she thinks] -> p9_quaile
+ [Go to bed. Sunday is the service] -> p10

=== p9_table ===
# panel: table
# voice: p9a-1
On the table: Win's napkin from the Plough, three mugs, and a plate of biscuits that Quaile is counting.
-> p9.p9_choices

=== p9_window ===
# panel: window
# voice: p9b-1
Through the window, the tower against the rain. Somebody has left the light on in the ringing chamber.
-> p9.p9_choices

=== p9_email ===
# panel: laptop
{not rows:
    # voice: p9c-none
    Dr Achebe's spreadsheet has six columns headed One to Six, and nothing in them yet.
    -> p9.p9_choices
}
{p9_email > 1:
    # voice: p9c-again
    Glenys's three rows, on the screen: 2 4 1 3. 4 2 3 1. 4 3 2 1.
    -> p9_guess
}
# voice: p9c-1
Achebe: From Glenys in Perth. Dear Dilys. Not your best. You were going nicely on five till fourteen minutes past, then somebody says lights, and one bell stops dead for forty seconds.
# voice: p9c-2
Achebe: I can only hear four, so I've numbered them by note, highest first, as I hear them. Here's three rows.
2 4 1 3
4 2 3 1
4 3 2 1
# voice: p9c-3
Achebe: Then it comes back late and clumsy, like somebody out of breath. Win stood you at sixteen minutes past. Four out of ten. Love, G.
# voice: p9c-4
Achebe: She can't tell which bell it was. She only hears the notes. But we have Win's napkin.
-> p9_guess
= p9_guess
+ [The one went silent] -> p9_one
+ [The two went silent] -> p9_two
+ [The three went silent] -> p9_three
+ [The four went silent] -> p9_four
+ [The five went silent] -> p9_five
+ [Leave it for now] -> p9.p9_choices

// what each silent bell would have sounded like, taken out of the napkin's rows 4 2 5 1 3, 4 5 2 3 1, 5 4 3 2 1 and
// numbered again by note (tools/rows.mjs prints these from the plain hunt rule)
=== p9_one ===
# panel: laptop
~ guesses += 1
# voice: p9d-1
Achebe: Take the one out, and that first row would sound 3 1 4 2. Glenys heard 2 4 1 3.
-> p9_email.p9_guess

=== p9_two ===
# panel: laptop
~ guesses += 1
# voice: p9d-2
Achebe: Take the two out, and that first row would sound 3 4 1 2. Glenys heard 2 4 1 3.
-> p9_email.p9_guess

=== p9_three ===
# panel: laptop
~ guesses += 1
# voice: p9d-3
Achebe: Take the three out, and that first row would sound 3 2 4 1. Glenys heard 2 4 1 3.
-> p9_email.p9_guess

=== p9_five ===
# panel: laptop
~ guesses += 1
# voice: p9d-5
Achebe: Take the five out, and that first row would sound 4 2 1 3. Close. Glenys heard 2 4 1 3.
-> p9_email.p9_guess

=== p9_four ===
# panel: laptop
~ bell4 = true
# voice: p9d-4
Achebe: Take the four out. 4 2 5 1 3 becomes 2 5 1 3, and by note that's 2 4 1 3. Then 4 2 3 1. Then 4 3 2 1. Every row.
{guesses == 0:
    # voice: p9d-first
    Quaile: First go.
}
# voice: p9d-6
Sam: The four stopped for forty seconds, in the dark, and came back out of breath.
-> p9_who

=== p9_who ===
# panel: table
{p9_who > 1:
    # voice: p9e-again
    Sam: Who had the four on Tuesday?
}
{p9_who == 1:
    # voice: p9e-1
    Achebe: Don't ask me who had it. I was on a rope for the fourth time in my life. I couldn't have told you which one was mine.
}
+ [Win] -> p9_win
+ [Jeremy] -> p9_jeremy
+ [Dilys] -> p9_dilys
+ [Margaret] -> p9_margaret
+ [Leave it for now] -> p9.p9_choices

=== p9_win ===
# panel: table
{swap:
    # voice: p9f-1
    Sam: The board says Win. Forty-one years on the four. But not on Tuesday. Hugh never came, so they all moved up one. Win had the three.
    -> p9_who
- else:
    # voice: p9f-2
    Sam: The blackboard says Win. Four, Win.
    # voice: p9f-3
    Quaile: That's who usually stands there, Sam. Is it who stood there on Tuesday?
    -> p9.p9_choices
}

=== p9_jeremy ===
# panel: table
{swap:
    ~ named4 = true
    # voice: p9g-1
    Sam: Hugh never came, so they all moved up one. Jeremy's bell is the five. On Tuesday he rang the four, next to the door and the light switch.
    {lie:
        # voice: p9g-2
        Sam: And he told us he was on the five, every blow.
    }
    # voice: p9g-3
    Quaile: Write that down.
- else:
    # voice: p9g-4
    Sam: Jeremy stood by the door.
    # voice: p9g-5
    Quaile: The board says Jeremy rings the five, Sam. You'd want more than where he stood.
}
-> p9.p9_choices

=== p9_dilys ===
# panel: table
# voice: p9h-1
Sam: Dilys rings the three, and on Tuesday she moved up to the two. She was talking to me through most of it.
-> p9_who

=== p9_margaret ===
# panel: table
# voice: p9h-2
Sam: Margaret had the treble. Her first time on it. Glenys would have heard the treble go.
-> p9_who

=== p9_quaile ===
# panel: quaile
{p9_quaile == 1 && was_quaile >= 1:
    # voice: p9i-warm
    Quaile: You've learnt to ask me things, Sam. All right.
}
{evidence() >= 5:
    # voice: p9i-good
    Quaile: I think you know. I'd like you to say it on Sunday, in front of the whole parish.
- else:
    {not typeface:
        # voice: p9i-board
        Quaile: Hugh wanted to say something about the board. Has anyone looked at it properly?
    - else:
        {not swap:
            # voice: p9i-swap
            Quaile: Hugh didn't come. So who was on which rope?
        - else:
            # voice: p9i-rows
            Quaile: Dilys records every practice. Has anyone asked her for Tuesday's?
        }
    }
}
-> p9.p9_choices

=== p9_notes ===
# panel: table
{text:
    # voice: p9n-text
    Hugh, at five past eight: on my way up, something to say about the board.
}
{proof:
    # voice: p9n-proof
    In his hand, the corner of a proof: Peal board, a corre. The rest of the page is gone.
}
{swap:
    # voice: p9n-swap
    Hugh never came, so they all moved up one.
}
{lie && swap:
    # voice: p9n-lie
    Jeremy says he rang the five, every blow.
}
{lie && not swap:
    # voice: p9n-lie-b
    Jeremy says he rang the five, every blow, which is what the blackboard says.
}
{rows:
    # voice: p9n-rows
    Glenys in Perth: one bell stopped dead for forty seconds when the lights went, and came back out of breath.
}
{named4:
    # voice: p9n-named
    The silent bell was the four, and on Tuesday the four was Jeremy.
}
{dark:
    # voice: p9n-dark
    The drone: the chamber dark from eight fourteen to eight fifteen. Nobody left the church.
}
{quiz:
    # voice: p9n-quiz
    Hugh's question seven: Gill Sans, nineteen twenty-eight. Then look up in the tower.
}
{typeface:
    # voice: p9n-typeface
    The Jubilee board is lettered in round letters with no feet.
}
{brush:
    # voice: p9n-brush
    In Jeremy's barn, a second Jubilee board, half lettered, the gold still wet.
}
{not (text or proof or swap or rows or dark or quiz or typeface or brush):
    # voice: p9n-empty
    Your notebook has the date in it, and the words plain hunt.
}
-> p9.p9_choices

// ---------------------------------------------------------------- page 10: Sunday
=== p10 ===
# page: 10
# panel: page
{p10 > 1:
    {p10 > 2:
        # voice: loop-here
        Quaile: We've been here, Sam.
    }
    # voice: p10-again
    The Sunday service.
}
{p10 == 1:
    # voice: p10-open
    Sunday, the harvest service. Marrows on the font, and on the wall the Jubilee board under a purple cloth, to be blessed after the notices. Jeremy Cole is in the front pew, in a suit.
}
-> p10_choices
= p10_choices
+ {p10_cloth == 0} [Lift the cloth] -> p10_cloth
+ [Listen to the notices] -> p10_nave
+ [Stand up] -> p10_stand

=== p10_nave ===
# panel: nave
# voice: p10a-1
Achebe: Notices. The flower rota is in the porch. The roof fund stands at four thousand two hundred pounds.
# voice: p10a-2
Achebe: Hugh Daventry's funeral will be here on Thursday at eleven. Margaret is doing the flowers.
-> p10.p10_choices

=== p10_pew ===
# panel: pew
# voice: p10b-1
Jeremy Cole sits in the front pew with his hymn book shut. He has not looked at the cloth.
-> p10.p10_choices

=== p10_cloth ===
# panel: cloth
~ swapped = true
# voice: p10c-1
You lift the corner of the purple cloth. The gold on the date is still tacky. The letters have little feet now.
{brush:
    # voice: p10c-2
    Sam: It's the board from his barn. He swapped them.
- else:
    # voice: p10c-3
    Sam: That's not the board I saw on Tuesday.
}
# voice: p10c-4
Achebe stops the notices and looks at you over her glasses.
-> p10.p10_choices

=== p10_stand ===
# panel: nave
# voice: p10d-1
Quaile: Go on, then.
+ [Name Jeremy Cole] -> p10_jeremy
+ [Name Win Haskett] -> p10_win
+ [Name Dilys Rudd] -> p10_dilys
+ [Name Dr Achebe] -> p10_achebe

=== p10_jeremy ===
# panel: pew
~ accused = "jeremy"
{proof:
    # voice: p10e-proof
    Sam: Hugh died holding the corner of a proof. Peal board, a correction. You have the rest of that page.
}
{quiz && typeface:
    # voice: p10e-typeface
    Sam: The board you sold this church for nine thousand pounds is lettered in Gill Sans. Gill Sans was released in nineteen twenty-eight.
}
{brush || swapped:
    # voice: p10e-brush
    Sam: So you lettered a new one in your barn, and swapped it this week.
}
{named4:
    # voice: p10e-named
    Sam: On Tuesday the band moved up one, and you rang the four. When the lights went, the four stopped dead for forty seconds.
- else:
    {rows:
        # voice: p10e-rows
        Sam: When the lights went, one bell stopped dead for forty seconds.
    }
}
{dark:
    # voice: p10e-dark
    Sam: And nobody left the church.
}
{evidence() >= 5:
    -> p10_confess
- else:
    # voice: p10e-hunch
    Jeremy: I rang every blow, Sergeant. Ask anyone in the band.
    # voice: p10e-sit
    Quaile: Sit down, Sam. Not today.
    ~ ending = "denied"
    -> p10_after
}

=== p10_win ===
# panel: nave
~ accused = "win"
{p10_win == 1:
    ~ rel_win -= 2
    # memory: win -2 You accused Win Haskett in church. She did not hear it, and she will not forget it.
}
# voice: p10f-win
Win: I had the three, Sergeant. I kept it going in the dark. Ask Glenys.
-> p10_quaile

=== p10_dilys ===
# panel: nave
~ accused = "dilys"
{p10_dilys == 1:
    ~ rel_dilys -= 2
    # memory: dilys -2 You accused Dilys Rudd in church. She will not forget it.
}
# voice: p10f-dilys
Dilys: I was on the two, love, and talking to you the whole time. You heard me.
-> p10_quaile

=== p10_achebe ===
# panel: nave
~ accused = "achebe"
{p10_achebe == 1:
    ~ rel_achebe -= 2
    # memory: achebe -2 You accused Dr Achebe in her own church. She will remember that, to two decimal places.
}
# voice: p10f-achebe
Achebe: Eleven per cent, Sergeant. I did say.
-> p10_quaile

=== p10_quaile ===
# panel: nave
{evidence() >= 5:
    # voice: p10g-1
    Quaile: Sit down, Sam. Mr Cole, Hugh was going to print a correction about your board. You went down the stair in the dark to get it back.
    ~ ending = "quaile"
    -> p10_confess
- else:
    # voice: p10g-2
    Quaile: Sit down, Sam.
    # voice: p10g-3
    Dr Achebe blesses the board. Jeremy Cole holds the cloth for her.
    ~ ending = "none"
    -> p10_after
}

=== p10_confess ===
# panel: pew
{ending == "":
    ~ ending = "solved"
    ~ rel_quaile += 1
    # memory: quaile +1 You named Jeremy Cole yourself. Quaile will remember that.
}
# voice: p10h-1
Jeremy: He was going to print it in the November magazine. Every house in the village gets one.
# voice: p10h-2
Jeremy: I went down to ask him for the page. He held on to it and stepped back, and there isn't a step there.
# voice: p10h-3
Quaile: And then you went back up and rang.
# voice: p10h-4
Jeremy: I didn't know what else to do.
-> p10_after

=== p10_after ===
+ [Stay for the ringing] -> p10_bell

=== p10_bell ===
# panel: bell
{ending == "": -> p10_stand}
# voice: p10i-1
After the service the band rings for the harvest. Five ropes. Win back on the four.
{ending == "solved" or ending == "quaile":
    # voice: p10i-2
    Dr Achebe rings the five, and gets it right twice.
- else:
    # voice: p10i-3
    Jeremy Cole rings the five, every blow.
}
# voice: p10i-4
When they stand, the tenor, which nobody has rung all week, speaks once on its own.
# voice: p10i-5
Up on its wheel, something small and yellow looks down the tower at you.
-> credits

=== credits ===
{ending:
- "solved": You solved Plain Hunt.
- "quaile": Quaile solved Plain Hunt. You named the wrong person first.
- "denied": You named the right man, without enough to hold him.
- else: Nobody was charged. The board was blessed.
}
Places you went: {seen_win: Win's cottage, }{seen_barn: Jeremy's barn, }{seen_plough: the Plough, }{seen_school: the schoolhouse, }{seen_board: the peal board, }and the vicarage.
Evidence against Jeremy Cole: {evidence()} of 11.
The village remembers you. Toby: {standing(rel_toby)}. Margaret: {standing(rel_margaret)}. Dilys: {standing(rel_dilys)}. Quaile: {standing(rel_quaile)}. Win: {standing(rel_win)}. Dr Achebe: {standing(rel_achebe)}.
+ [Begin again] -> restart

=== restart ===
# restart
-> END
