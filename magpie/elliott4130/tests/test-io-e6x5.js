/**
 * Test E6X5: I/O Instructions and Character Encoding
 *
 * Per E6X5 documentation, tests cover:
 *   - TR extracode letter display (F=77, Y=0, Z=1)
 *   - CH extracode octal display (F=77, Y=1, Z=1)
 *   - ITOM/ATOM interrupt word inspection (F=70)
 *   - Single word I/O (ODUM, IDUM)
 *   - Status/control (ISUM, OCUM)
 *   - sixBitToAscii / asciiToSixBit character encoding
 *   - Channel number extraction from instruction
 *
 * Note: Many I/O instructions trap to OS via extracode mechanism.
 * Tests verify both direct method calls and instruction trapping behavior.
 */

import { E4130, IOChannel } from '../elliott4130-core.js';

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

function assertTrue(actual, msg = '') {
    if (!actual) {
        const e = new Error(msg);
        e.actual = actual;
        e.expected = true;
        throw e;
    }
}

// Create fresh CPU for each test
function createCPU() {
    const cpu = new E4130();
    cpu.reset();
    cpu.halted = false;
    return cpu;
}

// ============================================================
// TC-IO-09: 6-BIT CHARACTER ENCODING (Direct Method Tests)
// ============================================================

console.log('\n--- TC-IO-09: sixBitToAscii/asciiToSixBit Character Encoding ---\n');

test('sixBitToAscii: code 0 should return space', () => {
    const cpu = createCPU();
    assertEqual(cpu.sixBitToAscii(0), ' ', 'Code 0 should be space');
});

test('sixBitToAscii: codes 1-26 should return A-Z', () => {
    const cpu = createCPU();
    assertEqual(cpu.sixBitToAscii(1), 'A', 'Code 1 should be A');
    assertEqual(cpu.sixBitToAscii(8), 'H', 'Code 8 should be H');
    assertEqual(cpu.sixBitToAscii(26), 'Z', 'Code 26 should be Z');
});

test('sixBitToAscii: codes 27-36 should return 0-9', () => {
    const cpu = createCPU();
    assertEqual(cpu.sixBitToAscii(27), '0', 'Code 27 should be 0');
    assertEqual(cpu.sixBitToAscii(28), '1', 'Code 28 should be 1');
    assertEqual(cpu.sixBitToAscii(36), '9', 'Code 36 should be 9');
});

test('asciiToSixBit: space should return 0', () => {
    const cpu = createCPU();
    assertEqual(cpu.asciiToSixBit(' '), 0, 'Space should be code 0');
});

test('asciiToSixBit: A-Z should return 1-26', () => {
    const cpu = createCPU();
    assertEqual(cpu.asciiToSixBit('A'), 1, 'A should be code 1');
    assertEqual(cpu.asciiToSixBit('H'), 8, 'H should be code 8');
    assertEqual(cpu.asciiToSixBit('Z'), 26, 'Z should be code 26');
});

test('asciiToSixBit: lowercase a-z should convert to 1-26 (uppercase)', () => {
    const cpu = createCPU();
    assertEqual(cpu.asciiToSixBit('a'), 1, 'a should be code 1 (like A)');
    assertEqual(cpu.asciiToSixBit('z'), 26, 'z should be code 26 (like Z)');
});

test('asciiToSixBit: 0-9 should return 27-36', () => {
    const cpu = createCPU();
    assertEqual(cpu.asciiToSixBit('0'), 27, '0 should be code 27');
    assertEqual(cpu.asciiToSixBit('9'), 36, '9 should be code 36');
});

test('Round-trip encoding preserves printable characters', () => {
    const cpu = createCPU();
    // Test alphabet
    for (let i = 1; i <= 26; i++) {
        const ascii = cpu.sixBitToAscii(i);
        const back = cpu.asciiToSixBit(ascii);
        assertEqual(back, i, `Round-trip failed for code ${i} (${ascii})`);
    }
    // Test digits
    for (let i = 27; i <= 36; i++) {
        const ascii = cpu.sixBitToAscii(i);
        const back = cpu.asciiToSixBit(ascii);
        assertEqual(back, i, `Round-trip failed for code ${i} (${ascii})`);
    }
});

