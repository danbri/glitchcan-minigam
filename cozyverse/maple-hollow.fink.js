oooOO`
// Maple Hollow: Aslan Rising - A Cozy Interactive Romance
// Uses VIDEO tags for YouTube mood clips

VAR warmth = 0
VAR visited_bakery = false
VAR met_jake = false
VAR heard_song = false

-> train_arrives

=== train_arrives ===
# VIDEO: R4ZGGJsho7I

The train slows with a familiar screech. Through frost-laced windows, Emma watches Maple Hollow emerge from the snow—unchanged, impossibly unchanged, after three years away.

— As Aslan might say: "You cannot go back to the beginning, but you can start where you are."

She hasn't been home since the night she left. Since Jake.

The platform is nearly empty. Steam rises from the engine like breath in winter air.

+ [Step onto the platform, heart pounding]
    ~ warmth += 1
    Emma's boots crunch on fresh snow. The cold bites her cheeks, but something else makes her breath catch—
    -> spot_jake
+ [Linger in the doorway, scanning the crowd]
    She hesitates. The smart thing would be to go straight to Mom's. Avoid... complications.
    -> go_to_bakery
+ [Watch a snowflake land on her glove]
    A single perfect crystal. She remembers catching snowflakes with him, counting the points, making wishes.
    -> stranger_kindness

=== spot_jake ===
# VIDEO: BlAGHcJsJio
~ met_jake = true

And there he is.

Jake leans against his old red truck, hands stuffed in pockets, breath clouding the air. He looks up. Their eyes meet across the platform.

Three years collapse into nothing.

— "Courage, dear heart," Aslan whispers through the falling snow.

+ [Walk toward him—let the past be past]
    ~ warmth += 2
    Her feet move before her mind catches up. His face—guarded at first—softens as she approaches.
    "Emma." Just her name. But the way he says it.
    -> walk_together
+ [Nod politely, keep walking]
    She forces a smile, a wave, and turns toward town. Some wounds need more than three years.
    -> go_to_bakery
+ {warmth > 0} [A snowball hits Jake square in the chest]
    "GOTCHA!" A small figure bursts from behind a bench—Lily, Jake's little sister, now not so little.
    -> lily_ambush

=== walk_together ===
# VIDEO: q6mGKXTJdCw
~ warmth += 1

They fall into step together, the old rhythm returning despite everything. Snow crunches beneath their boots.

"You look..." Jake starts.
"Different? Older? Like I've been living in the city?"
"Good." He clears his throat. "You look good, Emma."

— In Narnia, the ice always melts eventually.

The truck waits at the curb, its engine still warm.

+ [Accept a ride to the festival grounds]
    ~ warmth += 1
    "Hop in. I'm helping set up the Winter Lights Festival. You could... if you want..."
    She does want. That's the terrifying part.
    -> festival_prep
+ [Walk into town instead—need time to think]
    "I should... I need to see Mom first. At the bakery."
    His face flickers with something—disappointment? Understanding?
    -> go_to_bakery
+ {heard_song == false} [The truck radio crackles to life]
    ~ heard_song = true
    And there it is. *Their* song. The one from that summer.
    -> song_returns

=== go_to_bakery ===
# VIDEO: 7Fs_xFCEegM
~ visited_bakery = true

The Hearth & Crumb smells exactly as Emma remembers—cinnamon, rising bread, and the faint sweetness of her mother's famous apple tarts.

"EMMA!" Her mother's flour-dusted arms wrap around her before the door even closes.

— "There is nothing like a cup of tea—or fresh bread—to set the world right."

The warmth of the kitchen seeps into her bones. This, at least, hasn't changed.

+ [Ask about Jake]
    ~ warmth += 1
    "Mom... is Jake... is he seeing anyone?"
    Her mother's knowing smile says everything.
    -> ask_about_jake
+ [Help with the baking]
    "Put me to work. I've missed this."
    Some conversations are easier with hands busy.
    -> festival_prep
+ [Accidentally knock over the flour]
    Emma reaches for her favorite mixing bowl and her elbow catches—
    POOF.
    -> flour_disaster

=== stranger_kindness ===
# VIDEO: 5BT8jT16n88

An elderly woman with kind eyes offers Emma a handkerchief. "You'll catch cold, dear, standing in doorways."

"Grandma June?" Emma barely recognizes her old neighbor.

"Three years, and you still dawdle just the same." But she's smiling. "The town's been waiting for you, you know. *Someone* especially."

— "Aslan is on the move."

+ [Follow Grandma June to the bakery for cocoa]
    "Come. Your mother's been stress-baking for a week."
    -> go_to_bakery
+ [Ask what she means by "someone"]
    Grandma June's eyes twinkle. "Oh, I think you know. Some hearts don't forget, Emma. Even when heads try to."
    ~ warmth += 1
    -> lights_of_rising
+ [Return to the platform—too much, too fast]
    Emma turns back. Maybe she's not ready after all.
    -> train_arrives

=== lily_ambush ===
# VIDEO: bFo5lWvD8Ms

Lily has grown into a hurricane of energy and mischief. At fifteen, she's all gangly limbs and unstoppable enthusiasm.

"You're BACK! Finally! Jake's been—" She claps a hand over her mouth. "I wasn't supposed to say that."

Jake shakes snow from his collar, trying to look annoyed and failing completely.

— "Even the smallest person can change the course of the future."

+ [Help Lily plot more snowball chaos]
    ~ warmth += 1
    "What else weren't you supposed to tell me?"
    -> festival_prep
+ [Suggest hot cocoa at the bakery]
    "I'm freezing. Hearth & Crumb?"
    Lily's eyes light up. "MOM'S APPLE TARTS."
    -> go_to_bakery
+ {warmth >= 3} [Grandma June appears with perfect timing]
    "Lily June Mitchell, I saw that throw from my window. Inside, all of you. Hot cocoa. Now."
    -> lights_of_rising

=== festival_prep ===
# VIDEO: TBPoH_FyWLw
~ warmth += 1

The town square transforms under hundreds of hands. String lights drape between lampposts. A massive tree waits for ornaments. Children chase each other through sawdust.

Emma finds herself next to Jake, untangling lights.

"Remember when we got the whole strand knotted?" he asks.
"We were here until midnight."
"Best midnight of my life."

— "Once a King or Queen of Narnia, always a King or Queen."

+ [Let their hands brush reaching for the same light]
    ~ warmth += 2
    Neither pulls away.
    -> song_returns
+ [Step back—this is moving too fast]
    "I should check on Lily. Make sure she's not terrorizing anyone."
    -> lily_ambush
+ {warmth >= 4} [The lights flicker, then blaze golden]
    Something *happens*. A warmth that has nothing to do with the cold. The lights seem to glow from within.
    -> lights_of_rising

=== song_returns ===
# VIDEO: LpjWnlA5Eus
~ heard_song = true
~ warmth += 2

The melody drifts from somewhere—a radio, a phone, someone humming—and stops them both.

\*That\* song.

"I never deleted it from my playlist," Jake admits quietly. "I tried. I couldn't."

"Neither could I."

— "You have listened to fears, child. Now hear the truth."

The snow falls harder, wrapping them in white silence.

+ [Hum along—let the memory live]
    ~ warmth += 2
    Their voices blend, hesitant at first, then sure.
    -> lights_of_rising
+ [Change the subject—too vulnerable]
    "We should get inside. The festival..."
    -> go_to_bakery
+ {warmth >= 5} [Take his hand]
    ~ warmth += 3
    Her fingers find his. Cold skin, warm grip.
    -> lights_of_rising

=== flour_disaster ===
# VIDEO: gY0AynfJ3m8

White clouds everywhere. Emma stands in the epicenter, looking like a very surprised ghost.

Her mother starts laughing—deep, healing laughter—and Emma joins in until tears streak through the flour on her cheeks.

"Some things never change, Emma Rose."

— "Laugh and fear not, dear heart."

+ [Challenge Mom to a flour fight]
    ~ warmth += 1
    The kitchen descends into beautiful chaos.
    -> festival_prep
+ [The flour war spills outside]
    Lily appears at the window, sees the carnage, and charges in with reinforcements.
    -> lily_ambush
+ {visited_bakery && warmth >= 2} [Grandma June arrives for a taste test]
    "I heard there was baking. And possibly shenanigans."
    -> lights_of_rising

=== ask_about_jake ===
# VIDEO: q6mGKXTJdCw

Her mother sets down the rolling pin. "He asks about you, Emma. Every time he comes in for bread. 'Heard anything from Emma?' Like clockwork."

"Why didn't anyone tell me?"

"Because you needed to come home when *you* were ready. Not when we pushed you."

— "You would not have called to me unless I had been calling to you."

+ [Go find him]
    ~ warmth += 2
    Emma is out the door before the flour settles.
    -> festival_prep
+ [Stay and process this]
    She needs a moment. A cup of tea. The world just tilted.
    -> lights_of_rising

=== lights_of_rising ===
# VIDEO: mj1Dqod1MTA

The Winter Lights Festival begins at dusk, but something else is happening.

Above Maple Hollow, the aurora blooms—ribbons of green and gold dancing across the sky. The crowd falls silent.

"This hasn't happened in fifty years," Grandma June whispers.

Emma finds Jake beside her. Of course he's beside her.

— "I am the great Bridge Builder. I call you across."

{warmth >= 6:
    Their eyes meet in the impossible light.
    "Emma, I never stopped—"
    "I know." She takes his hand. "I know."
}
{warmth >= 3 && warmth < 6:
    The lights paint their faces gold and green.
    "Maybe..." Jake starts.
    "Maybe," she agrees. A beginning. Not an ending.
}
{warmth < 3:
    She watches the lights alone, but peaceful.
    Some journeys home take longer than others.
    And that's okay.
}

— "Welcome home, dear heart. Welcome home."

+ {warmth >= 5} [Take his hand—write the next chapter together]
    -> ending_love
+ [Smile at the lights—savor this moment]
    -> ending_hope
+ [Start a new path from here]
    -> train_arrives

=== ending_love ===
# VIDEO: mj1Dqod1MTA

Their fingers intertwine as the aurora dances overhead.

"Stay," Jake says. Not a question. A wish.

"I'm home," Emma answers. "I'm finally home."

— "All shall be well. All shall be well. And all manner of thing shall be well."

Behind them, Lily cheers. Grandma June dabs her eyes. And in the bakery window, Emma's mother watches her daughter finally stop running.

The lights of Maple Hollow burn bright against the winter sky.

\*\*THE END**

{warmth}: warmth points earned
{visited_bakery}: visited bakery
{met_jake}: met Jake at station
{heard_song}: heard their song

-> END

=== ending_hope ===
# VIDEO: mj1Dqod1MTA

Emma watches the aurora paint the sky, surrounded by the town that raised her.

There will be time. For conversations not yet had. For wounds not yet healed. For love not yet spoken.

— "There are no accidents. All is meant."

But tonight, she is home. And that is enough.

\*\*THE END**

-> END
`
