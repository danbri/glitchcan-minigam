/**
 * Test BUG-006: Interrupt Priority Order
 * Test BUG-016: checkInterrupts() and Executive Mode
 *
 * Per E6X4 specification:
 *   - Interrupt levels: Hesitation (0) > Attention (1) > Normal (2)
 *   - Lower level number = higher priority
 *   - Interrupt handlers run in Executive Mode with full memory access
 *   - Context saved to locations 0, 3-5 before jumping to handler
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

// ============================================================
// BUG-006: INTERRUPT PRIORITY ORDER TESTS
// Per E6X4: Hesitation (0) > Attention (1) > Normal (2)
// ============================================================

test('INT_HESITATION should be 0 (highest priority)', () => {
    const cpu = createCPU();
    assertEqual(cpu.INT_HESITATION, 0, 'INT_HESITATION should equal 0');
});

test('INT_ATTENTION should be 1 (middle priority)', () => {
    const cpu = createCPU();
    assertEqual(cpu.INT_ATTENTION, 1, 'INT_ATTENTION should equal 1');
});

test('INT_NORMAL should be 2 (lowest priority)', () => {
    const cpu = createCPU();
    assertEqual(cpu.INT_NORMAL, 2, 'INT_NORMAL should equal 2');
});

test('Hesitation has higher priority than Attention (0 < 1)', () => {
    const cpu = createCPU();
    const hesitationHigher = cpu.INT_HESITATION < cpu.INT_ATTENTION;
    assertEqual(hesitationHigher, true, 'Hesitation (0) should be higher priority than Attention (1)');
});

test('Attention has higher priority than Normal (1 < 2)', () => {
    const cpu = createCPU();
    const attentionHigher = cpu.INT_ATTENTION < cpu.INT_NORMAL;
    assertEqual(attentionHigher, true, 'Attention (1) should be higher priority than Normal (2)');
});

test('Higher priority interrupt processed first when multiple pending', () => {
    const cpu = createCPU();

    // Raise interrupts in reverse priority order
    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);      // Low priority, vector 10
    cpu.raiseInterrupt(cpu.INT_ATTENTION, 20);   // Middle priority, vector 20
    cpu.raiseInterrupt(cpu.INT_HESITATION, 30);  // High priority, vector 30

    // All three should be pending
    assertEqual(cpu.pendingInterrupts.length, 3, 'Should have 3 pending interrupts');

    // Process first interrupt - should be Hesitation (highest priority)
    cpu.checkInterrupts();

    // S should jump to vector 30 * 2 = 60 (vector is half-word address)
    assertEqual(cpu.S, 60, 'First interrupt should be Hesitation with vector 30');

    // Should have 2 remaining
    assertEqual(cpu.pendingInterrupts.length, 2, 'Should have 2 pending after first');
});

test('Attention processed before Normal when both pending', () => {
    const cpu = createCPU();

    // Raise Normal first, then Attention
    cpu.raiseInterrupt(cpu.INT_NORMAL, 5);
    cpu.raiseInterrupt(cpu.INT_ATTENTION, 15);

    // Process first - should be Attention
    cpu.checkInterrupts();
    assertEqual(cpu.S, 30, 'Attention (vector 15) should be processed first');

    // Reset S and process second - should be Normal
    cpu.checkInterrupts();
    assertEqual(cpu.S, 10, 'Normal (vector 5) should be processed second');
});

// ============================================================
// BUG-016: checkInterrupts() AND EXECUTIVE MODE TESTS
// ============================================================

test('checkInterrupts() is called during step() - interrupt gets processed', () => {
    const cpu = createCPU();

    // Set up a simple instruction (NOP-like: ADD with 0)
    // Short ADD with address 0 (which contains 0)
    cpu.mem[100] = 0;  // Instruction word with ADD short (f=0o00)
    cpu.S = 200;  // Half-word address pointing to word 100

    // Raise an interrupt
    cpu.raiseInterrupt(cpu.INT_NORMAL, 50);

    // Execute one step - instruction executes, then interrupt processed
    cpu.step();

    // Interrupt should have been processed - S should be at vector 50 * 2 = 100
    assertEqual(cpu.S, 100, 'Interrupt should be processed during step()');
});

test('Interrupt handler enters Executive Mode', () => {
    const cpu = createCPU();

    // Start in Protected Mode
    cpu.executiveMode = false;
    cpu.baseReg = 10;
    cpu.rangeReg = 5;

    // Raise interrupt
    cpu.raiseInterrupt(cpu.INT_ATTENTION, 25);

    // Process interrupt
    cpu.checkInterrupts();

    // Should now be in Executive Mode
    assertEqual(cpu.executiveMode, true, 'Interrupt handler should run in Executive Mode');
});

test('Context saved: mode to location 3', () => {
    const cpu = createCPU();

    // Start in Protected Mode (executiveMode = false)
    cpu.executiveMode = false;

    // Raise and process interrupt
    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);
    cpu.checkInterrupts();

    // Location 3 should contain saved mode
    // Per implementation: 0 if was Executive, 1 if was Protected
    assertEqual(cpu.mem[3], 1, 'Location 3 should save Protected mode as 1');
});

test('Context saved: mode flag 0 when was Executive', () => {
    const cpu = createCPU();

    // Start in Executive Mode (default)
    cpu.executiveMode = true;

    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);
    cpu.checkInterrupts();

    // Location 3 should contain 0 for Executive mode
    assertEqual(cpu.mem[3], 0, 'Location 3 should save Executive mode as 0');
});

test('Context saved: base register to location 4', () => {
    const cpu = createCPU();

    // Set base register
    cpu.baseReg = 0x2AB;  // Some non-zero value

    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);
    cpu.checkInterrupts();

    // Location 4 should contain saved base register
    assertEqual(cpu.mem[4], 0x2AB, 'Location 4 should save base register');
});

test('Context saved: range register to location 5', () => {
    const cpu = createCPU();

    // Set range register
    cpu.rangeReg = 0x1FF;  // Some non-zero value

    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);
    cpu.checkInterrupts();

    // Location 5 should contain saved range register
    assertEqual(cpu.mem[5], 0x1FF, 'Location 5 should save range register');
});

test('Return address saved to location 0', () => {
    const cpu = createCPU();

    // Set S to a known value
    cpu.S = 0x1234;

    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);
    cpu.checkInterrupts();

    // Location 0 should contain return address (S value)
    assertEqual(cpu.mem[0], 0x1234, 'Location 0 should save return address S');
});

test('S jumps to interrupt vector (vector * 2)', () => {
    const cpu = createCPU();

    cpu.S = 500;  // Original S value

    // Raise interrupt with vector 42
    cpu.raiseInterrupt(cpu.INT_NORMAL, 42);
    cpu.checkInterrupts();

    // S should jump to vector * 2 = 84 (half-word addressing)
    assertEqual(cpu.S, 84, 'S should jump to vector * 2');
});

test('Full interrupt context save and vector jump (Executive Mode start)', () => {
    const cpu = createCPU();

    // Set up complete context - start in Executive Mode
    cpu.executiveMode = true;
    cpu.baseReg = 100;
    cpu.rangeReg = 50;
    cpu.S = 0x5678;

    // Raise interrupt
    cpu.raiseInterrupt(cpu.INT_HESITATION, 77);
    cpu.checkInterrupts();

    // Verify all saved context
    assertEqual(cpu.mem[0], 0x5678, 'Return address at location 0');
    assertEqual(cpu.mem[3], 0, 'Mode (Executive=0) at location 3');
    assertEqual(cpu.mem[4], 100, 'Base register at location 4');
    assertEqual(cpu.mem[5], 50, 'Range register at location 5');
    assertEqual(cpu.executiveMode, true, 'Still in Executive Mode');
    assertEqual(cpu.S, 154, 'S at vector 77 * 2 = 154');
});

test('Return address saved when starting in Protected Mode', () => {
    const cpu = createCPU();

    // Start in Protected Mode with region that INCLUDES location 0
    // baseReg=0 means permitted region starts at address 0
    cpu.executiveMode = false;
    cpu.baseReg = 0;
    cpu.rangeReg = 10;  // Permits addresses 0 to 10239
    cpu.S = 0x1234;

    cpu.raiseInterrupt(cpu.INT_NORMAL, 20);
    cpu.checkInterrupts();

    // Location 0 should be writable since it's in permitted region
    assertEqual(cpu.mem[0], 0x1234, 'Return address saved even from Protected Mode');
});

test('Interrupts not processed when disabled', () => {
    const cpu = createCPU();

    cpu.interruptEnabled = false;
    cpu.S = 1000;

    cpu.raiseInterrupt(cpu.INT_NORMAL, 50);
    const processed = cpu.checkInterrupts();

    assertEqual(processed, false, 'checkInterrupts should return false when disabled');
    assertEqual(cpu.S, 1000, 'S should not change when interrupts disabled');
    assertEqual(cpu.pendingInterrupts.length, 1, 'Interrupt should remain pending');
});

test('No interrupt processed when none pending', () => {
    const cpu = createCPU();

    cpu.S = 2000;

    const processed = cpu.checkInterrupts();

    assertEqual(processed, false, 'checkInterrupts should return false with no pending');
    assertEqual(cpu.S, 2000, 'S should not change with no pending interrupts');
});

// ============================================================
// RESULTS
// ============================================================

console.log('');
console.log('============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
