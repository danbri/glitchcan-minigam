// Steeple Wyke: The Marrow Show. A village murder in ten graphic-novel pages (index.html, pages.json).
// "# page: N" turns to page N (the host swaps the panels and the page's background sound); "# panel: X" moves the
// view, and a tap on a panel diverts here to that panel's knot. "# voice: id" plays one recorded take of the line it
// is on (media/vo/<id>-N.mp3); voices.json says who speaks it. A line that starts "Name:" is that person speaking.
// After the body (page 2) the inquiries knot is a hub: four visits of five places (pages 3 to 7), in any order. The
// order changes what is found, each interview allows one question, and evidence() decides whether an accusation
// holds; the ending ("solved", "quaile", "denied", "none") changes page 10's lines.
// The scarecrows are the wrong note (nocliches skill, rule F7): they are never explained.
VAR flask = false
VAR green = false
VAR foxglove = false
VAR notebook = false
VAR syringe = false
VAR alibi = false
VAR poured = false
VAR argument = false
VAR clement_study = false
VAR rattled = false
VAR toby_vicar = false
VAR visits = 0
VAR seen_margaret = false
VAR seen_tent = false
VAR seen_carpark = false
VAR seen_vicarage = false
VAR seen_study = false
VAR accused = ""
VAR ending = ""

-> p1

// ---------------------------------------------------------------- page 1: the show
=== p1 ===
# page: 1
# panel: page
# voice: p1-open
The Steeple Wyke Horticultural Show, the hundred and twelfth. You have been a detective sergeant in this county for nineteen days.
+ [Find DCI Quaile] -> p1_chutney
+ [Listen to the man on the tannoy] -> p1_tannoy

=== p1_show ===
# panel: show
# voice: p1a-1
Bunting, a marquee, a brass band from the next village, and four hundred people who know each other's business.
# voice: p1a-2
Behind the marquee, a church spire. In front of it, a line of scarecrows.
+ [Find DCI Quaile] -> p1_chutney
+ [Walk along the scarecrows] -> p1_scarecrows

=== p1_chutney ===
# panel: chutney
# voice: p1b-1
Quaile: You came. Good. I'm judging the chutney, and you're holding the spoons.
# voice: p1b-2
Sam: Ma'am, I was told this was a day off.
# voice: p1b-3
Quaile: It is. Nobody has ever been murdered over chutney.
+ [Hold the spoons] -> p1_tannoy
+ [Walk along the scarecrows] -> p1_scarecrows

=== p1_tannoy ===
# panel: tannoy
# voice: p1c-1
Gerald: Gerald Pike, chairman. The marrow results are delayed. Would whoever has moved the marrows please put them back.
# voice: p1c-2
Gerald: And the vicar's cordial is in the church-hall flasks again. Do not take them home.
# voice: p1c-3
He has judged the marrows for thirty-one years. His own marrow has won for nine.
+ [Walk along the scarecrows] -> p1_scarecrows

=== p1_scarecrows ===
# panel: scarecrows
# voice: p1d-1
The scarecrow competition. This year's theme is Our Village: a straw vicar in a yellow jacket, a straw butcher, and a straw man in a panama hat.
# voice: p1d-2
The straw Gerald has a red rosette, and faces the wrong way.
# voice: p1d-3
Behind the produce tent, somebody screams. It is a short scream, and then a very English apology.
+ [Run to the produce tent] -> p2

// ---------------------------------------------------------------- page 2: behind the produce tent
=== p2 ===
# page: 2
# panel: page
# voice: p2-open
Gerald Pike is in a deckchair behind the produce tent, with his hat over his face. The woman who screamed is still apologising.
+ [Check on him] -> p2_chair
+ [Keep the crowd back] -> p2_crowd

=== p2_crowd ===
# panel: crowd
# voice: p2a-1
Half the show has followed you round the tent. The brass band has not stopped playing.
# voice: p2a-2
Quaile: Keep them back, Sam. Use your height.
+ [Check on Gerald] -> p2_chair

