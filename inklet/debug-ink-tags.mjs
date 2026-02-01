// Debug script to trace INK tag parsing
import { readFileSync } from 'fs';

// Load inkjs
const inkjsPath = '../third_party/ink/ink-full.js';
const inkjsCode = readFileSync(inkjsPath, 'utf-8');
eval(inkjsCode);

// Test content with https:// URL
const testContent = `
# FINK: https://danbri.github.io/isle_of_glitch/awakening.fink.js

-> start

=== start ===
Hello world.
+ [Continue] -> END
`;

console.log('=== INPUT CONTENT ===');
console.log(testContent);
console.log('');

console.log('=== COMPILING ===');
const compiler = new inkjs.Compiler(testContent);

if (compiler.errors?.length > 0) {
    console.log('Compiler errors:', compiler.errors);
}

const story = compiler.Compile();

if (compiler.errors?.length > 0) {
    console.log('Post-compile errors:', compiler.errors);
}

console.log('');
console.log('=== GLOBAL TAGS ===');
console.log('story.globalTags:', story.globalTags);

console.log('');
console.log('=== RUNNING STORY ===');
while (story.canContinue) {
    const text = story.Continue();
    console.log('Text:', JSON.stringify(text));
    console.log('currentTags:', story.currentTags);
}

console.log('');
console.log('=== ANALYSIS ===');
const globalTags = story.globalTags || [];
globalTags.forEach((tag, i) => {
    console.log(`Tag ${i}: "${tag}"`);
    if (tag.includes('FINK')) {
        const colonIndex = tag.indexOf(':');
        const value = tag.slice(colonIndex + 1).trim();
        console.log(`  FINK value: "${value}"`);
        console.log(`  Contains ://? ${value.includes('://')}`);
    }
});
