# TUBULAR SMELLS — the tape library

## Layout

```
audio/
  the-quiet-engines.mp3            core: the map
  gears-and-birdcalls.mp3          core: default station interior
  the-inexorable-passacaglia.mp3   core: the flight home
  per-station/                     a station's own song (file named after it)
  generic/                         the interior rotation for everywhere else
  HASHES.sha256                    every track's hash — the duplicate check
```

The three core tracks stay where they are — the game falls back to the
MIDI band only if a CORE track can't load; a missing side track just
drops out of rotation.

## Adding tracks

1. Drop files into `per-station/` or `generic/`. MP3 at ~64 kbps is the
   sweet spot (that's what the core three use): decoded PCM costs
   ~0.38 MB/s of RAM whatever the file size, so higher bitrates buy
   little. Keep files as ordinary git blobs — do NOT use git-LFS,
   GitHub Pages serves LFS pointers, not audio.
2. Name `per-station/` files after the station they belong to —
   `canada-water.mp3`, `kings-cross.mp3`. Area names are fine; the
   ingest tool maps them to an exact station on the network (aliases
   for area→station live at the top of the tool).
3. Run `node magpie/robbin/tools/ingest-audio.mjs` from the repo root.
   It hashes everything against HASHES.sha256 (duplicates are reported
   and skipped, never deleted), maps filenames to stations, and
   regenerates `robbin-tracks.js`. Unmappable names are listed for a
   human decision.

## How the game chooses

- Map: THE QUIET ENGINES. Flight home: THE INEXORABLE PASSACAGLIA.
- Inside a station WITH its own song: the song, two visits in three;
  the third visit takes a generic track so long sessions don't wear a
  groove.
- Inside any other station: rotation through `generic/` plus GEARS AND
  BIRDCALLS, varied per station and visit.
- At most two decoded tracks stay in RAM (LRU); compressed bytes are
  cached so nothing is ever re-downloaded.
