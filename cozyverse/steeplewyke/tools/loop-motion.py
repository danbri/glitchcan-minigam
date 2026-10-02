#!/usr/bin/env python3
# loop-motion.py <clip.mp4> <map.png> [gain]: where a loop clip moves, and whether its seam is clean. Writes a map
# (the first frame in grey, the biggest change from it at each pixel in red) and prints the moving area, the mean
# change per frame and the first-against-last difference (the seam). Needs ffmpeg, numpy and Pillow. The photo-novel
# skill says why (two of eight "long loops" moved nothing; one moved a man the prompt said to keep still).
import subprocess, sys
import numpy as np
from PIL import Image
f, out = sys.argv[1], sys.argv[2]
gain = float(sys.argv[3]) if len(sys.argv) > 3 else 4
w = 480
W, H = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                                '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip().split(','))
h = round(H * w / W / 2) * 2
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'],
                     capture_output=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
d = np.abs(v - v[0]).max(0)
step = np.abs(np.diff(v, axis=0)).mean((1, 2))
base = (v[0] // 2).astype(np.uint8)
Image.fromarray(np.stack([np.maximum(base, np.clip(d * gain, 0, 255).astype(np.uint8)), base, base], -1)).save(out)
print(f'{f}: moving area {(d > 20).mean() * 100:.1f} %, mean change per frame {step.mean():.2f}, '
      f'seam {np.abs(v[-1] - v[0]).mean():.2f}')
