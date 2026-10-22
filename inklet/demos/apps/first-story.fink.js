// foafos apps demo, the first of two stories (?root=apps). Plain demo text,
// not story prose: it says what each step does. Both stories add tracks to
// the one Playlist with `# APP: playlist then=go action=queue track=<id>`
// (track ids: inklet/apps/tv/channels.js). Design: docs/foafos-apps-20261022.md.
oooOO`
-> start

=== start ===
This is the first of two stories in the foafos apps demo. Each story has its own story runner. Both use the one Playlist.
+ [Add "The Quiet Engines" to the playlist] -> queue_engines
+ [Go into a story inside this one] -> inside

=== queue_engines ===
# APP: playlist then=go action=queue track=the-quiet-engines
This story asked the Playlist to add "The Quiet Engines". If the Playlist was not open, it opened now. The story did not wait for it.
-> menu

=== inside ===
This story now waits, and another story plays inside it. A frame round the text shows how deep you are. # FINK: ../dream-inner.fink.js # LINKREL: goDeeper
Back in the first story, where it stopped.
-> menu

=== menu ===
+ [Add "The Quiet Engines" again] -> queue_engines
+ [Go into a story inside this one] -> inside
+ [End this story] -> finish

=== finish ===
The first story ends here. The Playlist stays open: it belongs to the installation, not to this story.
-> END
`;
