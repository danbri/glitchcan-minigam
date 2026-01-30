# E6X5 I/O Test Coverage Review

**Document:** E6X5-emulation-notes.md
**Date:** 2026-01-30
**Reviewer:** Claude (Opus 4.5)

---

## Executive Summary

The existing test suite provides excellent coverage for core CPU operations (condition flags, floating-point, instruction format, interrupts, shifts, protected mode) but has **minimal coverage for I/O-specific functionality**. The E6X5 documentation defines a comprehensive I/O subsystem that requires dedicated testing.

---

## Current Test Coverage Analysis

### What IS Tested (I/O-Related)

| Test File | I/O Coverage | Notes |
|-----------|--------------|-------|
| `test-extracode-traps.js` | I/O trap mechanism (lines 158-169) | Tests that I/O instruction (F=0o74) traps to 2*F*2 = 240 for OS mediation |
| `test-advanced-ops.js` | GET/PUT character manipulation (lines 485-598) | Tests 6-bit character rotation in Q and M registers, but NOT actual I/O transfer |
| `test-interrupts.js` | Interrupt priority and context save | Tests INT_HESITATION, INT_ATTENTION, INT_NORMAL priorities |

**Key Finding:** Only ONE I/O-specific test exists - verifying that I/O extracodes trap correctly. This is necessary but far from sufficient.

### What is NOT Tested

The following E6X5 I/O requirements have **zero test coverage**:

#### 1. Data Transfer Instructions (F=74)
- `IDPR` (74/0/000nn) - Input data packed repetitive
- `ODPR` (74/0/100nn) - Output data packed repetitive
- `IDUR` (74/0/200nn) - Input data unpacked repetitive
- `ODUR` (74/0/300nn) - Output data unpacked repetitive

#### 2. Status/Control Instructions (F=75)
- `ISPR` (75/0/000nn) - Input status packed repetitive
- `OCPR` (75/0/100nn) - Output control packed repetitive
- `ISUR` (75/0/200nn) - Input status unpacked repetitive
- `OCUR` (75/0/300nn) - Output control unpacked repetitive

#### 3. Single Word Transfers (F=76,77)
- `IDUM` (76/0/200nn) - Input data unpacked single to M
- `ODUM` (76/0/300nn) - Output data unpacked single from M
- `ISUM` (77/0/200nn) - Input status unpacked single to M
- `OCUM` (77/0/300nn) - Output control unpacked single from M

#### 4. Interrupt Inspection (F=70)
- `ITOM` (70/0/21000) - Read 12-bit interrupt word to M
- `ATOM` (70/0/41000) - Read 12-bit attention word to M

#### 5. Console I/O Extracodes (F=77, Z=1)
- `TR n` - Display nth letter of alphabet
- `CH` (y=1,2,3) - Display Q register in 8-digit octal

#### 6. Character Encoding
- `sixBitToAscii()` - Convert Elliott 6-bit character to ASCII
- `asciiToSixBit()` - Convert ASCII to Elliott 6-bit character
- Packed 4-character word handling

#### 7. Channel State Management
- Channel status word format
- Channel control word format
- Input/output buffer management
- Interrupt/attention pending flags per channel

---

## Critical Priority Assessment

### P0: Critical for Basic Emulation

| Requirement | Rationale |
|-------------|-----------|
| **TR/CH extracodes** | Essential for any program output/debugging |
| **IDUM/ODUM single transfers** | Minimum viable I/O for simple programs |
| **ITOM/ATOM inspection** | Required for interrupt-driven I/O |
| **sixBitToAscii/asciiToSixBit** | Foundation for all character I/O |

### P1: Required for Multi-Tasking/OS

| Requirement | Rationale |
|-------------|-----------|
| **Channel status read (ISUM)** | Device ready/busy detection |
| **Channel control write (OCUM)** | Device configuration |
| **Interrupt word format** | Bit n = channel n pending |
| **Protected mode I/O trapping** | OS mediation of I/O |

### P2: Complete I/O Subsystem

| Requirement | Rationale |
|-------------|-----------|
| **Packed data transfers** | High-throughput bulk I/O |
| **Repetitive transfers** | Autonomous block transfers |
| **ATU (Autonomous Transfer Unit)** | DMA-style transfers |

---

## Proposed Test Cases

### TC-IO-01: TR Extracode Letter Display

```javascript
test('TR extracode displays correct letter', () => {
    const cpu = createCPU();

    // TR 7 should display 'H' (8th letter, 0-indexed)
    const trInstr = (0o77 << 18) | (0 << 16) | (1 << 15) | 7;
    cpu.mem[100] = trInstr;
    cpu.S = 200;

    cpu.step();

    // Verify console output contains 'H'
    assertEqual(cpu.consoleOutput.includes('H'), true, 'TR 7 should output H');
});

test('TR extracode wraps at 26 (alphabet)', () => {
    const cpu = createCPU();

    // TR 26 should display 'A' (wrap around)
    const trInstr = (0o77 << 18) | (0 << 16) | (1 << 15) | 26;
    cpu.mem[100] = trInstr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.consoleOutput.includes('A'), true, 'TR 26 should wrap to A');
});
```

