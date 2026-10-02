// The full picture prompt for each panel: the house style, the place, and the panel prompt with each cast name
// (QUAILE, SAM ...) replaced by that person's 'look' and the number of their reference photograph, from bible/characters.json. The reference sheets for the cast
// are wired into the same generation, so the words and the photograph describe the same person.
//   STORY=ch2 node cozyverse/steeplewyke/tools/prompts.mjs            (JSON: [{ id, ratio, cast, prompt }])
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bible = JSON.parse(readFileSync(join(root, 'bible/characters.json'), 'utf8'));
// the chapter folder: STORY=ch2 (default: chapter 1's pages.json at the top)
const book = JSON.parse(readFileSync(join(root, process.env.STORY || '.', 'pages.json'), 'utf8'));
const { pages } = book;
const look = Object.fromEntries(bible.characters.map((c) => [c.id.toUpperCase(), c]));
const out = [];
for (const p of pages) for (const panel of p.panels) {
  let text = panel.prompt;
  panel.cast.forEach((id, k) => {
    const c = look[id.toUpperCase()];
    text = text.replace(new RegExp(`\\b${id.toUpperCase()}\\b`, 'g'), `the person in reference photograph ${k + 1} (${c.look})`);
  });
  const refs = panel.cast.length ? ` The people must match their reference sheets exactly: same face, hair, age, build and clothes.` : '';
  out.push({ id: `p${p.n}-${panel.knot}`, ratio: panel.ratio, cast: panel.cast,
    prompt: `${bible.style} ${book.place || bible.place} ${text}${refs}` });
}
console.log(JSON.stringify(out, null, 1));
