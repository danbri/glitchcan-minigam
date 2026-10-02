#!/usr/bin/env python3
# peek-window.py <clip.mp4>: when the one event in a clip comes and goes, and where in the frame it is, for a "peek"
# panel. Prints JSON: {from, peak, to, at, cell, peakChange, restChange}. "from" is the last frame before the event,
# "peak" the frame where it is largest, "to" the first frame after it where the change is back near rest (null when
# it never goes back: then cut with tools/peek-clip.sh, which plays from..peak and back). "at" is the event's centre
# in % of the frame. Needs ffmpeg. The photo-novel skill ("Peek panels") explains the method and why the change is
# measured per cell, not over the whole frame.
import json, subprocess, sys
f = sys.argv[1]; W, H, fps = 320, 180, 24; CW, CH = 40, 36  # an 8x5 grid of cells
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-vf', f'fps={fps},scale={W}:{H},format=gray',
                      '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
n = len(raw) // (W * H)
frames = [raw[i * W * H:(i + 1) * W * H] for i in range(n)]
base = frames[0]
def cell_diff(fr, cx, cy):
    s = 0
    for y in range(cy * CH, (cy + 1) * CH):
        o = y * W + cx * CW
        s += sum(abs(a - b) for a, b in zip(fr[o:o + CW], base[o:o + CW]))
    return s / (CW * CH)
cells = [(cx, cy) for cy in range(H // CH) for cx in range(W // CW)]
# the cell that changes most at any moment is where the event is; a small subject is lost in a whole-frame average
curves = {c: [cell_diff(fr, *c) for fr in frames] for c in cells}
cell = max(cells, key=lambda c: max(curves[c]))
d = curves[cell]
peak = max(range(n), key=lambda i: d[i])
rest = sorted(d)[len(d) // 10]  # the quiet level (grain, compression)
th = rest + (d[peak] - rest) * 0.2
a = peak
while a > 0 and d[a] > th: a -= 1
b = peak
while b < n - 1 and d[b] > th: b += 1
back = d[b] <= th
fr = frames[peak]; sx = sy = m = 0
for y in range(H):
    for x in range(W):
        v = abs(fr[y * W + x] - base[y * W + x])
        if v > 25: sx += x * v; sy += y * v; m += v
at = [round(100 * sx / m / W, 1), round(100 * sy / m / H, 1)] if m else [50, 50]
print(json.dumps({'from': round(a / fps, 2), 'peak': round(peak / fps, 2), 'to': round(b / fps, 2) if back else None,
                  'at': at, 'cell': list(cell), 'peakChange': round(d[peak], 1),
                  'restChange': [round(d[a], 1), round(d[b], 1)], 'frames': n}))
