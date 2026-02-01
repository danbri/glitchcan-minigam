// Test INK's backslash escape for //
import { readFileSync } from 'fs';

const inkjsPath = '../third_party/ink/ink-full.js';
const inkjsCode = readFileSync(inkjsPath, 'utf-8');
eval(inkjsCode);

const tests = [
    `# FINK: https:\\/\\/example.com/story.fink.js`,
    `# FINK: https:\\\\/\\\\/example.com/story.fink.js`,
    `# FINK: https:\\/example.com/story.fink.js`,
];

console.log('=== Testing backslash escape ===\n');

for (const tag of tests) {
    const content = `${tag}\n-> start\n=== start ===\nHi\n+ [x] -> END`;
    console.log(`Input:  ${tag}`);
    try {
        const compiler = new inkjs.Compiler(content);
        const story = compiler.Compile();
        console.log(`Output: ${story.globalTags?.[0] || '(none)'}`);
    } catch (e) {
        console.log(`Error:  ${e.message}`);
    }
    console.log('');
}
