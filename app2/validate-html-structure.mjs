// Validate HTML structure without browser
// Can run in Claude Code web environment

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateHTMLStructure() {
  console.log('📋 Validating app2/index.html structure...\n');

  const html = await readFile(join(__dirname, 'index.html'), 'utf-8');

  const checks = [
    {
      name: 'Has doctype declaration',
      test: () => html.includes('<!DOCTYPE html>')
    },
    {
      name: 'Has app2 experimental badge',
      test: () => html.includes('APP2 - EXPERIMENTAL')
    },
    {
      name: 'Imports gcfink library',
      test: () => html.includes('./gcfink/src/index.js') && html.includes('import {')
    },
    {
      name: 'Has minigame container element',
      test: () => html.includes('id="minigame-container"')
    },
    {
      name: 'Has story container element',
      test: () => html.includes('id="story"')
    },
    {
      name: 'Has choices container element',
      test: () => html.includes('id="choices-container"')
    },
    {
      name: 'Has debug console element',
      test: () => html.includes('id="debug-console"')
    },
    {
      name: 'Loads inkjs from CDN',
      test: () => html.includes('cdn.jsdelivr.net/npm/inkjs')
    },
    {
      name: 'Defines extractFinkFromJsSource import',
      test: () => html.includes('extractFinkFromJsSource')
    },
    {
      name: 'Defines compileInk import',
      test: () => html.includes('compileInk')
    },
    {
      name: 'Has loadFinkFile function',
      test: () => html.includes('async function loadFinkFile')
    },
    {
      name: 'Has launchMinigame function',
      test: () => html.includes('function launchMinigame')
    },
    {
      name: 'Has completeMinigame function',
      test: () => html.includes('function completeMinigame')
    },
    {
      name: 'Has continueStory function',
      test: () => html.includes('function continueStory')
    },
    {
      name: 'Initializes minigame variables',
      test: () => html.includes('minigame_score') && html.includes('variablesState')
    },
    {
      name: 'Has CONFIG object',
      test: () => html.includes('const CONFIG = {')
    },
    {
      name: 'Loads default TOC on init',
      test: () => html.includes('loadFinkFile(CONFIG.DEFAULT_FINK_FILE)')
    },
    {
      name: 'Has mobile viewport meta',
      test: () => html.includes('viewport') && html.includes('user-scalable=no')
    },
    {
      name: 'Has minigame CSS styling',
      test: () => html.includes('.minigame-container') && html.includes('.minigame-demo')
    },
    {
      name: 'Has restart button handler',
      test: () => html.includes("getElementById('story-restart')")
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      if (check.test()) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${check.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Structure Validation: ${passed}/${checks.length} checks passed\n`);

  // Show file stats
  const lines = html.split('\n').length;
  const size = Buffer.byteLength(html, 'utf8');
  console.log('📄 File Statistics:');
  console.log(`   Lines: ${lines}`);
  console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
  console.log(`   Characters: ${html.length}`);

  // Extract key functions
  console.log('\n🔧 Key Functions Found:');
  const functions = html.match(/(?:async )?function \w+\(/g) || [];
  functions.slice(0, 10).forEach(fn => console.log(`   - ${fn.replace('(', '')}`));

  return failed === 0;
}

validateHTMLStructure().then(success => {
  process.exit(success ? 0 : 1);
});
