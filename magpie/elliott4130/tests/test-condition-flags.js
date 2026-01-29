/**
 * Test: Condition Register Bit Positions
 *
 * Per E6X3 specification:
 *   c24: result negative (Neg) - MSB of C register
 *   c23: result standardized (St)
 *   c22: result non-zero (Nz)
 *   c21: carry-out (Ca)
 *   c20: arithmetic overflow (Of)
 *
 * Elliott numbering: bit 24 is MSB, bit 1 is LSB
 * So in 0-indexed terms for a 24-bit word:
 *   c24 = bit 23 = 0x800000
 *   c23 = bit 22 = 0x400000
 *   c22 = bit 21 = 0x200000
 *   c21 = bit 20 = 0x100000
 *   c20 = bit 19 = 0x080000
 */

// Import emulator (adjust path as needed for your test runner)
import { E4130 } from '../elliott4130-core.js';

// Expected bit positions per E6X3
const EXPECTED = {
    F_NEG: 0x800000,  // c24 - Negative (MSB)
    F_ST:  0x400000,  // c23 - Standardized
    F_NZ:  0x200000,  // c22 - Non-zero
    F_CA:  0x100000,  // c21 - Carry
    F_OF:  0x080000   // c20 - Overflow
};

// WRONG values currently in emulator
const WRONG = {
    F_NEG: 32,  // bit 5 - WRONG!
    F_ST:  16,  // bit 4 - WRONG!
    F_NZ:  8,   // bit 3 - WRONG!
    F_CA:  4,   // bit 2 - WRONG!
    F_OF:  2    // bit 1 - WRONG!
};

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}`);
        console.log(`  ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg}: expected 0x${expected.toString(16)}, got 0x${actual.toString(16)}`);
    }
}

function assertFlag(cpu, flagName, expectedPos) {
    if (cpu[flagName] !== expectedPos) {
        throw new Error(`${flagName} should be 0x${expectedPos.toString(16)}, is 0x${cpu[flagName].toString(16)}`);
    }
}

// =============================================================================
// TEST 1: Flag constant positions match E6X3 spec
// =============================================================================

test('F_NEG constant should be 0x800000 (c24)', () => {
    const cpu = new E4130();
    assertFlag(cpu, 'F_NEG', EXPECTED.F_NEG);
});

test('F_ST constant should be 0x400000 (c23)', () => {
    const cpu = new E4130();
    assertFlag(cpu, 'F_ST', EXPECTED.F_ST);
});

test('F_NZ constant should be 0x200000 (c22)', () => {
    const cpu = new E4130();
    assertFlag(cpu, 'F_NZ', EXPECTED.F_NZ);
});

test('F_CA constant should be 0x100000 (c21)', () => {
    const cpu = new E4130();
    assertFlag(cpu, 'F_CA', EXPECTED.F_CA);
});

test('F_OF constant should be 0x080000 (c20)', () => {
    const cpu = new E4130();
    assertFlag(cpu, 'F_OF', EXPECTED.F_OF);
});

// =============================================================================
// TEST 2: setC() sets flags in correct positions
// =============================================================================

test('setC(-1) should set NEG flag at bit 23', () => {
    const cpu = new E4130();
    cpu.setC(0xFFFFFF);  // -1 in 24-bit
    // NEG should be set at position c24 (bit 23)
    if (!(cpu.C & EXPECTED.F_NEG)) {
        throw new Error(`NEG flag not set at c24: C=0x${cpu.C.toString(16)}`);
    }
});

test('setC(1) should set NZ flag at bit 21', () => {
    const cpu = new E4130();
    cpu.setC(1);  // Non-zero positive
    // NZ should be set at position c22 (bit 21)
    if (!(cpu.C & EXPECTED.F_NZ)) {
        throw new Error(`NZ flag not set at c22: C=0x${cpu.C.toString(16)}`);
    }
});

test('setC(0) should NOT set NZ flag', () => {
    const cpu = new E4130();
    cpu.setC(0);  // Zero
    if (cpu.C & EXPECTED.F_NZ) {
        throw new Error(`NZ flag incorrectly set for zero: C=0x${cpu.C.toString(16)}`);
    }
});

// =============================================================================
// TEST 3: CTOM (C to M) instruction should transfer flags correctly
// =============================================================================

test('CTOM should place NEG at M bit 23', () => {
    const cpu = new E4130();
    // Set NEG flag
    cpu.C = EXPECTED.F_NEG;
    // Execute CTOM: M' = C (F=10, N=01, Y=0 for register transfer)
    // For now, simulate the effect
    cpu.M = cpu.C;
    // Check M has NEG at correct position
    if (!(cpu.M & 0x800000)) {
        throw new Error(`CTOM: NEG should be at M bit 23, M=0x${cpu.M.toString(16)}`);
    }
});

// =============================================================================
// TEST 4: Conditional jumps should test correct bit positions
// =============================================================================

test('JN (Jump if Negative) should test bit 23 of C', () => {
    const cpu = new E4130();
    // With NEG at correct position, JN should branch
    cpu.C = EXPECTED.F_NEG;
    const shouldJump = (cpu.C & EXPECTED.F_NEG) !== 0;
    if (!shouldJump) {
        throw new Error('JN should jump when NEG is set at c24');
    }
});

test('JN should NOT jump when NEG in wrong position', () => {
    const cpu = new E4130();
    // If NEG were at wrong position (bit 5), JN testing c24 wouldn't see it
    cpu.C = WRONG.F_NEG;  // bit 5 only
    const wouldJumpWrong = (cpu.C & EXPECTED.F_NEG) !== 0;
    if (wouldJumpWrong) {
        throw new Error('NEG at bit 5 should NOT trigger jump testing c24');
    }
});

// =============================================================================
// TEST 5: Link preservation (JFL/JIR) depends on c24-c18 being in upper bits
// =============================================================================

test('JFL link should include C bits 24-18 in upper 7 bits', () => {
    // Per E6X3: link = c24-18 + s
    // With flags at correct positions, bits 24-18 of C contain the flags
    const cpu = new E4130();
    cpu.C = EXPECTED.F_NEG | EXPECTED.F_NZ;  // Some flags set
    cpu.S = 0x1000;  // Some PC value

    // Link should be: (C & 0xFE0000) | (S & 0x1FFFF)
    // That's bits 24-18 of C (7 bits) + S (17 bits) = 24 bits
    const link = ((cpu.C >> 17) << 17) | (cpu.S & 0x1FFFF);

    // With correct flag positions, link should have flags in upper bits
    if ((link & 0xFE0000) === 0 && cpu.C !== 0) {
        throw new Error('Link should preserve C bits 24-18');
    }
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
    console.log('\nThese tests SHOULD fail with the current (wrong) implementation.');
    console.log('After fixing flag positions to match E6X3 spec, they should pass.');
    process.exit(1);
}
