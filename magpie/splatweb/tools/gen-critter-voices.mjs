#!/usr/bin/env node
// gen-critter-voices.mjs — ONE-OFF generation of critter voice clips via
// the ElevenLabs API. Run locally; the clips are committed as static
// files and the public page never sees the key.
//
//   export ELEVENLABS_API_KEY=...      # never commit or paste into pages
//   node tools/gen-critter-voices.mjs
//
// Writes media/critter-voices/v{voice}-l{line}.mp3 + manifest.json.
// Skips files that already exist, so re-runs only fill gaps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('Set ELEVENLABS_API_KEY first (and revoke it after, if pasted anywhere).');
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'media', 'critter-voices');
fs.mkdirSync(OUT, { recursive: true });

// keep in sync with lib/critters.js CRITTER_LINES
const LINES = [
  'boing!', 'hello hello.', 'I am a small jelly.', 'wheee!', 'banana?',
  'bounce with me!', 'ooh, a visitor.', 'splat splat.', 'tiny thoughts, big hops.',
  'is it snack time?', 'the floor is springy today.', 'I like this room.',
];

// a spread of ElevenLabs premade voices, squeaky → deep, with playful
// settings; swap ids freely (GET /v1/voices lists what the key can use)
const VOICES = [
  { name: 'elli', id: 'MF3mGyEYCl7XYWbV9V6O' },
  { name: 'domi', id: 'AZnzlk1XvdvUeBnXmlld' },
  { name: 'bella', id: 'EXAVITQu4vr4xnSDxMaL' },
  { name: 'antoni', id: 'ErXwobaYiN019PkySvjV' },
  { name: 'josh', id: 'TxGEqnHWrfWFTfGW9XjX' },
];

async function gen(voice, vi, line, li) {
  const file = `v${vi}-l${li}.mp3`;
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) { console.log('skip  ', file); return file; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: line,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.35, similarity_boost: 0.7, style: 0.6 },
    }),
  });
  if (!res.ok) throw new Error(`${voice.name} "${line}": ${res.status} ${await res.text()}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('wrote ', file, `(${voice.name}: "${line}")`);
  return file;
}

const manifest = { voices: VOICES.map(v => v.name), lines: LINES, format: 'v{voice}-l{line}.mp3' };
for (let vi = 0; vi < VOICES.length; vi++) {
  for (let li = 0; li < LINES.length; li++) {
    await gen(VOICES[vi], vi, LINES[li], li);
    await new Promise(r => setTimeout(r, 350));   // gentle rate limiting
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`\ndone: ${VOICES.length}×${LINES.length} clips + manifest.json in media/critter-voices/`);
console.log('Commit the folder; the page auto-detects the manifest and switches from robo-TTS to clips.');
