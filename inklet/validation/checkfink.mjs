#!/usr/bin/env node
/**
 * checkfink.mjs - Unified INK/FINK Validator
 * -------------------------------------------
 * Usage:
 *   node checkfink.mjs [files...]
 *   node checkfink.mjs --scan     # Find and validate all INK/FINK files in repo
 *
 * • .ink files  → Direct compilation with ink-full.js
 * • .json files → Load pre-compiled story and test
 * • .fink.js files → sigil capture in a sandbox (finkcore), then compilation
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

// ── FINK validation ───────────────────────────────────────────────────
// A .fink.js is JavaScript: finkcore runs it in a sandbox (node:vm) and
// captures its ink sigils, then the real compiler compiles the result. This
// is the story runner's own load path; the browser page it used before ran
// the old host-page engine, which is gone.
const { extractFinkFromJsSource } = await import(
  pathToFileURL(path.join(here, '../../packages/finkcore/src/lib/finkExtract.js')).href
);

async function validateFinkFile(filePath) {
  let inkSrc = '';
  try {
    inkSrc = extractFinkFromJsSource(await fs.readFile(filePath, 'utf8'));
  } catch (e) {
    console.error(`✗ FAIL  ${filePath}`);
    console.error(`   ↳ extraction: ${e.message}`);
    return false;
  }
  if (!inkSrc.trim()) {
    console.error(`✗ FAIL  ${filePath}`);
    console.error('   ↳ no ink content extracted');
    return false;
  }
  const compiler = new Compiler(inkSrc);
  try {
    const story = compiler.Compile();
    let out = '';
    while (story.canContinue && out.length < 200) out += story.Continue();
    console.log(`✓ PASS  ${filePath}`);
    console.log(`   ↳ Extracted ${inkSrc.length} chars of INK content`);
    if (out) console.log(`   ↳ Output: ${JSON.stringify(out.slice(0, 100))}${out.length > 100 ? '...' : ''}`);
    return true;
  } catch (e) {
    console.error(`✗ FAIL  ${filePath}`);
    for (const err of (compiler.errors && compiler.errors.length ? compiler.errors : [e.message])) {
      console.error(`   ↳ ${err}`);
    }
    return false;
  }
}

// ── Repository scanning ──────────────────────────────────────────────────────────────────
async function scanRepo() {
  const projectRoot = path.resolve(here, '../..');
  const files = [];
  
  async function scanDirectory(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectRoot, fullPath);
        
        // Skip common ignore patterns
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') {
          continue;
        }
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.name.endsWith('.ink') || entry.name.endsWith('.fink.js') || entry.name.endsWith('.json')) {
          // Only include JSON files that look like INK stories
          if (entry.name.endsWith('.json')) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const json = JSON.parse(content);
              // Compiled Ink always carries inkVersion. Do NOT accept a bare
              // `root` key — Lucid SDF scenes have one too, and matching it
              // once dragged 100+ scene files into the scan as failures.
              if (json && json.inkVersion) {
                files.push(relativePath);
              }
            } catch {
              // Skip invalid JSON files
            }
          } else {
            files.push(relativePath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  await scanDirectory(projectRoot);
  return files.sort();
}

// ── tiny helper to drive a Story to completion ─────────────────────────
function runStory(story) {
  const out = [];
  while (story.canContinue) out.push(story.Continue().trimEnd());
  return out.join('\n');
}

// ── validator ----------------------------------------------------------
async function validateFile(file) {
  try {
    if (file.endsWith('.fink.js')) {
      return await validateFinkFile(file);
    }
    
    let story;
    if (file.endsWith('.json')) {
      const json = JSON.parse(await fs.readFile(file, 'utf8'));
      story = new Story(json);
    } else if (file.endsWith('.ink')) {
      const src = await fs.readFile(file, 'utf8');
      const compiler = new Compiler(src, null);
      try {
        story = compiler.Compile();
      } catch (e) {
        // If the compiler throws, prefer structured errors if present
        if (compiler?.errors?.length) {
          console.error(`✗ FAIL  ${file}`);
          compiler.errors.forEach(err => console.error(`   ↳ ${err}`));
          if (compiler.warnings && compiler.warnings.length) {
            console.warn(`   ⚠ Warnings:`);
            compiler.warnings.forEach(w => console.warn(`     - ${w}`));
          }
          return false;
        }
        throw e; // fall back to outer catch
      }

      // Even if no exception, check collected diagnostics
      if (compiler.errors && compiler.errors.length) {
        console.error(`✗ FAIL  ${file}`);
        compiler.errors.forEach(err => console.error(`   ↳ ${err}`));
        if (compiler.warnings && compiler.warnings.length) {
          console.warn(`   ⚠ Warnings:`);
          compiler.warnings.forEach(w => console.warn(`     - ${w}`));
        }
        return false;
      }

      if (compiler.warnings && compiler.warnings.length) {
        console.warn(`⚠ WARN  ${file}`);
        compiler.warnings.forEach(w => console.warn(`   - ${w}`));
      }
    } else {
      throw new Error('Unsupported extension (expected .ink, .json, or .fink.js)');
    }

    const output = runStory(story);
    console.log(`✓ PASS  ${file}\n   ↳ Output: ${JSON.stringify(output)}`);
    return true;
  } catch (err) {
    console.error(`✗ FAIL  ${file}\n   ↳ ${err.message}`);
    return false;
  }
}

// ── entry point --------------------------------------------------------
const args = process.argv.slice(2);

try {
  if (args.length === 0) {
    // fallback demo
    console.log('Usage: node checkfink.mjs [files...] | --scan');
    console.log('\nDemo:');
    const demoSrc = `=== main ===\nHello, world!\n-> END`;
    const demo = new Compiler(demoSrc, null).Compile();
    console.log(runStory(demo));
  } else if (args[0] === '--scan') {
    console.log('🔍 Scanning repository for INK/FINK files...');
    const files = await scanRepo();
    console.log(`Found ${files.length} files:\n${files.map(f => '  ' + f).join('\n')}\n`);
    
    const projectRoot = path.resolve(here, '../..');
    const results = [];
    for (const file of files) {
      const fullPath = path.resolve(projectRoot, file);
      const success = await validateFile(fullPath);
      results.push(success);
    }
    
    const passed = results.filter(Boolean).length;
    const failed = results.length - passed;
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    process.exit(failed > 0 ? 1 : 0);
  } else {
    const results = [];
    for (const file of args) {
      const success = await validateFile(file);
      results.push(success);
    }
    
    const passed = results.filter(Boolean).length;
    const failed = results.length - passed;
    
    if (results.length > 1) {
      console.log('\n📊 Summary:');
      console.log(`   ✅ Passed: ${passed}`);
      console.log(`   ❌ Failed: ${failed}`);
    }
    
    process.exit(failed > 0 ? 1 : 0);
  }
} finally {
  /* nothing to close */
}