### TC-IO-02: CH Extracode Octal Display

```javascript
test('CH extracode displays M in 8-digit octal', () => {
    const cpu = createCPU();

    cpu.M = 0o123456;  // Octal 123456

    // CH extracode (F=77, Y=1, Z=1)
    const chInstr = (0o77 << 18) | (1 << 16) | (1 << 15) | 0;
    cpu.mem[100] = chInstr;
    cpu.S = 200;

    cpu.step();

    // Should display "00123456 " (8 octal digits + space)
    assertEqual(cpu.consoleOutput.includes('00123456'), true,
        'CH should display M as 8 octal digits');
});
```

### TC-IO-03: ITOM Interrupt Word Inspection

```javascript
test('ITOM loads interrupt word to M', () => {
    const cpu = createCPU();

    // Set channel 0 and channel 5 interrupt pending
    cpu.channels[0].interruptPending = true;
    cpu.channels[5].interruptPending = true;

    // ITOM instruction: 70/0/21000
    const itomInstr = (0o70 << 18) | (0 << 16) | (0 << 15) | 0o21000;
    cpu.mem[100] = itomInstr;
    cpu.S = 200;

    cpu.step();

    // M bits 1 and 6 should be set (channels 0 and 5)
    const expected = (1 << 1) | (1 << 6);  // Elliott numbering: bit n+1 for channel n
    assertEqual(cpu.M & 0xFFF, expected,
        'ITOM should reflect channel interrupt states');
});
```

### TC-IO-04: ATOM Attention Word Inspection

```javascript
test('ATOM loads attention word to M', () => {
    const cpu = createCPU();

    // Set channel 2 attention pending
    cpu.channels[2].attentionPending = true;

    // ATOM instruction: 70/0/41000
    const atomInstr = (0o70 << 18) | (0 << 16) | (0 << 15) | 0o41000;
    cpu.mem[100] = atomInstr;
    cpu.S = 200;

    cpu.step();

    // M bit 3 should be set (channel 2, Elliott numbering)
    const expected = (1 << 3);
    assertEqual(cpu.M & 0xFFF, expected,
        'ATOM should reflect channel attention states');
});
```

### TC-IO-05: ODUM Single Output

```javascript
test('ODUM outputs single byte to channel', () => {
    const cpu = createCPU();

    cpu.M = 0x41;  // ASCII 'A'

    // ODUM to channel 01: 76/0/30001
    const odumInstr = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o30001;
    cpu.mem[100] = odumInstr;
    cpu.S = 200;

    cpu.step();

    // Channel 01 output buffer should contain 'A'
    assertEqual(cpu.channels[1].outputBuffer.length, 1,
        'Channel should have one byte');
    assertEqual(cpu.channels[1].outputBuffer[0], 0x41,
        'Output byte should be 0x41');
});
```

### TC-IO-06: IDUM Single Input

```javascript
test('IDUM reads single byte from channel', () => {
    const cpu = createCPU();

    // Pre-load input buffer for channel 01
    cpu.channels[1].inputBuffer.push(0x42);  // ASCII 'B'

    // IDUM from channel 01: 76/0/20001
    const idumInstr = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = idumInstr;
    cpu.S = 200;
    cpu.M = 0;

    cpu.step();

    assertEqual(cpu.M, 0x42, 'M should contain input byte 0x42');
    assertEqual(cpu.channels[1].inputBuffer.length, 0,
        'Input buffer should be consumed');
});
```

### TC-IO-07: Status Read (ISUM)

```javascript
test('ISUM reads device status', () => {
    const cpu = createCPU();

    // Set channel 01 status: ready (bit 0), busy (bit 1)
    cpu.channels[1].status = 0x03;

    // ISUM from channel 01: 77/0/20001
    const isumInstr = (0o77 << 18) | (0 << 16) | (0 << 15) | 0o20001;
    cpu.mem[100] = isumInstr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.M, 0x03, 'M should contain status word');
});
```

### TC-IO-08: Control Write (OCUM)

```javascript
test('OCUM writes control word to device', () => {
    const cpu = createCPU();

    cpu.M = 0x0F;  // Control bits: enable all

    // OCUM to channel 01: 77/0/30001
    const ocumInstr = (0o77 << 18) | (0 << 16) | (0 << 15) | 0o30001;
    cpu.mem[100] = ocumInstr;
    cpu.S = 200;

    cpu.step();

    assertEqual(cpu.channels[1].control, 0x0F,
        'Channel control should be set');
});
```