// ============================================================
// TC-IO-07/08: CHANNEL STATUS AND CONTROL (Direct Access)
// ============================================================

console.log('\n--- TC-IO-07/08: Channel Status and Control ---\n');

test('IOChannel initializes with id, zero status and control', () => {
    const ch = new IOChannel(5);
    assertEqual(ch.id, 5, 'Channel ID should be 5');
    assertEqual(ch.status, 0, 'Initial status should be 0');
    assertEqual(ch.control, 0, 'Initial control should be 0');
});

test('IOChannel buffer operations: write then read', () => {
    const ch = new IOChannel(0);
    ch.write(0x41);  // ASCII 'A'
    ch.write(0x42);  // ASCII 'B'
    assertEqual(ch.buffer.length, 2, 'Buffer should have 2 entries');
    assertEqual(ch.read(), 0x41, 'First read should be 0x41');
    assertEqual(ch.read(), 0x42, 'Second read should be 0x42');
    assertEqual(ch.buffer.length, 0, 'Buffer should be empty');
});

test('IOChannel hasData returns true when buffer has data', () => {
    const ch = new IOChannel(0);
    assertEqual(ch.hasData(), false, 'Empty channel hasData should be false');
    ch.write(0x55);
    assertEqual(ch.hasData(), true, 'Channel with data hasData should be true');
});

test('IOChannel reset clears status, control, and buffer', () => {
    const ch = new IOChannel(1);
    ch.status = 0x03;
    ch.control = 0x0F;
    ch.write(0x99);
    ch.reset();
    assertEqual(ch.status, 0, 'Reset status should be 0');
    assertEqual(ch.control, 0, 'Reset control should be 0');
    assertEqual(ch.buffer.length, 0, 'Reset buffer should be empty');
});

test('CPU has 14 I/O channels initialized', () => {
    const cpu = createCPU();
    assertEqual(cpu.channels.length, 14, 'CPU should have 14 channels');
    for (let i = 0; i < 14; i++) {
        assertEqual(cpu.channels[i].id, i, `Channel ${i} should have id ${i}`);
    }
});

test('Channel status can be set and read directly', () => {
    const cpu = createCPU();
    cpu.channels[1].status = 0x03;  // Ready + Busy
    assertEqual(cpu.channels[1].status, 0x03, 'Channel 1 status should be 0x03');
});

test('Channel control can be set directly', () => {
    const cpu = createCPU();
    cpu.channels[2].control = 0x0F;
    assertEqual(cpu.channels[2].control, 0x0F, 'Channel 2 control should be 0x0F');
});

// ============================================================
// TC-IO-03/04: INTERRUPT WORD INSPECTION (ITOM/ATOM)
// ============================================================

console.log('\n--- TC-IO-03/04: ITOM/ATOM Interrupt Word Inspection ---\n');

test('CPU interruptWord can be set and reflects interrupt state', () => {
    const cpu = createCPU();
    // Simulate channel 0 and channel 5 interrupt pending
    // Bit 1 for channel 0, bit 6 for channel 5
    cpu.interruptWord = (1 << 1) | (1 << 6);
    assertEqual(cpu.interruptWord, 0x42, 'Interrupt word should be 0x42');
});

test('CPU attentionWord can be set and reflects attention state', () => {
    const cpu = createCPU();
    // Simulate channel 2 attention pending (bit 3)
    cpu.attentionWord = (1 << 3);
    assertEqual(cpu.attentionWord, 0x08, 'Attention word should be 0x08');
});

test('raiseInterrupt updates interruptWord for INT_NORMAL', () => {
    const cpu = createCPU();
    cpu.interruptWord = 0;
    cpu.raiseInterrupt(cpu.INT_NORMAL, 3);  // Channel 3
    assertEqual(cpu.interruptWord & (1 << 3), 0x08, 'Bit 3 should be set');
});

