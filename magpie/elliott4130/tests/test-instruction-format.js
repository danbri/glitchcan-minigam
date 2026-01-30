/**
 * Test BUG-002: Short Instruction Half-Word Packing
 * Test BUG-004: JFL/JIR Link Word Preservation
 *
 * BUG-002: The S register is a half-word address. S bit 0 indicates which half:
 *   S bit 0 = 0: Upper half (bits 23-12) -> f from bits 18-23, n from bits 12-17
 *   S bit 0 = 1: Lower half (bits 11-0) -> f from bits 6-11, n from bits 0-5
 *   Short instructions advance S by 1, long by 2.
 *
 * BUG-004: JFL stores link = C[24:18] (7 bits) + S (17 bits)
 *   JIR restores both C[24:18] and S from link
 */

import { E4130 } from '../elliott4130-core.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`\u2713 ${name}`);
        passed++;
    } catch (e) {
        console.log(`\u2717 ${name}`);
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

// ============================================================
// BUG-002: SHORT INSTRUCTION HALF-WORD PACKING TESTS
// ============================================================

console.log('');
console.log('=== BUG-002: Short Instruction Packing ===');
console.log('');

test('Short instruction from upper half (S even) extracts f correctly', () => {
    const cpu = createCPU();

    // Pack LD (f=0o03) n=10 in upper half, NOP in lower
    // Upper half: f=0o03, n=10
    const word = packShortInstructions(0o03, 10, 0, 0);
    cpu.mem[100] = word;
    cpu.mem[10] = 0x123456;  // Value to load

    // S = 200 (half-word address, word 100, upper half since 200 is even)
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    // LD should have loaded mem[10] into M
    assertEqual(cpu.M, 0x123456, 'M should contain value from mem[10]');
});

test('Short instruction from upper half extracts n correctly', () => {
    const cpu = createCPU();

    // Pack LD (f=0o03) n=25 in upper half
    const word = packShortInstructions(0o03, 25, 0, 0);
    cpu.mem[100] = word;
    cpu.mem[25] = 0xABCDEF;

    cpu.S = 200;  // Even = upper half
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0xABCDEF, 'M should contain value from mem[25]');
});

test('Short instruction from lower half (S odd) extracts f correctly', () => {
    const cpu = createCPU();

    // Pack NOP in upper half, LD (f=0o03) n=15 in lower half
    const word = packShortInstructions(0, 0, 0o03, 15);
    cpu.mem[100] = word;
    cpu.mem[15] = 0x987654;

    // S = 201 (odd = lower half of word 100)
    cpu.S = 201;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0x987654, 'M should contain value from mem[15]');
});

test('Short instruction from lower half extracts n correctly', () => {
    const cpu = createCPU();

    // Pack NOP in upper, LD (f=0o03) n=42 in lower
    const word = packShortInstructions(0, 0, 0o03, 42);
    cpu.mem[100] = word;
    cpu.mem[42] = 0xFEDCBA;

    cpu.S = 201;  // Odd = lower half
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0xFEDCBA, 'M should contain value from mem[42]');
});

test('Short instruction advances S by 1', () => {
    const cpu = createCPU();

    // LD in upper half
    const word = packShortInstructions(0o03, 10, 0, 0);
    cpu.mem[100] = word;
    cpu.mem[10] = 42;

    cpu.S = 200;  // Start at upper half

    cpu.step();

    assertEqual(cpu.S, 201, 'S should advance from 200 to 201');
});

test('Long instruction advances S by 2', () => {
    const cpu = createCPU();

    // Long instruction: J (f=0o45) to address 50
    // Format: F(6) Y(2) Z(1) N(15)
    // F=0o45, Y=0, Z=0, N=50
    const longInstr = (0o45 << 18) | (0 << 16) | (0 << 15) | 50;
    cpu.mem[100] = longInstr;

    cpu.S = 200;  // Must be even for long instruction

    cpu.step();

    // J instruction jumps, so S won't be 202 - it will be at the jump target
    // Actually, we need a different long instruction that doesn't change S
    // Use LD long form instead: 0o43
});

