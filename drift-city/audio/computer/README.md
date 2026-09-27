# The ship's computer: guided-flight narration

Ten clips, `00.mp3` to `09.mp3`, one per entry of `GUIDE_LINES` in `src/guide.js`, in the same order. The page plays
them in Menu > Guided flight and shows the same words as a caption.

- Made September 2026 with the ElevenLabs connector (text to speech), model `eleven_multilingual_v2`, one take per
  line, no retakes.
- Voice: "Barny - Neutral, Measured, Professional" (ElevenLabs library voice `Z4PTrXjozXIfS7qbVx4X`, British English,
  middle-aged male), picked for a ship's computer: plain, level, not theatrical.
- Cost: about 1,690 credits for the ten clips.
- Re-encoded to 48 kbps mono at 32 kHz with ffmpeg (2.2 MB down to 764 KB):
  `ffmpeg -i in.mp3 -ac 1 -ar 32000 -b:a 48k -map_metadata -1 out.mp3`.
- Durations (ffprobe, seconds) are copied into `GUIDE_DUR` in `src/guide.js`: the caption uses them when the sound
  is off or the browser blocks playback.
- Nobody has listened to these clips inside this pipeline. Listen before trusting a new one.

To change a line: change its text in `GUIDE_LINES`, generate it again with the same voice and model, re-encode, put
it at the same number, and update its `GUIDE_DUR` entry.
