#!/bin/sh
# tiny-loop.sh <clip.mp4> <out base> [seconds]: a short ambient loop from the start of a clip made from a panel's
# still: the first <seconds> (1.6 by default) forward, then backward, so it begins and ends on the still and needs no
# end frame. 24 fps, 960x540 / 720x720 / 540x960 by shape, VP9 WebM and H.264 MP4, no sound.
set -e
f=$1; out=$2; secs=${3:-1.6}
wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f")
w=${wh%,*}; h=${wh#*,}
if [ "$w" -gt "$((h * 13 / 10))" ]; then s=960:540; elif [ "$h" -gt "$((w * 13 / 10))" ]; then s=540:960; else s=720:720; fi
fc="[0:v]trim=0:$secs,setpts=PTS-STARTPTS,fps=24,scale=$s,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1[v]"
ffmpeg -loglevel error -y -i "$f" -filter_complex "$fc" -map "[v]" -an -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 4 "$out.webm"
ffmpeg -loglevel error -y -i "$f" -filter_complex "$fc" -map "[v]" -an -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart "$out.mp4"
