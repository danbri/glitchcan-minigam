// Larkspur Falls, the accusation at the Lantern Festival, as one graphic-novel page (festival.html). One knot per
// panel and "page" for the overview; <novel-page> keeps the view and the story in step. "# voice: <id>" plays one of
// the recorded takes of that line (media/vo/<id>-N.mp3); the text shown is what the voice says.
-> page

=== page ===
# panel: page
# voice: page
The Lantern Festival. The whole town is on the green, and every face is turned to you.
+ [Step up to the microphone] -> crowd

=== crowd ===
# panel: crowd
# voice: mayor
"Nora Halvorsen will now tell us who took the Founders' Snowglobe!"
# voice: agree
You did not agree to this.
+ [Find Agatha Pruitt in the crowd] -> agatha
+ [Look at the edge of the crowd] -> wreath

=== agatha ===
# panel: agatha
# voice: box
Agatha Pruitt holds a bakery box by its string. There is a plaster on her finger.
# voice: waiting
"Well? We are all waiting, dear."
+ [Look into the box] -> box
+ [Name Agatha Pruitt] -> confess
+ [Name somebody else] -> confess

=== box ===
# panel: box
# voice: snowing
Inside the box, something is snowing upward.
+ [Name Agatha Pruitt] -> confess
+ [Look at the edge of the crowd] -> wreath

=== wreath ===
# panel: wreath
# voice: wreath
At the edge of the crowd, a man with a wreath is not looking at you. He is looking at whoever is looking at you.
+ [Find Agatha Pruitt in the crowd] -> agatha

=== confess ===
# panel: box
# voice: confess
"Oh, for heaven's sake. It was me. I cracked it last year, and I had it mended."
+ [Look at the edge of the crowd] -> wreath
+ [See the whole page] -> page
