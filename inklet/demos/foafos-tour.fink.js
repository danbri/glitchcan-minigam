// The foafos tour — a compact live demo of the whole shell, as a story.
// Load: inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/foafos-tour.fink.js
oooOO`
-> lobby

=== lobby ===
Welcome to the foafos shell. Everything you can see is a window, every window is a process, and everything that happens is an event. # CLASS: info
Two controls frame this tour: the shell dock — the ⊞ button, bottom right — and, when a game is running, the window grip ▦ top right.
+ [1 · The dream stack] -> dreams
+ [2 · A game as a window] -> game
+ [3 · Widgets and the Maker] -> widgets
+ [4 · The feed, sessions, and two tabs] -> shellbits
+ [Enough — take me somewhere real] -> depart

=== dreams ===
Documents nest. This story can push itself onto a stack and play another inside it — watch the colours shift as reality thins, and the DREAM badge appear on the Story row in the dock.
When the inner story ends, you will land back here, mid-breath.
+ [Descend] -> descend
+ [Back to the lobby] -> lobby

=== descend ===
You drift down a level. # FINK: dream-inner.fink.js # LINKREL: goDeeper
And you are back — the outer story resumed exactly where it held its breath. That was END-at-depth popping the stack.
+ [Back to the lobby] -> lobby

=== game ===
A minigame is a sandboxed window speaking a small protocol. Robbin will open now: try the grip ▦ — FULL, SPLIT (story and game share the screen), PIP (a live corner, tap to restore). Pause is ⏸. The ✕ hands quitting to the game's own paper dialog — the shell never just kills a guest that owns its exit.
Down on the platforms, something is singing. # MINIGAME: robbin mode=hampstead controls=none
-> game_return

=== game_return ===
The escalator hauls you back up to the tour.
+ [Out of the station]
    Back in the lobby. Anything the game wrote — birds befriended, scores — is now story state; open the Maker to see it.
    -> lobby

=== widgets ===
Open the dock ⊞ → WIDGETS. Launch Tally twice: two instances of one widget, two isolated processes — bump one, the other holds still, yet the granted counter events cross. Launch Data for a full SQLite spreadsheet in a sandbox. And open 🔧 Maker: live story variables (try SET diamonds 42), the dream stack, and a tap on the minigame protocol itself.
The WINDOWS tree in the dock lists every one of these — select to focus, ✕ to close.
+ [Back to the lobby] -> lobby

=== shellbits ===
The FEED in the dock is this session as a social stream — story beats, windows opening, games finishing, audio moving. Your session is ephemeral until you SAVE it with a passphrase; then it is encrypted at rest and survives reloads.
And if you open this same page in a second tab and start a game there, this tab's game will politely fall silent: the tabs share one bus, elect a coordinator, and one machine plays one soundtrack.
+ [Back to the lobby] -> lobby

=== depart ===
The tour thins. Beyond here, the finkiverse proper.
+ [Hampstead — the full episode] # FINK: ../hampstead.fink.js
    Mind the gap. -> lobby
+ [The table of contents] # FINK: ../toc.fink.js
    Everything is not here yet. -> lobby
+ [Stay in the lobby] -> lobby
`;
