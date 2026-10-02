#!/bin/sh
# enc.sh <loop.mp4> <outdir>: 24 fps, 960x540 (or 720x720 when square), VP9 WebM and H.264 MP4, no sound
f=$1; OUT=$2; b=$(basename ${f%.mp4})
w=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $f)
case $w in 1440,1440|1080,1080) s=720:720;; *) s=960:540;; esac
ffmpeg -loglevel error -y -i $f -an -vf scale=$s,fps=24 -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 4 $OUT/$b.webm
ffmpeg -loglevel error -y -i $f -an -vf scale=$s,fps=24 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart $OUT/$b.mp4