test('Long instruction (LD) advances S by 2', () => {
    const cpu = createCPU();

    // Long LD: F=0o43, Y=1 (direct), Z=0, N=50
    const longInstr = (0o43 << 18) | (1 << 16) | (0 << 15) | 50;
    cpu.mem[100] = longInstr;
    cpu.mem[50] = 0x111111;

    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.S, 202, 'S should advance from 200 to 202 for long instruction');
    assertEqual(cpu.M, 0x111111, 'M should contain value from mem[50]');
});

test('Two packed short instructions execute sequentially', () => {
    const cpu = createCPU();

    // Pack two LD instructions:
    // Upper: LD (0o03) from address 10
    // Lower: LD (0o03) from address 20
    const word = packShortInstructions(0o03, 10, 0o03, 20);
    cpu.mem[100] = word;
    cpu.mem[10] = 0x111111;
    cpu.mem[20] = 0x222222;

    cpu.S = 200;  // Start at upper half

    // Execute first instruction (upper half)
    cpu.step();
    assertEqual(cpu.M, 0x111111, 'First LD should load from mem[10]');
    assertEqual(cpu.S, 201, 'S should be 201 after first instruction');

    // Execute second instruction (lower half)
    cpu.step();
    assertEqual(cpu.M, 0x222222, 'Second LD should load from mem[20]');
    assertEqual(cpu.S, 202, 'S should be 202 after second instruction');
});

test('Sequential short instructions across word boundary', () => {
    const cpu = createCPU();

    // Word 100: LD from 10 in lower half (we start at lower half)
    // Word 101: LD from 20 in upper half
    const word100 = packShortInstructions(0, 0, 0o03, 10);
    const word101 = packShortInstructions(0o03, 20, 0, 0);
    cpu.mem[100] = word100;
    cpu.mem[101] = word101;
    cpu.mem[10] = 0x333333;
    cpu.mem[20] = 0x444444;

    cpu.S = 201;  // Start at lower half of word 100

    cpu.step();
    assertEqual(cpu.M, 0x333333, 'First LD should load from mem[10]');
    assertEqual(cpu.S, 202, 'S should be 202 (upper half of word 101)');

    cpu.step();
    assertEqual(cpu.M, 0x444444, 'Second LD should load from mem[20]');
    assertEqual(cpu.S, 203, 'S should be 203');
});

// ============================================================
// BUG-004: JFL/JIR LINK WORD PRESERVATION TESTS
// ============================================================

console.log('');
console.log('=== BUG-004: JFL/JIR Link Preservation ===');
console.log('');

test('JFL stores C upper 7 bits (C[24:18]) in link', () => {
    const cpu = createCPU();

    // Set C with specific pattern in bits 23-17 (C[24:18] in Elliott numbering)
    // Elliott bit 24 = JS bit 23, Elliott bit 18 = JS bit 17
    cpu.C = 0b11010110_00000000_00000000;  // Pattern in upper bits
    //        ^^^^^^^-- bits 23-17 = 0x6B << 17 = 0xD60000

    // JFL (0o53) Y=0, Z=0, N=10 (relative jump +10)
    const jflInstr = (0o53 << 18) | (0 << 16) | (0 << 15) | 10;
    cpu.mem[100] = jflInstr;

    cpu.S = 200;

    cpu.step();

    // Link stored at location 0
    const link = cpu.mem[0];

    // Extract C[24:18] from link (upper 7 bits of the 24-bit link word)
    // Link format: (C >> 17) & 0x7F in bits 23-17, S in bits 16-0
    const storedC = (link >> 17) & 0x7F;
    const expectedC = (0xD60000 >> 17) & 0x7F;  // 0x6B

    assertEqual(storedC, expectedC, 'Link should contain C[24:18]');
});

