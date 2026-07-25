// Audio demo — the answer to "where can I hear an mp3 set as background
// for a fink story?", which until now was "nowhere".
//
// The `# AUDIO:` tag has always been able to do this: FinkAudio fetches
// the URL, decodes it, loops it and crossfades between tracks. No story
// had ever pointed it at a file. The only two AUDIO tags in the whole
// corpus said `synth:wind`, which is a FOLEY layer, not a URL — so they
// tried to fetch a "synth:" scheme and failed silently.
//
// Tracks borrowed from ROBBIN's tape library (magpie/robbin/audio/, see
// its README). If a track is ever retired from that rotation this demo
// loses its music — an acceptable coupling for a demo, not for a game.
//
//   inklet/finkapp/?story=/glitchcan-minigam/inklet/demos/audio-demo.fink.js
//
// NOTE: browsers will not start audio before a user gesture. The first
// knot exists so that tapping a choice unlocks the AudioContext; the
// music starts on the knot after it. That is a platform fact, not a bug
// to route around.

oooOO`
# BASEHREF: ..\/..\/magpie\/robbin\/audio\/

-> gate

=== gate ===
Three tracks, one story, crossfaded by the platform.

Tap to begin — a browser will not let any page make a sound until you
have touched it once.

+ [Begin] -> quiet_engines

=== quiet_engines ===
The first track is loading and will loop. # AUDIO: the-quiet-engines.mp3

Nothing else on this page is doing anything. The tag did it: the engine
resolved the filename against this story's BASEHREF, fetched it, decoded
it, and started a looping source with its own gain node.

+ [Next track — listen for the crossfade] -> passacaglia
+ [Add a procedural layer on top] -> layered
+ [Stop everything] -> silence

=== passacaglia ===
Switching. # AUDIO: the-inexorable-passacaglia.mp3

The old track fades out while this one comes up: FinkAudio keeps one
background source and crossfades when a new AUDIO tag arrives. There is
no playlist and no next/previous — one tag, one bed.

+ [Back to the engines] -> quiet_engines
+ [Add a procedural layer on top] -> layered
+ [Stop everything] -> silence

=== layered ===
Wind, generated rather than loaded. # FOLEY: wind(pan:0, vol:0.25, gust:0.3)

Two different systems are now running at once. The mp3 is FinkAudio —
fetch, decode, loop. The wind is FinkFoley — oscillators and filtered
noise, no file at all. They share one AudioContext, which is why the
levels sit together instead of fighting.

Writing \# AUDIO: synth:wind gets you the same wind: that form is routed
to the foley engine, because "synth:" is an instruction, not a URL.

+ [Drop the wind, keep the music] -> quiet_engines
+ [Stop everything] -> silence

=== silence ===
Everything stopped. # STOP_AUDIO

One tag stops both engines.

+ [Start again] -> quiet_engines
+ [Done] -> END
`;
