#!/usr/bin/env python3
# takes-check.py <dir of takes> [voices.json]: which voice takes to listen to first. For each take, seconds of speech
# per character of the page text, compared with the median for its speaker. A take much longer than its speaker's
# usual pace may have read an audio tag aloud or added a laugh; a much shorter one may have dropped words. Prints the
# outliers, longest first. Needs ffprobe. The photo-novel skill explains why (four of four long outliers were laughs).
import json, os, statistics, subprocess, sys
src = sys.argv[1]
voices = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'ch2/voices.json'))['lines']
rows = []
for f in sorted(os.listdir(src)):
    if not f.endswith('.mp3'): continue
    lid = f[:-4].rsplit('-', 1)[0]
    if lid not in voices: continue
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(src, f)],
                             capture_output=True, text=True).stdout or 0)
    rows.append((f, voices[lid]['speaker'], d, d / max(1, len(voices[lid]['text']))))
med = {s: statistics.median([r[3] for r in rows if r[1] == s]) for s in {r[1] for r in rows}}
odd = sorted([(r[3] / med[r[1]], r) for r in rows if r[3] > 1.6 * med[r[1]] or r[3] < 0.6 * med[r[1]]], reverse=True)
for k, (f, who, d, _) in odd: print(f'{k:4.2f}x  {f:24} {who:9} {d:5.1f} s')
print(f'{len(rows)} takes, {len(odd)} to listen to first')