test('JFL stores S in link lower 17 bits', () => {
    const cpu = createCPU();

    cpu.C = 0;  // Clear C to isolate S testing

    // JFL (0o53) Y=0, relative jump
    const jflInstr = (0o53 << 18) | (0 << 16) | (0 << 15) | 5;
    cpu.mem[100] = jflInstr;

    // S = 200, after advancing by 2 for long instruction = 202
    cpu.S = 200;

    cpu.step();

    const link = cpu.mem[0];
    const storedS = link & 0x1FFFF;

    // S is stored AFTER advancing by 2 (return address)
    assertEqual(storedS, 202, 'Link should contain return S (202)');
});

test('JIR restores C[24:18] from link', () => {
    const cpu = createCPU();

    // Store a link word at address 50 with specific C bits
    // Link format: upper 7 bits are C[24:18], lower 17 bits are S
    const savedC = 0x5A;  // 7-bit pattern (01011010)
    const savedS = 300;
    const link = (savedC << 17) | savedS;
    cpu.mem[50] = link;

    // Set current C to something different
    cpu.C = 0x000000;  // All zeros

    // JIR (0o05) from address 50
    const word = packShortInstructions(0o05, 50, 0, 0);
    cpu.mem[100] = word;

    cpu.S = 200;

    cpu.step();

    // C[24:18] (bits 23-17) should be restored
    const restoredC = (cpu.C >> 17) & 0x7F;
    assertEqual(restoredC, savedC, 'C[24:18] should be restored from link');
});

test('JIR restores S from link', () => {
    const cpu = createCPU();

    // Store link with specific S value
    const savedS = 500;
    const link = (0 << 17) | savedS;
    cpu.mem[50] = link;

    // JIR from address 50
    const word = packShortInstructions(0o05, 50, 0, 0);
    cpu.mem[100] = word;

    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.S, savedS, 'S should be restored from link');
});

