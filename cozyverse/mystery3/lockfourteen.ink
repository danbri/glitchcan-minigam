// Lock Fourteen: a death on the Wyke Arm. Gate 2: the text-only playable draft. No pictures, sounds or voices yet.
// CASE.md is the truth this is built on; VOICES.md is how each person speaks. The tags follow the Steeple Wyke host
// (photo-novel skill): "# page: N" turns the page, "# panel: X" moves the view, a tap on a panel diverts to its knot.
// Ros has Friday, Saturday and Sunday, two visits a day. The hub is page 8, her car and her case board: thinking
// there is free. Page 10 is Monday: the report in three parts, then Quaile.
// A tap can reach any panel of the page in view, so every panel knot starts with a guard on "at" (the page Ros is
// visiting); a panel of a page she has left sends her back to the board.
VAR day = 1
VAR visits = 0
VAR at = 1
// what Ros has seen
VAR logic = false
VAR fifteen = false
VAR windlass = false
VAR keys = false
VAR photos = false
VAR cloud = false
VAR pub = false
VAR pm = false
VAR pm2_asked = false
VAR pm2_told = false
VAR pm2 = false
VAR plate = false
VAR grease = false
VAR box = false
VAR ticket = false
VAR clive_windlass = false
VAR clive_key = false
// statements broken
VAR joost_broke = false
VAR kit_broke = false
VAR clive1_broke = false
VAR clive2_broke = false
VAR annette_cold = 0
// the case board
VAR c_filled = false
VAR c_alive = false
VAR c_chain = false
// the report
VAR r_conclusion = ""
VAR r_how = ""
VAR r_whom = ""
VAR chain_answer = false
VAR ending = ""
// the village remembers (Steeple Wyke's key)
VAR rel_quaile = 0
VAR was_quaile = 0

-> p1

=== function day_name() ===
{day:
- 1: ~ return "Friday"
- 2: ~ return "Saturday"
- 3: ~ return "Sunday"
- else: ~ return "Monday"
}

=== function evidence() ===
~ temp n = 0
{c_filled:
    ~ n += 1
}
{c_alive:
    ~ n += 1
}
{c_chain:
    ~ n += 1
}
~ return n

// ---------------------------------------------------------------- page 1: lock 14, Friday morning
=== p1 ===
# page: 1
# panel: page
{at != 1: -> hub}
{p1 == 1:
    Lock fourteen of the Wyke Arm. Friday, nine in the morning.
    You are Ros Kettering, coroner's officer for the county. A sudden death comes to you before it goes to the coroner. You retire in March.
    The police tape runs from a balance beam to a fence post. The body went to the mortuary an hour ago. Neville Strand, sixty-six, chairman of the canal trust. Found at ten past seven by the crew of a hire boat.
    The lock is full to the top of the gates. Below thirteen you can see the hire boat that came down the flight last night, moored.
    A man in a trust fleece waits by the top gate with two coffees.
- else:
    Lock fourteen. Full.
}
+ {p1_clive == 0} [Take the coffee] -> p1_clive
+ {p1_fifteen == 0} [Walk up to lock fifteen] -> p1_fifteen
+ {p1_bag == 0} [Look at the bag by the top gate] -> p1_bag
+ {p1_clive > 0} [Go to your car] -> leave

=== p1_clive ===
# panel: clive
{at != 1: -> hub}
{p1_clive > 1:
    Clive: Anything else I can tell you, Mrs Kettering?
    -> p1_clive_choices
}
Clive: Mrs Kettering? Clive Amory. I'm the trust's treasurer. Kit's away, so I said I'd meet you. White, no sugar. I guessed.
Ros: Thank you. You knew him well.
Clive: Fourteen years on the committee with the chairman.
He has a windlass in his fleece pocket, and he holds the coffee with both hands.
+ [Ask him how a lock works] -> p1_logic
+ [Tell him you know how locks work] -> p1_statement

= p1_logic
~ logic = true
Clive: A lock is a box of water with a pair of gates at each end. To take a boat up, you bring it into the box while it's empty, shut the bottom gates and wind up the top paddles. The water comes in from the canal above.
Clive: To go down, you do it the other way round. So a boat that goes down leaves the lock empty, and a boat that goes up leaves it full.
Ros: And the water for it?
Clive: From the pound, the stretch of canal between this lock and the next one up. A lock this size holds about sixty tonnes. When it fills, the pound drops.
Clive: At night we chain the paddle gear, to save water. The chairman did it on his walk. Every night at ten.
-> p1_statement

= p1_statement
Ros: When did you last speak to the deceased?
Clive: He rang me at five to eleven last night, about the minutes of our meeting. I told him to ring me in the morning, and I went to bed.
His car is in the lock car park: a green estate with a trust sticker in the back window.
-> p1_clive_choices

= p1_clive_choices
+ {p1_fifteen == 0} [Walk up to lock fifteen] -> p1_fifteen
+ {p1_bag == 0} [Look at the bag by the top gate] -> p1_bag
+ [Go to your car] -> leave

=== p1_fifteen ===
# panel: fifteen
{at != 1: -> hub}
~ fifteen = true
Two hundred metres up the towpath, lock fifteen is empty. Both pairs of gates are shut.
Between the two locks the canal is low. A strip of wet brick, a foot high, runs along the bank above the water. The trust's work boat sits on the mud at an angle, its mooring ropes tight.
+ {p1_clive == 0} [Go back to the man with the coffees] -> p1_clive
+ {p1_bag == 0} [Look at the bag by the top gate] -> p1_bag
+ {p1_clive > 0} [Go to your car] -> leave

