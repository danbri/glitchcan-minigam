#!/usr/bin/env node
/**
 * Elliott 4130 Test Runner (Node.js)
 * Runs the full test suite from command line with detailed failure reporting
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load browser-style JS files and eval them to get class definitions
function loadAndEval(filename) {
    const code = readFileSync(join(__dirname, filename), 'utf-8');
    return eval(code + `\n; typeof E4130 !== 'undefined' ? E4130 : typeof Asm !== 'undefined' ? Asm : typeof E4130Tests !== 'undefined' ? E4130Tests : null;`);
}

// We need to eval these in a way that the classes become available
const coreCode = readFileSync(join(__dirname, 'elliott4130-core.js'), 'utf-8');
const asmCode = readFileSync(join(__dirname, 'elliott4130-asm.js'), 'utf-8');
const testsCode = readFileSync(join(__dirname, 'elliott4130-tests.js'), 'utf-8');

// Eval all together so classes are in scope
const allCode = `
${coreCode}
${asmCode}
${testsCode}
({ E4130, Asm, E4130Tests })
`;

const { E4130, Asm, E4130Tests } = eval(allCode);

// Enhanced test runner with detailed failure reporting
class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.failures = [];
    }

    runTest(name, code, check, options = {}) {
        const cpu = new E4130();
        const asm = new Asm();

        try {
            // Setup if provided
            if (options.setup) {
                options.setup(cpu);
            }

            // Assemble
            const program = asm.asm(code);

            // Load program
            for (const { addr, word } of program) {
                cpu.mem[addr] = word;
            }

            cpu.halted = false;
            const maxCycles = options.maxCycles || 1000;

            // Execute
            let lastS = -1;
            for (let i = 0; i < maxCycles && !cpu.halted; i++) {
                const w = cpu.mem[cpu.S >> 1];
                const f = (w >> 18) & 0x3F;
                const y = (w >> 16) & 3;
                const n = w & 0x7FFF;

                // Detect infinite loop (J to self)
                if (f === 0o45 && y === 0 && n === cpu.S) break;
                if (cpu.S === lastS) break; // PC didn't change
                lastS = cpu.S;

                cpu.step();
            }

            // Check result
            const passed = check(cpu);

            if (passed) {
                this.passed++;
                return { passed: true };
            } else {
                this.failed++;
                const failure = {
                    name,
                    error: null,
                    cpu: {
                        M: cpu.M,
                        R: cpu.R,
                        S: cpu.S,
                        K: cpu.K,
                        C: cpu.C,
                        flags: this.decodeFlags(cpu.C)
                    },
                    mem: this.dumpRelevantMem(cpu, program),
                    program: program.map(p => ({
                        addr: p.addr,
                        word: p.word.toString(8).padStart(8, '0'),
                        disasm: this.disasm(p.word)
                    }))
                };
                this.failures.push(failure);
                return { passed: false, failure };
            }
        } catch (e) {
            this.failed++;
            const failure = { name, error: e.message, stack: e.stack };
            this.failures.push(failure);
            return { passed: false, failure };
        }
    }

    decodeFlags(c) {
        const flags = [];
        if (c & 32) flags.push('NEG');
        if (c & 16) flags.push('ST');
        if (c & 8) flags.push('NZ');
        if (c & 4) flags.push('CA');
        if (c & 2) flags.push('OF');
        return flags.join('|') || 'none';
    }

    dumpRelevantMem(cpu, program) {
        const addrs = new Set();
        for (const p of program) {
            addrs.add(p.addr);
            // Also check referenced addresses
            const n = p.word & 0x7FFF;
            if (n < 1000) addrs.add(n);
        }
        const mem = {};
        for (const a of [...addrs].sort((x,y) => x-y)) {
            mem[a] = cpu.mem[a];
        }
        return mem;
    }

    disasm(word) {
        const f = (word >> 18) & 0x3F;
        const y = (word >> 16) & 3;
        const n = word & 0xFFFF;
        const yStr = ['#', '', ',R', '@'][y] || '';
        return `f=${f.toString(8)} y=${y} n=${n} (${yStr}${n})`;
    }

    runDirectTest(name, testFn) {
        try {
            const cpu = new E4130();
            const passed = testFn(cpu);
            if (passed) {
                this.passed++;
                return { passed: true };
            } else {
                this.failed++;
                const failure = { name, error: 'Check returned false' };
                this.failures.push(failure);
                return { passed: false, failure };
            }
        } catch (e) {
            this.failed++;
            const failure = { name, error: e.message };
            this.failures.push(failure);
            return { passed: false, failure };
        }
    }
}

// Run all test categories
const runner = new TestRunner();
const categories = [];
let currentCategory = '';

// Patch E4130Tests to use our runner
E4130Tests.runTest = (name, code, check, options) => {
    const result = runner.runTest(name, code, check, options);
    const status = result.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${status} ${name}`);
    return result.passed;
};

E4130Tests.runDirectTest = (name, testFn) => {
    const result = runner.runDirectTest(name, testFn);
    const status = result.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${status} ${name}`);
    return result.passed;
};

// Intercept category changes
const origCurrentCategory = Object.getOwnPropertyDescriptor(E4130Tests, 'currentCategory');
Object.defineProperty(E4130Tests, 'currentCategory', {
    set(v) {
        currentCategory = v;
        categories.push({ name: v, startPassed: runner.passed, startFailed: runner.failed });
        console.log(`\n\x1b[33m${v}\x1b[0m`);
    },
    get() { return currentCategory; }
});

// Run all tests
console.log('\x1b[1mElliott 4130 Test Suite\x1b[0m\n');

// Run all test methods that exist
const testMethods = [
    'testCorePrimitives',
    'testBasicArithmetic',
    'testConditionFlags',
    'testAddressingModes',
    'testJumps',
    'testLogic',
    'testShifts',
    'testRegisterOps',
    'testMemoryOps',
    'testMulDiv',
    'testIntegration'
];

for (const method of testMethods) {
    if (typeof E4130Tests[method] === 'function') {
        E4130Tests[method]();
    }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\x1b[1mRESULTS: ${runner.passed}/${runner.passed + runner.failed} passed\x1b[0m`);

// Category breakdown
console.log('\nBy category:');
for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const next = categories[i + 1] || { startPassed: runner.passed, startFailed: runner.failed };
    const catPassed = next.startPassed - cat.startPassed;
    const catFailed = next.startFailed - cat.startFailed;
    const total = catPassed + catFailed;
    const pct = total > 0 ? Math.round(100 * catPassed / total) : 100;
    const color = pct === 100 ? '\x1b[32m' : pct >= 50 ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${color}${catPassed}/${total}\x1b[0m ${cat.name}`);
}

// Detailed failure report
if (runner.failures.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('\x1b[31mFAILURE DETAILS:\x1b[0m\n');

    for (const f of runner.failures) {
        console.log(`\x1b[1m${f.name}\x1b[0m`);
        if (f.error) {
            console.log(`  Error: ${f.error}`);
            if (f.stack) console.log(`  ${f.stack.split('\n').slice(1, 3).join('\n  ')}`);
        }
        if (f.cpu) {
            console.log(`  CPU: M=${f.cpu.M} (0x${f.cpu.M.toString(16)}) R=${f.cpu.R} S=${f.cpu.S} K=${f.cpu.K}`);
            console.log(`  Flags: ${f.cpu.flags}`);
        }
        if (f.mem) {
            console.log(`  Memory:`);
            for (const [addr, val] of Object.entries(f.mem)) {
                console.log(`    [${addr}] = ${val} (0x${val.toString(16)}, 0o${val.toString(8)})`);
            }
        }
        if (f.program) {
            console.log(`  Program:`);
            for (const p of f.program.slice(0, 10)) {
                console.log(`    [${p.addr}] ${p.word} ${p.disasm}`);
            }
        }
        console.log('');
    }
}

// Exit code
process.exit(runner.failed > 0 ? 1 : 0);
