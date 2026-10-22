// Test fixture for `# APP:` (docs/foafos-apps-20261022.md, section 6):
// then=wait (the default), then=beside, then=go, and the old name `# MINIGAME:`.
// Driven by inklet/finkapp/test/e2e-app-tag.mjs. A tag binds to the line that
// follows it, so each tag comes first and its lead-in line second.
oooOO`
VAR game_success = false
VAR game_score = 0
-> start

=== start ===
Four ways to open an app.
+ [Wait for a game] -> waiting
+ [An app beside the story] -> beside
+ [Start a service and go on] -> go
+ [The old tag] -> oldname

=== waiting ===
# APP: waterworld then=wait mode=test
You go down to the dock.
-> after

=== after ===
Back from the game: {game_success}, score {game_score}.
-> END

=== beside ===
# APP: drift then=beside tale=peraspera
The city stands beside the story.
+ [Go on] -> END

=== go ===
# APP: player then=go
The story goes on at once.
+ [Go on] -> END

=== oldname ===
# MINIGAME: waterworld
The old tag still works.
-> after
`;
