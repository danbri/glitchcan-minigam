// Entry point: plays Drift city's Lantern Cellar page as a foafos stage app (`# MINIGAME: cellar`, registered in
// inklet/finkapp/foafos-apps.js). The page runs sandboxed with its own ink (cellar.ink) and hands control back
// here when its story returns the reader to the street.
// Every line of prose and every choice label below is an exact quote from drift-city/story/peraspera.fink.js
// (knot street, its choice into the cellar, and the cellar's second visit). Do not add prose the owner has not
// written.
oooOO`
# title: The Lantern Cellar
Ferry Street. Snow settles on your case.
+ [Go down to the Lantern Cellar, Chinatown] -> cellar

=== cellar ===
# MINIGAME: cellar
The Lantern Cellar. The jam goes on under the street.
-> street

=== street ===
Ferry Street, the snow still falling.
+ [Go down to the Lantern Cellar, Chinatown] -> cellar
`
