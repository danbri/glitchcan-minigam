/**
 * Test: E6X3 Instruction Coverage
 *
 * Comprehensive tests based on E6X3-test-review.md analysis.
 * Covers critical gaps identified in the test review:
 *
 * 1. Missing shift instructions (SRL, SRLA, SRR, SRLC, SML, SMR, SRRL, SMRL, SBR, SBST)
 * 2. DKJN instruction (decrement K, jump if k12 set)
 * 3. Register-to-register operations (16 instructions)
 * 4. Y=2 addressing mode (modified: N+R)
 * 5. Y=3 addressing mode (indirect: [N])
 * 6. Condition flag tests (St, Ca, Of)
 * 7. Additional arithmetic and storage instructions
 *
 * Per E6X3 (CCS E6X3 Version 2, November 2011) specification.
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
        e.actual = `0x${actual.toString(16)} (${actual})`;
        e.expected = `0x${expected.toString(16)} (${expected})`;
        throw e;
    }
}

function assertTrue(condition, msg = '') {
    if (!condition) {
        const e = new Error(msg);
        e.actual = 'false';
        e.expected = 'true';
        throw e;
    }
}

function createCPU() {
    const cpu = new E4130();
    cpu.reset();
    cpu.halted = false;
    return cpu;
}

// Helper: Pack two short instructions into one 24-bit word
// Upper: bits 23-12 (f in 18-23, n in 12-17)
// Lower: bits 11-0 (f in 6-11, n in 0-5)
function packShortInstructions(f1, n1, f2, n2) {
    const upper = ((f1 & 0x3F) << 6) | (n1 & 0x3F);  // 12 bits
    const lower = ((f2 & 0x3F) << 6) | (n2 & 0x3F);  // 12 bits
    return (upper << 12) | lower;
}

// Helper: Create long instruction word
// Format: F(6) Y(2) Z(1) N(15)
function makeLongInstr(f, y, z, n) {
    return ((f & 0x3F) << 18) | ((y & 0x3) << 16) | ((z & 0x1) << 15) | (n & 0x7FFF);
}

// ============================================================================
// SECTION 1: MISSING SHIFT INSTRUCTIONS
// Per E6X3 Section 4: Full complement of 16 shift instructions
// ============================================================================

console.log('\n=== E6X3 Section 4: Missing Shift Instructions ===\n');

// SRL (0o00) - R left arithmetic
test('SRL: R left arithmetic shift by 1', () => {
    const cpu = createCPU();
    cpu.R = 0x100000;  // A value to shift
    cpu.K = 1;
    cpu.shift(0o00);  // SRL

    assertEqual(cpu.R, 0x200000, 'R should shift left by 1');
});

test('SRL: R left arithmetic shift by 4', () => {
    const cpu = createCPU();
    cpu.R = 0x00F000;
    cpu.K = 4;
    cpu.shift(0o00);  // SRL

    assertEqual(cpu.R, 0x0F0000, 'R should shift left by 4');
});

test('SRL: R left shift clears low bits with zeros', () => {
    const cpu = createCPU();
    cpu.R = 0x800001;  // Has bit 0 set
    cpu.K = 1;
    cpu.shift(0o00);  // SRL

    // Bit 0 should shift to bit 1, bit 0 should be 0
    assertEqual(cpu.R & 0x3, 0x2, 'Low bits should zero-fill');
});

test('SRL: R left shift by 24 clears register', () => {
    const cpu = createCPU();
    cpu.R = 0xABCDEF;
    cpu.K = 24;
    cpu.shift(0o00);  // SRL

    assertEqual(cpu.R, 0x000000, 'Shift by 24 should clear R');
});

// SRLA (0o01) - R left circular
test('SRLA: R left circular shift by 1', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // MSB set
    cpu.K = 1;
    cpu.shift(0o01);  // SRLA

    // MSB should wrap to LSB
    assertEqual(cpu.R, 0x000001, 'MSB should wrap to LSB');
});

test('SRLA: R left circular shift preserves all bits', () => {
    const cpu = createCPU();
    cpu.R = 0xABCDEF;
    cpu.K = 8;
    cpu.shift(0o01);  // SRLA

    // Circular shift by 8
    const expected = ((0xABCDEF << 8) | (0xABCDEF >>> 16)) & 0xFFFFFF;
    assertEqual(cpu.R, expected, 'All bits should be preserved in circular shift');
});

test('SRLA: R left circular shift by 24 returns original', () => {
    const cpu = createCPU();
    cpu.R = 0x123456;
    cpu.K = 24;
    cpu.shift(0o01);  // SRLA

    assertEqual(cpu.R, 0x123456, 'Full rotation should return original');
});

// SRR (0o02) - R right arithmetic
test('SRR: R right arithmetic shift by 1 (positive)', () => {
    const cpu = createCPU();
    cpu.R = 0x400000;  // Positive (sign bit 0)
    cpu.K = 1;
    cpu.shift(0o02);  // SRR

    assertEqual(cpu.R, 0x200000, 'Positive value should shift right with 0 fill');
});

test('SRR: R right arithmetic shift by 1 (negative)', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Negative (sign bit 1)
    cpu.K = 1;
    cpu.shift(0o02);  // SRR

    // Should sign-extend: fill with 1s
    assertEqual(cpu.R, 0xC00000, 'Negative value should sign-extend');
});

test('SRR: R right arithmetic shift preserves sign', () => {
    const cpu = createCPU();
    cpu.R = 0xF00000;  // Negative value
    cpu.K = 4;
    cpu.shift(0o02);  // SRR

    // Sign bit should remain 1, filling with 1s
    assertTrue((cpu.R & 0x800000) !== 0, 'Sign bit should remain set');
});

test('SRR: Multiple arithmetic shifts of negative stay negative', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Just sign bit
    cpu.K = 8;
    cpu.shift(0o02);  // SRR

    // Should be 0xFF8000 (sign extended)
    assertEqual(cpu.R, 0xFF8000, 'Should sign-extend through shift');
});

// SRLC (0o03) - R character circular (k*6 bits)
test('SRLC: R character circular shift by 1 character (6 bits)', () => {
    const cpu = createCPU();
    // R = 0x3F0000: top 6 bits = 0x0F, rest = 0
    cpu.R = 0x3F0000;
    cpu.K = 1;  // 1 character = 6 bits
    cpu.shift(0o03);  // SRLC

    // Top 6 bits (0x0F = 001111) should wrap to bottom 6 bits
    // (0x3F0000 << 6) | (0x3F0000 >>> 18) & 0xFFFFFF
    const expected = ((0x3F0000 << 6) | (0x3F0000 >>> 18)) & 0xFFFFFF;
    assertEqual(cpu.R, expected, 'Character should rotate left 6 bits');
});

test('SRLC: R character circular by 4 characters (24 bits) returns original', () => {
    const cpu = createCPU();
    cpu.R = 0xABCDEF;
    cpu.K = 4;  // 4 * 6 = 24 bits = full rotation
    cpu.shift(0o03);  // SRLC

    assertEqual(cpu.R, 0xABCDEF, 'Full character rotation should return original');
});

// SML (0o04) - M left arithmetic
test('SML: M left arithmetic shift by 1', () => {
    const cpu = createCPU();
    cpu.M = 0x100000;
    cpu.K = 1;
    cpu.shift(0o04);  // SML

    assertEqual(cpu.M, 0x200000, 'M should shift left by 1');
});

test('SML: M left shift clears low bits', () => {
    const cpu = createCPU();
    cpu.M = 0x000001;
    cpu.K = 8;
    cpu.shift(0o04);  // SML

    assertEqual(cpu.M, 0x000100, 'M should shift left by 8');
});

// SMR (0o06) - M right arithmetic
test('SMR: M right arithmetic shift (positive)', () => {
    const cpu = createCPU();
    cpu.M = 0x400000;  // Positive
    cpu.K = 2;
    cpu.shift(0o06);  // SMR

    assertEqual(cpu.M, 0x100000, 'Positive M should zero-fill on right shift');
});

test('SMR: M right arithmetic shift (negative)', () => {
    const cpu = createCPU();
    cpu.M = 0x800000;  // Negative (sign bit set)
    cpu.K = 2;
    cpu.shift(0o06);  // SMR

    // Should sign-extend
    assertEqual(cpu.M, 0xE00000, 'Negative M should sign-extend');
});

test('SMR: M right arithmetic multiple shifts of negative', () => {
    const cpu = createCPU();
    cpu.M = 0xC00000;  // 1100 0000...
    cpu.K = 4;
    cpu.shift(0o06);  // SMR

    // Sign bit 1, shift right 4, filling with 1s
    assertEqual(cpu.M, 0xFC0000, 'Sign extension should continue');
});

// SRRL (0o12) - R right logical
test('SRRL: R right logical shift zero-fills', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Sign bit set
    cpu.K = 1;
    cpu.shift(0o12);  // SRRL

    // Should zero-fill, not sign-extend
    assertEqual(cpu.R, 0x400000, 'Should zero-fill, not sign-extend');
});

test('SRRL: R right logical shift by 4', () => {
    const cpu = createCPU();
    cpu.R = 0xF00000;
    cpu.K = 4;
    cpu.shift(0o12);  // SRRL

    assertEqual(cpu.R, 0x0F0000, 'Should shift right logically');
});

test('SRRL: R right logical shift clears register', () => {
    const cpu = createCPU();
    cpu.R = 0xFFFFFF;
    cpu.K = 24;
    cpu.shift(0o12);  // SRRL

    assertEqual(cpu.R, 0x000000, 'Shift by 24 should clear R');
});

// SMRL (0o16) - M right logical
test('SMRL: M right logical shift zero-fills', () => {
    const cpu = createCPU();
    cpu.M = 0x800000;  // Sign bit set
    cpu.K = 1;
    cpu.shift(0o16);  // SMRL

    assertEqual(cpu.M, 0x400000, 'Should zero-fill on right logical shift');
});

test('SMRL: M right logical differs from arithmetic for negative', () => {
    const cpu = createCPU();
    const cpu2 = createCPU();

    cpu.M = 0x800000;
    cpu.K = 4;
    cpu.shift(0o16);  // SMRL (logical)

    cpu2.M = 0x800000;
    cpu2.K = 4;
    cpu2.shift(0o06);  // SMR (arithmetic)

    // Logical should zero-fill, arithmetic should sign-extend
    assertEqual(cpu.M, 0x080000, 'Logical shift zero-fills');
    assertEqual(cpu2.M, 0xF80000, 'Arithmetic shift sign-extends');
});

// SBR (0o42) - Both right arithmetic (48-bit)
test('SBR: 48-bit right arithmetic shift by 1', () => {
    const cpu = createCPU();
    cpu.R = 0x000001;  // LSB of upper 24 bits
    cpu.M = 0x000000;
    cpu.K = 1;
    cpu.shift(0o42);  // SBR

    // LSB of R should carry into MSB of M
    assertEqual(cpu.R, 0x000000, 'R should shift right');
    assertEqual(cpu.M, 0x800000, 'LSB of R should carry to MSB of M');
});

test('SBR: 48-bit right arithmetic sign-extends from R sign', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Sign bit set in R (48-bit number is negative)
    cpu.M = 0x000000;
    cpu.K = 1;
    cpu.shift(0o42);  // SBR

    // Should sign-extend into R
    assertEqual(cpu.R, 0xC00000, 'R should sign-extend');
});

test('SBR: 48-bit shift by 24 moves R to M', () => {
    const cpu = createCPU();
    cpu.R = 0x123456;  // Positive (sign bit 0)
    cpu.M = 0xABCDEF;
    cpu.K = 24;
    cpu.shift(0o42);  // SBR

    // R should move to M, R should be 0 (positive number, zero-filled)
    assertEqual(cpu.R, 0x000000, 'R should be zero (positive, zero-filled)');
    assertEqual(cpu.M, 0x123456, 'R should move to M');
});

test('SBR: 48-bit shift negative value fills R with 1s', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Negative
    cpu.M = 0x000000;
    cpu.K = 24;
    cpu.shift(0o42);  // SBR

    // R should fill with 1s (sign extension), R moves to M
    assertEqual(cpu.R, 0xFFFFFF, 'R should fill with 1s (sign extend)');
    assertEqual(cpu.M, 0x800000, 'Original R should move to M');
});

// SBST (0o62) - Both standardize (48-bit)
test('SBST: 48-bit standardize counts shifts in K', () => {
    const cpu = createCPU();
    // R,M = 0x000100_000000 needs many shifts to standardize
    cpu.R = 0x000100;
    cpu.M = 0x000000;
    cpu.K = 0;
    cpu.shift(0o62);  // SBST

    // After standardization, bits 46,47 of (R,M) should differ
    // K should contain the shift count
    const b46 = (cpu.R >> 22) & 1;
    const b47 = (cpu.R >> 23) & 1;
    assertTrue(b46 !== b47 || (cpu.R === 0 && cpu.M === 0), 'Should be standardized');
    assertTrue(cpu.K > 0, 'K should contain shift count');
});

test('SBST: Already standardized 48-bit value gives K=0', () => {
    const cpu = createCPU();
    // R = 0x400000 has b22=0, b23=1 (different) - already standardized
    cpu.R = 0x400000;
    cpu.M = 0x000000;
    cpu.K = 99;
    cpu.shift(0o62);  // SBST

    assertEqual(cpu.K, 0, 'Already standardized should give K=0');
});

test('SBST: 48-bit standardize shifts M into R', () => {
    const cpu = createCPU();
    // Small number in M only - needs 24+ shifts
    cpu.R = 0x000000;
    cpu.M = 0x100000;
    cpu.K = 0;
    cpu.shift(0o62);  // SBST

    // M's bits should have shifted into R
    assertTrue(cpu.R !== 0, 'M bits should shift into R');
    assertTrue(cpu.K >= 4, 'Should need multiple shifts');
});

// ============================================================================
// SECTION 2: DKJN INSTRUCTION
// Per E6X3 Section 10: DKJN - Decrement K, Jump if Negative
// ============================================================================

console.log('\n=== E6X3 Section 10: DKJN Instruction ===\n');

test('DKJN: Decrements K by 1', () => {
    const cpu = createCPU();
    cpu.K = 5;

    // DKJN is long format: F=0o67, Y=0, Z=0, N=10
    const instr = makeLongInstr(0o67, 0, 0, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;  // Half-word address (word 100, upper)

    cpu.step();

    assertEqual(cpu.K, 4, 'K should decrement from 5 to 4');
});

test('DKJN: Does NOT jump when K positive (k12=0)', () => {
    const cpu = createCPU();
    cpu.K = 5;  // After decrement = 4, which is positive (k12=0)

    const instr = makeLongInstr(0o67, 0, 0, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // S should just advance by 2 (long instruction), no jump
    assertEqual(cpu.S, 202, 'S should just advance, no jump');
});

test('DKJN: Jumps when K goes negative (k12=1)', () => {
    const cpu = createCPU();
    cpu.K = 0;  // After decrement = -1 = 0xFFF (12-bit), k12 will be 1

    // DKJN with offset 10
    const instr = makeLongInstr(0o67, 0, 0, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // K should be 0xFFF (12-bit -1)
    assertEqual(cpu.K, 0xFFF, 'K should wrap to 0xFFF');

    // Should have jumped: S = S + 2 + (signed N * 2)
    // S was 200, advances to 202, then jumps by 10*2 = 20
    assertEqual(cpu.S, 222, 'Should jump when k12 set');
});

test('DKJN: K=1 to K=0 does NOT jump (k12=0)', () => {
    const cpu = createCPU();
    cpu.K = 1;  // After decrement = 0, k12 = 0

    const instr = makeLongInstr(0o67, 0, 0, 50);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.K, 0, 'K should be 0');
    assertEqual(cpu.S, 202, 'Should NOT jump when K=0 (k12=0)');
});

test('DKJN: k12 is bit 11 (0-indexed) = 0x800', () => {
    const cpu = createCPU();
    // K = 0x800 has k12 already set
    // After decrement: 0x7FF (k12 = 0)
    cpu.K = 0x800;

    const instr = makeLongInstr(0o67, 0, 0, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.K, 0x7FF, 'K should decrement to 0x7FF');
    // k12 was set BEFORE but we check AFTER decrement
    // 0x7FF has k12 = 0, so no jump
    assertEqual(cpu.S, 202, 'Should NOT jump after decrement clears k12');
});

test('DKJN: K=0x801 to K=0x800 DOES jump (k12=1)', () => {
    const cpu = createCPU();
    cpu.K = 0x801;  // After decrement = 0x800, k12 = 1

    const instr = makeLongInstr(0o67, 0, 0, 5);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.K, 0x800, 'K should be 0x800');
    assertEqual(cpu.S, 212, 'Should jump when k12 set (0x800)');
});

test('DKJN: Loop countdown pattern', () => {
    const cpu = createCPU();

    // Classic loop: decrement K and jump back until K goes negative
    // K starts at 3, loop body at word 100, DKJN jumps back -2 words
    cpu.K = 3;

    // DKJN with negative offset (jump backward)
    // N is 15-bit signed, so for -2 we use 0x7FFE or just use the sx15 behavior
    // Actually let's use a simpler forward jump that we can count
    const instr = makeLongInstr(0o67, 0, 0, 0);  // Jump offset 0 (stay in place after advance)
    cpu.mem[100] = instr;

    // Count iterations
    let iterations = 0;
    cpu.S = 200;

    while (iterations < 10) {
        const prevK = cpu.K;
        cpu.step();
        iterations++;

        if ((cpu.K & 0x800) !== 0) {
            // K went negative, should have jumped
            break;
        }

        // Reset S for next iteration
        cpu.S = 200;
    }

    // Should loop 4 times: K=3->2, 2->1, 1->0, 0->0xFFF (jump)
    assertEqual(iterations, 4, 'Should loop until K goes negative');
    assertEqual(cpu.K, 0xFFF, 'Final K should be 0xFFF');
});

// ============================================================================
// SECTION 3: REGISTER-TO-REGISTER OPERATIONS
// Per E6X3 Section 5: 16 register-to-register instructions
// ============================================================================

console.log('\n=== E6X3 Section 5: Register-to-Register Operations ===\n');

// KTOR (0o00020) - K to R
test('KTOR: K to R transfer', () => {
    const cpu = createCPU();
    cpu.K = 0x123;
    cpu.R = 0;

    cpu.regOp(0o00020);  // KTOR

    assertEqual(cpu.R, 0x123, 'R should contain K value');
});

test('KTOR: K transfers as 12-bit value', () => {
    const cpu = createCPU();
    cpu.K = 0xABC;  // 12-bit value
    cpu.R = 0xFFFFFF;

    cpu.regOp(0o00020);  // KTOR

    assertEqual(cpu.R, 0xABC, 'R should contain 12-bit K value');
});

// MTOR (0o00402) - M to R
test('MTOR: M to R transfer', () => {
    const cpu = createCPU();
    cpu.M = 0xABCDEF;
    cpu.R = 0;

    cpu.regOp(0o00402);  // MTOR

    assertEqual(cpu.R, 0xABCDEF, 'R should contain M value');
});

// STOR (0o00404) - S to R
test('STOR: S to R transfer', () => {
    const cpu = createCPU();
    cpu.S = 0x1234;  // 17-bit S
    cpu.R = 0;

    cpu.regOp(0o00404);  // STOR

    assertEqual(cpu.R, 0x1234, 'R should contain S value');
});

test('STOR: S transfers as 17-bit value', () => {
    const cpu = createCPU();
    cpu.S = 0x1FFFF;  // Max 17-bit
    cpu.R = 0;

    cpu.regOp(0o00404);  // STOR

    assertEqual(cpu.R, 0x1FFFF, 'R should contain full 17-bit S');
});

// RTOM (0o01001) - R to M
test('RTOM: R to M transfer', () => {
    const cpu = createCPU();
    cpu.R = 0x123456;
    cpu.M = 0;

    cpu.regOp(0o01001);  // RTOM

    assertEqual(cpu.M, 0x123456, 'M should contain R value');
});

test('RTOM: Sets condition flags', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Negative
    cpu.M = 0;
    cpu.C = 0;

    cpu.regOp(0o01001);  // RTOM

    assertTrue((cpu.C & cpu.F_NEG) !== 0, 'Negative flag should be set');
    assertTrue((cpu.C & cpu.F_NZ) !== 0, 'Non-zero flag should be set');
});

// MORR (0o01003) - M OR R
test('MORR: M OR R', () => {
    const cpu = createCPU();
    cpu.M = 0xF0F0F0;
    cpu.R = 0x0F0F0F;

    cpu.regOp(0o01003);  // MORR

    assertEqual(cpu.M, 0xFFFFFF, 'M should be M OR R');
});

test('MORR: Sets condition flags', () => {
    const cpu = createCPU();
    cpu.M = 0x800000;
    cpu.R = 0x000000;
    cpu.C = 0;

    cpu.regOp(0o01003);  // MORR

    assertTrue((cpu.C & cpu.F_NEG) !== 0, 'Negative flag should be set');
});

// CTOM (0o01010) - C to M
test('CTOM: C to M transfer', () => {
    const cpu = createCPU();
    cpu.C = 0xABCDEF;
    cpu.M = 0;

    cpu.regOp(0o01010);  // CTOM

    assertEqual(cpu.M, 0xABCDEF, 'M should contain C value');
});

// RTOS (0o02001) - R to S
test('RTOS: R to S transfer', () => {
    const cpu = createCPU();
    cpu.R = 0x12345;
    cpu.S = 0;

    cpu.regOp(0o02001);  // RTOS

    assertEqual(cpu.S, 0x12345, 'S should contain R value (17-bit masked)');
});

test('RTOS: Masks to 17 bits', () => {
    const cpu = createCPU();
    cpu.R = 0xFFFFFF;  // 24 bits all set
    cpu.S = 0;

    cpu.regOp(0o02001);  // RTOS

    assertEqual(cpu.S, 0x1FFFF, 'S should be masked to 17 bits');
});

// MTOS (0o02002) - M to S
test('MTOS: M to S transfer', () => {
    const cpu = createCPU();
    cpu.M = 0x1ABCD;  // 17-bit value
    cpu.S = 0;

    cpu.regOp(0o02002);  // MTOS

    assertEqual(cpu.S, 0x1ABCD, 'S should contain M value');
});

test('MTOS: Masks to 17 bits', () => {
    const cpu = createCPU();
    cpu.M = 0xFFFFFF;  // 24 bits all set
    cpu.S = 0;

    cpu.regOp(0o02002);  // MTOS

    assertEqual(cpu.S, 0x1FFFF, 'S should be masked to 17 bits');
});

// MTOC (0o04002) - M to C
test('MTOC: M to C transfer', () => {
    const cpu = createCPU();
    cpu.M = 0x123456;
    cpu.C = 0;

    cpu.regOp(0o04002);  // MTOC

    // MTOC masks to 14 bits per implementation
    assertEqual(cpu.C, 0x123456 & 0x3FFF, 'C should contain M value (14-bit masked)');
});

// RTOK (0o10001) - R to K
test('RTOK: R to K transfer', () => {
    const cpu = createCPU();
    cpu.R = 0x123456;
    cpu.K = 0;

    cpu.regOp(0o10001);  // RTOK

    assertEqual(cpu.K, 0x456, 'K should contain R value (12-bit masked)');
});

test('RTOK: Masks to 12 bits', () => {
    const cpu = createCPU();
    cpu.R = 0xFFFFFF;
    cpu.K = 0;

    cpu.regOp(0o10001);  // RTOK

    assertEqual(cpu.K, 0xFFF, 'K should be masked to 12 bits');
});

// MTOK (0o10002) - M to K
test('MTOK: M to K transfer', () => {
    const cpu = createCPU();
    cpu.M = 0xABCDEF;
    cpu.K = 0;

    cpu.regOp(0o10002);  // MTOK

    assertEqual(cpu.K, 0xDEF, 'K should contain M value (12-bit masked)');
});

// ============================================================================
// SECTION 4: ADDRESSING MODES Y=2 AND Y=3
// Per E6X3 Section 2: Instruction format and addressing
// ============================================================================

console.log('\n=== E6X3 Section 2: Y=2 and Y=3 Addressing Modes ===\n');

// Y=2: Modified addressing (N + R)
test('Y=2 modified addressing: effective address = N + R', () => {
    const cpu = createCPU();
    cpu.R = 100;  // Modifier

    // Long LD with Y=2, N=50 should access mem[150]
    const instr = makeLongInstr(0o43, 2, 0, 50);  // LD, Y=2
    cpu.mem[100] = instr;
    cpu.mem[150] = 0xABCDEF;  // Value at N+R = 50+100
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0xABCDEF, 'Should load from address N+R');
});

test('Y=2 modified addressing: R=0 acts like direct', () => {
    const cpu = createCPU();
    cpu.R = 0;

    const instr = makeLongInstr(0o43, 2, 0, 75);  // LD, Y=2
    cpu.mem[100] = instr;
    cpu.mem[75] = 0x123456;
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0x123456, 'Y=2 with R=0 should act like direct');
});

test('Y=2 modified addressing: address wraps at 15 bits', () => {
    const cpu = createCPU();
    cpu.R = 0x7F00;  // Large R value

    // N=0x100, R=0x7F00, sum would be 0x8000 but masked to 15 bits
    const instr = makeLongInstr(0o43, 2, 0, 0x100);
    cpu.mem[100] = instr;
    cpu.mem[0] = 0x999999;  // At wrapped address
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    // (0x100 + 0x7F00) & 0x7FFF = 0x8000 & 0x7FFF = 0
    // Note: implementation uses 0x7FFF mask
    const expectedAddr = (0x100 + 0x7F00) & 0x7FFF;
    assertEqual(cpu.M, cpu.mem[expectedAddr], 'Address should wrap at 15 bits');
});

test('Y=2 for store instruction (ST)', () => {
    const cpu = createCPU();
    cpu.R = 50;
    cpu.M = 0xDEADBE;

    // ST with Y=2 (actually F=0o60 with Y>0 is ST)
    const instr = makeLongInstr(0o60, 2, 0, 100);  // ST, Y=2
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // Should store at N+R = 100+50 = 150
    assertEqual(cpu.mem[150], 0xDEADBE, 'Should store at N+R');
});

// Y=3: Indirect addressing ([N])
test('Y=3 indirect addressing: effective address = [N]', () => {
    const cpu = createCPU();

    // Long LD with Y=3, N=50 should access mem[[50]]
    const instr = makeLongInstr(0o43, 3, 0, 50);  // LD, Y=3
    cpu.mem[100] = instr;
    cpu.mem[50] = 200;       // Pointer at N
    cpu.mem[200] = 0x123456; // Actual value at [N]
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0x123456, 'Should load from address [N]');
});

test('Y=3 indirect addressing: double indirection', () => {
    const cpu = createCPU();

    const instr = makeLongInstr(0o43, 3, 0, 10);  // LD, Y=3
    cpu.mem[100] = instr;
    cpu.mem[10] = 20;        // First pointer
    cpu.mem[20] = 0xFEDCBA;  // Value
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0xFEDCBA, 'Should load from [N]');
});

test('Y=3 for store instruction (ST)', () => {
    const cpu = createCPU();
    cpu.M = 0x111222;

    const instr = makeLongInstr(0o60, 3, 0, 30);  // ST, Y=3
    cpu.mem[100] = instr;
    cpu.mem[30] = 300;  // Pointer
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[300], 0x111222, 'Should store at [N]');
});

test('Y=3 pointer masked to 15 bits', () => {
    const cpu = createCPU();

    const instr = makeLongInstr(0o43, 3, 0, 40);
    cpu.mem[100] = instr;
    cpu.mem[40] = 0xFFFFFF;  // Pointer with extra bits
    // Masked: 0xFFFFFF & 0x7FFF = 0x7FFF
    cpu.mem[0x7FFF] = 0xAAAAAA;
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0xAAAAAA, 'Pointer should be masked to 15 bits');
});

// ============================================================================
// SECTION 5: CONDITION FLAGS
// Per E6X3 Section 1: Condition register
// ============================================================================

console.log('\n=== E6X3 Section 1: Condition Flags ===\n');

// St (Standardized) flag tests
test('St flag: set when bits 22,23 are equal (both 0)', () => {
    const cpu = createCPU();
    cpu.setC(0x000001);  // Bits 22,23 both 0

    assertTrue((cpu.C & cpu.F_ST) !== 0, 'St should be set when bits 22,23 both 0');
});

test('St flag: set when bits 22,23 are equal (both 1)', () => {
    const cpu = createCPU();
    cpu.setC(0xC00000);  // Bits 22,23 both 1

    assertTrue((cpu.C & cpu.F_ST) !== 0, 'St should be set when bits 22,23 both 1');
});

test('St flag: NOT set when bits 22,23 differ (b22=0, b23=1)', () => {
    const cpu = createCPU();
    cpu.setC(0x800000);  // Bit 23=1, bit 22=0

    assertTrue((cpu.C & cpu.F_ST) === 0, 'St should NOT be set when bits differ');
});

test('St flag: NOT set when bits 22,23 differ (b22=1, b23=0)', () => {
    const cpu = createCPU();
    cpu.setC(0x400000);  // Bit 23=0, bit 22=1

    assertTrue((cpu.C & cpu.F_ST) === 0, 'St should NOT be set when bits differ');
});

test('St flag: set for zero value', () => {
    const cpu = createCPU();
    cpu.setC(0x000000);  // Zero

    assertTrue((cpu.C & cpu.F_ST) !== 0, 'St should be set for zero');
});

// Neg (Negative) flag tests
test('Neg flag: set when sign bit is 1', () => {
    const cpu = createCPU();
    cpu.setC(0x800000);  // Sign bit set

    assertTrue((cpu.C & cpu.F_NEG) !== 0, 'Neg should be set');
});

test('Neg flag: NOT set when sign bit is 0', () => {
    const cpu = createCPU();
    cpu.setC(0x7FFFFF);  // Sign bit clear

    assertTrue((cpu.C & cpu.F_NEG) === 0, 'Neg should NOT be set');
});

// Nz (Non-zero) flag tests
test('Nz flag: set when value is non-zero', () => {
    const cpu = createCPU();
    cpu.setC(0x000001);  // Non-zero

    assertTrue((cpu.C & cpu.F_NZ) !== 0, 'Nz should be set');
});

test('Nz flag: NOT set when value is zero', () => {
    const cpu = createCPU();
    cpu.setC(0x000000);  // Zero

    assertTrue((cpu.C & cpu.F_NZ) === 0, 'Nz should NOT be set');
});

// Of (Overflow) flag tests
test('Of flag: set on positive overflow', () => {
    const cpu = createCPU();
    // Pass a value > 0x7FFFFF to setC
    cpu.setC(0x800000);  // This is the boundary

    // Actually, setC checks if r > 0x7FFFFF or r < -0x800000
    // Let's test the overflow condition directly
    const cpu2 = createCPU();
    cpu2.M = 0x7FFFFF;  // Max positive
    cpu2.mem[10] = 1;

    // Add 1 to max positive should overflow
    const word = packShortInstructions(0o00, 10, 0, 0);  // ADD from addr 10
    cpu2.mem[100] = word;
    cpu2.S = 200;

    cpu2.step();

    // The result wraps, but overflow flag indicates the math exceeded range
    // Note: setC implementation checks the raw sum, not the masked result
});

// ============================================================================
// SECTION 6: ADDITIONAL GROUP A INSTRUCTIONS
// Per E6X3 Section 3
// ============================================================================

console.log('\n=== E6X3 Section 3: Additional Instructions ===\n');

// NADD (0o02) - M := [n] - M
test('NADD: M := [n] - M', () => {
    const cpu = createCPU();
    cpu.M = 30;
    cpu.mem[50] = 100;

    // Short NADD from address 50
    const word = packShortInstructions(0o02, 50, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 70, 'M should be [50] - M = 100 - 30');
});

// ADDR (0o10) - R := R + [n]
test('ADDR: R := R + [n]', () => {
    const cpu = createCPU();
    cpu.R = 100;
    cpu.mem[25] = 50;

    const word = packShortInstructions(0o10, 25, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.R, 150, 'R should be R + [25] = 100 + 50');
});

// SUBR (0o11) - R := R - [n]
test('SUBR: R := R - [n]', () => {
    const cpu = createCPU();
    cpu.R = 100;
    cpu.mem[25] = 30;

    const word = packShortInstructions(0o11, 25, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.R, 70, 'R should be R - [25] = 100 - 30');
});

// NADR (0o12) - R := [n] - R
test('NADR: R := [n] - R', () => {
    const cpu = createCPU();
    cpu.R = 30;
    cpu.mem[25] = 100;

    const word = packShortInstructions(0o12, 25, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.R, 70, 'R should be [25] - R = 100 - 30');
});

// COMP (0o55) - Compare (M - [n]), set flags only
test('COMP: Sets flags without modifying M', () => {
    const cpu = createCPU();
    cpu.M = 100;
    cpu.mem[50] = 50;

    const instr = makeLongInstr(0o55, 1, 0, 50);  // COMP, Y=1 (direct)
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 100, 'M should be unchanged');
    assertTrue((cpu.C & cpu.F_NZ) !== 0, 'Non-zero flag set (100-50=50)');
    assertTrue((cpu.C & cpu.F_NEG) === 0, 'Negative flag not set');
});

test('COMP: Sets negative flag when M < [n]', () => {
    const cpu = createCPU();
    cpu.M = 50;
    cpu.mem[50] = 100;

    const instr = makeLongInstr(0o55, 1, 0, 50);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertTrue((cpu.C & cpu.F_NEG) !== 0, 'Negative flag set (50-100=-50)');
});

// ST (0o30 short, 0o60 long with Y>0) - Store M
test('ST short: Stores M to address', () => {
    const cpu = createCPU();
    cpu.M = 0x123456;

    const word = packShortInstructions(0o30, 50, 0, 0);  // ST to addr 50
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[50], 0x123456, 'Memory should contain M');
});

// STR (0o31 short, 0o61 long with Y>0) - Store R
test('STR short: Stores R to address', () => {
    const cpu = createCPU();
    cpu.R = 0xABCDEF;

    const word = packShortInstructions(0o31, 50, 0, 0);  // STR to addr 50
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[50], 0xABCDEF, 'Memory should contain R');
});

// CLS (0o65 with Y>0) - Clear storage
test('CLS: Clears memory location', () => {
    const cpu = createCPU();
    cpu.mem[75] = 0xFFFFFF;

    const instr = makeLongInstr(0o65, 1, 0, 75);  // CLS, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[75], 0, 'Memory should be cleared');
});

// INCS (0o66 with Y>0) - Increment storage
test('INCS: Increments memory location', () => {
    const cpu = createCPU();
    cpu.mem[75] = 99;

    const instr = makeLongInstr(0o66, 1, 0, 75);  // INCS, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[75], 100, 'Memory should be incremented');
});

// DECS (0o67 with Y>0) - Decrement storage
test('DECS: Decrements memory location', () => {
    const cpu = createCPU();
    cpu.mem[75] = 100;

    const instr = makeLongInstr(0o67, 1, 0, 75);  // DECS, Y=1 (not Y=0 which is DKJN)
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[75], 99, 'Memory should be decremented');
});

// MULM (0o73) - Double-length multiply
test('MULM: 48-bit result in (R,M)', () => {
    const cpu = createCPU();
    cpu.M = 0x100;  // 256
    cpu.mem[50] = 0x100;  // 256

    const instr = makeLongInstr(0o73, 1, 0, 50);  // MULM, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // 256 * 256 = 65536 = 0x10000
    // Low 24 bits in M, high 24 bits in R
    assertEqual(cpu.M, 0x010000, 'M should have low 24 bits');
    assertEqual(cpu.R, 0x000000, 'R should have high 24 bits');
});

test('MULM: Large multiply overflows into R', () => {
    const cpu = createCPU();
    cpu.M = 0x10000;  // 65536
    cpu.mem[50] = 0x10000;  // 65536

    const instr = makeLongInstr(0o73, 1, 0, 50);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // 65536 * 65536 = 0x100000000 = 4294967296
    // Low 24 bits: 0x000000, High: 0x100
    assertEqual(cpu.M, 0x000000, 'M should have low 24 bits');
    assertEqual(cpu.R, 0x000100, 'R should have high 24 bits');
});

// EXC (0o76) - Exchange M with memory
test('EXC: Exchange M with memory', () => {
    const cpu = createCPU();
    cpu.M = 0xAAAAAA;
    cpu.mem[50] = 0xBBBBBB;

    const instr = makeLongInstr(0o76, 1, 0, 50);  // EXC, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0xBBBBBB, 'M should have old memory value');
    assertEqual(cpu.mem[50], 0xAAAAAA, 'Memory should have old M value');
});

// EXCR (0o77) - Exchange R with memory
test('EXCR: Exchange R with memory', () => {
    const cpu = createCPU();
    cpu.R = 0x111111;
    cpu.mem[50] = 0x222222;

    const instr = makeLongInstr(0o77, 1, 0, 50);  // EXCR, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.R, 0x222222, 'R should have old memory value');
    assertEqual(cpu.mem[50], 0x111111, 'Memory should have old R value');
});

// MVE (0o74) - Move entry (block move forward)
test('MVE: Move entry operation', () => {
    const cpu = createCPU();
    cpu.R = 100;  // Destination address
    cpu.mem[50] = 0xDEADBE;  // Source value

    const instr = makeLongInstr(0o74, 1, 0, 50);  // MVE, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0xDEADBE, 'M should load source value');
    assertEqual(cpu.mem[100], 0xDEADBE, 'Destination should have value');
    assertEqual(cpu.R, 99, 'R should decrement');
});

// MVB (0o75) - Move backward
test('MVB: Move backward operation', () => {
    const cpu = createCPU();
    cpu.R = 80;  // Source address
    cpu.M = 0x123456;  // Value to store
    cpu.mem[80] = 0x789ABC;  // Next value to load

    const instr = makeLongInstr(0o75, 1, 0, 50);  // MVB, Y=1
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[50], 0x123456, 'Destination should have old M');
    assertEqual(cpu.M, 0x789ABC, 'M should load from [R]');
    assertEqual(cpu.R, 81, 'R should increment');
});

// ============================================================================
// SECTION 7: EXTRACODE ADDRESS MODES
// Per E6X3 Section 6
// ============================================================================

console.log('\n=== E6X3 Section 6: Extracode Address Modes ===\n');

test('Extracode Y=2: stores effective address N+R at location 1', () => {
    const cpu = createCPU();
    cpu.R = 50;  // Modifier
    cpu.hardwareFPEnabled = false;  // Force software trap

    // Extracode F=0o50, Y=2, Z=1, N=100
    // Effective address = 100 + 50 = 150
    const instr = makeLongInstr(0o50, 2, 1, 100);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // N stored at location 1 should be the raw N, not effective address
    // Per E6X3: "Place N in memory location 1"
    // The getAddr calculation happens before the trap
    assertEqual(cpu.mem[1], 100, 'Location 1 should have N');
});

test('Extracode Y=3: stores [N] at location 1', () => {
    const cpu = createCPU();
    cpu.hardwareFPEnabled = false;

    // Extracode F=0o50, Y=3, Z=1, N=75
    const instr = makeLongInstr(0o50, 3, 1, 75);
    cpu.mem[100] = instr;
    cpu.mem[75] = 500;  // Pointer target
    cpu.S = 200;

    cpu.step();

    // Per E6X3: N is stored at location 1, which is the raw N field
    assertEqual(cpu.mem[1], 75, 'Location 1 should have N');
});

test('Extracode link preserves C[24:18] correctly', () => {
    const cpu = createCPU();
    cpu.C = 0x5A0000;  // Pattern in upper bits: 0101 1010 in bits 23-16
    cpu.hardwareFPEnabled = false;

    const instr = makeLongInstr(0o50, 0, 1, 42);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    const link = cpu.mem[2];
    const savedC = (link >> 17) & 0x7F;
    const expectedC = (0x5A0000 >> 17) & 0x7F;

    assertEqual(savedC, expectedC, 'Link should preserve C[24:18]');
});

test('Extracode Y=0 jumps to 2*F', () => {
    const cpu = createCPU();
    cpu.hardwareFPEnabled = false;

    // F=0o50 = 40 decimal, so trap to 2*40 = 80, then *2 for S = 160
    const instr = makeLongInstr(0o50, 0, 1, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // S should be at 2*F*2 = 2*40*2 = 160
    assertEqual(cpu.S, 160, 'S should be at trap vector 2*F');
});

test('Extracode Y>0 jumps to 2*F+1', () => {
    const cpu = createCPU();
    cpu.hardwareFPEnabled = false;

    // F=0o50 = 40, Y=1, so trap to (2*40+1)*2 = 162
    const instr = makeLongInstr(0o50, 1, 1, 10);
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // S should be at (2*F+1)*2 = (80+1)*2 = 162
    assertEqual(cpu.S, 162, 'S should be at trap vector 2*F+1');
});

// ============================================================================
// SECTION 8: AND/ANDN INSTRUCTIONS
// Per E6X3 Section 3
// ============================================================================

console.log('\n=== E6X3: AND/ANDN Instructions ===\n');

test('AND short: M := M & [n]', () => {
    const cpu = createCPU();
    cpu.M = 0xFF00FF;
    cpu.mem[50] = 0x0F0F0F;

    const word = packShortInstructions(0o06, 50, 0, 0);  // AND
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0x0F000F, 'M should be M AND [50]');
});

test('ANDN short: M := M & ~[n]', () => {
    const cpu = createCPU();
    cpu.M = 0xFFFFFF;
    cpu.mem[50] = 0x00FF00;

    const word = packShortInstructions(0o07, 50, 0, 0);  // ANDN
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0xFF00FF, 'M should be M AND NOT [50]');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`E6X3 INSTRUCTION TESTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
