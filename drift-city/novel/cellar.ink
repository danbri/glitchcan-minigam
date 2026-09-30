// The Lantern Cellar novel page: one knot per panel, and "page" for the overview. <novel-page> keeps the view and
// this story in step: "# panel:" moves the view, and a reader's tap or swipe diverts here to the panel's knot.
// Every still leads to the stage (the moving panel), which holds the choices.
// Words: the two lines of prose and the labels "Go down to the Lantern Cellar, Chinatown", "Sit in with Oskar" and
// "Back to Ferry Street" are exact quotes from story/peraspera.fink.js (knot cellar, and the choice into it). "Take a minute to think" and
// "Watch from back of room" are the owner's (2026-09-28; they replaced "Look at her from the side", which the owner
// found creepy, and "Look back at the door"). The other choice labels
// are plain navigation, to be replaced by owner-written lines. Do not add prose here that the owner has not written.
// Set by cellar.html from the MINIGAME argument `exits=oskar` (Per Aspera's cellar): the stage then also offers
// Per Aspera's own choice "Sit in with Oskar", and taking it hands control back with that choice (# leave: oskar).
VAR oskar_exit = false
-> page

=== page ===
# panel: page
The Lantern Cellar. The jam goes on under the street.
+ [Go down to the Lantern Cellar, Chinatown] -> door

=== door ===
# panel: door
The Lantern Cellar is under a noodle bar on Glass Walk: forty steps down, then an airlock, then a low room full of smoke and brass. The late jam never stops; players come and go and the tune goes on.
+ [Look at the stage] -> stage

=== stage ===
# panel: stage
+ [Take a minute to think] -> side
+ [Watch from back of room] -> door
+ {oskar_exit} [Sit in with Oskar] -> oskar
+ [Back to Ferry Street] -> street

=== oskar ===
# leave: oskar
-> DONE

=== side ===
# panel: side
+ [Look at the stage] -> stage

=== street ===
# panel: street
+ [Go down to the Lantern Cellar, Chinatown] -> door
