// The story for Node tools: reads story/lamplighter.fink.js, captures its ink with the repo's frozen backticks kernel
// (packages/backticks, the same capture the browser runs), and compiles it with the real inkjs compiler.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extractBlocks, firstInkOf } from '../../packages/backticks/src/node.js';

export const STORY_FILE = fileURLToPath(new URL('../story/lamplighter.fink.js', import.meta.url));
const inkjs = createRequire(import.meta.url)('inkjs/full');
export { inkjs };

export function storyInk() {
  const ink = firstInkOf(extractBlocks(fs.readFileSync(STORY_FILE, 'utf8')).blocks);
  if (!ink) throw new Error('no ink captured from ' + STORY_FILE);
  return ink;
}

export function compileStory() {
  const c = new inkjs.Compiler(storyInk());
  try { return { story: c.Compile(), warnings: c.warnings || [] }; }
  catch (e) { throw new Error('story does not compile:\n' + (c.errors || []).join('\n')); }
}

// Tags at the start of every knot, from the compiled story (the story API, not the source text).
export function knotTags(story) {
  const out = {};
  for (const name of story.mainContentContainer.namedContent.keys()) {
    if (name.startsWith('global ')) continue;
    out[name] = story.TagsForContentAtPath(name) || [];
  }
  return out;
}
