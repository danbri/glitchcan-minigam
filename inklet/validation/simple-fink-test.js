#!/usr/bin/env node
/**
 * simple-fink-test.js - Basic FINK validation without browser dependencies
 * 
 * Usage: node simple-fink-test.js ../shane-manor.fink.js
 */

const fs = require('fs');
const path = require('path');

function validateFinkFile(filePath) {
    console.log(`🔍 Validating FINK file: ${filePath}`);
    
    try {
        // Read file
        const finkContent = fs.readFileSync(filePath, 'utf8');
        console.log('✅ File read successfully');
        
        // Extract INK content from FINK file
        const match = finkContent.match(/oooOO`([^]+?)`/);
        if (!match) {
            throw new Error('No oooOO template literal found');
        }
        
        const inkContent = match[1];
        console.log(`✅ INK content extracted (${inkContent.length} characters)`);
        
        // Basic syntax validation
        const tests = [
            {
                name: 'Knot definitions',
                regex: /^===/gm,
                expected: count => count >= 10
            },
            {
                name: 'Choice markers',
                regex: /^\s*\*/gm,
                expected: count => count >= 15
            },
            {
                name: 'Variable declarations',
                regex: /^VAR /gm,
                expected: count => count >= 3
            },
            {
                name: 'Story flow arrows',
                regex: /-> \w+/g,
                expected: count => count >= 10
            },
            {
                name: 'BASEHREF directive',
                regex: /# BASEHREF:/,
                expected: count => count >= 1
            }
        ];
        
        const results = tests.map(test => {
            const matches = inkContent.match(test.regex) || [];
            const count = matches.length;
            const passed = test.expected(count);
            
            console.log(`${passed ? '✅' : '❌'} ${test.name}: ${count} found`);
            return { ...test, count, passed };
        });
        
        // Shane Manor specific tests
        const shaneTests = [
            {
                name: 'Chess skill variable',
                check: () => inkContent.includes('chess_skill'),
                description: 'Chess minigame integration'
            },
            {
                name: 'Chess insights variable', 
                check: () => inkContent.includes('chess_insights'),
                description: 'Chess analysis tracking'
            },
            {
                name: 'Minigame directive',
                check: () => inkContent.includes('# MINIGAME:'),
                description: 'Minigame integration marker'
            },
            {
                name: 'Direct link comments',
                check: () => inkContent.includes('DIRECT LINKS FOR TESTING'),
                description: 'Testing/debugging support'
            },
            {
                name: 'Enhanced opening',
                check: () => inkContent.includes('November rain drums'),
                description: 'Atmospheric story opening'
            }
        ];
        
        console.log('\n🎯 Shane Manor specific features:');
        shaneTests.forEach(test => {
            const passed = test.check();
            console.log(`${passed ? '✅' : '❌'} ${test.name}: ${test.description}`);
        });
        
        // Overall assessment
        const allBasicTestsPassed = results.every(r => r.passed);
        const allShaneTestsPassed = shaneTests.every(t => t.check());
        
        console.log('\n📊 Summary:');
        console.log(`Basic INK structure: ${allBasicTestsPassed ? 'PASS' : 'FAIL'}`);
        console.log(`Shane Manor features: ${allShaneTestsPassed ? 'PASS' : 'FAIL'}`);
        console.log(`Overall: ${allBasicTestsPassed && allShaneTestsPassed ? 'PASS ✅' : 'FAIL ❌'}`);
        
        return allBasicTestsPassed && allShaneTestsPassed;
        
    } catch (error) {
        console.error(`❌ Validation failed: ${error.message}`);
        return false;
    }
}

// Run validation
const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node simple-fink-test.js <fink-file>');
    process.exit(1);
}

const result = validateFinkFile(filePath);
process.exit(result ? 0 : 1);