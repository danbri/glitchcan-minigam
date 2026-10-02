#!/bin/sh
# voices-post.sh <dir of raw takes>: every <id>-<k>.mp3 to v2/media/vo/, mono at 96 kbit/s (the first set was 64,
# chosen for size alone). Gerald's tannoy lines (p1c-1, p1c-2) go through an old field loudspeaker first: a narrow
# band, hard compression and a short slap of echo off the marquee. Takes for line ids no longer in voices.json are
# removed from media/vo.
set -e
SRC=$1; OUT=$(dirname "$0")/../v2/media/vo
mkdir -p "$OUT"
TANNOY="highpass=f=380,lowpass=f=3300,acompressor=threshold=-24dB:ratio=8:attack=5:release=80,aecho=0.8:0.55:85|170:0.32|0.18,volume=1.6"
for f in "$SRC"/*.mp3; do
  b=$(basename "$f")
  case $b in p1c-1-*|p1c-2-*) af="-af $TANNOY";; *) af="";; esac
  ffmpeg -loglevel error -y -i "$f" $af -ac 1 -b:a 96k "$OUT/$b"
done
ids=$(node -e "console.log(Object.keys(require('$(cd "$(dirname "$0")/.." && pwd)/v2/voices.json').lines).join(' '))")
for f in "$OUT"/*.mp3; do
  id=$(basename "$f" .mp3); id=${id%-*}
  case " $ids " in *" $id "*) ;; *) rm "$f"; echo "removed stale $f";; esac
done