### TC-IO-09: 6-Bit Character Encoding

```javascript
test('sixBitToAscii converts correctly', () => {
    const cpu = createCPU();

    // Elliott 6-bit codes (varies by installation, typical):
    // 01 = 'A', 02 = 'B', ..., 32 = space
    assertEqual(cpu.sixBitToAscii(0o01), 'A', '01 should be A');
    assertEqual(cpu.sixBitToAscii(0o32), ' ', '32 should be space');
    assertEqual(cpu.sixBitToAscii(0o00), '\0', '00 should be null');
});

test('asciiToSixBit converts correctly', () => {
    const cpu = createCPU();

    assertEqual(cpu.asciiToSixBit('A'), 0o01, 'A should be 01');
    assertEqual(cpu.asciiToSixBit(' '), 0o32, 'space should be 32');
});

test('Round-trip encoding preserves characters', () => {
    const cpu = createCPU();

    for (let i = 0; i < 64; i++) {
        const ascii = cpu.sixBitToAscii(i);
        if (ascii !== '\0') {  // Skip null
            const back = cpu.asciiToSixBit(ascii);
            assertEqual(back, i, `Round-trip failed for code ${i}`);
        }
    }
});
```

### TC-IO-10: Channel Number Extraction

```javascript
test('Channel number extracted from N field (nn)', () => {
    const cpu = createCPU();

    // ODUM to channel 13 (octal): N = 0o30013
    // Channel number = N & 0o77 = 13 (octal) = 11 (decimal)
    const odumInstr = (0o76 << 18) | (0 << 16) | (0 << 15) | 0o30013;
    cpu.mem[100] = odumInstr;
    cpu.M = 0x55;
    cpu.S = 200;

    cpu.step();

    // Should output to channel 11 (0o13)
    assertEqual(cpu.channels[11].outputBuffer[0], 0x55,
        'Output should go to channel 11');
});
```

---

## Implementation Notes

### Channel Object Structure (from E6X5 docs)

```javascript
class IOChannel {
    constructor(id) {
        this.id = id;
        this.status = 0;          // Device status bits
        this.control = 0;         // Control configuration
        this.inputBuffer = [];    // Pending input data
        this.outputBuffer = [];   // Output accumulation
        this.interruptPending = false;
        this.attentionPending = false;
    }
}
```

### Minimum Viable I/O (Phase 1)

1. **TR/CH extracodes** - Console output for debugging
2. **IDUM/ODUM** - Single word transfers
3. **ITOM/ATOM** - Interrupt inspection
4. **sixBitToAscii/asciiToSixBit** - Character encoding

### Channel Assignment Convention

| Channel | Device |
|---------|--------|
| 00 | Teleprinter/console |
| 01 | Paper tape reader |
| 02 | Paper tape punch |
| 03-05 | Magnetic tape |
| 06-07 | Disc |
| 10-13 | User peripherals |

### Interrupt Word Format

```
Bit 12: Channel 11 interrupt pending
Bit 11: Channel 10 interrupt pending
...
Bit 2:  Channel 01 interrupt pending
Bit 1:  Channel 00 interrupt pending
```

---

## Recommendations

1. **Create `test-io-basic.js`** - Tests for TR, CH, IDUM, ODUM, ITOM, ATOM
2. **Create `test-character-encoding.js`** - Tests for 6-bit character conversions
3. **Create `test-channel-system.js`** - Tests for channel state management
4. **Defer packed/repetitive transfers** - Lower priority, complex implementation

### Test File Organization Suggestion

```
tests/
├── test-condition-flags.js      # Existing
├── test-extracode-traps.js      # Existing
├── test-floating-point.js       # Existing
├── test-advanced-ops.js         # Existing
├── test-instruction-format.js   # Existing
├── test-interrupts.js           # Existing
├── test-io-basic.js             # NEW: TR, CH, IDUM, ODUM, ITOM, ATOM
├── test-io-channels.js          # NEW: Channel state, status, control
└── test-character-encoding.js   # NEW: 6-bit encoding
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| I/O tests require emulator I/O infrastructure | High | May need to implement IOChannel class first |
| Character encoding varies by installation | Medium | Document assumed encoding, make configurable |
| Packed transfers are complex | Low | Defer to Phase 2, focus on single transfers |

---

## Conclusion

The Elliott 4130 emulator test suite has **good coverage for computational operations** but **significant gaps in I/O testing**. The proposed test cases address the critical P0 requirements needed for basic program execution and debugging. Implementation should proceed in phases:

1. **Phase 1:** TR/CH extracodes, IDUM/ODUM, ITOM/ATOM (console I/O)
2. **Phase 2:** Channel status/control, interrupt word format
3. **Phase 3:** Packed/repetitive transfers, ATU

This phased approach ensures basic I/O works before tackling the more complex autonomous transfer system.
