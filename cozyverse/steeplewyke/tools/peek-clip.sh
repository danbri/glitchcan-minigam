#!/bin/sh
# peek-clip.sh <clip.mp4> <out base> <from> <peak> [scale]: a peek from a clip made from a panel's still: <from> to
# <peak> forward, then backward, so the subject comes up and goes down again and the clip starts and ends on frames
# that look like the still. Use tools/peek-window.py for <from> and <peak>. 24 fps, 960 on the long side, VP9 WebM
# and H.264 MP4, no sound. The photo-novel skill ("Peek panels") explains the method.
set -e
f=$1; out=$2; a=$3; b=$4; s=${5:-960:-2}
fc="[0:v]trim=$a:$b,setpts=PTS-STARTPTS,fps=24,scale=$s,split[x][y];[y]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[x][r]concat=n=2:v=1[v]"
ffmpeg -loglevel error -y -i "$f" -filter_complex "$fc" -map "[v]" -an -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 4 "$out.webm"
ffmpeg -loglevel error -y -i "$f" -filter_complex "$fc" -map "[v]" -an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart "$out.mp4"
