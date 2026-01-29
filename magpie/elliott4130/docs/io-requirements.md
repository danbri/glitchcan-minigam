# Elliott 4130 I/O Emulator Requirements

Based on analysis of CCS E6X1-E6X5 reference manuals.

## Current Implementation Status

### Implemented
- **TR extracode** (F=77, y=0): Display letter (A + n%26)
- **CH extracode** (F=77, y>0): Display M register in octal
- **Output handler callback**: `cpu.outputHandler` for teleprinter simulation

### Not Yet Implemented
- Paper tape reader/punch
- Keyboard input
- Vector display (Type 4280)
- I/O channel system
- Interrupts

---

## Phase 1: Console I/O (Minimal LISP Support)

### Requirements

**1.1 Teleprinter Output** ✅ (Mostly done)
```
Instruction: TR n (F=77, y=0, z=1)
Behavior: Output letter (A + n%26) to console
Current: Works - displays single characters
```

```
Instruction: CH (F=77, y>0, z=1)
Behavior: Output M register as 8-digit octal
Current: Works - displays "NNNNNNNN " format
```

**1.2 Console Input** (NEW)
```
Instruction: RI (Read Input) - needs research
Behavior: Wait for character from keyboard
Implementation:
  - Add cpu.inputHandler callback
  - Queue keyboard events
  - Block on read until input available
  - Return 6-bit character code
```

**1.3 Character Encoding**
```
Elliott 6-bit character set:
  A-Z: 01-26 (decimal)
  0-9: 27-36
  Space: 00
  Special: 37-63

4 characters per 24-bit word: {a, b, c, d}
  a = bits 23-18 (most significant)
  b = bits 17-12
  c = bits 11-6
  d = bits 5-0 (least significant)
```

---

## Phase 2: Paper Tape I/O

### Requirements

**2.1 Paper Tape Reader**
```
Purpose: Load programs and data
Format: 8-bit ASCII or 6-bit packed
Instructions:
  IDPR nn - Input Data Packed Repetitive (channel nn)
  IDUR nn - Input Data Unpacked Repetitive
  IDUM nn - Input Data Unpacked single to M

Implementation:
  - FileReader API for tape file upload
  - Byte buffer for tape content
  - Position pointer
  - End-of-tape detection
```

**2.2 Paper Tape Punch**
```
Purpose: Save programs and data
Instructions:
  ODPR nn - Output Data Packed Repetitive
  ODUR nn - Output Data Unpacked Repetitive
  ODUM nn - Output Data Unpacked single from M

Implementation:
  - Output buffer accumulation
  - Download as file when complete
  - Binary or ASCII format options
```

**2.3 Relocatable Binary Format**
```
Elliott tape format (from CCS docs):
  - Block headers with address info
  - Checksum verification
  - Entry point specification
```

---

## Phase 3: I/O Channel System

### Architecture

**Channel Addressing**
```
Channels 00-11 (basic), expandable to 13
Instruction format: F bits + Y=0 + channel number in N

Channel types:
  - Packed (4 chars/word continuous)
  - Unpacked (1 char/operation)
```

**Data Transfer Instructions (F=74)**
```
74/000nn IDPR - Input data packed repetitive
74/100nn ODPR - Output data packed repetitive
74/200nn IDUR - Input data unpacked repetitive
74/300nn ODUR - Output data unpacked repetitive
```

**Status/Control Instructions (F=75)**
```
75/000nn ISPR - Input status (packed)
75/100nn OCPR - Output control (packed)
75/200nn ISUR - Input status (unpacked)
75/300nn OCUR - Output control (unpacked)
```

**Single Word Transfers (F=76, F=77)**
```
76/200nn IDUM - Input data single to M
76/300nn ODUM - Output data single from M
77/200nn ISUM - Input status single to M
77/300nn OCUM - Output control single from M
```

### Implementation

```javascript
class IOChannel {
  constructor(id) {
    this.id = id;
    this.status = 0;
    this.control = 0;
    this.buffer = [];
    this.device = null;  // Attached device
  }

  read() { /* ... */ }
  write(data) { /* ... */ }
  getStatus() { return this.status; }
  setControl(ctrl) { this.control = ctrl; }
}
```

---

## Phase 4: Interrupts

### Interrupt Architecture

