// Minimal test runner: discovers *.test.js in this directory and runs them.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = readdirSync(__dirname).filter(f => f.endsWith('.test.js'));

// Two styles live here now: the original `export async function run()`
// files, and newer ones written against node:test. Rather than rewrite
// nine working suites, detect and dispatch — a package whose own
// `npm test` fails is not one to publish.
import { spawnSync } from 'node:child_process';

let fail = 0;
for (const file of tests) {
  try {
    const mod = await import(pathToFileURL(join(__dirname, file)).href);
    if (typeof mod.run === 'function') {
      await mod.run();
      console.log(`✔ ${file}`);
      continue;
    }
    // node:test style: it registered its cases on import rather than
    // exporting anything, so hand the file to the runner that owns it.
    const r = spawnSync(process.execPath, ['--test', join(__dirname, file)],
      { encoding: 'utf8' });
    const m = (r.stdout || '').match(/^# pass (\d+)/m);
    if (r.status === 0) {
      console.log(`✔ ${file}${m ? ` (${m[1]})` : ''}`);
    } else {
      console.error(`✖ ${file}:\n${(r.stdout || r.stderr || '').split('\n').filter(l => /^not ok|Error/.test(l)).slice(0, 4).join('\n')}`);
      fail++;
    }
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