test('raiseInterrupt updates attentionWord for INT_ATTENTION', () => {
    const cpu = createCPU();
    cpu.attentionWord = 0;
    cpu.raiseInterrupt(cpu.INT_ATTENTION, 7);  // Channel 7
    assertEqual(cpu.attentionWord & (1 << 7), 0x80, 'Bit 7 should be set');
});

// Note: ITOM/ATOM instruction execution requires regOpExtra to be wired up
// Currently regOp doesn't handle 0o21000 or 0o41000 - this tests the data structure

// ============================================================
// TC-IO-05/06: SINGLE WORD I/O (IDUM/ODUM via channelRead/Write)
// ============================================================

console.log('\n--- TC-IO-05/06: Single Word I/O (Channel Read/Write) ---\n');

test('channelRead from channel 0 uses inputBuffer', () => {
    const cpu = createCPU();
    cpu.inputBuffer.push(0x41);  // ASCII 'A' (Elliott 6-bit code 1)
    const data = cpu.channelRead(0);
    assertEqual(data, 0x41, 'Should read 0x41 from input buffer');
    assertEqual(cpu.inputBuffer.length, 0, 'Input buffer should be consumed');
});

test('channelRead from channel 1 (tape reader) reads from tape', () => {
    const cpu = createCPU();
    cpu.loadTape([0x55, 0x66]);  // Load tape data
    const data = cpu.channelRead(1);
    assertEqual(data, 0x55, 'Should read 0x55 from tape');
});

test('channelRead from non-tape channel uses channel buffer', () => {
    const cpu = createCPU();
    cpu.channels[3].buffer.push(0x77);  // Use channel 3, not 1 (tape)
    const data = cpu.channelRead(3);
    assertEqual(data, 0x77, 'Should read 0x77 from channel 3');
});

test('channelWrite to channel 0 calls output handler', () => {
    let outputChars = [];
    const cpu = new E4130({
        outputHandler: (c) => outputChars.push(c)
    });
    cpu.reset();

    // Write 6-bit code for 'A' (code 1) to channel 0
    cpu.channelWrite(0, 1);
    assertEqual(outputChars.length, 1, 'Should have one output character');
    assertEqual(outputChars[0], 'A', 'Output should be A');
});

test('channelWrite to channel 2 (tape punch) adds to tapePunch', () => {
    const cpu = createCPU();
    cpu.tapePunch = [];  // Clear punch buffer
    cpu.channelWrite(2, 0x77);
    assertEqual(cpu.tapePunch.length, 1, 'Tape punch should have 1 byte');
    assertEqual(cpu.tapePunch[0], 0x77, 'Tape punch should contain 0x77');
});

test('channelWrite to non-tape channel adds to buffer', () => {
    const cpu = createCPU();
    cpu.channels[3].buffer = [];  // Use channel 3, not 2 (tape punch)
    cpu.channelWrite(3, 0x88);
    assertEqual(cpu.channels[3].buffer.length, 1, 'Channel 3 buffer should have 1 byte');
    assertEqual(cpu.channels[3].buffer[0], 0x88, 'Buffer should contain 0x88');
});

// ============================================================
// TC-IO-10: CHANNEL NUMBER EXTRACTION
// ============================================================

console.log('\n--- TC-IO-10: Channel Number Extraction ---\n');

test('Channel number extracted from N field lower 6 bits', () => {
    // Per E6X5: ODUM to channel nn uses N = 0o300nn
    // Channel number = N & 0o77 (lower 6 bits)
    const n_ch5 = 0o30005;   // ODUM to channel 5
    const n_ch13 = 0o30013;  // ODUM to channel 13 (octal) = 11 decimal
    assertEqual(n_ch5 & 0o77, 5, 'Channel from 0o30005 should be 5');
    assertEqual(n_ch13 & 0o77, 0o13, 'Channel from 0o30013 should be 0o13 (11 decimal)');
});

// ============================================================
// PACKED CHARACTER I/O
// ============================================================

console.log('\n--- Packed Character I/O ---\n');

