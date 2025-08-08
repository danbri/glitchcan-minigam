// Minimal test runner: discovers *.test.js in this directory and runs them.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = readdirSync(__dirname).filter(f => f.endsWith('.test.js'));

let fail = 0;
for (const file of tests) {
  try {
    const mod = await import(pathToFileURL(join(__dirname, file)).href);
    if (typeof mod.run !== 'function') {
      console.error(`✖ ${file}: no run() export`);
      fail++;
      continue;
    }
    await mod.run();
    console.log(`✔ ${file}`);
  } catch (e) {
    console.error(`✖ ${file}:`, e && e.stack || e);
    fail++;
  }
}

if (fail > 0) {
  console.error(`\n${fail} test file(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll tests passed');
}

