// Test compiling awakening.fink.js
import { readFileSync } from 'fs';

const inkjsPath = '../third_party/ink/ink-full.js';
const inkjsCode = readFileSync(inkjsPath, 'utf-8');
eval(inkjsCode);

// Read the awakening file
const finkContent = readFileSync('/tmp/awakening.fink.js', 'utf-8');

// Extract INK content from oooOO template
const match = finkContent.match(/oooOO`([\s\S]*)`/);
if (!match) {
    console.log('No oooOO template found');
    process.exit(1);
}

const inkContent = match[1];
console.log(`INK content length: ${inkContent.length}`);
console.log(`First 200 chars:\n${inkContent.slice(0, 200)}`);
console.log('\n=== COMPILING ===\n');

try {
    const compiler = new inkjs.Compiler(inkContent);

    // Check for errors immediately after construction
    console.log('After constructor:');
    console.log(`  _errors: ${JSON.stringify(compiler._errors)}`);
    console.log(`  errors: ${JSON.stringify(compiler.errors)}`);

    if (compiler.errors?.length > 0) {
        console.log('Constructor errors:');
        compiler.errors.forEach(e => console.log(`  ${e}`));
    }

    let story;
    try {
        story = compiler.Compile();
    } catch (compileErr) {
        console.log('Compile threw:', compileErr.message);
        console.log('Errors after Compile():');
        console.log(`  errors: ${JSON.stringify(compiler.errors)}`);
        if (compiler.errors?.length > 0) {
            compiler.errors.forEach(e => console.log(`  - ${e}`));
        }
        throw compileErr;
    }

    if (compiler.errors?.length > 0) {
        console.log('Compile errors:');
        compiler.errors.forEach(e => console.log(`  ${e}`));
    }

    if (compiler.warnings?.length > 0) {
        console.log('Warnings:');
        compiler.warnings.forEach(w => console.log(`  ${w}`));
    }

    console.log('Compilation successful!');
    console.log(`Global tags: ${story.globalTags}`);

} catch (e) {
    console.log(`Exception: ${e.message}`);
}