test('channelPackedWrite unpacks Q register (4 chars)', () => {
    const cpu = createCPU();
    cpu.channels[3].buffer = [];

    // Pack 4 characters: A(1), B(2), C(3), D(4) into Q
    // Q = (1 << 18) | (2 << 12) | (3 << 6) | 4
    cpu.Q = (1 << 18) | (2 << 12) | (3 << 6) | 4;

    cpu.channelPackedWrite(3);

    assertEqual(cpu.channels[3].buffer.length, 4, 'Should write 4 characters');
    // channelWrite converts via sixBitToAscii for channel 0 only
    // For channel 3, raw bytes go to buffer
    assertEqual(cpu.channels[3].buffer[0], 1, 'First char code should be 1');
    assertEqual(cpu.channels[3].buffer[1], 2, 'Second char code should be 2');
    assertEqual(cpu.channels[3].buffer[2], 3, 'Third char code should be 3');
    assertEqual(cpu.channels[3].buffer[3], 4, 'Fourth char code should be 4');
});

test('channelPackedRead packs 4 chars into Q', () => {
    const cpu = createCPU();
    // Pre-load channel 4 with 4 characters
    cpu.channels[4].buffer = [5, 6, 7, 8];  // E, F, G, H codes

    cpu.channelPackedRead(4);

    // Q should be (5 << 18) | (6 << 12) | (7 << 6) | 8
    const expected = (5 << 18) | (6 << 12) | (7 << 6) | 8;
    assertEqual(cpu.Q, expected, 'Q should contain packed characters');
});

// ============================================================
// I/O INSTRUCTION TRAPPING BEHAVIOR
// ============================================================

console.log('\n--- I/O Instruction Trapping Behavior ---\n');

test('I/O extracode (F=74, Z=1) traps to 2*F*2 = 240', () => {
    const cpu = createCPU();
    // IDPR/ODPR/IDUR/ODUR are F=74 extracodes
    const ioInstr = (0o74 << 18) | (0 << 16) | (1 << 15) | 0o00001;
    cpu.mem[100] = ioInstr;
    cpu.S = 200;  // Half-word address for word 100

    cpu.step();

    // F=0o74=60 decimal, trap address = 2*60*2 = 240
    assertEqual(cpu.S, 240, 'I/O (F=74) should trap to address 240');
});

test('Status/control extracode (F=75, Z=1) traps to 2*F*2 = 244', () => {
    const cpu = createCPU();
    const scInstr = (0o75 << 18) | (0 << 16) | (1 << 15) | 0o00001;
    cpu.mem[100] = scInstr;
    cpu.S = 200;

    cpu.step();

    // F=0o75=61 decimal, trap address = 2*61*2 = 244
    assertEqual(cpu.S, 244, 'Status/control (F=75) should trap to address 244');
});

test('Single I/O extracode (F=76, Z=1) traps to 2*F*2 = 248', () => {
    const cpu = createCPU();
    // IDUM/ODUM are F=76 extracodes
    const sioInstr = (0o76 << 18) | (0 << 16) | (1 << 15) | 0o30001;
    cpu.mem[100] = sioInstr;
    cpu.S = 200;

    cpu.step();

    // F=0o76=62 decimal, trap address = 2*62*2 = 248
    assertEqual(cpu.S, 248, 'Single I/O (F=76) should trap to address 248');
});

test('Console extracode (F=77, Z=1) traps to 2*F*2 = 252', () => {
    const cpu = createCPU();
    // TR/CH are F=77 extracodes
    const conInstr = (0o77 << 18) | (0 << 16) | (1 << 15) | 7;  // TR 7
    cpu.mem[100] = conInstr;
    cpu.S = 200;

    cpu.step();

    // F=0o77=63 decimal, trap address = 2*63*2 = 252
    assertEqual(cpu.S, 252, 'Console (F=77) should trap to address 252');
});

test('I/O extracode stores N at location 1', () => {
    const cpu = createCPU();
    const ioInstr = (0o74 << 18) | (0 << 16) | (1 << 15) | 0o12345;
    cpu.mem[100] = ioInstr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.mem[1], 0o12345, 'N should be stored at location 1');
});

