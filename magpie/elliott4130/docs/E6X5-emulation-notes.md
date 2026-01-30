# E6X5 Emulation Notes

## Document Overview

**E6X5** (Version 3, 1/7/2014) is a **bibliography/reference list** for the Elliott 4100 Series computers, not a technical manual. It contains 9 primary references including:

1. Elliott 4150/4120 functional specification (May 1964)
2. "Computers and Orders, 1947-1966" booklet (early 1967)
3. 4100 FACTS booklet (October 1967)
4. Appendix C: NCR-Elliott 4100 4130 Processor specification
5. Appendix E: 4100 Autonomous Transfer Unit specification
6. ICL Archive item numbers (38/152-38/155, 38/163, 38/181-38/201, 38/215)
7. "Moving Targets" book by S H Lavington (Springer)
8. Kent On-Line System paper (Software - Practice and Experience, 1971)
9. POP-2 Edinburgh references

**Note:** I/O technical details are found in **E6X2** (architecture) and **E6X3** (instructions).

---

## I/O Architecture (from E6X2/E6X3)

### Standard Interface

Physical plug/socket arrangement for all peripherals:
- **8 data-in lines**
- **8 data-out lines**
- **3 interrupt lines**
- **11 control/status/timing signals**

### Channel System

- Up to **12 independent, asynchronous channels** (expandable to 14)
- Channel number encoded in last 2 octal digits of N field (`nn`)
- Each channel can trigger: **Interrupt** or **Attention**

### Autonomous Transfer Unit (ATU)

- Optional for 4120, **built-in for 4130**
- Bulk data transfers via cycle-stealing
- Up to **3 packed transfer units** + **1 unpacked transfer unit**
- Hardware **Hesitation** (high-priority interrupt) for ADT

### Interrupt Architecture

Three priority levels:
1. **Hesitation** - Highest, for ADT cycle-stealing
2. **Interrupt** - Normal program break
3. **Attention** - Intermediate priority

Two 12-bit inspection words:
- **Interrupt word** - read via ITOM (70/0/21000)
- **Attention word** - read via ATOM (70/0/41000)

---

## Peripheral Devices (from E6X2)

