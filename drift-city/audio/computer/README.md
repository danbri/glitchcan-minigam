# The ship's computer: guided-flight narration

Twenty clips, `00.mp3` to `19.mp3`, one per entry of `GUIDE_LINES` in `src/guide.js`, in the same order. The page plays
them in Menu > Guided flight (lines 0 to 9) and Menu > Full tour (line 10, most of 1 to 8, lines 11 to 19, and 9 at
the end), and shows the same words as a caption.

- Made September 2026 with the ElevenLabs connector (text to speech), model `eleven_v3`, one take per line. The first
  ten were made with `eleven_multilingual_v2` and made again with `eleven_v3` when the full tour was added: the owner
  asked for the newest model every time. `eleven_v4` is listed by the connector but refused ("needs an access grant
  this workspace does not have"), so `eleven_v3` is the newest this workspace can use.
- Voice: "Barny - Neutral, Measured, Professional" (ElevenLabs library voice `Z4PTrXjozXIfS7qbVx4X`, British English,
  middle-aged male), picked for a ship's computer: plain, level, not theatrical. No direction tags.
- Cost: about 3,100 credits for the twenty clips with `eleven_v3`.
- Re-encoded to 48 kbps mono at 32 kHz with ffmpeg:
  `ffmpeg -i in.mp3 -ac 1 -ar 32000 -b:a 48k -map_metadata -1 out.mp3`.
- Durations (ffprobe, seconds) are copied into `GUIDE_DUR` in `src/guide.js`: the caption uses them when the sound
  is off or the browser blocks playback.
- Checked by machine: a local Whisper transcript of lines 11, 14 and 18 matches the text. Nobody has listened to them
  inside this pipeline.

- Lines 05, 11, 12 and 18 were made again (September 2026) after text changes: the pagoda's flames now come from
  an unlicensed oxygen store, the tour no longer names the Asters' language, and the Life line names the neighbour
  colours and the glider guns. A local Whisper transcript (faster-whisper, base.en) of the four matches the text.

To change a line: change its text in `GUIDE_LINES`, generate it again with the same voice and model, re-encode, put
it at the same number, and update its `GUIDE_DUR` entry.
