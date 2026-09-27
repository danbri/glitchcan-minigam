// The stories for Node tools: reads a story file (default story/lamplighter.fink.js; all of them in STORY_FILES), captures its ink with the repo's frozen backticks kernel
// (packages/backticks, the same capture the browser runs), and compiles it with the real inkjs compiler.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extractBlocks, firstInkOf } from '../../packages/backticks/src/node.js';

export const STORY_FILE = fileURLToPath(new URL('../story/lamplighter.fink.js', import.meta.url));
export const STORY_FILES = ['lamplighter', 'peraspera'].map((n) => fileURLToPath(new URL('../story/' + n + '.fink.js', import.meta.url)));
const inkjs = createRequire(import.meta.url)('inkjs/full');
export { inkjs };

export function storyInk(file = STORY_FILE) {
  const ink = firstInkOf(extractBlocks(fs.readFileSync(file, 'utf8')).blocks);
  if (!ink) throw new Error('no ink captured from ' + file);
  return ink;
}

export function compileStory(file = STORY_FILE) {
  const c = new inkjs.Compiler(storyInk(file));
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