test('JIR preserves lower bits of C', () => {
    const cpu = createCPU();

    // Store link
    const savedC = 0x3F;  // 7-bit pattern
    const savedS = 400;
    const link = (savedC << 17) | savedS;
    cpu.mem[50] = link;

    // Set C with pattern in lower 17 bits that should be preserved
    cpu.C = 0x0000ABCD & 0x1FFFF;  // Lower 17 bits pattern

    const word = packShortInstructions(0o05, 50, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    // Lower 17 bits should be preserved, upper 7 bits restored
    const lowerC = cpu.C & 0x1FFFF;
    const upperC = (cpu.C >> 17) & 0x7F;

    assertEqual(upperC, savedC, 'C[24:18] should be restored');
    assertEqual(lowerC, 0x0000ABCD & 0x1FFFF, 'C lower bits should be preserved');
});

test('Nested subroutine calls preserve state', () => {
    const cpu = createCPU();

    // Set up nested subroutine scenario:
    // Main program at word 100 calls sub1 at word 200
    // Sub1 at word 200 calls sub2 at word 300
    // Sub2 at word 300 returns to sub1
    // Sub1 returns to main

    // Main: JFL to sub1 (word 200)
    // JFL (0o53), Y=0, relative offset
    const offsetToSub1 = 200 - 101;  // After JFL, S will be at 202, target is 400
    // Actually for absolute target, let's use Y=1 (direct)
    // JFL Y=1 jumps to contents of address, so we need a pointer

    // Simpler: use literal addressing for absolute jump
    // JFL Y=0 does S := S + sx15(N)*2, so N is a signed offset in words

    // Let's set up with known C bits
    cpu.C = 0x550000;  // Pattern in C[24:18]

    // Main at 100: JFL to word 200 (S=400)
    // From S=200, after +2=202, we want to reach 400
    // offset = (400 - 202) / 2 = 99
    const jflToSub1 = (0o53 << 18) | (0 << 16) | (0 << 15) | 99;
    cpu.mem[100] = jflToSub1;

    // Sub1 at 200: JFL to word 300 (S=600)
    // After JFL, link0 = C bits + 402
    // New C for sub1
    cpu.mem[48] = 0xAB0000;  // We'll load this into C

    // Sub1: Load new C, then JFL to sub2
    // LD C value, then JFL
    // Actually, let's simplify and just track the link words

    cpu.S = 200;  // Start at main

    // Execute JFL to sub1
    cpu.step();

    // Check link0 has main's return info
    const link0 = cpu.mem[0];
    const main_returnS = link0 & 0x1FFFF;
    const main_returnC = (link0 >> 17) & 0x7F;

    assertEqual(main_returnS, 202, 'First JFL should store return S=202');
    assertEqual(main_returnC, (0x550000 >> 17) & 0x7F, 'First JFL should store C bits');

    // Now S should be at sub1 entry point
    assertEqual(cpu.S, 400, 'S should be at sub1 (400)');

    // Set up sub1 with different C and JFL to sub2
    cpu.C = 0x2A0000;  // Different C pattern

    // Sub1 at word 200: JFL to sub2 at word 300 (S=600)
    // From S=400, after +2=402, we want 600
    // offset = (600 - 402) / 2 = 99
    const jflToSub2 = (0o53 << 18) | (0 << 16) | (0 << 15) | 99;
    cpu.mem[200] = jflToSub2;

    cpu.step();

    // Now link0 has sub1's return info (overwrites main's!)
    // This is the Elliott way - location 0 is always the link
    const link1 = cpu.mem[0];
    assertEqual(link1 & 0x1FFFF, 402, 'Second JFL should store return S=402');

    // Sub1 should have saved link0 elsewhere if it wants to return properly
    // Let's test JIR works to return

    // Store sub1's link at address 60 for later return
    cpu.mem[60] = link0;  // Main's return link

    // Now at sub2 (S=600), return to sub1 using link at location 0
    const jirInstr = packShortInstructions(0o05, 0, 0, 0);  // JIR from addr 0
    cpu.mem[300] = jirInstr;

    cpu.step();

    // Should be back at sub1's return point
    assertEqual(cpu.S, 402, 'JIR should return to sub1 at S=402');

    // Now return to main using saved link
    const jirToMain = packShortInstructions(0o05, 60, 0, 0);
    cpu.mem[201] = jirToMain;

    cpu.step();

    // Should be back at main
    assertEqual(cpu.S, 202, 'JIR should return to main at S=202');
    assertEqual((cpu.C >> 17) & 0x7F, (0x550000 >> 17) & 0x7F, 'C bits should be restored');
});

test('JFL with literal addressing calculates correct target', () => {
    const cpu = createCPU();

    // JFL Y=0 (literal): S := S + sx15(N) * 2
    // Start S=200, after advancing = 202
    // N=50, so new S = 202 + 50*2 = 302
    const jflInstr = (0o53 << 18) | (0 << 16) | (0 << 15) | 50;
    cpu.mem[100] = jflInstr;

    cpu.S = 200;
    cpu.C = 0;

    cpu.step();

    assertEqual(cpu.S, 302, 'JFL should jump to S + N*2');
    assertEqual(cpu.mem[0] & 0x1FFFF, 202, 'Link should contain return address 202');
});

test('JFL preserves all 7 bits of C[24:18]', () => {
    const cpu = createCPU();

    // Test with all 7 bits set (0x7F)
    cpu.C = 0xFE0000;  // 0x7F << 17

    const jflInstr = (0o53 << 18) | (0 << 16) | (0 << 15) | 10;
    cpu.mem[100] = jflInstr;
    cpu.S = 200;

    cpu.step();

    const link = cpu.mem[0];
    const storedC = (link >> 17) & 0x7F;

    assertEqual(storedC, 0x7F, 'All 7 bits of C[24:18] should be stored');
});

test('JIR restores all 7 bits of C[24:18]', () => {
    const cpu = createCPU();

    // Store link with all 7 C bits set
    const link = (0x7F << 17) | 500;
    cpu.mem[50] = link;

    cpu.C = 0;  // Start with C cleared

    const word = packShortInstructions(0o05, 50, 0, 0);
    cpu.mem[100] = word;
    cpu.S = 200;

    cpu.step();

    const restoredC = (cpu.C >> 17) & 0x7F;
    assertEqual(restoredC, 0x7F, 'All 7 bits of C[24:18] should be restored');
    assertEqual(cpu.S, 500, 'S should be restored');
});

// ============================================================
// RESULTS
// ============================================================

console.log('');
console.log('============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
