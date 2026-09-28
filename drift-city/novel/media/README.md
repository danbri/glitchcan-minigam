# Novel page media: the Lantern Cellar

| file | what | made by |
|---|---|---|
| cellar-arrival.jpg, cellar-singer-horn.jpg, street-snow.jpg | stills | tiles cut from an image the owner made with ChatGPT from a Drift city screenshot (September 2026), scaled 2x |
| cellar-lantern-loop.mp4 / .webm | the moving panel, 720x720, 34.5 s loop, no sound | two Kling 3.0 Pro image-to-video takes (ElevenLabs connector) from another tile of that image, joined with ffmpeg |
| cellar-lantern-poster.jpg | the loop's first frame | ffmpeg |

- The loop: take 1 (start and end frame the same still; she barely moves), then take 2 (start frame only; she taps
  time, nods, sways) forward, back to its tapping part, forward again, then backward to the start. Every join meets
  at matching frames. A slow zoom and drift (7.5% at most) spans the whole loop and returns to its start. Cost:
  about 10,860 ElevenLabs credits for the two takes.
- The people in these images are generated, not real people.
- H.264 for Safari and most browsers; VP9 WebM as a second source for browsers without H.264 (open-source Chromium).
