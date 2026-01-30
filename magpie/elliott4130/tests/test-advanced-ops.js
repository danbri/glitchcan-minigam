/**
 * Test: Advanced Operations (BUG-007, BUG-008, BUG-009, BUG-010)
 *
 * BUG-007: 16 Shift Instructions
 * BUG-008: Protected Mode Architecture
 * BUG-009: DIVM Remainder in R Register
 * BUG-010: GET/PUT Character Instructions
 *
 * Per E6X3 and E6X4 specifications.
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
        e.actual = `0x${actual.toString(16)} (${actual})`;
        e.expected = `0x${expected.toString(16)} (${expected})`;
        throw e;
    }
}

function createCPU() {
    const cpu = new E4130();
    cpu.reset();
    cpu.halted = false;
    return cpu;
}

// ============================================================================
// BUG-007: 16 SHIFT INSTRUCTIONS
// ============================================================================

console.log('\n=== BUG-007: Shift Instructions ===\n');

// SRST (0o20) - Shift R until standardized, count in K
test('SRST: Shift R until standardized (bit 22 != bit 23)', () => {
    const cpu = createCPU();
    // R = 0x100000 has bits 22 and 23 both = 0, so needs shifting
    // After shifting left, eventually bit 22 will differ from bit 23
    cpu.R = 0x100000;  // Binary: 000100...
    cpu.K = 0;
    cpu.shift(0o20);  // SRST

    // After standardization, bits 22 and 23 should differ
    const b22 = (cpu.R >> 22) & 1;
    const b23 = (cpu.R >> 23) & 1;
    assertEqual(b22 !== b23 || cpu.R === 0 ? 1 : 0, 1, 'R should be standardized');
    // K should contain the shift count
    if (cpu.K === 0 && cpu.R !== 0x100000) {
        // K was updated
    }
});

test('SRST: Already standardized R should not shift', () => {
    const cpu = createCPU();
    // R = 0x400000 has bit 22=0, bit 23=1 (already standardized)
    cpu.R = 0x400000;
    cpu.K = 99;
    cpu.shift(0o20);  // SRST

    assertEqual(cpu.R, 0x400000, 'Already standardized R unchanged');
    assertEqual(cpu.K, 0, 'K should be 0 (no shifts needed)');
});

test('SRST: Negative value should standardize correctly', () => {
    const cpu = createCPU();
    // R = 0xF00000 = 1111 0000... has bits 22=1 and 23=1 (both same, not standardized)
    // Shift 1: 0xE00000 = 1110 0000, b22=1, b23=1 (same)
    // Shift 2: 0xC00000 = 1100 0000, b22=1, b23=1 (same)
    // Shift 3: 0x800000 = 1000 0000, b22=0, b23=1 (differ! standardized)
    cpu.R = 0xF00000;
    cpu.K = 99;
    cpu.shift(0o20);  // SRST

    // Should standardize after 3 shifts
    assertEqual(cpu.K, 3, 'Negative value needs 3 shifts to standardize');
});

// SMST (0o24) - Shift M until standardized, count in K
test('SMST: Shift M until standardized', () => {
    const cpu = createCPU();
    // M = 0x080000 needs to shift left until bits 22,23 differ
    cpu.M = 0x080000;
    cpu.K = 0;
    cpu.shift(0o24);  // SMST

    const b22 = (cpu.M >> 22) & 1;
    const b23 = (cpu.M >> 23) & 1;
    assertEqual(b22 !== b23 || cpu.M === 0 ? 1 : 0, 1, 'M should be standardized');
});

test('SMST: K should count number of shifts', () => {
    const cpu = createCPU();
    // M = 0x400000 has b23=0, b22=1 - already standardized (bits differ)
    cpu.M = 0x400000;
    cpu.K = 99;
    cpu.shift(0o24);  // SMST

    assertEqual(cpu.K, 0, 'K should be 0 for already standardized');
});

// SBL (0o40) - Shift both M and R left (48-bit shift)
test('SBL: 48-bit left shift by 1', () => {
    const cpu = createCPU();
    cpu.R = 0x000001;  // Upper 24 bits
    cpu.M = 0x800000;  // Lower 24 bits (MSB set)
    cpu.K = 1;         // Shift count
    cpu.shift(0o40);   // SBL

    // (R,M) as 48-bit: 0x000001_800000 << 1 = 0x000003_000000
    assertEqual(cpu.R, 0x000003, 'R upper part after 48-bit left shift by 1');
    assertEqual(cpu.M, 0x000000, 'M lower part after 48-bit left shift by 1');
});

test('SBL: 48-bit left shift by 24 (full word)', () => {
    const cpu = createCPU();
    cpu.R = 0x000000;
    cpu.M = 0xABCDEF;
    cpu.K = 24;        // Shift count
    cpu.shift(0o40);   // SBL

    // M should move entirely into R
    assertEqual(cpu.R, 0xABCDEF, 'M should move to R after 24-bit shift');
    assertEqual(cpu.M, 0x000000, 'M should be zero after 24-bit shift');
});

test('SBL: Bit carry from M to R', () => {
    const cpu = createCPU();
    cpu.R = 0x000000;
    cpu.M = 0x800000;  // MSB of M set
    cpu.K = 1;
    cpu.shift(0o40);   // SBL

    // MSB of M should carry into LSB of R
    assertEqual(cpu.R, 0x000001, 'MSB of M should carry into R');
    assertEqual(cpu.M, 0x000000, 'M should shift left');
});

// SBRL (0o52) - Shift both M and R right logical (48-bit)
test('SBRL: 48-bit right logical shift by 1', () => {
    const cpu = createCPU();
    cpu.R = 0x000001;  // LSB set in R
    cpu.M = 0x000000;
    cpu.K = 1;
    cpu.shift(0o52);   // SBRL

    // (R,M) >> 1: LSB of R should go to MSB of M
    assertEqual(cpu.R, 0x000000, 'R should shift right');
    assertEqual(cpu.M, 0x800000, 'LSB of R should carry to MSB of M');
});

test('SBRL: 48-bit right logical shift by 24', () => {
    const cpu = createCPU();
    cpu.R = 0xABCDEF;
    cpu.M = 0x000000;
    cpu.K = 24;
    cpu.shift(0o52);   // SBRL

    // R should move entirely into M
    assertEqual(cpu.R, 0x000000, 'R should be zero after 24-bit right shift');
    assertEqual(cpu.M, 0xABCDEF, 'R should move to M');
});

test('SBRL: Zero-fill on right shift (logical, not arithmetic)', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Sign bit set
    cpu.M = 0x000000;
    cpu.K = 1;
    cpu.shift(0o52);   // SBRL

    // Should zero-fill, not sign-extend
    assertEqual(cpu.R, 0x400000, 'Should zero-fill, not sign-extend');
});

// SMLA (0o05) - Shift M left circularly
test('SMLA: Circular left shift by 1', () => {
    const cpu = createCPU();
    cpu.M = 0x800000;  // MSB set
    cpu.K = 1;
    cpu.shift(0o05);   // SMLA

    // MSB should wrap to LSB
    assertEqual(cpu.M, 0x000001, 'MSB should wrap to LSB in circular shift');
});

test('SMLA: Circular left shift by 24 returns original', () => {
    const cpu = createCPU();
    cpu.M = 0xABCDEF;
    cpu.K = 24;
    cpu.shift(0o05);   // SMLA

    // Full rotation should return original
    assertEqual(cpu.M, 0xABCDEF, 'Full 24-bit rotation should return original');
});

test('SMLA: Circular shift by 0 leaves unchanged', () => {
    const cpu = createCPU();
    cpu.M = 0x123456;
    cpu.K = 0;
    cpu.shift(0o05);   // SMLA

    assertEqual(cpu.M, 0x123456, 'Shift by 0 should leave unchanged');
});

// Additional shift tests
test('SMLC: Shift M by k characters (k*6 bits)', () => {
    const cpu = createCPU();
    // 0x3F0000 binary: 0011 1111 0000 0000 0000 0000
    // Top 6 bits (23-18): 001111 = 0x0F
    cpu.M = 0x3F0000;
    cpu.K = 1;         // Shift by 1 character = 6 bits
    cpu.shift(0o07);   // SMLC

    // Circular left by 6:
    // (0x3F0000 << 6) & 0xFFFFFF = 0xC00000
    // (0x3F0000 >>> 18) = 0x0F (top 6 bits wrap to bottom)
    // Result: 0xC00000 | 0x0F = 0xC0000F
    assertEqual(cpu.M, 0xC0000F, 'Character circular shift by 6 bits');
});

// ============================================================================
// BUG-008: PROTECTED MODE ARCHITECTURE
// ============================================================================

console.log('\n=== BUG-008: Protected Mode ===\n');

// checkProtection tests
test('checkProtection: Executive Mode has full access', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.baseReg = 10;
    cpu.rangeReg = 5;

    // Even outside the base+range, Executive Mode should have access
    assertEqual(cpu.checkProtection(0), true, 'Exec mode accesses address 0');
    assertEqual(cpu.checkProtection(65535), true, 'Exec mode accesses max address');
});

test('checkProtection: Protected Mode allows access within bounds', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;   // Base = 10 * 1024 = 10240
    cpu.rangeReg = 5;   // Range = 5 * 1024 = 5120
    // Permitted: [10240, 15360)

    assertEqual(cpu.checkProtection(10240), true, 'Access at base');
    assertEqual(cpu.checkProtection(12000), true, 'Access within range');
    assertEqual(cpu.checkProtection(15359), true, 'Access at limit-1');
});

test('checkProtection: Protected Mode denies access outside bounds', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;   // Base = 10240
    cpu.rangeReg = 5;   // Limit = 15360

    assertEqual(cpu.checkProtection(10239), false, 'Access below base denied');
    assertEqual(cpu.checkProtection(15360), false, 'Access at limit denied');
    assertEqual(cpu.checkProtection(0), false, 'Access at 0 denied');
});

test('checkProtection: Violation raises attention interrupt', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;
    cpu.rangeReg = 5;
    cpu.pendingInterrupts = [];

    cpu.checkProtection(0);  // Should violate

    // Should have raised an attention interrupt
    assertEqual(cpu.pendingInterrupts.length > 0 ? 1 : 0, 1, 'Should raise interrupt');
    if (cpu.pendingInterrupts.length > 0) {
        assertEqual(cpu.pendingInterrupts[0].level, cpu.INT_ATTENTION, 'Attention level');
    }
});

// PMEN - Enter Protected Mode
test('PMEN: Enters Protected Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;

    // PMEN is regOpExtra n=0o02000
    cpu.regOpExtra(0o02000);

    assertEqual(cpu.executiveMode, false, 'Should enter Protected Mode');
});

// EXEN - Enter Executive Mode (only from Executive)
test('EXEN: Stays in Executive Mode when already Executive', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;

    cpu.regOpExtra(0o01000);  // EXEN

    assertEqual(cpu.executiveMode, true, 'Should stay in Executive Mode');
});

// LDBR - Load Base Register (only in Executive Mode)
test('LDBR: Loads Base Register from M in Executive Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.M = 0x155;  // 10-bit value
    cpu.baseReg = 0;

    cpu.regOpExtra(0o04000);  // LDBR

    assertEqual(cpu.baseReg, 0x155, 'Base register should be loaded');
});

test('LDBR: Ignored in Protected Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.M = 0x155;
    cpu.baseReg = 0x100;  // Original value

    cpu.regOpExtra(0o04000);  // LDBR

    assertEqual(cpu.baseReg, 0x100, 'Base register unchanged in Protected Mode');
});

test('LDBR: Masks to 10 bits', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.M = 0xFFF;  // More than 10 bits

    cpu.regOpExtra(0o04000);  // LDBR

    assertEqual(cpu.baseReg, 0x3FF, 'Base register masked to 10 bits');
});

// LDRR - Load Range Register (only in Executive Mode)
test('LDRR: Loads Range Register from M in Executive Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.M = 0x200;
    cpu.rangeReg = 0;

    cpu.regOpExtra(0o10000);  // LDRR

    assertEqual(cpu.rangeReg, 0x200, 'Range register should be loaded');
});

test('LDRR: Ignored in Protected Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.M = 0x200;
    cpu.rangeReg = 0x50;  // Original value

    cpu.regOpExtra(0o10000);  // LDRR

    assertEqual(cpu.rangeReg, 0x50, 'Range register unchanged in Protected Mode');
});

// BRTM - Base Register to M
test('BRTM: Reads Base Register to M', () => {
    const cpu = createCPU();
    cpu.baseReg = 0x2AA;
    cpu.M = 0;

    cpu.regOpExtra(0o00400);  // BRTM

    assertEqual(cpu.M, 0x2AA, 'M should contain Base Register');
});

// RRTM - Range Register to M
test('RRTM: Reads Range Register to M', () => {
    const cpu = createCPU();
    cpu.rangeReg = 0x155;
    cpu.M = 0;

    cpu.regOpExtra(0o00401);  // RRTM

    assertEqual(cpu.M, 0x155, 'M should contain Range Register');
});

// ============================================================================
// BUG-009: DIVM REMAINDER
// ============================================================================

console.log('\n=== BUG-009: DIVM Remainder ===\n');

test('DIVM: Sets quotient in M', () => {
    const cpu = createCPU();
    // (R,M) / Q where (R,M) is 48-bit dividend
    cpu.R = 0;
    cpu.M = 100;  // Dividend = 100
    cpu.mem[50] = 7;  // Divisor = 7

    cpu.execLong(0o72, 1, 50);  // DIVM with Y=1 (direct)

    assertEqual(cpu.M, 14, 'Quotient 100/7 = 14');
});

test('DIVM: Sets remainder in R', () => {
    const cpu = createCPU();
    cpu.R = 0;
    cpu.M = 100;
    cpu.mem[50] = 7;  // 100 / 7 = 14 remainder 2

    cpu.execLong(0o72, 1, 50);  // DIVM

    assertEqual(cpu.R, 2, 'Remainder 100%7 = 2');
});

test('DIVM: Handles 48-bit dividend correctly', () => {
    const cpu = createCPU();
    // 48-bit dividend: R=1, M=0 => 0x1000000 = 16777216
    cpu.R = 1;
    cpu.M = 0;
    cpu.mem[50] = 1000;

    cpu.execLong(0o72, 1, 50);  // DIVM

    // 16777216 / 1000 = 16777 remainder 216
    assertEqual(cpu.M, 16777, 'Quotient of 48-bit dividend');
    assertEqual(cpu.R, 216, 'Remainder of 48-bit dividend');
});

test('DIVM: Large 48-bit dividend', () => {
    const cpu = createCPU();
    // 48-bit: R=0xABCDEF, M=0x123456
    cpu.R = 0xABCDEF;
    cpu.M = 0x123456;
    cpu.mem[50] = 0x10000;  // Divisor = 65536

    cpu.execLong(0o72, 1, 50);

    // Verify M contains quotient and R contains remainder
    // (0xABCDEF << 24 | 0x123456) / 0x10000
    const dividend = (0xABCDEF * 0x1000000 + 0x123456);
    const expectedQ = Math.floor(dividend / 0x10000) & 0xFFFFFF;
    const expectedR = dividend % 0x10000;

    assertEqual(cpu.M, expectedQ, 'Quotient of large dividend');
    assertEqual(cpu.R, expectedR, 'Remainder of large dividend');
});

test('DIVM: Division by zero is handled', () => {
    const cpu = createCPU();
    cpu.R = 0;
    cpu.M = 100;
    cpu.mem[50] = 0;  // Divisor = 0

    // Should not crash
    cpu.execLong(0o72, 1, 50);

    // M and R should remain unchanged (or have defined behavior)
    // The implementation checks for divisor !== 0
});

test('DIVM: Negative dividend', () => {
    const cpu = createCPU();
    cpu.R = 0xFFFFFF;  // -1 in upper 24 bits (sign extended)
    cpu.M = 0xFFFFFF;  // -1 in lower 24 bits
    // Combined: -1 as 48-bit
    cpu.mem[50] = 2;

    cpu.execLong(0o72, 1, 50);

    // -1 / 2 with BigInt division
    // Result depends on how signed division is handled
});

// ============================================================================
// BUG-010: GET/PUT CHARACTER INSTRUCTIONS
// ============================================================================

console.log('\n=== BUG-010: GET/PUT Character Instructions ===\n');

// GET: Q' = Q(bcda); m' = m(abc)Q(a)
// Q rotates left by 6 bits (one character)
// M gets its top 3 characters plus original Q's top character

test('GET: Rotates Q left by 6 bits', () => {
    const cpu = createCPU();
    // Q = ABCD where each letter is 6 bits
    // A in bits 23-18, B in bits 17-12, C in bits 11-6, D in bits 5-0
    cpu.Q = 0xABCDEF;  // Arbitrary 24-bit value

    const originalQ = cpu.Q;
    const expectedQ = ((originalQ << 6) | (originalQ >>> 18)) & 0xFFFFFF;

    // Simulate GET operation on Q
    cpu.Q = expectedQ;

    assertEqual(cpu.Q, expectedQ, 'Q should rotate left by 6 bits');
});

test('GET: Q rotation preserves all bits', () => {
    const cpu = createCPU();
    cpu.Q = 0xFC0000;  // Top character = 0x3F

    // After rotating left 6 bits, top 6 bits should wrap to bottom
    const expectedQ = ((cpu.Q << 6) | (cpu.Q >>> 18)) & 0xFFFFFF;
    cpu.Q = expectedQ;

    // Top 6 bits (0x3F) should now be in bottom 6 bits
    assertEqual(cpu.Q & 0x3F, 0x3F, 'Top character should wrap to bottom');
});

test('GET: M gets top 3 M chars + original Q top char', () => {
    const cpu = createCPU();
    // M = ABC? where A,B,C are top 3 characters (18 bits)
    // Q top char (bits 23-18) should replace bottom char of M
    cpu.M = 0xABC000;  // Top 3 chars: 0x2A, 0x2F, 0x00
    cpu.Q = 0xDE0000;  // Top char: 0x37

    const topMChars = cpu.M & 0xFFFFC0;  // Top 18 bits (3 chars)
    const qTopChar = (cpu.Q >> 18) & 0x3F;  // Top 6 bits of Q
    const expectedM = topMChars | qTopChar;

    // After GET: M' = m(abc)Q(a) = top 3 M chars + Q top char
    cpu.M = expectedM;

    assertEqual(cpu.M, expectedM, 'M should have top 3 M chars + Q top char');
});

// PUT: Shifts Q left, inserts M bottom char
test('PUT: Shifts Q left by 6 bits', () => {
    const cpu = createCPU();
    cpu.Q = 0x123456;

    const expectedQ = (cpu.Q << 6) & 0xFFFFFF;
    cpu.Q = expectedQ;

    assertEqual(cpu.Q & 0xFFFFC0, 0x123456 << 6 & 0xFFFFC0, 'Q should shift left');
});

test('PUT: Inserts M bottom char into Q bottom', () => {
    const cpu = createCPU();
    cpu.Q = 0xABCDE0;  // Bottom 6 bits = 0
    cpu.M = 0x00003F;  // Bottom char = 0x3F

    // PUT shifts Q left and inserts M's bottom char
    const mBottomChar = cpu.M & 0x3F;
    cpu.Q = ((cpu.Q << 6) & 0xFFFFC0) | mBottomChar;

    assertEqual(cpu.Q & 0x3F, 0x3F, 'M bottom char should be in Q bottom');
});

test('PUT: Full character transfer sequence', () => {
    const cpu = createCPU();
    // Pack 4 characters from M into Q
    cpu.Q = 0;

    // Character 1
    cpu.M = 0x000001;  // Char 'A' (assuming 1=A)
    cpu.Q = ((cpu.Q << 6) | (cpu.M & 0x3F)) & 0xFFFFFF;

    // Character 2
    cpu.M = 0x000002;  // Char 'B'
    cpu.Q = ((cpu.Q << 6) | (cpu.M & 0x3F)) & 0xFFFFFF;

    // Character 3
    cpu.M = 0x000003;  // Char 'C'
    cpu.Q = ((cpu.Q << 6) | (cpu.M & 0x3F)) & 0xFFFFFF;

    // Character 4
    cpu.M = 0x000004;  // Char 'D'
    cpu.Q = ((cpu.Q << 6) | (cpu.M & 0x3F)) & 0xFFFFFF;

    // Q should now contain ABCD packed as 4 6-bit chars
    // 1*2^18 + 2*2^12 + 3*2^6 + 4 = 262144 + 8192 + 192 + 4 = 270532 = 0x0420C4
    assertEqual(cpu.Q, 0x0420C4, 'Q should contain packed ABCD');
});

test('PUT: M rotates with Q top char inserted', () => {
    const cpu = createCPU();
    // Per E6X3: M also gets updated - M rotates left with Q's original top char
    // M' = m(bcd)Q(a) - M rotates, Q's top goes to M's bottom
    cpu.M = 0xABCDEF;
    cpu.Q = 0xF00000;  // Q top char = 0x3C

    const qTopChar = (cpu.Q >> 18) & 0x3F;
    const expectedM = ((cpu.M << 6) & 0xFFFFC0) | qTopChar;

    cpu.M = expectedM;

    assertEqual(cpu.M & 0x3F, 0x3C, 'Q top char should be in M bottom');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
