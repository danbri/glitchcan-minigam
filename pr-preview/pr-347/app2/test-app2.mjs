// Test: Verify app2 works correctly
// Tests FINK extraction, INK compilation, and minigame integration

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testApp2() {
  console.log('Testing app2 FINK + Minigame integration...\n');

  const tests = [];

  // Test 1: app2/index.html exists
  tests.push({
    name: 'app2/index.html exists',
    check: async () => {
      const { existsSync } = await import('node:fs');
      return existsSync(join(__dirname, 'index.html'));
    }
  });

  // Test 2: app2/toc.fink.js exists
  tests.push({
    name: 'app2/toc.fink.js exists',
    check: async () => {
      const { existsSync } = await import('node:fs');
      return existsSync(join(__dirname, 'toc.fink.js'));
    }
  });

  // Test 3: Extract INK from app2/toc.fink.js
  tests.push({
    name: 'Extract INK from app2/toc.fink.js',
    check: async () => {
      const { extractFinkFromJsSource } = await import('./gcfink/src/lib/finkExtract.js');
      const finkJs = await readFile(join(__dirname, 'toc.fink.js'), 'utf-8');
      const ink = extractFinkFromJsSource(finkJs);
      return ink.includes('main_menu') && ink.includes('minigame_demos');
    }
  });

  // Test 4: Compile INK from app2/toc.fink.js (Node environment - no inkjs)
  tests.push({
    name: 'Compile app2/toc.fink.js with stub compiler',
    check: async () => {
      try {
        const { compileInk } = await import('./gcfink/src/lib/inkEngine.js');
        const { extractFinkFromJsSource } = await import('./gcfink/src/lib/finkExtract.js');

        const finkJs = await readFile(join(__dirname, 'toc.fink.js'), 'utf-8');
        const ink = extractFinkFromJsSource(finkJs);

        // Create stub compiler for Node testing
        const stubCompiler = (source) => {
          if (!source || source.length < 10) {
            throw new Error('Invalid INK source');
          }
          return { /* stub story object */ };
        };

        const result = compileInk(ink, { compilerImpl: stubCompiler });
        return result.ok === true;
      } catch (error) {
        console.error('  Compilation error:', error.message);
        return false;
      }
    }
  });

  // Test 5: Verify MINIGAME tags in app2/toc.fink.js
  tests.push({
    name: 'app2/toc.fink.js contains MINIGAME tags',
    check: async () => {
      const { extractFinkFromJsSource } = await import('./gcfink/src/lib/finkExtract.js');
      const finkJs = await readFile(join(__dirname, 'toc.fink.js'), 'utf-8');
      const ink = extractFinkFromJsSource(finkJs);
      return ink.includes('# MINIGAME:') && ink.includes('simple-score');
    }
  });

  // Test 6: Verify minigame state variables in app2/toc.fink.js
  tests.push({
    name: 'app2/toc.fink.js defines minigame state variables',
    check: async () => {
      const { extractFinkFromJsSource } = await import('./gcfink/src/lib/finkExtract.js');
      const finkJs = await readFile(join(__dirname, 'toc.fink.js'), 'utf-8');
      const ink = extractFinkFromJsSource(finkJs);
      return ink.includes('{minigame_score}') && ink.includes('{collected_items}');
    }
  });

  // Test 7: Verify app2/index.html imports gcfink
  tests.push({
    name: 'app2/index.html imports gcfink library',
    check: async () => {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      return html.includes('./gcfink/src/index.js') && html.includes('import {');
    }
  });

  // Test 8: Verify app2/index.html has minigame container
  tests.push({
    name: 'app2/index.html has minigame container',
    check: async () => {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      return html.includes('minigame-container') && html.includes('launchMinigame');
    }
  });

  // Test 9: Verify app2 badge present
  tests.push({
    name: 'app2/index.html shows experimental badge',
    check: async () => {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      return html.includes('APP2 - EXPERIMENTAL');
    }
  });

  // Test 10: Verify existing inklet/app unchanged
  tests.push({
    name: 'Existing inklet/app/index.html unchanged',
    check: async () => {
      const { existsSync } = await import('node:fs');
      const html = await readFile(join(__dirname, '../inklet/app/index.html'), 'utf-8');
      // Should NOT have app2 badge
      return existsSync(join(__dirname, '../inklet/app/index.html')) && !html.includes('APP2');
    }
  });

  // Run tests
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.check();
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - returned false`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  return failed === 0;
}

// Run tests
testApp2().then(success => {
  process.exit(success ? 0 : 1);
});