### Type 4280 Graphical Display Unit
- 10" x 10" viewing area
- 1024 x 1024 addressable positions
- 0.01" resolution
- 10 Hz refresh from display file in memory
- Drawing speed: 100 us per displayed inch
- Vector generator for straight lines
- Character generator: 3 sizes (5/64", 5/32", 5/16")
- Light pen for interactive pointing

### Disc Equipment (1967)
- 10 disc surfaces
- 100 tracks per surface
- 16 sectors per track
- 64 words per sector
- Total capacity: ~1 million words
- Seek time: ~100ms for 33 tracks
- Mean access: 12.5ms
- Sector transfer: 1.5ms

### Other Peripherals
- Magnetic tape units
- Exchangeable disc units
- Plotters
- Paper tape reader/punch
- Teleprinter

---

## I/O Instructions (from E6X3)

### Data Transfer (F=74, Y=0)

| Encoding | Mnemonic | Action |
|----------|----------|--------|
| 74/0/000nn | IDPR | Input data packed repetitive |
| 74/0/100nn | ODPR | Output data packed repetitive |
| 74/0/200nn | IDUR | Input data unpacked repetitive |
| 74/0/300nn | ODUR | Output data unpacked repetitive |

### Status/Control (F=75, Y=0)

| Encoding | Mnemonic | Action |
|----------|----------|--------|
| 75/0/000nn | ISPR | Input status word packed repetitive |
| 75/0/100nn | OCPR | Output control word packed repetitive |
| 75/0/200nn | ISUR | Input status word unpacked repetitive |
| 75/0/300nn | OCUR | Output control word unpacked repetitive |

### Single Word Transfers (F=76,77, Y=0)

| Encoding | Mnemonic | Action |
|----------|----------|--------|
| 76/0/200nn | IDUM | Input data unpacked single to M |
| 76/0/300nn | ODUM | Output data unpacked single from M |
| 77/0/200nn | ISUM | Input status word unpacked single to M |
| 77/0/300nn | OCUM | Output control word unpacked single from M |

### Interrupt Inspection (F=70, Y=0)

| Encoding | Mnemonic | Action |
|----------|----------|--------|
| 70/0/21000 | ITOM | m' = interrupt word |
| 70/0/41000 | ATOM | m' = attention word |

### Console I/O Extracodes (F=77, Z=1)

| Encoding | Mnemonic | Action |
|----------|----------|--------|
| 77/0/1/n | TR | Display nth letter of alphabet on console |
| 77/y/1/n | CH | Display Q in octal on console (y=1,2,3) |

---

## Testable Requirements

### Channel System
1. Channels 00-13 addressable via `nn` field
2. Packed transfers: 4 chars/word continuous
3. Unpacked transfers: 1 char/operation
4. Status word reflects device state
5. Control word configures device operation

### Interrupt Mechanism
1. ITOM loads 12-bit interrupt word to M
2. ATOM loads 12-bit attention word to M
3. Interrupt/Attention bits correspond to channel numbers
4. Hesitation has highest priority

### Console Output
1. TR extracode displays letter (A + n%26)
2. CH extracode displays M register in 8-digit octal

### Data Transfer Modes
1. **Packed repetitive** - continuous 4 chars/word
2. **Unpacked repetitive** - single char transfers
3. **Single** - one word transfer to/from M

---

## Test Cases

### TC-IO-01: TR Extracode Letter Display
```
; Display "HELLO"
LD /7      ; H = 8th letter (0-indexed: 7)
TR 7
LD /4      ; E = 5th letter
TR 4
LD /11     ; L = 12th letter
TR 11
TR 11      ; L again
LD /14     ; O = 15th letter
TR 14
```
Expected: "HELLO" displayed on console

### TC-IO-02: CH Extracode Octal Display
```
LD /123456   ; Load test value
77/1/1/0     ; CH extracode (y=1)
```
Expected: "00123456 " displayed (8 octal digits + space)

### TC-IO-03: ITOM Interrupt Word Inspection
```
70/0/21000   ; ITOM
; M should contain 12-bit interrupt word
; Bit n set = channel n has pending interrupt
```
Expected: M bits 12-1 reflect pending interrupts

### TC-IO-04: ATOM Attention Word Inspection
```
70/0/41000   ; ATOM
; M should contain 12-bit attention word
```
Expected: M bits 12-1 reflect pending attentions

### TC-IO-05: ODUM Single Output
```
LD /101      ; ASCII 'A' = 65 = 0101 octal
76/0/30001   ; ODUM to channel 01
```
Expected: Single byte output to channel 01

### TC-IO-06: IDUM Single Input
```
76/0/20001   ; IDUM from channel 01
; M should contain input byte
```
Expected: M receives single byte from channel 01

### TC-IO-07: Status Read
```
77/0/20001   ; ISUM from channel 01
; M should contain device status
```
Expected: M contains status word for channel 01

### TC-IO-08: Control Write
```
LD /1        ; Control bits
77/0/30001   ; OCUM to channel 01
```
Expected: Control word sent to channel 01

---

## Implementation Notes for Emulator

### Current Implementation Status (January 2026)

#### ✅ Implemented
1. **TR/CH extracodes** - Console output working
2. **IDUM/ODUM** - Single word I/O working with 6-bit masking
3. **ISUM/OCUM** - Status/control single word transfers
4. **ITOM/ATOM** - Interrupt/attention word inspection
5. **Paper tape reader** - Channel 1, loads from `.lisp` tape files
6. **Paper tape punch** - Channel 2, output buffer
7. **6-bit character handling** - Input/output masked to 0x3F

#### Assembler Support
I/O instruction encoding fixed (January 2026):
- `IDUM n` - F=76, Y=0, Z=0, N bits 14-12=2, bits 5-0=channel
- `ODUM n` - F=76, Y=0, Z=0, N bits 14-12=3, bits 5-0=channel
- `ISUM n` - F=77, Y=0, Z=0, N bits 14-12=2, bits 5-0=channel
- `OCUM n` - F=77, Y=0, Z=0, N bits 14-12=3, bits 5-0=channel

#### 6-Bit Character Notes
Elliott 4130 uses 6-bit characters ("6-bit bytes"), not 8-bit octets:
- 4 characters pack into one 24-bit word
- Tape reader masks input to 6 bits (`& 0x3F`)
- On-disk tape format (ASCII `.lisp` files) is a development placeholder
- Historical 4130 tapes used 6-bit encoding

### Phase 2: Channel System (Future)
```javascript
class IOChannel {
  constructor(id) {
    this.id = id;
    this.status = 0;        // Device status bits
    this.control = 0;       // Control configuration
    this.inputBuffer = [];  // Pending input data
    this.outputBuffer = []; // Output accumulation
    this.interruptPending = false;
    this.attentionPending = false;
  }
}
```

### Channel Assignment Convention
- Channel 00: Teleprinter/console
- Channel 01: Paper tape reader
- Channel 02: Paper tape punch
- Channel 03-05: Magnetic tape
- Channel 06-07: Disc
- Channel 10-13: User peripherals

### Interrupt Word Format
```
Bit 12: Channel 11 interrupt
Bit 11: Channel 10 interrupt
...
Bit 2:  Channel 01 interrupt
Bit 1:  Channel 00 interrupt
```

---

## References

- E6X2: Systems architectures (peripherals, Standard Interface)
- E6X3: Instruction sets (I/O instructions, extracodes)
- E6X4: Programming and software (operating systems, TSS)
- E6X5: Bibliography (this document)
