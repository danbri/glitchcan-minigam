#!/usr/bin/env python3
# takes-check.py <dir of takes> [voices.json]: which voice takes to listen to first. For each take, seconds of speech
# per character of the page text, compared with the median for its speaker. A take much longer than its speaker's
# usual pace may have read an audio tag aloud or added a laugh; a much shorter one may have dropped words. Prints the
# outliers, longest first. Needs ffprobe. The photo-novel skill explains why (four of four long outliers were laughs).
# --words also transcribes every take on this machine (faster-whisper, base.en; pip install faster-whisper) and
# lists takes whose words differ from the page text: a direction tag read aloud, a word dropped or changed.
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
if '--words' in sys.argv:
    import difflib, re
    from faster_whisper import WhisperModel
    model = WhisperModel('base.en', device='cpu', compute_type='int8')
    NUM = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
    norm = lambda t: [NUM.get(w, w) for w in re.findall(r"[a-z0-9']+", t.lower().replace("'s", ""))]
    bad = []
    for f, who, d, _ in rows:
        lid = f[:-4].rsplit('-', 1)[0]
        heard = ' '.join(x.text for x in model.transcribe(os.path.join(src, f))[0])
        a, b = norm(voices[lid]['text']), norm(heard)
        r = difflib.SequenceMatcher(None, a, b).ratio()
        extra = [w for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes() if op in ('insert', 'replace') for w in b[j1:j2]]
        if r < 0.85 or len(extra) > 2: bad.append((r, f, ' '.join(extra), heard.strip()))
    for r, f, extra, heard in sorted(bad): print(f'{r:4.2f}  {f:24} extra: {extra!r:40} heard: {heard}')
    print(f'{len(bad)} takes whose words differ from the text')
