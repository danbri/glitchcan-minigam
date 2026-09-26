// plays the story many times with random choices (and random discoveries), checking every run ends and counting endings
import fs from 'node:fs';
import { compileStory } from '../tools/story.mjs';
let story, warnings;
try { ({ story, warnings } = compileStory()); } catch (e) { console.log('COMPILE ERROR', e.message); process.exit(1); }
if (warnings.length) console.log('warnings:', warnings.slice(0, 6).join(' | '));
const places = new Set(JSON.parse(fs.readFileSync(new URL('../src/places.json', import.meta.url), 'utf8')).map((p) => p.id));
const endings = {}, lens = [];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let run = 0; run < 400; run++) {
  story.ResetState();
  let steps = 0, scene = null, hots = [], ended = null, badPlace = null;
  while (steps < 250) {
    while (story.canContinue) {
      const t = story.Continue();
      for (const tag of story.currentTags) {
        const k = tag.split(':')[0].trim(), v = tag.slice(tag.indexOf(':') + 1).trim();
        if (k === 'scene') { scene = v; hots = []; }
        if (k === 'place' && !places.has(v)) badPlace = v;
        if (k === 'hotspot') { const f = v.split('@').map((x) => x.trim()); if (!story.variablesState[f[0]]) hots.push(f[0]); }
      }
      const m = t.match(/THE END: ([A-Z ]+)/); if (m) ended = m[1].trim();
    }
    if (ended || !story.currentChoices.length) break;
    // sometimes look around and find this scene's clue, which refreshes the scene
    if (hots.length && rnd() < 0.6 && scene) { story.variablesState[hots[0]] = true; hots.shift(); story.ChoosePathString(scene); continue; }
    story.ChooseChoiceIndex(Math.floor(rnd() * story.currentChoices.length));
    steps++;
  }
  if (badPlace) console.log('unknown place', badPlace);
  endings[ended || (story.currentChoices.length ? 'still going after 250' : 'stuck')] = (endings[ended || (story.currentChoices.length ? 'still going after 250' : 'stuck')] || 0) + 1;
  lens.push(steps);
}
lens.sort((a, b) => a - b);
console.log('endings over 400 random runs:', JSON.stringify(endings), '| choices per run: median', lens[200], ', 90th percentile', lens[360]);
console.log('compiled story JSON', story.ToJson().length, 'bytes');
