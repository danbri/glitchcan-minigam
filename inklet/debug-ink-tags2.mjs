// Debug script to trace INK tag parsing at different stages
import { readFileSync } from 'fs';

// Load inkjs
const inkjsPath = '../third_party/ink/ink-full.js';
const inkjsCode = readFileSync(inkjsPath, 'utf-8');
eval(inkjsCode);

// Test cases
const testCases = [
    { name: "Full URL", content: `# FINK: https://example.com/story.fink.js\n-> start\n=== start ===\nHello.\n+ [x] -> END` },
    { name: "No slashes", content: `# FINK: example.com/story.fink.js\n-> start\n=== start ===\nHello.\n+ [x] -> END` },
    { name: "Single slash", content: `# FINK: /path/to/story.fink.js\n-> start\n=== start ===\nHello.\n+ [x] -> END` },
    { name: "Escaped", content: `# FINK: https:ESCAPED_SLASHexample.com/story.fink.js\n-> start\n=== start ===\nHello.\n+ [x] -> END` },
];

console.log('=== INK TAG PARSING TEST ===\n');

for (const tc of testCases) {
    console.log(`--- ${tc.name} ---`);
    console.log(`Input tag line: ${tc.content.split('\n')[0]}`);

    try {
        const compiler = new inkjs.Compiler(tc.content);
        const story = compiler.Compile();

        const tag = story.globalTags?.[0] || '(no tag)';
        console.log(`Output tag:     ${tag}`);

        // Check if truncated
        if (tag.includes('://')) {
            console.log('Status: FULL URL PRESERVED ✓');
        } else if (tag.includes('FINK')) {
            console.log('Status: TRUNCATED ✗');
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    console.log('');
}

// Now test what happens with just text after //
console.log('--- Direct // test ---');
const directTest = `# TEST: before//after\n-> start\n=== start ===\nHello.\n+ [x] -> END`;
console.log(`Input: # TEST: before//after`);
const compiler2 = new inkjs.Compiler(directTest);
const story2 = compiler2.Compile();
console.log(`Output: ${story2.globalTags?.[0]}`);
