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
 * • .fink.js files → Puppeteer-based validation via browser execution
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

// ── FINK validation via Puppeteer ─────────────────────────────────────
import puppeteer from 'puppeteer';

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--allow-file-access-from-files']
    });
  }
  return browserInstance;
}

async function validateFinkFile(filePath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('file://') || url.startsWith('data:')) {
        request.continue();
      } else {
        request.abort();
      }
    });
    
    const finkContent = await fs.readFile(filePath, 'utf8');
    const validationHtmlPath = pathToFileURL(path.join(here, 'validate-fink.html')).href;
    
    await page.goto(validationHtmlPath);
    await page.waitForFunction(() => window.validatorReady === true, { timeout: 10000 });
    
    const result = await page.evaluate(async (content, fileName) => {
      return await window.validateFinkContent(content, fileName);
    }, finkContent, path.basename(filePath));
    
    if (result.success) {
      console.log(`✓ PASS  ${filePath}`);
      console.log(`   ↳ Extracted ${result.extractedInkLength} chars of INK content`);
      if (result.compilationOutput) {
        const preview = result.compilationOutput.substring(0, 100);
        console.log(`   ↳ Output: ${JSON.stringify(preview)}${result.compilationOutput.length > 100 ? '...' : ''}`);
      }
    } else {
      console.error(`✗ FAIL  ${filePath}`);
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.error(`   ↳ ${error}`);
        });
      }
    }
    
    return result.success;
    
  } finally {
    await page.close();
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
              // Check if it looks like an INK story JSON
              if (json && (json.inkVersion || json.root || json.listDefs)) {
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
      story = new Compiler(src, null).Compile();  // returns Story
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
  if (browserInstance) {
    await browserInstance.close();
  }
}