oooOO`
// The foafos entry to Drift City's stage apps (inklet/finkapp/foafos-apps.js): "drift", the city itself, opened on one
// of its stories; "talkinghead", a cast member's face speaking a recorded line; "cellar", a novel page. Every line a
// reader sees is quoted exactly from story/episodes.fink.js, story/peraspera.fink.js and novel/cellar-entry.fink.js
// (the drift-city skill: words on screen). Each # MINIGAME: tag is inline on its text line (glitchcanary skill,
// minigames, rule 6). Play it in the FINK player:
// inklet/finkapp/?story=/glitchcan-minigam/drift-city/foafos-entry.fink.js
# title: Drift city
-> door

=== door ===
Drift city, on Titan: one city under an orange sky, many nights, many people. Each story has its own narrator and its own night; only the city is shared.
+ [The Lamplighter's Last Round] -> lamplighter
+ [Per Aspera] -> peraspera
+ [Go into the Cold Tap and ask Mags] -> mags
+ [Go down to the Lantern Cellar, Chinatown] -> cellar

=== lamplighter ===
The night before the vote. You keep a tea stall in the Chinatown night market, and the last flame-keeper is missing. You send your old drone out into the methane snow to find her. # MINIGAME: drift tale=lamplighter
-> door

=== peraspera ===
Midnight. You play upright bass, and the band leader has taken a seat home to Earth. You walk the dive bars to find her before the set in the Warmhouse. # MINIGAME: drift tale=peraspera
-> door

=== mags ===
The Cold Tap is a dive bar behind an airlock: nine stools, a heater that ticks, and a price list older than the dome. You crack your helmet seal. The air smells of hops and hot metal.
"Nuala was in at noon," Mags says, and wipes the bar. "Sat where you're sitting. Drank one whisky, very slow, and didnae say a word." # MINIGAME: talkinghead line=mags-1
She puts a glass in front of you. "The set's still on. Midnight, in the bubble. Ruth says it goes ahead with or without her." # MINIGAME: talkinghead line=mags-3
+ [Thank her and go] -> door

=== cellar ===
The Lantern Cellar. The jam goes on under the street. # MINIGAME: cellar
-> door
`;
