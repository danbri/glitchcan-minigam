/**
 * Test BUG-001: Two-Word Floating-Point Format
 *
 * Per E6X3 p.6:
 * "On the 4130 where hardware is used, the mantissa occupies 48 bits within
 * CPU registers and the exponent 12 bits... When held in memory, floating-point
 * numbers are normally rounded and packed into two words containing 39 bits of
 * mantissa and 9 bits of exponent."
 *
 * Memory format (two 24-bit words):
 *   Word 1: [Sign(1)] [Exponent(9)] [Mantissa high(14)]
 *   Word 2: [Mantissa low(24)]
 *   Total: 39-bit mantissa, 9-bit exponent, 1-bit sign
 *
 * This gives ~12 decimal digits precision vs ~5 with the old fabricated format.
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
        if (e.message) console.log(`  Message:  ${e.message}`);
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

function assertClose(actual, expected, epsilon = 1e-10, msg = '') {
    const diff = Math.abs(actual - expected);
    const relativeDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
    if (relativeDiff > epsilon && diff > epsilon) {
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
    cpu.hardwareFPEnabled = true;  // Enable hardware FP
    return cpu;
}

// ============================================================
// BASIC TWO-WORD FORMAT TESTS
// ============================================================

test('floatToFp(1.0) produces correct two-word representation', () => {
    const cpu = createCPU();

    // Store 1.0 at address 100
    cpu.floatToFp(1.0, 100);

    const w1 = cpu.mem[100];
    const w2 = cpu.mem[101];

    // 1.0 should have:
    // - Sign = 0 (positive)
    // - Exponent = 256 (excess-256, for 2^0 = 1)
    // - Mantissa = 0 (since 1.0 = 1.0 * 2^0, mantissa fraction is 0)

    const sign = (w1 >> 23) & 1;
    const exp = (w1 >> 14) & 0x1FF;

    assertEqual(sign, 0, 'Sign should be 0 for positive');
    assertEqual(exp, 256, 'Exponent should be 256 (excess-256 for exp=0)');
});

test('floatToFp(0) produces zero in both words', () => {
    const cpu = createCPU();

    cpu.floatToFp(0, 100);

    assertEqual(cpu.mem[100], 0, 'Word 1 should be 0 for zero');
    assertEqual(cpu.mem[101], 0, 'Word 2 should be 0 for zero');
});

test('floatToFp(-1.0) sets sign bit correctly', () => {
    const cpu = createCPU();

    cpu.floatToFp(-1.0, 100);

    const w1 = cpu.mem[100];
    const sign = (w1 >> 23) & 1;

    assertEqual(sign, 1, 'Sign should be 1 for negative');
});

test('fpToFloat reads two-word format correctly', () => {
    const cpu = createCPU();

    // Store 1.0 and read it back
    cpu.floatToFp(1.0, 100);
    const result = cpu.fpToFloat(100);

    assertClose(result, 1.0, 1e-10, 'Should read back 1.0');
});

test('Round-trip: floatToFp then fpToFloat preserves value for 2.5', () => {
    const cpu = createCPU();

    cpu.floatToFp(2.5, 100);
    const result = cpu.fpToFloat(100);

    assertClose(result, 2.5, 1e-10, 'Should preserve 2.5');
});

test('Round-trip: floatToFp then fpToFloat preserves value for -3.14159', () => {
    const cpu = createCPU();

    cpu.floatToFp(-3.14159, 100);
    const result = cpu.fpToFloat(100);

    assertClose(result, -3.14159, 1e-10, 'Should preserve -3.14159');
});

test('Round-trip: floatToFp then fpToFloat preserves value for 1e10', () => {
    const cpu = createCPU();

    cpu.floatToFp(1e10, 100);
    const result = cpu.fpToFloat(100);

    assertClose(result, 1e10, 1e-5, 'Should preserve 1e10');
});

test('Round-trip: floatToFp then fpToFloat preserves value for 1e-10', () => {
    const cpu = createCPU();

    cpu.floatToFp(1e-10, 100);
    const result = cpu.fpToFloat(100);

    assertClose(result, 1e-10, 1e-5, 'Should preserve 1e-10');
});

// ============================================================
// FP ARITHMETIC TESTS
// ============================================================

test('FADD adds two FP numbers correctly', () => {
    const cpu = createCPU();

    // Store 2.5 at address 50
    cpu.floatToFp(2.5, 50);

    // Load 3.5 into FP accumulator (via fpLoad)
    cpu.floatToFp(3.5, 60);
    cpu.fpLoad(60);  // Load from address 60

    // Add operand at address 50
    cpu.fpAdd(50);

    // Store result and read back
    cpu.fpStore(1, 70);  // y=1 (direct), n=70
    const result = cpu.fpToFloat(70);

    assertClose(result, 6.0, 1e-10, 'FADD: 3.5 + 2.5 should equal 6.0');
});

test('FSUB subtracts correctly', () => {
    const cpu = createCPU();

    // Store 2.5 at address 50
    cpu.floatToFp(2.5, 50);

    // Load 5.0 into FP accumulator
    cpu.floatToFp(5.0, 60);
    cpu.fpLoad(60);

    // Subtract operand at address 50
    cpu.fpSub(50);

    // Store result and read back
    cpu.fpStore(1, 70);
    const result = cpu.fpToFloat(70);

    assertClose(result, 2.5, 1e-10, 'FSUB: 5.0 - 2.5 should equal 2.5');
});

test('FMUL multiplies correctly', () => {
    const cpu = createCPU();

    // Store 3.0 at address 50
    cpu.floatToFp(3.0, 50);

    // Load 4.0 into FP accumulator
    cpu.floatToFp(4.0, 60);
    cpu.fpLoad(60);

    // Multiply by operand at address 50
    cpu.fpMul(50);

    // Store result and read back
    cpu.fpStore(1, 70);
    const result = cpu.fpToFloat(70);

    assertClose(result, 12.0, 1e-10, 'FMUL: 4.0 * 3.0 should equal 12.0');
});

test('FDIV divides correctly', () => {
    const cpu = createCPU();

    // Store 4.0 at address 50
    cpu.floatToFp(4.0, 50);

    // Load 12.0 into FP accumulator
    cpu.floatToFp(12.0, 60);
    cpu.fpLoad(60);

    // Divide by operand at address 50
    cpu.fpDiv(50);

    // Store result and read back
    cpu.fpStore(1, 70);
    const result = cpu.fpToFloat(70);

    assertClose(result, 3.0, 1e-10, 'FDIV: 12.0 / 4.0 should equal 3.0');
});

test('FLD loads two-word FP from memory', () => {
    const cpu = createCPU();

    // Store 7.5 at address 50
    cpu.floatToFp(7.5, 50);

    // Load into FP accumulator
    cpu.fpLoad(50);

    // Store and verify
    cpu.fpStore(1, 70);
    const result = cpu.fpToFloat(70);

    assertClose(result, 7.5, 1e-10, 'FLD should load 7.5 from memory');
});

test('FST stores two-word FP to memory', () => {
    const cpu = createCPU();

    // Load a value
    cpu.floatToFp(9.25, 50);
    cpu.fpLoad(50);

    // Store to different location
    cpu.fpStore(1, 80);

    // Verify both words were written
    const result = cpu.fpToFloat(80);
    assertClose(result, 9.25, 1e-10, 'FST should store to two words');
});

// ============================================================
// PRECISION TEST
// ============================================================

test('Precision test: can represent 12 significant digits', () => {
    const cpu = createCPU();

    // Test with a number requiring high precision
    // 39-bit mantissa should give about 11-12 decimal digits
    const testValue = 1.23456789012;  // 12 significant digits

    cpu.floatToFp(testValue, 100);
    const result = cpu.fpToFloat(100);

    // With 39-bit mantissa, we should get at least 10 digits correct
    // 2^39 = 5.5e11, so ~11 decimal digits
    assertClose(result, testValue, 1e-11, 'Should preserve ~11-12 decimal digits');
});

test('Precision test: distinguish 1.0 from 1.0 + 1e-11', () => {
    const cpu = createCPU();

    const a = 1.0;
    const b = 1.0 + 1e-11;

    cpu.floatToFp(a, 100);
    cpu.floatToFp(b, 102);

    const resultA = cpu.fpToFloat(100);
    const resultB = cpu.fpToFloat(102);

    // These should be distinguishable with 39-bit mantissa
    if (Math.abs(resultA - resultB) < 1e-12) {
        const e = new Error('Should distinguish values differing by 1e-11');
        e.actual = 'Values indistinguishable';
        e.expected = 'Difference of ~1e-11';
        throw e;
    }
});

// ============================================================
// EDGE CASES
// ============================================================

test('fpToFloat handles zero correctly', () => {
    const cpu = createCPU();

    cpu.mem[100] = 0;
    cpu.mem[101] = 0;

    const result = cpu.fpToFloat(100);
    assertEqual(result, 0, 'Should return 0 for zero input');
});

test('FDIV by zero sets overflow flag', () => {
    const cpu = createCPU();

    cpu.floatToFp(0, 50);  // Zero divisor
    cpu.floatToFp(5.0, 60);
    cpu.fpLoad(60);

    cpu.fpDiv(50);

    // Should set overflow flag
    const hasOverflow = (cpu.C & cpu.F_OF) !== 0;
    assertEqual(hasOverflow, true, 'Division by zero should set overflow flag');
});

test('FP negation works correctly', () => {
    const cpu = createCPU();

    cpu.floatToFp(5.5, 50);
    cpu.fpLoad(50);

    cpu.fpNeg();

    cpu.fpStore(1, 60);
    const result = cpu.fpToFloat(60);

    assertClose(result, -5.5, 1e-10, 'Negation of 5.5 should be -5.5');
});

test('FP absolute value works correctly', () => {
    const cpu = createCPU();

    cpu.floatToFp(-7.25, 50);
    cpu.fpLoad(50);

    cpu.fpAbs();

    cpu.fpStore(1, 60);
    const result = cpu.fpToFloat(60);

    assertClose(result, 7.25, 1e-10, 'Absolute value of -7.25 should be 7.25');
});

test('FIX converts float to integer', () => {
    const cpu = createCPU();

    cpu.floatToFp(3.7, 50);
    cpu.fpLoad(50);

    cpu.fpFix();

    // M should now contain integer 3
    assertEqual(cpu.M, 3, 'FIX of 3.7 should be 3');
});

test('FLT converts integer to float', () => {
    const cpu = createCPU();

    cpu.M = 42;  // Integer in M

    cpu.fpFloat();

    // Store and read back as float
    cpu.fpStore(1, 60);
    const result = cpu.fpToFloat(60);

    assertClose(result, 42.0, 1e-10, 'FLT of 42 should be 42.0');
});

test('FCMP sets flags correctly for equal values', () => {
    const cpu = createCPU();

    cpu.floatToFp(5.0, 50);
    cpu.floatToFp(5.0, 60);
    cpu.fpLoad(60);  // Load 5.0

    cpu.fpCmp(50);  // Compare with 5.0

    // Should NOT be negative, should NOT be non-zero
    const isNeg = (cpu.C & cpu.F_NEG) !== 0;
    const isNZ = (cpu.C & cpu.F_NZ) !== 0;

    assertEqual(isNeg, false, 'Equal values should not be negative');
    assertEqual(isNZ, false, 'Equal values difference should be zero');
});

test('FCMP sets negative flag when accumulator < operand', () => {
    const cpu = createCPU();

    cpu.floatToFp(7.0, 50);  // Larger operand
    cpu.floatToFp(3.0, 60);
    cpu.fpLoad(60);  // Load smaller value

    cpu.fpCmp(50);  // Compare: 3.0 - 7.0 = -4.0

    const isNeg = (cpu.C & cpu.F_NEG) !== 0;
    assertEqual(isNeg, true, '3.0 - 7.0 should be negative');
});

test('FSQRT computes square root correctly', () => {
    const cpu = createCPU();

    cpu.floatToFp(16.0, 50);
    cpu.fpLoad(50);

    cpu.fpSqrt();

    cpu.fpStore(1, 60);
    const result = cpu.fpToFloat(60);

    assertClose(result, 4.0, 1e-10, 'sqrt(16) should be 4.0');
});

test('FSQRT of negative sets overflow flag', () => {
    const cpu = createCPU();

    cpu.floatToFp(-4.0, 50);
    cpu.fpLoad(50);

    cpu.fpSqrt();

    const hasOverflow = (cpu.C & cpu.F_OF) !== 0;
    assertEqual(hasOverflow, true, 'sqrt of negative should set overflow');
});

// ============================================================
// RESULTS
// ============================================================

console.log('');
console.log('============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