**Three Levels**
1. **Hardware Hesitation** - Highest priority, for ADT cycle-stealing
2. **Interrupt (Normal)** - Program break for standard I/O
3. **Attention** - Intermediate priority for urgent events

**Interrupt Words (12 bits)**
```
Location 0: Store return address when interrupt occurs
Interrupt vector table in low memory
```

**Inspection Instructions**
```
ITOM (F=70, y=0, N=21000): m' = interrupt word
ATOM (F=70, y=0, N=41000): m' = attention word
```

### Implementation

```javascript
class InterruptController {
  constructor(cpu) {
    this.cpu = cpu;
    this.interruptWord = 0;
    this.attentionWord = 0;
    this.pending = [];
  }

  raise(level, vector) {
    this.pending.push({ level, vector });
    this.checkPending();
  }

  checkPending() {
    if (this.pending.length > 0 && !this.cpu.inhibitInterrupts) {
      // Save state, jump to handler
    }
  }
}
```

---

## Phase 5: Vector Display (Type 4280)

### Specifications (from CCS docs)

```
Display area: 10" × 10"
Resolution: 1024 × 1024 addressable positions
Accuracy: ±0.01 inch
Refresh rate: 10 Hz
Drawing speed: 100 μs per displayed inch
```

### Features

**Vector Generator**
- Draw straight lines between points
- Display file in main memory
- Real-time refresh from core

**Character Generator**
- Three font sizes: 5/64", 5/32", 5/16"
- Hardware character rendering

**Light Pen**
- Interactive pointing device
- Position detection via display sync

### Implementation

```javascript
class VectorDisplay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.displayFile = [];  // Commands from memory
    this.scale = canvas.width / 1024;
  }

  moveTo(x, y) {
    this.ctx.moveTo(x * this.scale, (1024 - y) * this.scale);
  }

  lineTo(x, y) {
    this.ctx.lineTo(x * this.scale, (1024 - y) * this.scale);
    this.ctx.stroke();
  }

  drawChar(char, size) {
    // Character generator simulation
  }

  refresh() {
    // Execute display file
  }
}
```

---

## Phase 6: Real-Time Clock

### Specification

```
Standard on 4130 (part of ATU on 4120)
Interrupt: Once per second
Programmable delay: Can 'ring' after N seconds
```

### Implementation

```javascript
class RealTimeClock {
  constructor(cpu) {
    this.cpu = cpu;
    this.interval = null;
    this.delay = 0;
    this.counter = 0;
  }

  start() {
    this.interval = setInterval(() => {
      this.counter++;
      if (this.delay > 0 && this.counter >= this.delay) {
        this.cpu.interrupt(RTC_VECTOR);
        this.counter = 0;
      }
    }, 1000);
  }

  setDelay(seconds) {
    this.delay = seconds;
    this.counter = 0;
  }
}
```

---

## Character Packing (GET/PUT)

### Instructions

**GET (F=70, y=1,3)**
```
Unpack next character from Q register
Q' = Q rotated left by 6 bits
M gets character from Q high bits
```

**PUT (F=71, y=1,3)**
```
Pack character from M into Q
Q' = Q shifted left, M low 6 bits inserted
```

### Implementation

```javascript
// GET instruction
get(y) {
  const char = (this.Q >> 18) & 0x3F;  // Top 6 bits
  this.Q = ((this.Q << 6) | char) & 0xFFFFFF;  // Rotate left
  this.M = char;
}

// PUT instruction
put(y) {
  const char = this.M & 0x3F;  // Low 6 bits
  this.Q = ((this.Q << 6) | char) & 0xFFFFFF;  // Shift and insert
}
```

---

## Priority Implementation Order

1. **Console I/O** - Essential for LISP REPL
   - Keyboard input (blocking read)
   - Better output formatting

2. **Paper Tape** - Program loading/saving
   - File upload as tape reader
   - Download as tape punch

3. **Interrupts** - Required for async I/O
   - Basic interrupt dispatch
   - Timer interrupt

4. **Vector Display** - Nice to have
   - Canvas-based rendering
   - Display file execution

---

## Testing Checklist

- [ ] TR outputs correct letters A-Z
- [ ] CH outputs M in octal format
- [ ] Keyboard input waits and returns character
- [ ] Paper tape can load binary programs
- [ ] Interrupts dispatch to correct handlers
- [ ] Real-time clock fires every second
- [ ] Vector display draws lines correctly
- [ ] GET/PUT pack/unpack characters correctly