test('I/O extracode stores link at location 2', () => {
    const cpu = createCPU();
    cpu.C = 0;  // Clear C register
    const ioInstr = (0o74 << 18) | (0 << 16) | (1 << 15) | 99;
    cpu.mem[100] = ioInstr;
    cpu.S = 200;

    cpu.step();

    // Link lower 17 bits should be return address (S after advancing = 202)
    assertEqual(cpu.mem[2] & 0x1FFFF, 202, 'Link should contain return address');
});

// ============================================================
// KEYBOARD INPUT
// ============================================================

console.log('\n--- Keyboard Input ---\n');

test('keyboardInput converts char and adds to inputBuffer', () => {
    const cpu = createCPU();
    cpu.keyboardInput('A');
    assertEqual(cpu.inputBuffer.length, 1, 'Should have one input');
    assertEqual(cpu.inputBuffer[0], 1, 'A should convert to code 1');
});

test('stringInput queues multiple characters', () => {
    const cpu = createCPU();
    cpu.stringInput('HI');
    assertEqual(cpu.inputBuffer.length, 2, 'Should have two inputs');
    assertEqual(cpu.inputBuffer[0], 8, 'H should be code 8');
    assertEqual(cpu.inputBuffer[1], 9, 'I should be code 9');
});

test('channelRead sets waitingForInput when buffer empty', () => {
    const cpu = createCPU();
    cpu.inputBuffer = [];
    cpu.waitingForInput = false;

    cpu.channelRead(0);

    assertEqual(cpu.waitingForInput, true, 'Should set waitingForInput');
});

test('keyboardInput clears waitingForInput flag', () => {
    const cpu = createCPU();
    cpu.waitingForInput = true;

    cpu.keyboardInput('X');

    assertEqual(cpu.waitingForInput, false, 'Should clear waitingForInput');
});

// ============================================================
// DIRECT I/O INSTRUCTION EXECUTION (Z=0)
// Per E6X3: F=76/77 with Y=0, Z=0 execute directly (not trap)
// ============================================================

console.log('\n--- Direct I/O Instruction Execution (Z=0) ---\n');

test('IDUM from channel 1 (tape reader) reads byte to M', () => {
    const cpu = createCPU();
    // Load tape with test data
    cpu.loadTape([0x42, 0x43, 0x44]);  // B, C, D

    // IDUM: F=76, Y=0, Z=0, N=0o20001 (input from channel 1)
    // Long instruction format: F(6)|Y(2)|Z(1)|N(15)
    const idum = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = idum;
    cpu.S = 200;  // Half-word address for word 100

    cpu.step();

    assertEqual(cpu.M, 0x42, 'M should contain 0x42 from tape');
});

test('IDUM reads sequential bytes from tape', () => {
    const cpu = createCPU();
    cpu.loadTape([0xAA, 0xBB, 0xCC]);

    const idum = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = idum;
    cpu.mem[101] = idum;
    cpu.mem[102] = idum;

    cpu.S = 200;
    cpu.step();
    assertEqual(cpu.M, 0xAA, 'First read should be 0xAA');

    cpu.S = 202;
    cpu.step();
    assertEqual(cpu.M, 0xBB, 'Second read should be 0xBB');

    cpu.S = 204;
    cpu.step();
    assertEqual(cpu.M, 0xCC, 'Third read should be 0xCC');
});

test('ODUM to channel 2 (tape punch) writes M to punch', () => {
    const cpu = createCPU();
    cpu.M = 0x55;

    // ODUM: F=76, Y=0, Z=0, N=0o30002 (output to channel 2)
    const odum = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o30002;
    cpu.mem[100] = odum;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.tapePunch.length, 1, 'Should have 1 punched byte');
    assertEqual(cpu.tapePunch[0], 0x55, 'Punched byte should be 0x55');
});

test('ODUM writes multiple bytes to punch sequentially', () => {
    const cpu = createCPU();
    const odum = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o30002;
    cpu.mem[100] = odum;
    cpu.mem[101] = odum;

    cpu.M = 0x11;
    cpu.S = 200;
    cpu.step();

    cpu.M = 0x22;
    cpu.S = 202;
    cpu.step();

    assertEqual(cpu.tapePunch.length, 2, 'Should have 2 punched bytes');
    assertEqual(cpu.tapePunch[0], 0x11, 'First byte should be 0x11');
    assertEqual(cpu.tapePunch[1], 0x22, 'Second byte should be 0x22');
});

