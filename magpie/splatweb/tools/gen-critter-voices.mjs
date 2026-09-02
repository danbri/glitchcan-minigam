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

const KEY = process.env.ELEVENLABS_TRIBBLEHOPPERGLADE_APIKEY || process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('Set ELEVENLABS_TRIBBLEHOPPERGLADE_APIKEY first.');
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
// accents tend British (owner request, Sept 2026): dorothy/george/daniel
// replaced the US domi/antoni/josh premades
const VOICES = [
  { name: 'elli', id: 'MF3mGyEYCl7XYWbV9V6O' },
  { name: 'dorothy', id: 'ThT5KcBeYPX3keUQqHPh' },
  { name: 'bella', id: 'EXAVITQu4vr4xnSDxMaL' },
  { name: 'george', id: 'JBFqnCBsd6RMkjVDRZzb' },
  { name: 'daniel', id: 'onwK4e9ZLuTAKqWW03F9' },
];

// TTS respellings — 'boing' reads as 'Boeing' otherwise
const SPELL = { 'boing!': 'boyoyoing!', 'Boing.': 'boyoyoing!' };

async function gen(voice, vi, line, li) {
  const file = `v${vi}-l${li}.mp3`;
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) { console.log('skip  ', file); return file; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: SPELL[line] || line,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.35, similarity_boost: 0.7, style: 0.6 },
    }),
  });
  if (!res.ok) throw new Error(`${voice.name} "${line}": ${res.status} ${await res.text()}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('wrote ', file, `(${voice.name}: "${line}")`);
  return file;
}

// short exclamations for being flung and for landing
const THROWS = ['Wheeee!', 'Waaah!', 'Eeeep!'];
const LANDS = ['Oof!', 'Boing.', 'Ouf, hello ground.'];

async function genNamed(voice, vi, text, file) {
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) { console.log('skip  ', file); return; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: SPELL[text] || text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.3, similarity_boost: 0.7, style: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`${voice.name} "${text}": ${res.status} ${await res.text()}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('wrote ', file, `(${voice.name}: "${text}")`);
}

// simple toki pona chatter (see ../../tokitokipona) — v{voice}-k{i}.mp3
const TOKI = ['toki!', 'pona!', 'mi tawa!', 'musi pona!', 'sina pona.', 'mi pilin pona.'];

const manifest = { voices: VOICES.map(v => v.name), lines: LINES, throws: THROWS, lands: LANDS, toki: TOKI,
  format: 'v{voice}-l{line}.mp3, v{voice}-t{i}.mp3, v{voice}-d{i}.mp3, v{voice}-k{i}.mp3' };
for (let vi = 0; vi < VOICES.length; vi++) {
  for (let li = 0; li < LINES.length; li++) {
    await gen(VOICES[vi], vi, LINES[li], li);
    await new Promise(r => setTimeout(r, 350));   // gentle rate limiting
  }
  for (let i = 0; i < THROWS.length; i++) {
    await genNamed(VOICES[vi], vi, THROWS[i], `v${vi}-t${i}.mp3`);
    await new Promise(r => setTimeout(r, 350));
  }
  for (let i = 0; i < LANDS.length; i++) {
    await genNamed(VOICES[vi], vi, LANDS[i], `v${vi}-d${i}.mp3`);
    await new Promise(r => setTimeout(r, 350));
  }
  for (let i = 0; i < TOKI.length; i++) {
    await genNamed(VOICES[vi], vi, TOKI[i], `v${vi}-k${i}.mp3`);
    await new Promise(r => setTimeout(r, 350));
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`\ndone: ${VOICES.length}×${LINES.length} clips + manifest.json in media/critter-voices/`);
console.log('Commit the folder; the page auto-detects the manifest and switches from robo-TTS to clips.');