=== p1_bag ===
# panel: bag
{at != 1: -> hub}
~ windlass = true
A police exhibit bag lies on the lockside. In it is a windlass: an iron handle, bent in an L, for winding paddles. A plastic tag on it says WREN, with the name of a hire company in Banbury.
A constable lifts the tape for you.
Constable: It was by the top gate, ma'am. It's off the hire boat. Dutch couple. They came down through the locks last night and found him this morning.
+ {p1_clive == 0} [Go back to the man with the coffees] -> p1_clive
+ {p1_fifteen == 0} [Walk up to lock fifteen] -> p1_fifteen
+ {p1_clive > 0} [Go to your car] -> leave

=== leave ===
~ at = 8
-> hub

// ---------------------------------------------------------------- page 8: Ros's car and the case board (the hub)
=== p8 ===
-> hub

=== hub ===
# page: 8
# panel: page
~ at = 8
{day == 4: -> p10_ready}
{visits >= 2: -> evening}
{day == 1 && visits == 0:
    Your car, in the lock car park. You open a notebook on the steering wheel. Friday, Saturday, Sunday: two calls a day, if you want to do them properly. The coroner wants your report at nine on Monday.
    Kit Rowe, the lock-keeper, is away until Saturday. Dr Shah does the post-mortem tomorrow morning.
- else:
    {day_name()}. {visits == 0: Two visits today.|One more visit today.}
}
{day == 2 && pm && not pm2_asked:
    The body is released tomorrow at noon, unless the coroner orders more.
}
+ [Walk up the flight to the lock cottage] -> go(2)
+ [Go down to the hire boat] -> go(3)
+ [Call on Annette Strand] -> go(4)
+ [Go to the Navigation Inn] -> go(5)
+ {day > 1} [Go to the coroner's office] -> go(6)
+ [Look at the top gate of lock fourteen] -> go(7)
+ [Call on Clive Amory at home] -> go(9)
+ {day == 2 && pm && not pm2_asked} [Phone the coroner: ask for a second post-mortem] -> call_coroner
+ [Think at the case board] -> board
+ [Read your notebook] -> notes

=== go(n) ===
~ visits += 1
~ at = n
{n:
- 2: -> p2
- 3: -> p3
- 4: -> p4
- 5: -> p5
- 6: -> p6
- 7: -> p7
- else: -> p9
}

=== p8_board ===
# panel: board
{at != 8: -> hub}
-> board

=== p8_notes ===
# panel: notes
{at != 8: -> hub}
-> notes

=== call_coroner ===
~ pm2_asked = true
You phone the coroner at home. He is in his garden; you can hear a mower stop.
Ros: The deceased drowned. He has a bruise on the head that Dr Shah can't measure yet.
Ros: If he was knocked out, it's an accident. If he was awake, someone has to explain the water.
Ros: I'd like a forensic post-mortem. Before the body is released.
Coroner: The funeral's booked for Wednesday, Ros.
Ros: I know.
Coroner: All right. Dr Shah can do it tomorrow morning. Someone had better tell Mrs Strand before the undertaker does.
-> hub

=== notes ===
Your notebook.
Lock fourteen was full at dawn. The hire boat came down the flight last night.
{fifteen: Lock fifteen, above it, was empty. The pound between them was a foot low, and the work boat aground.}
{logic: A boat going down leaves a lock empty; going up leaves it full. Filling a lock drains the pound above it.}
{windlass: A hire-boat windlass, tagged WREN, by the top gate of fourteen.}
{p1_clive: Clive Amory says Neville rang him at 22:55, and he went to bed.}
{keys: There are three chain keys, for Strand, Amory and Rowe. In Neville's coat were his own key and Kit Rowe's.}
{p2_minutes: In Thursday's minutes Neville proposed ending Kit Rowe's post, and said he would "bring something about the gates" to the next meeting.}
{photos: Maaike van Dam's photographs at 22:38 and 22:41 show lock fourteen empty, Neville alive on the lockside.}
{joost_broke: Joost says Neville took his windlass at fourteen; it fell, and they left it. They walked to the pub, and came back at a quarter to twelve. A car stood in the lock car park with its lights off.}
{pub: Pete Garrow had the van Dams in the pub from 23:05 to 23:40. At 23:40 Clive Amory's green estate was in the lock car park, with someone in it.}
{cloud: Neville's photographs, uploaded at 23:13, show the gate plate, HOLLINS 1987, two plugged bolt holes, and the plate again with the chained paddle post behind it.}
{box: Neville's box file shows £180,000 of grant paid for new oak gates, signed off by Clive Amory. Two years ago Clive moved the trust's £150,000 reserve into the Meridian Income Fund, which closed. In June £150,000 came back as an "anonymous donation".}
{pm: The post-mortem says drowning. Left thigh broken. A bruise on the back of the head. Low alcohol.}
{pm2_asked && not pm2: A second post-mortem is ordered.}
{pm2: The second post-mortem finds no skull injury; he was awake. Torn nails with brick in them. A man awake can sit up in half a metre of water. He drowned because the water got deeper.}
{plate: The top gate of fourteen has HOLLINS 1987 under the new paint, and plugged bolt holes from another lock.}
{grease: The paddle gear of fourteen has new grease on its spindle and its chain.}
{ticket: Kit Rowe was in Bristol on Thursday night, for an interview at Cumberland Basin. She gave Neville her key.}
{clive_windlass: Clive's windlass, in his car boot, has new grease on it.}
{clive_key: Clive still has his chain key, on his car keys.}
{clive1_broke: Clive now says he went down to the lock, found nobody and came home.}
{evidence() > 0: On the board.}
{c_filled: Someone filled lock fourteen by hand after the last boat.}
{c_alive: Neville was alive in the water when the lock was filled.{pm2: He was awake.}}
{c_chain: Whoever filled the lock unlocked the chain after 23:13 with the third key, Clive Amory's.}
{day == 4: -> p10_ready}
+ [Close the notebook] -> hub

// ---------------------------------------------------------------- the case board: join two facts
=== board ===
{day == 4:
    Your board, one last time.
- else:
    Your board: index cards and a roll of tape on the back seat.
}
-> board_choices
= board_choices
+ {fifteen && not c_filled} [Lock fourteen full, lock fifteen empty. Join it with...] -> q_filled
+ {pm && c_filled && not c_alive} [He drowned, with a broken leg. Join it with...] -> q_alive
+ {cloud && not c_chain} [The chained post behind the plate at 23:13. Join it with...] -> q_chain
+ [Leave the board] -> board_done

=== board_done ===
{day == 4: -> p10_ready}
-> hub

=== q_filled ===
+ {logic} [How a lock works] -> right
+ {windlass} [The hire-boat windlass] -> wrong
+ {photos} [Maaike's photographs at 22:41] -> wrong
+ [Not yet] -> board.board_choices
= right
~ c_filled = true
The hire boat came down the flight last night, through fifteen and fourteen, and left both empty. A boat coming up would have filled fourteen and then had to fill fifteen. Fifteen is still empty. So nobody came up. Someone wound the paddles on fourteen by hand, and the water came out of the pound.
New card: someone filled lock fourteen after the last boat.
-> board.board_choices
= wrong
It does not join.
-> board.board_choices

=== q_alive ===
+ [Someone filled lock fourteen after the last boat] -> right
+ {windlass} [The hire-boat windlass] -> wrong
+ {pub} [Clive's car at 23:40] -> wrong
+ [Not yet] -> board.board_choices
= right
~ c_alive = true
He fell into an empty lock and broke his leg. He breathed water in, so he was alive in it. Someone filled the lock.
{pm2:
    Dr Shah's second report: he was awake, and he could have sat up in the water at the bottom. He drowned because someone made it deeper.
    New card: Neville was alive and awake in the water when the lock was filled.
- else:
    If he was knocked out, he could have drowned in the water at the bottom of an empty lock. If he was awake, he drowned because someone filled it. Only a second post-mortem can say which.
    New card: Neville was alive in the water when the lock was filled.
}
-> board.board_choices
= wrong
It does not join.
-> board.board_choices

=== q_chain ===
+ {keys} [Two keys in Neville's coat, his own and Kit's] -> right
+ {grease} [New grease on the chain of fourteen] -> wrong
+ {clive_windlass} [The grease on Clive's windlass] -> wrong
+ [Not yet] -> board.board_choices
= right
~ c_chain = true
At 23:13 the paddle gear on fourteen was chained. To fill the lock, someone had to unlock it after that. A padlock snaps shut without a key, so the chain on it at dawn proves nothing. The unlocking does. There are three keys. Two were in Neville's pocket, in the water.
New card: whoever filled the lock had the third key, Clive Amory's.
-> board.board_choices
= wrong
It does not join.
-> board.board_choices

// ---------------------------------------------------------------- evenings
=== evening ===
# page: 8
# panel: page
~ at = 8
{evening_line()}
{day == 3 && pm2_asked && not pm2:
    ~ pm2 = true
    At eight the phone rings. Dr Shah, from a station platform.
    Shah: Second post-mortem. The bruise on the head is slight. No fracture, no bleeding inside the skull. He was conscious.
    Shah: The nails on both hands are torn, with brick in them. He tried to climb the chamber wall. The broken thigh bled into the muscle for some minutes before he died.
    Shah: Plainly: a conscious man with a broken leg can sit up in half a metre of water. He drowned because the water got deeper.
}
+ [Look at the board before bed] -> board_evening
+ [Go to bed] -> next_day

=== function evening_line() ===
{day:
- 1: Friday ends. You eat toast standing up.
- 2: Saturday ends. The cat sits on your index cards.
- 3: Sunday ends.
}

=== board_evening ===
-> board

=== next_day ===
~ day += 1
~ visits = 0
{day == 4: -> p10}
-> hub

// ---------------------------------------------------------------- page 2: the flight and the lock cottage
=== p2 ===
# page: 2
# panel: page
{at != 2: -> hub}
{p2 == 1:
    The towpath climbs beside the flight. Sixteen, fifteen and fourteen have their paddle gear chained, each post wrapped in a chain with a brass padlock. Thirteen, below the cottage, is not.
    The lock cottage is the trust's office, with a flat upstairs for the lock-keeper.
- else:
    The lock cottage.
}
+ {p2_coat == 0} [Sign for Neville's coat] -> p2_coat
+ {p2_minutes == 0} [Read the minutes book on the table] -> p2_minutes
+ [Knock at the flat upstairs] -> p2_kit
+ [Leave] -> hub

=== p2_coat ===
# panel: coat
{at != 2: -> hub}
~ keys = true
The police have left Neville's coat on a hook, in a clear bag, with a form for you to sign. Wallet. A torch, switched off. A phone, dead from the water. A ring with two small brass keys: one with N.S. scratched on the bow, one with a paper label in round handwriting, K.R.
Above the hook, on the wall, a typed list: Chain keys. N. Strand. C. Amory. K. Rowe.
+ {p2_minutes == 0} [Read the minutes book on the table] -> p2_minutes
+ [Knock at the flat upstairs] -> p2_kit
+ [Leave] -> hub

=== p2_minutes ===
# panel: minutes
{at != 2: -> hub}
The minutes of Thursday's committee, in the same round handwriting.
Item four. The chairman proposed that the paid lock-keeper post end in March. To be discussed in November.
Item seven, any other business. The chairman will bring something about the gates to the next meeting.
Under it, in pencil, a drawing of a gate with a face.
+ {p2_coat == 0} [Sign for Neville's coat] -> p2_coat
+ [Knock at the flat upstairs] -> p2_kit
+ [Leave] -> hub

=== p2_kit ===
# panel: kit
{at != 2: -> hub}
{day == 1: -> p2_kit_away}
{p2_kit_met:
    Kit: What now?
    -> p2_kit_choices
}
-> p2_kit_met

= p2_kit_away
A card is pinned to the door of the flat: AWAY TILL SAT. Kit.
+ {p2_coat == 0} [Sign for Neville's coat] -> p2_coat
+ {p2_minutes == 0} [Read the minutes book on the table] -> p2_minutes
+ [Leave] -> hub

= p2_kit_met
Kit Rowe is twenty-four, in a lock-keeper's fleece with the sleeves pushed up. She has a mug in one hand and a windlass hooked in her belt.
Ros: Ros Kettering, coroner's officer. I'm sorry about Mr Strand.
Kit: Yeah.
Ros: Were you here on Thursday night?
Kit: I was here all night. Upstairs. I heard nothing. I sleep with the window shut.
-> p2_kit_choices

= p2_kit_choices
+ {not logic} [Ask her how a lock works] -> p2_kit_logic
+ [Ask her about Neville] -> p2_kit_neville
+ {not kit_broke} [Show her something] -> p2_kit_show
+ [Leave] -> hub

= p2_kit_logic
~ logic = true
Kit: Down leaves it empty, up leaves it full. You fill it from the pound above. Fifteen's slow; the bottom paddles stick.
-> p2_kit_choices

= p2_kit_neville
Kit: He walked the flight every night at ten and wrote down the levels. He knew every lock on the Arm by its sound.
Kit: He's why I can do this job.
-> p2_kit_choices

= p2_kit_show
+ {keys} [The key labelled K.R., from his coat] -> p2_kit_broke
+ {p2_minutes} [The minutes: ending her post] -> p2_kit_wrong
+ {windlass} [The hire-boat windlass] -> p2_kit_wrong
+ [Put it away] -> p2_kit_choices

= p2_kit_wrong
Kit: {&What's that got to do with me?|I don't know anything about that.}
-> p2_kit_choices

= p2_kit_broke
~ kit_broke = true
~ ticket = true
She turns the label over. On the back, in the same hand: spare.
Kit: I gave him that at twenty to eight. I had a train.
Kit: I was in Bristol. Interview at nine on Friday, at Cumberland Basin. Lock-keeper for the Harbour, on the big locks to the river. Neville knew. He said he wouldn't tell the committee.
She fetches a train ticket and a letter from the flat: the 19:52 from Kemble on Thursday, and an interview at nine, Friday, signed by the Harbour Master's office.
Kit: Don't tell Clive. Please. If they know I'm going they'll end the post before I've got the other one.
-> p2_kit_choices

// ---------------------------------------------------------------- page 3: the hire boat
=== p3 ===
# page: 3
# panel: page
{at != 3: -> hub}
{p3 == 1:
    Wren is moored on the lock landing below thirteen, next to a sign that says NO MOORING. A green hire boat, fifty feet long, with geraniums in a tin on the roof. The police have asked the van Dams to stay until Monday.
- else:
    Wren, below thirteen.
}
+ [Talk to the man on the roof] -> p3_joost
+ [Knock at the side hatch] -> p3_maaike
+ [Leave] -> hub

=== p3_joost ===
# panel: joost
{at != 3: -> hub}
{p3_joost_met:
    Joost: Yes?
    -> p3_joost_choices
}
-> p3_joost_met

= p3_joost_met
Joost van Dam is coiling a rope on the roof. He coils it twice.
Joost: You are from the police?
Ros: From the coroner. I find out how people died.
Joost: We did not see him after lock fifteen. He shouted at us there, about a paddle. Then we went on, and we did not see him again.
-> p3_joost_choices

= p3_joost_choices
+ {not joost_broke} [Show him something] -> p3_joost_show
+ [Leave] -> hub

= p3_joost_show
+ {photos} [Maaike's photograph at 22:41] -> p3_joost_broke
+ {windlass} [His windlass, in the police bag] -> p3_joost_wrong
+ {keys} [The chain keys] -> p3_joost_wrong
+ [Put it away] -> p3_joost_choices

= p3_joost_wrong
Joost: {&I do not know about this.|This is not ours.}
-> p3_joost_choices

= p3_joost_broke
~ joost_broke = true
He looks at the man with the torch on his wife's phone.
Joost: Yes. At fourteen also. He stood there and told us how to do it. Then he took my windlass, to show me. I took it back from him, and it fell on the stones. In the dark I could not find it.
Joost: We were afraid it looks like a fight. It was not a fight. He was a man who wants to show you.
Joost: Then we moored here. I know, it is not allowed. We walked down to the pub, and came back at a quarter to twelve. In the car park by the cottage there was a car, with the lights off. Maaike said, lovers.
-> p3_joost_choices

=== p3_maaike ===
# panel: maaike
{at != 3: -> hub}
{p3_maaike > 1:
    Maaike: You can have all of them. I will send them.
    -> p3_maaike_choices
}
~ photos = true
Maaike van Dam opens the hatch before you knock. She has her phone ready.
Maaike: You want these. I took them for my sister, because the locks are so old.
Two photographs, by headlamp. 22:38: lock fourteen, nearly empty, the hire boat low in the chamber. 22:41: the lock empty, the boat leaving through the open bottom gates, and on the lockside above, a man in a dark coat with a torch, pointing.
Maaike: That is him, with the torch. Joost, tell her about the windlass.
Joost, on the roof, does not answer.
-> p3_maaike_choices

= p3_maaike_choices
+ [Talk to the man on the roof] -> p3_joost
+ [Leave] -> hub

// ---------------------------------------------------------------- page 4: Annette Strand
=== p4 ===
# page: 4
# panel: page
{at != 4: -> hub}
{p4 == 1:
    The Strands' house is on Mill Lane in Steeple Wyke: a stone semi with a rain gauge on a post in the front garden.
- else:
    Mill Lane.
}
+ [Talk to Annette] -> p4_annette
+ [Look at the notebook on the hall table] -> p4_notebook
+ [Leave] -> hub

=== p4_annette ===
# panel: annette
{at != 4: -> hub}
{p4_annette > 1:
    Annette: Yes?
    -> p4_choices
}
Annette Strand is sixty-four, in a cardigan buttoned to the top. She has made tea and not drunk it.
{pm2_asked && not pm2_told && day == 2: -> p4_first}
{pm2_asked && not pm2_told: -> p4_undertaker}
Annette: You'll want to know about Thursday.
-> p4_choices

= p4_first
Before the undertaker can ring her, you tell her yourself.
Ros: I've asked the coroner for a second post-mortem. The funeral will have to move.
-> p4_why

= p4_undertaker
~ annette_cold = day
~ pm2_told = true
Annette: The undertaker rang. He says there's to be another post-mortem, and the funeral can't be Wednesday. Nobody from your office rang me.
+ [Tell her why] -> p4_why
+ [Say you are sorry] -> p4_sorry

= p4_why
~ pm2_told = true
~ annette_cold = 0
Ros: The first post-mortem can't tell if he was awake in the water. The second one can. If he was awake, I need to know how the lock came to be full.
Annette: Then do it properly.
-> p4_choices

= p4_sorry
Ros: I'm sorry. Someone should have told you first.
Annette: Yes. They should.
-> p4_choices

= p4_choices
+ {p4_thursday == 0} [Ask about Thursday evening] -> p4_thursday
+ {not cloud} [Ask to see the photographs on his phone account] -> p4_cloud
+ {not box} [Ask about the gates] -> p4_gates
+ [Leave] -> hub

= p4_thursday
Annette: He came back from the Navigation at nine. One pint; he always had one. He went out again at ten to ten with the torch.
Annette: The phone bill's online. I looked last night, because I couldn't sleep. He rang Clive at five to eleven. Two minutes. After that, nothing.
-> p4_choices

= p4_cloud
{annette_cold == day:
    Annette: No. Not today.
    -> p4_choices
}
~ cloud = true
She opens a laptop on the kitchen table. Neville's phone sent its photographs to his account as he took them. The last three came in at 23:13.
The first: a cast iron plate on the beam of a lock gate. The new black paint has been scraped off round it. HOLLINS 1987.
The second: two round wooden plugs in the gate timber, painted over, where bolts had been.
The third: the plate again, from further back, in the torchlight. Behind it, the paddle post of lock fourteen, with its chain on.
Annette: That's fourteen. He was looking at the gates.
-> p4_choices

= p4_gates
~ box = true
Annette: He kept every receipt. He'd been up in the study every night since the summer.
In the study, a box file marked GATES.
A letter from the heritage grant office in Bristol: £180,000 paid in April for two pairs of new oak gates, locks thirteen and fourteen, maker Hollins and Daughter. The work signed off as complete by C. Amory, treasurer. Pinned to it, in Neville's pencil: Rang Bristol Wed. for maker's certificate. They have none.
Under it, a statement for the trust's reserve account, with two lines ringed. Two years ago: £150,000 out, to the Meridian Income Fund, authorised C. Amory. This June: £150,000 in, "anonymous donation". In the margin: Meridian closed March 2025.
-> p4_choices

=== p4_notebook ===
# panel: notebook
{at != 4: -> hub}
On the hall table is a small notebook with a pencil in the spine. Annette sees you looking.
Annette: The water levels. Every lock, every night, for eleven years.
The pages are columns of numbers in pencil. The last entry is Thursday. Lock fifteen. Then the page is blank.
+ [Talk to Annette] -> p4_annette
+ [Leave] -> hub

// ---------------------------------------------------------------- page 5: the Navigation Inn
=== p5 ===
# page: 5
# panel: page
{at != 5: -> hub}
{p5 == 1:
    The Navigation Inn, by lock eleven: low beams, a fire, a darts board, a lane up to the lock car park.
- else:
    The Navigation.
}
+ [Talk to the landlord] -> p5_pete
+ [Leave] -> hub

=== p5_pete ===
# panel: pete
{at != 5: -> hub}
{p5_pete == 1:
    Pete Garrow is behind the bar, drying glasses.
}
+ {p5_neville == 0} [Ask about Neville on Thursday] -> p5_neville
+ {p5_dutch == 0} [Ask about the Dutch couple] -> p5_dutch
+ {p5_closing == 0} [Ask what he saw at closing] -> p5_closing
+ [Leave] -> hub

= p5_neville
Pete: One pint of Hook Norton, half eight, same as every Thursday. Gone by nine.
-> p5_pete

= p5_dutch
Pete: Came in at five past eleven. Two halves of cider and two packets of crisps. Left at twenty to twelve. She paid.
-> p5_pete

= p5_closing
~ pub = true
Pete: Put the bins out at twenty to twelve. Clive Amory's car was up in the lock car park. Green estate, trust sticker. He leaves it here on quiz nights. Engine off, lights off.
Pete: Somebody in it. I didn't look.
-> p5_pete

// ---------------------------------------------------------------- page 6: the coroner's office
=== p6 ===
# page: 6
# panel: page
{at != 6: -> hub}
{p6 == 1:
    The coroner's office in Cirencester, above a solicitor's. Your desk, your kettle, a window on the car park.
- else:
    The office.
}
+ [Take the call from Dr Shah] -> p6_shah
+ {day == 2} [Talk to Sam Adeyemi] -> p6_sam
+ [Leave] -> hub

=== p6_shah ===
# panel: phone
{at != 6: -> hub}
~ pm = true
{p6_shah > 1:
    Shah: That's all I have{pm2_asked: until I've written up the second one|}.
    -> p6_shah_choices
}
{day == 3 && pm2_asked:
    Dr Shah rings from the mortuary.
    Shah: I've done the second one this morning. I'll ring you tonight, when it's written up.
    -> p6_shah_choices
}
Dr Imogen Shah rings on the dot of ten. You can hear a station announcer.
Shah: Neville Strand. Drowning: water in the lungs and airways, froth. In plain words, he breathed water in, so he was alive in it.
Shah: Left thigh broken, from a fall onto an edge. A bruise on the back of the head. I can't tell you yet how hard he hit it. Blood alcohol low. About one pint.
{day == 2: Shah: The coroner releases the body tomorrow at noon, unless he orders more.}
-> p6_shah_choices

= p6_shah_choices
+ [Ask if he could drown in an empty lock] -> p6_shah_empty
+ [Ask what a second post-mortem would show] -> p6_shah_second
+ [Thank her] -> p6

= p6_shah_empty
Shah: There's always some water at the bottom of an empty lock, isn't there? Half a metre is enough if you're unconscious. I can't tell you how deep it was.
-> p6_shah_choices

= p6_shah_second
Shah: A forensic one. The brain, for the head injury. The hands, the nails. Bruising under the skin. It would tell you whether he was awake.
{
- pm2_asked: Shah: The coroner's ordered it. I'll ring you when it's done.
- day == 2: Shah: The coroner has to order it. The body's released tomorrow at noon.
- else: Shah: The coroner would have had to order it. The body was released at noon.
}
-> p6_shah_choices

=== p6_sam ===
# panel: sam
{at != 6: -> hub}
{day != 2: -> p6}
{p6_sam > 1:
    Sam: You're still here, then.
    -> p6_sam_end
}
DS Sam Adeyemi is at the door with a box of pastries from the station.
Sam: The DCI said you'd be in. I'm to tell you there's no crime on our side. A man of sixty-six on a towpath in the dark. I'm sorry.
Ros: Do you think there's no crime?
Sam: I think he fell. I'd tell you if I thought he didn't.
He leaves you the pastries.
-> p6_sam_end

= p6_sam_end
+ [Leave] -> hub

// ---------------------------------------------------------------- page 7: the top gate of lock fourteen
=== p7 ===
# page: 7
# panel: page
{at != 7: -> hub}
{p7 == 1:
    The top gate of lock fourteen. The police tape is gone. The new black paint on the balance beam shines.
- else:
    The top gate of fourteen.
}
+ {p7_plate == 0} [Look at the end of the gate beam] -> p7_plate
+ {p7_post == 0} [Look at the paddle post] -> p7_post
+ {p7_pound == 0} [Look up the pound to fifteen] -> p7_pound
+ [Leave] -> hub

=== p7_plate ===
# panel: plate
{at != 7: -> hub}
~ plate = true
At the end of the beam the paint has been scraped back with a blade, in a rough square. Under it is a cast iron plate: HOLLINS 1987.
Lower down, two round wooden plugs in the timber, painted over, where bolts went through once. There is no ironwork that fits them on this lock.
+ {p7_post == 0} [Look at the paddle post] -> p7_post
+ {p7_pound == 0} [Look up the pound to fifteen] -> p7_pound
+ [Leave] -> hub

=== p7_post ===
# panel: post
{at != 7: -> hub}
~ grease = true
The paddle post has its chain on, and a brass padlock. The square spindle where a windlass fits is bright with new grease. A smear of the same grease is on the chain, at the height of a hand.
+ {p7_plate == 0} [Look at the end of the gate beam] -> p7_plate
+ {p7_pound == 0} [Look up the pound to fifteen] -> p7_pound
+ [Leave] -> hub

=== p7_pound ===
# panel: pound
{at != 7: -> hub}
~ fifteen = true
{day == 1:
    The pound to fifteen is still a foot down. The work boat sits on the mud. Fifteen is empty.
- else:
    The pound to fifteen has come back up from the overflow weir at fifteen, and the work boat floats again. Fifteen is still empty, its gates shut and chained.
}
+ {p7_plate == 0} [Look at the end of the gate beam] -> p7_plate
+ {p7_post == 0} [Look at the paddle post] -> p7_post
+ [Leave] -> hub

// ---------------------------------------------------------------- page 9: Clive Amory at home
=== p9 ===
# page: 9
# panel: page
{at != 9: -> hub}
{p9 == 1:
    Clive Amory lives in the last house on Wyke Hill, with a view of the whole flight. The green estate is on the drive.
- else:
    Wyke Hill.
}
+ [Talk to Clive] -> p9_clive
+ {not clive_windlass} [Ask to see the windlass in his car] -> p9_car
+ [Leave] -> hub

=== p9_clive ===
# panel: clive
{at != 9: -> hub}
{p9_clive > 1:
    Clive: More questions? Of course.
    -> p9_choices
}
Clive opens the door in a cardigan, with his reading glasses pushed up.
Clive: Mrs Kettering. Come in. I've put the trust's accounts out for you; I thought you'd want them. They're in order.
They are. Every column adds up. The reserve account is shown at £150,000 in each of the last three years.
{not clive1_broke:
    Clive: As I said, the chairman rang me at five to eleven, and I told him to ring me in the morning. Then I went to bed.
}
-> p9_choices

= p9_choices
+ {not clive2_broke} [Show him something] -> p9_show
+ [Ask about the gates] -> p9_gates
+ {not clive_key} [Ask if he still has his chain key] -> p9_key
+ [Leave] -> hub

= p9_key
~ clive_key = true
He takes his car keys from his pocket. With them is a small brass key with C.A. scratched on the bow.
Clive: Always. The chairman was very particular about the keys.
-> p9_choices

= p9_gates
Clive: Hollins and Daughter. Ted Hollins is a craftsman; I was at school with him. Oak, from a French forest, seasoned four years. I can show you the invoice. It's in the file.
-> p9_choices

= p9_show
+ {pub && not clive1_broke} [Pete Garrow saw your car in the lock car park at 23:40] -> p9_broke1
+ {cloud && clive1_broke} [Neville's photographs at 23:13] -> p9_broke2
+ {photos} [Maaike's photographs at 22:41] -> p9_wrong
+ {windlass} [The hire-boat windlass] -> p9_wrong
+ {plate} [HOLLINS 1987 on the top gate] -> p9_wrong
+ [Put it away] -> p9_choices

= p9_wrong
Clive: {&I'm not sure what you want me to say about that, Mrs Kettering; it's a very sad business, and I've told you all I know.|I don't see how that bears on the chairman's death, though I'm sure you have a reason for asking.}
-> p9_choices

= p9_broke1
~ clive1_broke = true
Clive takes his glasses off.
Clive: Yes. I went down, after all. I was worried about him; he'd sounded upset. I drove to the car park and walked to fourteen, and he wasn't there. I sat in the car for a while, in case he came back. Then I came home.
Clive: I didn't say so, because it sounds as if I left him there.
-> p9_choices

= p9_broke2
~ clive2_broke = true
He puts his glasses back on and goes through the three photographs twice: the plate, the plugs, the post with its chain.
Clive: The chairman was very thorough.
Clive: I think I'd like to stop now, Mrs Kettering. Will you see yourself out?
+ {not clive_windlass} [Ask to see the windlass in his car] -> p9_car
+ [Leave] -> hub

=== p9_car ===
# panel: car
{at != 9: -> hub}
~ clive_windlass = true
Clive opens the boot. A trust fleece, a first-aid box, wellingtons, and a windlass with a worn wooden grip.
The socket of the windlass is packed with fresh grease.
Clive: I did the paddles on sixteen on Wednesday.
+ {p9_clive == 0} [Talk to Clive] -> p9_clive
+ [Leave] -> hub

// ---------------------------------------------------------------- page 10: Monday, the report and Quaile
=== p10 ===
# page: 10
# panel: page
~ at = 10
{p10 == 1:
    Monday, half past eight. The coroner's office. Your report is on three sheets, in a card folder, with the index cards from your board clipped to the back.
    At ten to nine there is a knock. DCI Hester Quaile, in a raincoat. Her hearing aid is on.
    Quaile: The coroner says you've a file on the canal death that I'll want. I've come to read it before he does.
}
-> p10_ready

=== p10_clive ===
# panel: clive
{ending == "": -> p10_ready}
-> credits

=== p10_ready ===
+ [Read your notebook once more] -> notes
+ [Look at the board once more] -> board
+ [Write the report] -> p10_conclusion

=== p10_conclusion ===
# panel: report
{ending != "": -> credits}
{at != 10: -> hub}
Part one. The conclusion you recommend to the coroner.
+ [Accident] -> set_accident
+ [Open: the evidence does not say] -> set_open
+ [Unlawful killing] -> set_unlawful
= set_accident
~ r_conclusion = "accident"
-> p10_how
= set_open
~ r_conclusion = "open"
-> p10_how
= set_unlawful
~ r_conclusion = "unlawful"
-> p10_how

=== p10_how ===
# panel: report
Part two. How Neville Strand came to die.
+ [He fell into the empty lock and drowned] -> fell
+ [He was pushed into the lock] -> pushed
+ [He fell into the empty lock, and drowned when someone filled it] -> filled
= fell
~ r_how = "fell"
-> p10_whom
= pushed
~ r_how = "pushed"
-> p10_whom
= filled
~ r_how = "filled"
-> p10_whom

=== p10_whom ===
# panel: report
Part three. The coroner may not name anyone. The police can. Whom do you name to Quaile, and why?
+ [Joost and Maaike van Dam, after the row at fifteen] -> vandams
+ [Kit Rowe, who was losing her post] -> kit
+ [Clive Amory, for the gate money] -> clive_theft
+ [Clive Amory, for the death, to hide the lost reserve] -> clive_death
= vandams
~ r_whom = "vandams"
-> p10_quaile
= kit
~ r_whom = "kit"
-> p10_quaile
= clive_theft
~ r_whom = "clive_theft"
-> p10_quaile
= clive_death
~ r_whom = "clive_death"
-> p10_quaile

=== p10_quaile ===
# panel: quaile
{ending != "": -> credits}
{r_whom == "": -> p10_ready}
Quaile reads the whole file, every sheet and every card, without a word. It takes eleven minutes. Once she turns a card over to see if there is anything on the back.
{r_whom == "clive_death": -> question}
-> p10_verdict

= question
Quaile: One question. The chain on fourteen. Who unlocked it?
+ [Clive Amory] -> chain_clive
+ [Kit Rowe] -> chain_wrong
+ [I don't know] -> chain_wrong

= chain_clive
{c_chain:
    Ros: It was chained at 23:13; Neville photographed it. To fill the lock someone unlocked it after that. Two of the three keys were in Neville's coat, in the water. The third is Clive Amory's.
    -> chain_right
}
Ros: I think so.
Quaile: Thinking won't do. His solicitor will ask how.
-> p10_verdict

= chain_right
~ chain_answer = true
Quaile: Yes. That's what I'd have asked him.
-> p10_verdict

= chain_wrong
Quaile: Then his solicitor will say it was never unlocked at all.
-> p10_verdict

=== p10_verdict ===
{
- r_whom == "vandams" || r_whom == "kit":
    {r_conclusion == "unlawful": -> end_wrong}
- r_whom == "clive_death" && r_conclusion == "unlawful" && r_how == "filled" && chain_answer && c_filled && c_alive:
    {pm2: -> end_full}
    -> end_thin
- r_whom == "clive_death" || r_whom == "clive_theft":
    -> end_half
}
{r_conclusion == "accident": -> end_accident}
-> end_open

=== end_full ===
# panel: clive
~ ending = "full"
{end_full == 1:
    ~ rel_quaile += 1
    # memory: quaile +1 You brought Quaile a lock, a chain and a second post-mortem.
}
Quaile takes the folder. At four o'clock she rings you.
Quaile: He's asked to speak to you. Not to me. You can say no.
In the interview room Clive Amory has his reading glasses on, and a solicitor beside him who has stopped writing.
Clive: I put the reserve into the Meridian fund on Ted Hollins's advice, and when it closed I told the committee nothing, because I thought I could put it right before anyone needed the money.
Clive: When he fell I could hear him, and I went to the car for my windlass, and I wound the paddles up; when it was full I wound them down and put the chain back on, because that is what you do at night.
Clive: Ted gave the parish council the same advice about Meridian, and he has made gates for four other trusts since nineteen ninety. You might ask how many of those were new.
Clive: Neville was right about the gates.
-> credits

=== end_thin ===
# panel: clive
~ ending = "thin"
Quaile takes the folder.
On Wednesday Neville Strand is cremated, as booked.
In January Clive Amory's solicitor tells a judge that a man with a head injury can drown in half a metre of water, and there is no second post-mortem to say otherwise. Clive is convicted of fraud, and of perverting the course of justice for what he told you. He serves fourteen months.
In February Annette writes to ask for a copy of your report.
-> credits

=== end_half ===
# panel: quaile
~ ending = "half"
{r_whom == "clive_theft":
    Quaile: This is a fraud, Mrs Kettering. I'll pass it on.
- else:
    Quaile takes the folder.
    {r_how == "pushed":
        Clive Amory's solicitor takes the push apart in an hour. Nobody saw a push, and nothing in the file shows one.
    - else:
        The file names the right man and cannot say what he did. Clive's solicitor asks for the evidence on the chain and the water, and there is not enough.
    }
}
The coroner records {r_conclusion == "accident": an accident|an open conclusion}.
In the spring Clive Amory pleads guilty to fraud over the gate grant, and pays it back, and says in court that the chairman was the best friend the canal ever had.
-> credits

=== end_wrong ===
# panel: quaile
~ ending = "wrong"
Quaile reads your file again and takes it.
{r_whom == "vandams":
    The van Dams are stopped at Harwich with their car on the ferry. They are held for two days and released without charge. Maaike sends you all of her photographs from the holiday, eighty-one of them, with no message.
- else:
    Kit Rowe is interviewed under caution on Tuesday. On Wednesday the Harbour in Bristol withdraws its offer. On Thursday the committee ends her post, as Neville proposed. Clive Amory writes her a reference.
}
Clive Amory keeps the trust's accounts.
-> credits

=== end_open ===
# panel: quaile
~ ending = "open"
Quaile closes the folder and gives it back to you.
The coroner records an open conclusion. In November Annette Strand writes to you: one page, in a teacher's hand. She asks what happened in the last hour.
-> credits

=== end_accident ===
# panel: quaile
~ ending = "accident"
Quaile closes the folder and gives it back to you.
The coroner records an accident. At the funeral Clive Amory gives the address. Kit Rowe stands at the back, in her lock-keeper's fleece.
-> credits

=== credits ===
{ending:
- "full": You solved Lock Fourteen.
- "thin": You named the right man and how he did it, without the second post-mortem.
- "half": You named the right man, but not for the death.
- "wrong": You named the wrong {r_whom == "vandams": people|person}.
- else: Nobody was charged.
}
Your report: {r_conclusion}; {r_how == "filled": fell and was drowned when the lock was filled|{r_how}}; named {r_whom == "clive_death": Clive Amory, for the death|{r_whom == "clive_theft": Clive Amory, for the money|{r_whom == "vandams": the van Dams|Kit Rowe}}}.
Cards on your board: {evidence()} of 3.
+ [Begin again] -> restart

=== restart ===
# restart
-> END