=== p2_chair ===
# panel: chair
# voice: p2b-1
No pulse. His hand is cool. Under the hat his face is calm, as if somebody has just told him his marrow won.
# voice: p2b-2
Quaile: Don't move him. Ring it in. Then look at what's on the grass.
+ [Look at what's on the grass] -> p2_flask

=== p2_flask ===
# panel: flask
~ flask = true
# voice: p2c-1
A blue enamel flask, half full of something pale. A brown label on a string: Church Hall.
# voice: p2c-2
Sam: He told everybody not to take them home.
# voice: p2c-3
Quaile: Then why has he got one?
+ [Tell Quaile what you think] -> p2_kneel


=== p2_kneel ===
# panel: kneel
# voice: p2d-1
Quaile: Seventy-two, heavy, red in the face, a hot day. The doctor will say heart.
# voice: p2d-2
Sam: And you'll say?
# voice: p2d-3
Quaile: I'll say a man who tells four hundred people not to touch the vicar's flasks doesn't drink from one.
# voice: p2d-4
Quaile: The prize-giving is at seven, and the whole village will be in one room. We have till then.
+ [Decide where to start] -> inquiries

// ---------------------------------------------------------------- the inquiries: four visits of five, in any order
// Each place is a page. Its first knot counts the visit once (a tap back to a page's overview re-enters that knot).
=== inquiries ===
{visits >= 4: -> evening}
{visits:
- 0:
    # voice: hub-0
    Quaile: Five people to see before seven, and time for four. Where first?
- 3:
    # voice: hub-3
    Quaile: One more, then the pub. My feet have been judging chutney since nine.
- else:
    # voice: hub-n
    Quaile: Where next?
}
+ {not seen_margaret} [Go to Margaret Pike's cottage] -> p3
+ {not seen_tent} [Go back to the marrow tent] -> p4
+ {not seen_carpark} [Find Gerald's son in the car park] -> p5
+ {not seen_vicarage} [Call on the vicar] -> p6
+ {not seen_study} [Search Gerald's study] -> p7
+ {visits >= 2} [Go to the pub now and think] -> p8

=== evening ===
# voice: evening
Quaile: That's the light gone. Pub, Sam. I'm buying, so it's halves.
+ [Go to the pub] -> p8

=== function evidence() ===
~ temp n = 0
{flask:
    ~ n += 1
}
{foxglove:
    ~ n += 1
}
{notebook:
    ~ n += 1
}
{poured:
    ~ n += 1
}
{argument:
    ~ n += 1
}
{clement_study:
    ~ n += 1
}
{rattled:
    ~ n += 1
}
~ return n

// ---------------------------------------------------------------- page 3: Margaret
=== p3 ===
# page: 3
# panel: page
{not seen_margaret:
    ~ visits += 1
    ~ seen_margaret = true
}
{seen_study:
    # voice: p3-open-b
    Margaret Pike is back in her garden, deadheading roses, as if the afternoon were any other.
    + [Talk to her] -> p3_margaret
- else:
    # voice: p3-open
    Margaret Pike is in her garden, two fields from the show, deadheading roses. Nobody has told her. You have to.
    + [Tell her] -> p3_margaret
}

=== p3_margaret ===
# panel: margaret
{seen_study:
    # voice: p3a-b1
    Margaret: You've been in his study, Sergeant. Did you find what you wanted?
    # voice: p3a-b2
    Sam: Some of it.
- else:
    # voice: p3a-1
    Sam: Mrs Pike, I'm sorry. Your husband has died.
    # voice: p3a-2
    Margaret: At the show?
    # voice: p3a-3
    Sam: Behind the produce tent.
    # voice: p3a-4
    Margaret: He'd have wanted to be in front of it.
}
+ [Ask about his flask] -> p3_green
+ [Ask about the foxgloves] -> p3_border

=== p3_green ===
# panel: green
~ green = true
# voice: p3b-1
Margaret: Gerald only drank from the green flask. Elderflower. He made it himself, and nobody else would touch it.
# voice: p3b-2
Margaret: He forgot it this morning. He forgot it every morning, and I took it down to him at twelve.
# voice: p3b-3
Sam: Not today?
# voice: p3b-4
Margaret: Not today. I had the roses.
+ {flask && not poured} [Show her the church-hall flask] -> p3_shown
+ [Ask about her secateurs] -> p3_secateurs
+ [Ask about the foxgloves] -> p3_border

=== p3_shown ===
# panel: green
~ poured = true
# voice: p3e-1
Margaret: That's the vicar's. Clement takes Gerald a cup of his cordial at every show, and Gerald tips it on the nearest roses when Clement has gone.
# voice: p3e-2
Margaret: He must have been thirsty today.
+ [Ask about the foxgloves] -> p3_border

=== p3_secateurs ===
# panel: secateurs
# voice: p3c-1
Red handles, clean blades. She wears them on a cord round her neck.
# voice: p3c-2
Margaret: If you want to know whether I've cut any foxgloves, Sergeant, count them.
+ [Count them] -> p3_border

=== p3_border ===
# panel: border
# voice: p3d-1
Forty-one foxgloves along the back wall. You count them twice. Every stem is standing.
# voice: p3d-2
At the end of the border stands the scarecrow in the panama hat. An hour ago it was at the show.
# voice: p3d-3
Margaret: That's not ours.
+ [Leave her to the roses] -> inquiries

// ---------------------------------------------------------------- page 4: the marrow tent
=== p4 ===
# page: 4
# panel: page
{not seen_tent:
    ~ visits += 1
    ~ seen_tent = true
}
# voice: p4-open
The marrow tent. Forty marrows on trestles, and one woman in a butcher's apron, who has not left.
+ [Talk to her] -> p4_dilys
+ [Look for Gerald's marrow] -> p4_tent

=== p4_tent ===
# panel: tent
# voice: p4a-1
Gerald's marrow is on the end of the table. This year it has no card.
# voice: p4a-2
Dilys: He judged it himself. Every year. Nobody said anything, because it was Gerald.
+ [Talk to Dilys] -> p4_dilys

=== p4_dilys ===
# panel: dilys
# voice: p4b-1
Dilys: Dilys Rudd, Rudd's Butchers. I didn't kill him, love. I was weighing.
# voice: p4b-2
Quaile: I'm told he was going to disqualify you this year.
# voice: p4b-3
Dilys: He was going to try.
# voice: p4b-4
The tannoy is calling her to the scales. You have time for one question.
+ {not syringe && not argument} [Ask what's in her apron pocket] -> p4_syringe
+ {not syringe && not argument} [Ask who Gerald argued with today] -> p4_argue
+ {syringe || argument} [Look at her marrow] -> p4_marrows

=== p4_syringe ===
# panel: syringe
~ syringe = true
# voice: p4c-1
In her apron pocket, a veterinary syringe the size of a cucumber.
# voice: p4c-2
Dilys: Water. Two pints a night, straight up the stalk. Every grower in this tent does it. Gerald just never caught anyone else.
# voice: p4c-3
Quaile: Is that a confession?
# voice: p4c-4
Dilys: To marrows, yes.
+ [Look at her marrow] -> p4_marrows

=== p4_argue ===
# panel: dilys
~ argument = true
# voice: p4f-1
Dilys: The vicar. Behind the produce tent, about one. Gerald was waving his little notebook at him.
# voice: p4f-2
Dilys: Then they shook hands, and the vicar went and fetched him a drink. Very Christian.
# voice: p4f-3
She goes to the scales without a backward look.
+ [Look at her marrow] -> p4_marrows

=== p4_marrows ===
# panel: marrows
{syringe:
    # voice: p4d-1
    Her marrow is weeping water from a hole the size of a pin. So is Gerald's.
    # voice: p4d-2
    Sam: He did it too.
    # voice: p4d-3
    Dilys: Thirty-one years. Write that down, love. Big letters.
- else:
    # voice: p4d-4
    Her marrow is weeping water from a hole the size of a pin. So is Gerald's, and so is every other marrow on the table.
}
+ [Leave the tent] -> inquiries

// ---------------------------------------------------------------- page 5: the car park
=== p5 ===
# page: 5
# panel: page
{not seen_carpark:
    ~ visits += 1
    ~ seen_carpark = true
}
# voice: p5-open
The car park is a field. Toby Pike is in the middle of it, on the phone, in suede loafers.
+ [Wait for him to finish] -> p5_toby
+ [Look round the car park] -> p5_field

=== p5_field ===
# panel: field
# voice: p5a-1
Range Rovers, a tractor, the brass band's minibus. Somebody has parked across the gate, and it is Toby.
+ [Get him off the phone] -> p5_toby

=== p5_toby ===
# panel: toby
# voice: p5b-1
Toby: Sorry, sorry. Clients. Toby Pike, Pike and Lowe, Cirencester. Is it Dad?
# voice: p5b-2
Sam: I'm sorry.
# voice: p5b-3
Toby: Right. Right. Is there a form for probate, or do I just ring someone?
# voice: p5b-4
His phone is already buzzing again. He will give you one answer.
+ {not alibi && not toby_vicar} [Ask where he was at two o'clock] -> p5_alibi
+ {not alibi && not toby_vicar} [Ask what his father thought of the vicar] -> p5_father
+ {alibi || toby_vicar} [Walk him back to his car] -> p5_minibus

=== p5_alibi ===
# panel: alibi
~ alibi = true
# voice: p5c-1
Toby: In the car, on a call to a man in Swindon from half one till twenty past two. He wants a barn.
# voice: p5c-2
His phone agrees. So does his dashcam, which has filmed him talking to the windscreen for fifty minutes.
# voice: p5c-3
Quaile: Your father owned the fields behind the church.
# voice: p5c-4
Toby: Forty houses, if the parish council sees sense. Dad wouldn't. I'm not hiding it.
+ [Walk him back to his car] -> p5_minibus
+ [Leave him to his phone] -> inquiries

=== p5_father ===
# panel: toby
~ toby_vicar = true
# voice: p5e-1
Toby: The vicar? Dad said he couldn't add up. Said it twice this week, which for Dad is practically a sermon.
# voice: p5e-2
Toby: Sorry, I have to take this. It's Swindon.
+ [Walk him back to his car] -> p5_minibus
+ [Leave him to his phone] -> inquiries

=== p5_minibus ===
# panel: minibus
# voice: p5d-1
There is mud to his ankles and no straw on him anywhere. He has not been near the produce tent.
# voice: p5d-2
In the back of the brass band's minibus, the straw vicar sits with its seatbelt on.
+ [Leave the car park] -> inquiries

// ---------------------------------------------------------------- page 6: the vicarage
=== p6 ===
# page: 6
# panel: page
{not seen_vicarage:
    ~ visits += 1
    ~ seen_vicarage = true
}
# voice: p6-open
St Aldhelm's: the church, the hall, the vicarage, and a roof that has been under scaffolding since Easter.
+ [Find the vicar] -> p6_vicar

=== p6_vicar ===
# panel: vicar
# voice: p6a-1
Clement: Sergeant! Inspector! Dreadful. I've been on the cake stall all afternoon, you can ask anyone.
# voice: p6a-2
Quaile: Nobody's asked you yet, Vicar.
# voice: p6a-3
Clement: No. Quite. Sorry. Cordial?
+ {notebook && not rattled} [Show him Gerald's notebook] -> p6_shown
+ [Ask about his garden] -> p6_garden
+ [Ask to see the hall kitchen] -> p6_hooks

=== p6_shown ===
# panel: vicar
~ rattled = true
# voice: p6e-1
Clement: Gerald wrote everything down. He once wrote down my sermon. And timed it.
# voice: p6e-2
Quaile: Did he time this?
# voice: p6e-3
The vicar puts both hands on his bicycle, as if it might leave without him.
+ [Ask about his garden] -> p6_garden
+ [Ask to see the hall kitchen] -> p6_hooks

=== p6_garden ===
# panel: garden
~ foxglove = true
# voice: p6b-1
The vicarage border: foxgloves, and six of them cut down to the stalk. Clean cuts, this week.
# voice: p6b-2
Clement: Slugs.
# voice: p6b-3
Sam: Slugs with secateurs?
# voice: p6b-4
Clement: Very determined slugs.
+ [Ask to see the hall kitchen] -> p6_hooks

=== p6_hooks ===
# panel: hooks
# voice: p6c-1
The church-hall kitchen. Seven hooks, numbered in marker pen. Six blue flasks.
# voice: p6c-2
Clement: One always goes walkabout at the show. Gerald's very strict about it. Was.
+ [Go out and look at the roof] -> p6_roof

=== p6_roof ===
# panel: roof
# voice: p6d-1
The roof appeal board: a thermometer painted red up to twenty thousand pounds. The target is sixty.
# voice: p6d-2
The top of the red is still wet. It has run down over the old paint.
# voice: p6d-3
Quaile: Generous parish.
# voice: p6d-4
Clement: An anonymous donor.
+ [Leave the vicar to his roof] -> inquiries

// ---------------------------------------------------------------- page 7: Gerald's study
=== p7 ===
# page: 7
# panel: page
{not seen_study:
    ~ visits += 1
    ~ seen_study = true
}
{seen_margaret:
    # voice: p7-open
    Gerald's study. Margaret lets you in, and stays in the doorway.
- else:
    # voice: p7-open-b
    Margaret Pike opens the door. Someone has already told her; she does not say who. She lets you into the study and stays in the doorway.
}
+ [Search the desk] -> p7_notebook
+ [Ask Margaret about the Society's money] -> p7_margaret

=== p7_room ===
# panel: room
# voice: p7a-1
Rosettes on every wall, in date order from 1994. Out on the lawn, the scarecrow in the panama hat looks in at the window.
# voice: p7a-2
Margaret: That wasn't there this morning either.
+ [Search the desk] -> p7_notebook

=== p7_margaret ===
# panel: doorway
# voice: p7b-1
Margaret: He kept the Society's books in there. He was treasurer before Clement, and he never forgave him for being better at it.
# voice: p7b-2
Sam: Was Clement better at it?
# voice: p7b-3
Margaret: Clement was nicer at it.
+ [Search the desk] -> p7_notebook

=== p7_notebook ===
# panel: notebook
~ notebook = true
# voice: p7c-1
A notebook in Gerald's square capitals. Saturday's page: Prize fund four thousand short. Roof? Ask C. After marrows.
{seen_vicarage:
    ~ clement_study = true
    # voice: p7c-4
    Margaret: The vicar came at four, to pray with me. He asked to sit in here on his own for a while.
    # voice: p7c-5
    Quaile: And did he pray?
    # voice: p7c-6
    Margaret: He looked in the drawers. I suppose that's a kind of prayer.
- else:
    # voice: p7c-2
    Sam: After the marrows. He was going to ask him today.
    # voice: p7c-3
    Quaile: And he never got past the marrows.
}
+ [Look at the cups on the shelf] -> p7_cups
+ [Leave the study] -> inquiries

=== p7_cups ===
# panel: cups
# voice: p7d-1
Nine silver cups. All of them the Pike Cup, all won by Gerald Pike, all judged by Gerald Pike.
# voice: p7d-2
Quaile: I'd have poisoned him over that alone.
# voice: p7d-3
Sam: Ma'am.
# voice: p7d-4
Quaile: I'm deaf in one ear, Sam. I can say what I like.
+ [Leave the study] -> inquiries

// ---------------------------------------------------------------- page 8: the Plough
=== p8 ===
# page: 8
# panel: page
# voice: p8-open
The Plough, half past six. The whole village is in, and pretending not to listen to you.
+ [Sit down with Quaile] -> p8_quaile

=== p8_outside ===
# panel: outside
# voice: p8a-1
The blackboard by the door says Quiz cancelled, mark of respect. Under that, it says Scampi, nine pounds.
+ [Go in and sit down with Quaile] -> p8_quaile

=== p8_quaile ===
# panel: quaile
# voice: p8b-1
Quaile: Go on, then. Who did it?
# voice: p8b-2
Quaile: Foxglove's digitalis. On a hot day it stops a big man's heart, and it looks like a big man's heart on a hot day.
+ [Go through your notebook] -> p8_notes
+ [Ask her what she thinks] -> p8_hint

=== p8_hint ===
# panel: quaile
# voice: p8e-1
The landlord comes over to talk about the quiz. Quaile turns her hearing aid off and smiles at him until he goes.
{evidence() >= 3:
    # voice: p8e-good
    Quaile: I think you know, and I think you'd like me to say it. I shan't.
- else:
    {not seen_vicarage:
        # voice: p8e-vic
        Quaile: Nobody's been to look at the vicar's garden. I'd have looked at the vicar's garden.
    - else:
        {not seen_study:
            # voice: p8e-study
            Quaile: A chairman keeps notes. Nobody's read Gerald's.
        - else:
            # voice: p8e-ask
            Quaile: Gerald didn't drink that flask by himself. Somebody saw who handed it to him. Somebody always sees.
        }
    }
}
+ {visits < 4} [Go back out while there's light] -> inquiries
+ [Go through your notebook] -> p8_notes
+ [Go to the prize-giving] -> p9

=== p8_notes ===
# panel: notes
{flask:
    # voice: p8c-flask
    A church-hall flask by his chair, and he never drank from them.
}
{green:
    # voice: p8c-green
    His own green flask was at home on the draining board.
}
{poured:
    # voice: p8c-poured
    The vicar takes Gerald a cup of cordial at every show. Gerald pours it on the roses.
}
{argument:
    # voice: p8c-argument
    Gerald and the vicar, behind the produce tent at one. A notebook, a handshake, a drink.
}
{foxglove:
    # voice: p8c-foxglove
    Six foxgloves cut at the vicarage. None cut at the Pikes'.
}
{notebook:
    # voice: p8c-notebook
    Four thousand pounds short in the prize fund. Ask C.
}
{clement_study:
    # voice: p8c-study
    The vicar, alone in Gerald's study at four, looking in the drawers.
}
{rattled:
    # voice: p8c-rattled
    The vicar, holding on to his bicycle when he saw the notebook.
}
{syringe:
    # voice: p8c-syringe
    Dilys and a syringe. Water, and only in marrows.
}
{alibi:
    # voice: p8c-alibi
    Toby, on the phone in a field for fifty minutes.
}
{toby_vicar:
    # voice: p8c-toby
    Gerald said the vicar couldn't add up. Twice this week.
}
{not (flask or green or foxglove or notebook or syringe or alibi or poured or argument):
    # voice: p8c-empty
    Your notebook has the date in it, and the word chutney.
}
+ {visits < 4} [Go back out while there's light] -> inquiries
+ [Look round the bar] -> p8_bar
+ [Go to the prize-giving] -> p9

=== p8_bar ===
# panel: bar
# voice: p8d-1
At the bar, between the darts team and the vet, the straw butcher has a pint in front of it. Nobody has drunk any.
# voice: p8d-2
Quaile: Don't. It happens every year. Nobody owns up.
+ [Go to the prize-giving] -> p9

// ---------------------------------------------------------------- page 9: the prize-giving
=== p9 ===
# page: 9
# panel: page
# voice: p9-open
The village hall. The prize-giving goes ahead, because Gerald would have wanted it, says the vicar, who is giving the prizes.
+ [Listen to the vicar] -> p9_hall
+ [Stand up] -> p9_stand

=== p9_hall ===
# panel: hall
# voice: p9a-1
Clement: The Pike Cup for the heaviest marrow goes this year to Mrs Dilys Rudd.
# voice: p9a-2
Dilys does not go up. One by one, the hall turns round to look at you.
+ [Stand up] -> p9_stand

=== p9_crowd ===
# panel: crowd9
# voice: p9b-1
Margaret in the front row, very upright. Dilys with her arms folded. Toby at the back, on his phone.
+ [Stand up] -> p9_stand

=== p9_cup ===
# panel: cup
# voice: p9c-1
The vicar holds the cup with both hands. The lid rattles.
+ [Stand up] -> p9_stand

=== p9_stand ===
# panel: stand
# voice: p9d-1
Quaile: Your hall, Sergeant.
+ [Name the vicar] -> p9_clement
+ [Name Margaret Pike] -> p9_margaret
+ [Name Dilys Rudd] -> p9_dilys
+ [Name Toby Pike] -> p9_toby

=== p9_clement ===
# panel: cup
~ accused = "clement"
{notebook:
    # voice: p9e-notebook
    Sam: The prize fund was four thousand short, and Gerald wrote it down: ask C, after the marrows.
}
{argument:
    # voice: p9e-argument
    Sam: At one o'clock he showed you that notebook behind the produce tent. Then you fetched him a drink.
}
{poured:
    # voice: p9e-poured
    Sam: He never drank your cordial. He poured it on the roses. So today you stayed and watched him drink it.
}
{foxglove:
    # voice: p9e-foxglove
    Sam: Six foxgloves cut in your garden. Not slugs.
}
{clement_study:
    # voice: p9e-study
    Sam: And at four you were in his study, looking for the notebook.
}
{flask:
    # voice: p9e-flask
    Sam: He died with one of your flasks by his chair.
}
{evidence() >= 3:
    -> p9_confess
- else:
    # voice: p9e-hunch
    Clement: I was on the cake stall all afternoon. Ask anyone.
    # voice: p9e-hall
    Forty people in the hall nod. They all bought cake.
    # voice: p9e-sit
    Quaile: Sit down, Sam. Not tonight.
    ~ ending = "denied"
    -> p9_after
}

=== p9_margaret ===
# panel: crowd9
~ accused = "margaret"
# voice: p9f-margaret
Margaret: I had forty-one foxgloves this morning, Sergeant. I still have forty-one. Count them.
-> p9_quaile

=== p9_dilys ===
# panel: crowd9
~ accused = "dilys"
# voice: p9f-dilys
Dilys: I put water in marrows, love. Not in men.
-> p9_quaile

=== p9_toby ===
# panel: crowd9
~ accused = "toby"
# voice: p9f-toby
Toby: I was in a field with a man from Swindon. There's a video. It's very long.
-> p9_quaile

=== p9_quaile ===
# panel: stand
{evidence() >= 3:
    # voice: p9g-1
    Quaile: Sit down, Sam. Vicar, the prize fund is four thousand short, and your roof is not. Gerald was going to say so, after the marrows.
    ~ ending = "quaile"
    -> p9_confess
- else:
    # voice: p9g-2
    Quaile: Sit down, Sam.
    # voice: p9g-3
    The vicar clears his throat and gives Dilys Rudd the Pike Cup. Nobody claps.
    ~ ending = "none"
    -> p9_after
}

=== p9_confess ===
# panel: cup
{ending == "":
    ~ ending = "solved"
}
# voice: p9h-1
Clement: He was going to stand up here and say it. In front of everyone. In front of the roof.
# voice: p9h-2
Clement: I only wanted him to be ill. For the afternoon.
# voice: p9h-3
Quaile: The roof will still leak, Vicar.
-> p9_after

=== p9_after ===
+ [Go out into the evening] -> p10

// ---------------------------------------------------------------- page 10: Sunday
=== p10 ===
# page: 10
# panel: page
# voice: p10-open
Sunday. The marquee is coming down, and the marrows have gone to the pig farm.
+ [Say goodbye to Margaret] -> p10_margaret
+ [Walk to the car] -> p10_car

=== p10_field ===
# panel: field10
# voice: p10a-1
Men in shorts are folding the marquee. The Pike Cup is in a box marked Village Hall, Do Not Remove.
+ [Say goodbye to Margaret] -> p10_margaret

=== p10_margaret ===
# panel: margaret10
# voice: p10b-1
Margaret has cut one foxglove, and is putting it in a vase on the kitchen table.
{ending == "solved" or ending == "quaile":
    # voice: p10b-2
    Margaret: Thank you, Sergeant. You were very thorough. They look nice indoors, as long as nobody drinks the water.
- else:
    # voice: p10b-3
    Margaret: The vicar called this morning, to see how I was. I didn't offer him anything.
}
+ [Walk to the car] -> p10_car

=== p10_car ===
# panel: car
# voice: p10c-1
Quaile has taken her hearing aid out. It is on the dashboard.
{ending:
- "solved":
    # voice: p10c-2
    Quaile: You did well, Sam. For nineteen days.
- "quaile":
    # voice: p10c-5
    Quaile: Next time, look at the vicar first. In my experience it's the vicar a surprising amount of the time.
- "denied":
    # voice: p10c-6
    Quaile: We'll have him on the prize fund by Friday. The foxgloves will take longer.
- else:
    # voice: p10c-7
    Quaile: Well. Nobody's dead who wasn't dead yesterday.
}
# voice: p10c-3
Sam: Twenty.
# voice: p10c-4
Quaile: Hm? Other side, Sam. That one's off.
+ [Drive past the scarecrows] -> p10_scarecrows

=== p10_scarecrows ===
# panel: scarecrows10
{ending == "solved" or ending == "quaile":
    # voice: p10d-1
    The scarecrows are still along the hedge. The straw vicar has gone.
- else:
    # voice: p10d-5
    The scarecrows are still along the hedge. The straw vicar has moved to the end of the row.
}
# voice: p10d-2
At the end of the row is a new one: a navy mac, a loose tie, brown city shoes, a small black notebook. Its card says Our Village, D S Adeyemi.
# voice: p10d-3
Quaile: Twenty days, and they've made you already. That's quick.
{ending == "solved" or ending == "quaile":
    # voice: p10d-4
    Nobody entered it.
- else:
    # voice: p10d-6
    Nobody entered it. The card on the straw vicar beside it says Best in Show.
}
-> credits

=== credits ===
{ending:
- "solved": You solved the Marrow Show.
- "quaile": Quaile solved the Marrow Show. You named the wrong person first.
- "denied": You named the right man, without enough to hold him.
- else: Nobody was charged. The vicar gave out the prizes.
}
Places you went: {seen_margaret: Margaret's garden, }{seen_tent: the marrow tent, }{seen_carpark: the car park, }{seen_vicarage: the vicarage, }{seen_study: Gerald's study, }and the pub.
Evidence against the vicar: {evidence()} of 7.
+ [Begin again] -> restart

=== restart ===
# restart
-> END
