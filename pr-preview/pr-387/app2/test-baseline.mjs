// Test: Verify existing inklet/app/ still works
// Run before and after app2 changes to ensure no breakage

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function testExistingApp() {
  console.log('Testing existing inklet/app/ entry point...\n');

  const tests = [];

  // Test 1: Verify inklet/app/index.html exists
  tests.push({
    name: 'inklet/app/index.html exists',
    check: async () => {
      const { existsSync } = await import('node:fs');
      return existsSync(join(projectRoot, 'inklet/app/index.html'));
    }
  });

  // Test 2: Verify toc.fink.js exists
  tests.push({
    name: 'inklet/toc.fink.js exists',
    check: async () => {
      const { existsSync } = await import('node:fs');
      return existsSync(join(projectRoot, 'inklet/toc.fink.js'));
    }
  });

  // Test 3: Verify toc.fink.js can be extracted
  tests.push({
    name: 'toc.fink.js extracts valid INK',
    check: async () => {
      const { readFile } = await import('node:fs/promises');
      const { extractFinkFromJsSource } = await import('./gcfink/src/lib/finkExtract.js');

      const finkJs = await readFile(join(projectRoot, 'inklet/toc.fink.js'), 'utf-8');
      const ink = extractFinkFromJsSource(finkJs);

      return ink.includes('main_menu') && ink.includes('episodes_menu');
    }
  });

  // Test 4: Verify modular JS files exist
  tests.push({
    name: 'All inklet/app/ JS modules exist',
    check: async () => {
      const { existsSync } = await import('node:fs');
      const modules = [
        'fink-utils.js',
        'fink-config.js',
        'fink-sandbox.js',
        'fink-ink-engine.js',
        'fink-ui.js',
        'fink-player.js'
      ];
      return modules.every(m => existsSync(join(projectRoot, 'inklet/app', m)));
    }
  });

  // Test 5: Verify fink-config points to toc.fink.js
  tests.push({
    name: 'fink-config.js references toc.fink.js',
    check: async () => {
      const { readFile } = await import('node:fs/promises');
      const config = await readFile(join(projectRoot, 'inklet/app/fink-config.js'), 'utf-8');
      return config.includes('toc.fink.js');
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
testExistingApp().then(success => {
  process.exit(success ? 0 : 1);
});