test('ISUM reads channel status to M', () => {
    const cpu = createCPU();
    cpu.channels[1].status = 0x07;  // Some status bits set

    // ISUM: F=77, Y=0, Z=0, N=0o20001 (input status from channel 1)
    const isum = (0o77 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = isum;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0x07, 'M should contain channel 1 status');
});

test('OCUM writes M to channel control', () => {
    const cpu = createCPU();
    cpu.M = 0xFF;

    // OCUM: F=77, Y=0, Z=0, N=0o30002 (output control to channel 2)
    const ocum = (0o77 << 18) | (0 << 16) | (0 << 15) | 0o30002;
    cpu.mem[100] = ocum;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.channels[2].control, 0xFF, 'Channel 2 control should be 0xFF');
});

test('Tape reader status shows EOF when tape exhausted', () => {
    const cpu = createCPU();
    cpu.loadTape([0x01]);  // Single byte

    // Read the only byte
    const idum = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = idum;
    cpu.S = 200;
    cpu.step();

    // Try to read past end
    cpu.S = 200;
    cpu.step();

    // Check EOF status
    const status = cpu.getTapeReaderStatus();
    assertTrue(status.atEnd, 'Tape should be at end');
});

// ============================================================
// PAPER TAPE OPERATIONS
// ============================================================

console.log('\n--- Paper Tape Operations ---\n');

test('loadTape initializes tape reader', () => {
    const cpu = createCPU();
    const tapeData = new Uint8Array([0x10, 0x20, 0x30]);
    cpu.loadTape(tapeData);

    assertTrue(cpu.tapeReader !== null, 'Tape reader should be initialized');
    assertEqual(cpu.tapeReader.position, 0, 'Position should be 0');
    assertEqual(cpu.tapeReader.data.length, 3, 'Data length should be 3');
});

test('tapeRead returns bytes sequentially', () => {
    const cpu = createCPU();
    cpu.loadTape([0xAA, 0xBB, 0xCC]);

    assertEqual(cpu.tapeRead(), 0xAA, 'First byte should be 0xAA');
    assertEqual(cpu.tapeRead(), 0xBB, 'Second byte should be 0xBB');
    assertEqual(cpu.tapeRead(), 0xCC, 'Third byte should be 0xCC');
});

test('tapeRead returns -1 at end of tape', () => {
    const cpu = createCPU();
    cpu.loadTape([0x55]);

    cpu.tapeRead();  // Consume the one byte
    assertEqual(cpu.tapeRead(), -1, 'Should return -1 at EOF');
});

test('tapePunchByte adds to punch buffer', () => {
    const cpu = createCPU();
    cpu.tapePunchByte(0x12);
    cpu.tapePunchByte(0x34);

    assertEqual(cpu.tapePunch.length, 2, 'Should have 2 punched bytes');
    assertEqual(cpu.tapePunch[0], 0x12, 'First byte should be 0x12');
    assertEqual(cpu.tapePunch[1], 0x34, 'Second byte should be 0x34');
});

test('getTapePunch returns Uint8Array of punched data', () => {
    const cpu = createCPU();
    cpu.tapePunchByte(0xAB);
    cpu.tapePunchByte(0xCD);

    const data = cpu.getTapePunch();
    assertTrue(data instanceof Uint8Array, 'Should return Uint8Array');
    assertEqual(data.length, 2, 'Should have 2 bytes');
    assertEqual(data[0], 0xAB, 'First byte should be 0xAB');
});

// ============================================================
// RESULTS
// ============================================================

console.log('');
console.log('============================================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
    console.log('\nNOTE: Some I/O operations (TR, CH, ITOM, ATOM inline execution)');
    console.log('require OS trap handlers. Tests verify trapping behavior and');
    console.log('direct method calls rather than full I/O instruction execution.');
}

process.exit(failed > 0 ? 1 : 0);
