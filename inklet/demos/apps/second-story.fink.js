// foafos apps demo, the second of two stories (?root=apps). Plain demo text,
// not story prose: it says what each step does. It uses the same Playlist as
// the first story: the second request finds it open and adds to its queue.
// Design: docs/foafos-apps-20261022.md.
oooOO`
-> start

=== start ===
This is the second story in the foafos apps demo. It uses the same Playlist as the first story, not a player of its own.
+ [Add "Euston Night Mail" to the playlist] -> queue_mail
+ [Add "The Inexorable Passacaglia" to the playlist] -> queue_passacaglia

=== queue_mail ===
# APP: playlist then=go action=queue track=per-station/euston-night-mail-remastered
This story asked the Playlist to add "Euston Night Mail". It goes after anything the first story added.
-> menu

=== queue_passacaglia ===
# APP: playlist then=go action=queue track=the-inexorable-passacaglia
This story asked the Playlist to add "The Inexorable Passacaglia".
-> menu

=== menu ===
+ [Add "Euston Night Mail"] -> queue_mail
+ [Add "The Inexorable Passacaglia"] -> queue_passacaglia
+ [Skip to the next track] -> skip
+ [End this story] -> finish

=== skip ===
# APP: playlist then=go action=next
This story asked the Playlist to skip to the next track.
-> menu

=== finish ===
The second story ends here.
-> END
`;
