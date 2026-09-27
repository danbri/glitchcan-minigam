# Crowd sound in the venues

Four clips, played by `src/venue.js` (the crowd grains and the applause between tunes):

| file | what | length |
|---|---|---|
| bar-a.mp3 | a busy small bar: talk, a glass, a chair | 2.05 s |
| bar-b.mp3 | a crowded bar at night: talk | 2.05 s |
| club.mp3 | a jazz club between songs: talk at tables, glasses | 2.05 s |
| applause.mp3 | applause after a song in a small club | 3.06 s |

- Made September 2026 with the ElevenLabs connector, sound effects (`sfx`), model `eleven_text_to_sound_v2`, one
  take each, about 50 credits each (five takes in all: two of the bar bed).
- The connector gives no length setting. Prompts that asked for 20 or 22 seconds came back two seconds long, so the
  page plays these as overlapping grains (about a second each, random start, 0.9 to 1.1 speed, panned), not as loops.
- Re-encoded to 48 kbps mono at 32 kHz: `ffmpeg -i in.mp3 -ac 1 -ar 32000 -b:a 48k -map_metadata -1 out.mp3`.
- No clear words: a local Whisper (faster-whisper) transcript gives only its usual hallucinations on noise ("Thank
  you", "Thanks for watching"), with low confidence.
- How they are used: the drift-city skill, "A room that breathes".
