/**
 * Test BUG-003: Extracode Software Trap Mechanism
 *
 * Per E6X3, extracodes (Z=1 instructions) should:
 *   (a) Place N in memory location 1
 *   (b) Place link (c24-18 + S) in memory location 2
 *   (c) Jump to address 2*F (or 2*F+1 for Y>0)
 */

import { E4130 } from '../elliott4130-core.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  Expected: ${e.expected}`);
        console.log(`  Actual:   ${e.actual}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
        const e = new Error(msg);
        e.actual = actual;
        e.expected = expected;
        throw e;
    }
}

// Create fresh CPU for each test
function createCPU() {
    const cpu = new E4130();
    cpu.reset();
    cpu.halted = false;
    // Disable hardware FP to test trapping behavior
    cpu.hardwareFPEnabled = false;
    return cpu;
}

// ============================================================
// BUG-003 EXTRACODE TRAP TESTS
// ============================================================

test('Extracode should store N at location 1', () => {
    const cpu = createCPU();

    // Set up an extracode instruction at address 100
    // MULS instruction (F=0o50, Z=1, Y=0, N=42)
    // Format: F(6) Y(2) Z(1) N(15) = 0o50 << 18 | 0 << 16 | 1 << 15 | 42
    const mulsInstr = (0o50 << 18) | (0 << 16) | (1 << 15) | 42;
    cpu.mem[100] = mulsInstr;
    cpu.S = 200;  // Half-word address (word addr 100)

    cpu.step();

    // N (42) should be stored at location 1
    assertEqual(cpu.mem[1], 42, 'N should be stored at location 1');
});

test('Extracode should store link (c24-18 + S) at location 2', () => {
    const cpu = createCPU();

    // Set C register with some bits in c24-18 position
    cpu.C = 0x7F0000;  // All 7 bits of c24-18 set (0x7F << 17 would be different)

    // MULS at address 100, S = 200 (half-word)
    const mulsInstr = (0o50 << 18) | (0 << 16) | (1 << 15) | 100;
    cpu.mem[100] = mulsInstr;
    cpu.S = 200;

    cpu.step();

    // Link should be (C >> 17) & 0x7F in upper bits, S in lower 17 bits
    // C = 0x7F0000 => (C >> 17) & 0x7F = 0x3F (bits shifted)
    // Actually C[24:18] means bits 23-17 in 0-indexed, so >> 17 gives 7 bits
    const expectedLink = ((cpu.C >> 17) & 0x7F) << 17 | 202;  // S was 200, advanced by 2
    // Wait - link should contain ORIGINAL S before it was modified
    // The spec says store the link THEN jump, so S in link should be return address
    // After the instruction, S advanced to 202 before trap
    // Link = c24-18 concatenated with S (return address)

    const link = cpu.mem[2];
    // Link lower 17 bits should be the return address (S after advancing = 202)
    assertEqual(link & 0x1FFFF, 202, 'Link lower 17 bits should be return S');
});

test('Extracode Y=0 should jump to 2*F', () => {
    const cpu = createCPU();

    // MULS (F=0o50=40 decimal), Y=0, Z=1, N=99
    // Should jump to 2*40 = 80, then *2 for half-word = 160
    const mulsInstr = (0o50 << 18) | (0 << 16) | (1 << 15) | 99;
    cpu.mem[100] = mulsInstr;
    cpu.S = 200;

    cpu.step();

    // S should now point to trap handler at 2*F*2 = 2*0o50*2 = 2*40*2 = 160
    assertEqual(cpu.S, 160, 'S should jump to 2*F (half-word addr)');
});

test('Extracode Y>0 should jump to 2*F+1', () => {
    const cpu = createCPU();

    // MULS (F=0o50), Y=1 (direct), Z=1, N=99
    // Should jump to (2*40+1)*2 = 81*2 = 162
    const mulsInstr = (0o50 << 18) | (1 << 16) | (1 << 15) | 99;
    cpu.mem[100] = mulsInstr;
    cpu.S = 200;

    cpu.step();

    // S should now point to trap handler at (2*F+1)*2 = (2*40+1)*2 = 162
    assertEqual(cpu.S, 162, 'S should jump to 2*F+1 (half-word addr) for Y>0');
});

test('Hardware FP should execute inline when hardwareFPEnabled=true', () => {
    const cpu = createCPU();
    cpu.hardwareFPEnabled = true;  // Enable hardware FP

    // FADD (F=0o52), Y=1, Z=1, N=50
    // Should execute inline, NOT trap
    const faddInstr = (0o52 << 18) | (1 << 16) | (1 << 15) | 50;
    cpu.mem[100] = faddInstr;
    cpu.mem[50] = cpu.floatToFp ? cpu.floatToFp(2.0) : 0;  // Operand
    cpu.M = cpu.floatToFp ? cpu.floatToFp(3.0) : 0;  // M = 3.0
    cpu.S = 200;

    const oldS = cpu.S;
    cpu.step();

    // Should NOT have jumped to trap address - S should just advance by 2
    assertEqual(cpu.S, 202, 'Hardware FP should not trap, just advance S');
});

test('Hardware FP should trap when hardwareFPEnabled=false', () => {
    const cpu = createCPU();
    cpu.hardwareFPEnabled = false;  // Disable hardware FP (4120 mode)

    // FADD (F=0o52=42 decimal), Y=0, Z=1, N=50
    const faddInstr = (0o52 << 18) | (0 << 16) | (1 << 15) | 50;
    cpu.mem[100] = faddInstr;
    cpu.S = 200;

    cpu.step();

    // Should trap to 2*0o52*2 = 2*42*2 = 168
    assertEqual(cpu.S, 168, 'FP should trap when hardware disabled');
});

test('I/O extracode should trap (OS mediation)', () => {
    const cpu = createCPU();

    // I/O instruction (F=0o74=60 decimal), Y=0, Z=1
    const ioInstr = (0o74 << 18) | (0 << 16) | (1 << 15) | 5;
    cpu.mem[100] = ioInstr;
    cpu.S = 200;

    cpu.step();

    // Should trap to 2*0o74*2 = 2*60*2 = 240
    assertEqual(cpu.S, 240, 'I/O should trap for OS mediation');
});

// ============================================================
// RESULTS
// ============================================================

console.log('');
console.log('============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
