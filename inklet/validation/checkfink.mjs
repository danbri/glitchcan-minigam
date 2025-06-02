#!/usr/bin/env node
/**
 * validateInk.mjs
 * -------------------------------------------
 * Usage:
 *   node --enable-source-maps validateInk.mjs [files...]
 *
 * • If the argument ends in .ink  → read as plaintext, compile, then run.
 * • If it ends in .json          → load as pre-compiled story and run.
 * • With no args it just runs an inline “Hello, world!”.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── load local InkJS bundle (named exports!) ───────────────────────────
const here = path.dirname(fileURLToPath(import.meta.url));
const ink  = await import(
  pathToFileURL(path.join(here, 'vendor', 'ink-full.mjs')).href
);
const { Compiler, Story } = ink;

// ── tiny helper to drive a Story to completion ─────────────────────────
function runStory(story) {
  const out = [];
  while (story.canContinue) out.push(story.Continue().trimEnd());
  return out.join('\n');
}

// ── validator ----------------------------------------------------------
async function validateFile(file) {
  try {
    let story;
    if (file.endsWith('.json')) {
      const json = JSON.parse(await fs.readFile(file, 'utf8'));
      story = new Story(json);
    } else if (file.endsWith('.ink')) {
      const src   = await fs.readFile(file, 'utf8');
      story = new Compiler(src, null).Compile();  // returns Story
    } else {
      throw new Error('Unsupported extension');
    }

    const output = runStory(story);
    console.log(`✓ PASS  ${file}\n   ↳ Output: ${JSON.stringify(output)}`);
  } catch (err) {
    console.error(`✗ FAIL  ${file}\n   ↳ ${err.message}`);
  }
}

// ── entry point --------------------------------------------------------
const files = process.argv.slice(2);

if (files.length === 0) {
  // fallback demo
  const demoSrc = `=== main ===\nHello, world!\n-> END`;
  const demo = new Compiler(demoSrc, null).Compile();
  console.log(runStory(demo));
} else {
  await Promise.all(files.map(validateFile));
}
