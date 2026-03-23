oooOO`
// Radio Foundation Quiz - UK Ofcom Foundation Licence prep
// A gruff old-school elmer quizzes you on the basics

VAR score = 0
VAR total = 10
VAR q = 0

-> intro

=== intro ===
#BG:#112
Right then. Sit down.

I'm not here to hold your hand. I've been on the air since before you were born, and I've seen too many people key up without knowing what they're doing.

You want your Foundation licence? Prove you deserve it. {total} questions. No waffle. Get it right or learn something.

+ [Let's go] -> q1
+ [I'm not ready...] -> not_ready

=== not_ready ===
Nobody's ever ready. That's why we practise. Now stop dithering.

+ [Fine, go ahead] -> q1

=== q1 ===
~ q = 1
Question {q}. Basic stuff.

What does the letter F stand for in "RF"?

+ [Frequency] -> q1_right
+ [Foundation] -> q1_wrong
+ [Field] -> q1_wrong

=== q1_right ===
~ score = score + 1
Correct. Radio Frequency. The clue's in the name. RF — the energy we work with every time we transmit.

RF sits between about 3 kHz and 300 GHz. You don't need to memorise all that for Foundation, but you DO need to know it's not magic — it's electromagnetic waves.

+ [Next question] -> q2

=== q1_wrong ===
No. Radio FREQUENCY. Basic terminology. If you can't get the words right, how will you get the operating right?

RF — Radio Frequency — the electromagnetic energy we use to communicate. Remember it.

+ [Next question] -> q2

=== q2 ===
~ q = 2
Question {q}.

A UK Foundation licence callsign starts with which prefix?

+ [M7] -> q2_right
+ [M0] -> q2_wrong_m0
+ [G4] -> q2_wrong_g4
+ [2E0] -> q2_wrong_2e0

=== q2_right ===
~ score = score + 1
Good. M7 — that's you as a Foundation licensee. Three letters after it, assigned by Ofcom. Not chosen by you, before you ask.

Full licence is M0. Intermediate is 2E0. The old G-prefixed calls are legacy — earned when the exams were harder, some would say.

+ [Next] -> q3

=== q2_wrong_m0 ===
No. M0 is a Full licence call. You haven't earned that yet.

Foundation is M7. Intermediate is 2E0. Full is M0. Learn the hierarchy.

+ [Next] -> q3

=== q2_wrong_g4 ===
No. G4 is a legacy Full licence prefix from years back. Foundation calls start M7.

M7 — Foundation. 2E0 — Intermediate. M0 — Full. That's the progression.

+ [Next] -> q3

=== q2_wrong_2e0 ===
No. 2E0 is Intermediate. You need to walk before you can run.

Foundation is M7. That's where you start. Intermediate 2E0. Full M0.

+ [Next] -> q3

=== q3 ===
~ q = 3
Question {q}.

What is the maximum transmit power for a UK Foundation licence holder?

+ [10 watts] -> q3_right
+ [50 watts] -> q3_wrong
+ [100 watts] -> q3_wrong
+ [5 watts] -> q3_wrong

=== q3_right ===
~ score = score + 1
Right. 10 watts. Not a lot, but you'd be amazed what you can do with 10 watts and a decent aerial. I've worked across Europe on less.

Some Foundation bands allow less than 10 watts — check the band plan. But 10 watts is your ceiling. Go over it and Ofcom will be very interested in having a word.

+ [Next] -> q4

=== q3_wrong ===
Wrong. 10 watts. That's your lot on a Foundation licence.

50 watts is Intermediate. Full licence gets you 400 watts on most bands. But YOU get 10. Use them wisely.

+ [Next] -> q4

=== q4 ===
~ q = 4
Question {q}. Safety now — this matters.

You're setting up an HF antenna in your garden. What's the FIRST thing you check?

+ [Distance from overhead power lines] -> q4_right
+ [SWR reading] -> q4_wrong_swr
+ [Band conditions] -> q4_wrong_band
+ [Coax cable length] -> q4_wrong_coax

=== q4_right ===
~ score = score + 1
Exactly right. Power lines KILL. Full stop. No discussion.

An antenna touching or even near a power line is lethal. No radio contact is worth dying for. Check above, check around, then — and only then — start putting up wire.

The exam takes safety seriously. So should you.

+ [Next] -> q5

=== q4_wrong_swr ===
No! You can't measure SWR if you're dead!

POWER LINES. That's the first thing. Always. An antenna near overhead cables is a death sentence. Check for power lines before you do ANYTHING else.

+ [Next] -> q5

=== q4_wrong_band ===
Band conditions don't matter if you've electrocuted yourself putting the aerial up.

POWER LINES. Check for overhead power lines first. Every time. No exceptions.

+ [Next] -> q5

=== q4_wrong_coax ===
Coax length? You're thinking about feed loss when you should be thinking about not dying.

POWER LINES. Check for overhead power lines before you touch any antenna work. This isn't optional.

+ [Next] -> q5

=== q5 ===
~ q = 5
Question {q}.

In the NATO phonetic alphabet, how do you say the letter M?

+ [Mike] -> q5_right
+ [Mango] -> q5_wrong
+ [Metro] -> q5_wrong
+ [Mary] -> q5_wrong

=== q5_right ===
~ score = score + 1
Correct. Alpha, Bravo, Charlie... Mike.

The phonetic alphabet isn't a suggestion — it's how we communicate clearly. "M" and "N" sound identical on a noisy channel. "Mike" and "November" don't. Use it every time you give your callsign.

+ [Next] -> q6

=== q5_wrong ===
No. It's MIKE. M-I-K-E.

The NATO phonetic alphabet is standardised worldwide. You don't make up your own. Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike. Learn it. Live it.

+ [Next] -> q6

=== q6 ===
~ q = 6
Question {q}.

What does "CQ" mean when you hear it on the air?

+ [General call — seeking any station] -> q6_right
+ [Emergency call] -> q6_wrong_emergency
+ [Channel Quality check] -> q6_wrong_cq
+ [Calling a specific station] -> q6_wrong_specific

=== q6_right ===
~ score = score + 1
Right. CQ — "seek you" — a general call to anyone listening. "CQ CQ CQ, this is Mike Seven Alpha Bravo Charlie, Mike Seven Alpha Bravo Charlie, calling CQ and standing by."

That's how you make contacts. You put out a call, someone comes back. Simple as that. Been working since Marconi's day.

+ [Next] -> q7

=== q6_wrong_emergency ===
No! An emergency call is MAYDAY on voice, or SOS in Morse. Getting those confused could cause real problems.

CQ means "general call" — calling any station. Think "seek you." It's an invitation to chat, not a cry for help.

+ [Next] -> q7

=== q6_wrong_cq ===
Made that up, didn't you? CQ doesn't stand for "Channel Quality."

CQ is a general call — "seek you." You transmit it when you want any station to come back to you. It's one of the oldest conventions in radio.

+ [Next] -> q7

=== q6_wrong_specific ===
No. If you're calling a specific station, you use their callsign. "Golf Four Alpha Bravo Charlie, this is Mike Seven..."

CQ is a GENERAL call — you're calling anyone. Any station can respond. That's the whole point.

+ [Next] -> q7

=== q7 ===
~ q = 7
Question {q}.

What frequency band is the "2 metre" band?

+ [144 - 146 MHz] -> q7_right
+ [28 - 29.7 MHz] -> q7_wrong_10m
+ [430 - 440 MHz] -> q7_wrong_70cm
+ [3.5 - 3.8 MHz] -> q7_wrong_80m

=== q7_right ===
~ score = score + 1
Good. 144 to 146 MHz — VHF. The workhorse band for local communication. Most repeaters live here. Your first radio will probably be a 2 metre handheld.

The name comes from the wavelength. Speed of light divided by frequency gives you roughly 2 metres. Physics, not arbitrary naming.

+ [Next] -> q8

=== q7_wrong_10m ===
No. 28 MHz is 10 metres — that's HF. Completely different propagation.

2 metres is 144 to 146 MHz. VHF. Line-of-sight mostly, though you get some nice lifts with temperature inversions. Your bread-and-butter local band.

+ [Next] -> q8

=== q7_wrong_70cm ===
No. 430 MHz is 70 centimetres — close but wrong direction. That's UHF.

2 metres is 144 to 146 MHz. VHF. Longer wavelength than 70cm, generally better for getting over hills. Know your bands.

+ [Next] -> q8

=== q7_wrong_80m ===
No. 3.5 MHz is 80 metres — that's HF, down in the weeds. Good for ragchewing on winter evenings.

2 metres is 144 to 146 MHz. VHF. Totally different part of the spectrum. Foundation licensees use 2m a LOT.

+ [Next] -> q8

=== q8 ===
~ q = 8
Question {q}.

What does a high SWR reading on your antenna system indicate?

+ [Poor match between radio and antenna] -> q8_right
+ [Strong signal being received] -> q8_wrong
+ [Good antenna performance] -> q8_wrong
+ [Low battery] -> q8_wrong

=== q8_right ===
~ score = score + 1
Correct. SWR — Standing Wave Ratio. When your antenna isn't matched properly to your radio and feedline, power reflects back. High SWR means wasted power and potential damage to your transmitter.

A perfect match is 1:1. Under 1.5:1 is fine. Over 3:1 and you need to stop transmitting and fix the problem. Your radio's final amplifier won't thank you otherwise.

+ [Next] -> q9

=== q8_wrong ===
Not even close. SWR is Standing Wave Ratio — it tells you how well your antenna system is matched.

High SWR means power is bouncing back down the coax instead of being radiated. Bad for your radio, bad for your signal. Keep it low — under 1.5:1 ideally.

+ [Next] -> q9

=== q9 ===
~ q = 9
Question {q}.

You want to use a repeater. What does it mean to use a "tone" or CTCSS?

+ [A sub-audible tone that opens the repeater's squelch] -> q9_right
+ [A Morse code identifier] -> q9_wrong
+ [An audio filter for your receiver] -> q9_wrong
+ [A type of modulation] -> q9_wrong

=== q9_right ===
~ score = score + 1
Right. CTCSS — Continuous Tone-Coded Squelch System. A low-frequency tone below the voice range that tells the repeater "this transmission is meant for me."

Without the right tone, the repeater ignores you. Different repeaters use different tones. Check before you transmit — the keeper won't appreciate you hammering away with the wrong tone. Look up the repeater details on ukrepeater.net.

+ [Next] -> q10

=== q9_wrong ===
No. CTCSS is a sub-audible tone — a low frequency signal sent alongside your voice. The repeater won't open unless it hears the correct tone.

Think of it as a key for the repeater's front door. Wrong key, door stays shut. Check the repeater's required tone before you try to use it.

+ [Next] -> q10

=== q10 ===
~ q = 10
Last question. Get this one right and maybe there's hope for you.

Why must you identify your station with your callsign?

+ [It's a legal requirement of your licence] -> q10_right
+ [It's just good practice but optional] -> q10_wrong
+ [Only needed during contests] -> q10_wrong
+ [Only on HF, not VHF] -> q10_wrong

=== q10_right ===
~ score = score + 1
Exactly. It's the LAW. Your licence conditions require you to identify with your callsign at regular intervals and at the start and end of a contact.

Your callsign is your identity on the air. It's traceable. It means you're accountable. That's why we have licences — so the spectrum isn't a free-for-all. Identify. Every. Time.

+ [Get my results] -> results

=== q10_wrong ===
WRONG. It's a LEGAL REQUIREMENT. Not optional. Not "good practice." It's a condition of your licence from Ofcom.

You transmit without identifying, you're breaking the law. Simple as that. Your callsign proves you're a licensed operator and makes you accountable.

+ [Get my results] -> results

=== results ===
#BG:#112

Right. You scored {score} out of {total}.

{score >= 9:
Well well. {score}/{total}. You've actually been paying attention. Maybe you'll be alright on the air after all. Go book your Foundation exam — you're ready. 73.
}

{score >= 7 && score < 9:
{score}/{total}. Not bad. You know the basics but you've got gaps. Fill them. Read the Foundation licence manual cover to cover. Then come back and try again. The exam won't give you partial credit.
}

{score >= 5 && score < 7:
{score}/{total}. Middling. You've got some of it but you'd be shaky in the exam. Get the RSGB Foundation Licence Now! book. Read it properly — don't just skim it. The bands, the safety, the procedures — they all matter.
}

{score < 5:
{score}/{total}. Not good enough. Not by a long chalk. But don't give up — everyone starts somewhere. Get yourself the Foundation study materials, find a local radio club, and put the work in. The hobby's worth it. Come back when you've studied.
}

The Foundation exam is 26 multiple choice questions. You need 19 to pass. It covers everything we talked about and more — band plans, propagation, interference, EMF safety, operating procedures.

Find a club. Get on the air under supervision. Listen more than you talk — at least at first.

Now get out of my shack. I've got a pileup to work.

+ [Try again] -> intro
+ [73 — thanks] -> goodbye

=== goodbye ===
#BG:#223
73, and good luck with the exam.

Remember: the licence is just the beginning. The real learning happens on the air.

Now go study.

-> END
`
