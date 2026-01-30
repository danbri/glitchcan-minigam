# E6X2 Emulation Notes
**Source:** CCS E6X2 - Systems architectures for the Elliott 4100 Series computers (Version 2, November 2011)

## 1. Document Overview

E6X2 covers the **high-level systems architecture** of the Elliott 4100 series (4120/4130). Specification completed ~1964, first 4120 delivered 1965, first 4130 delivered 1966. Absorbed into ICL 1968, manufacture ceased ~1970.

**Key difference 4120 vs 4130:**
- 4120: Software extracode FP (199us FP ADD)
- 4130: Hardware FP unit (15us FP ADD), faster CPU, built-in ATU

---

## 2. Architecture Details

### Word Size & Representation
| Property | Value |
|----------|-------|
| Word length | 24 bits |
| Integer format | Two's complement |
| Bit numbering | Bit 24 = MSB, Bit 1 = LSB |
| Characters | 4 x 6-bit per word |

### Memory
| Model | Max Memory (2us store) |
|-------|------------------------|
| 4120 | 64K words |
| 4130 | 256K words |

Store options: 2us or 6us cycle time.

### Registers
| Reg | Size | Description |
|-----|------|-------------|
| M | 24 bits | Main accumulator |
| R | 24 bits | Reserve accumulator, address-modification register |
| S | 17 bits | Program counter (sequence-control), **half-word addressed** |
| K | 12 bits | Count register |
| C | 14 bits | Conditions register (bits 16-7 unallocated) |

### Software-Visible Quantities
| Name | Description |
|------|-------------|
| I | Normal Interrupt word (12 bits) |
| A | Attention Interrupt word (12 bits) |
| FPA | Floating point accumulator (39-bit mantissa, 9-bit exponent) |
| DPA | Double-length FP accumulator (87-bit mantissa, 9-bit exponent) |
| CPA | Complex FP accumulator |

---

## 3. Instruction Format

### Short vs Long Instructions
| Type | Size | Per Word | S Increment |
|------|------|----------|-------------|
| Short | 12 bits | 2 | +1 (half-word) |
| Long | 24 bits | 1 | +2 (full word) |

**Critical:** S is a **half-word address** pointing to next instruction.
- Even S: upper half of word (bits 24-13)
- Odd S: lower half of word (bits 12-1)

### Long Instruction Spanning Words
A long instruction **may be split across two consecutive memory locations**. In this case, execution takes longer (extra memory fetch).

---

## 4. Emulation-Relevant Details

### Timing (microseconds, 2us store)
| Operation | 4120 | 4130 |
|-----------|------|------|
| Fxpt ADD (direct) | 5.6 | 4.5 |
| Fxpt MPY (direct) | 60.6 | 15.0 |
| Flpt ADD (direct) | 199 (SW) | 15 (HW) |

### Floating-Point Memory Format
- **Two words** containing:
  - 39 bits mantissa
  - 9 bits exponent
- Rounded when stored from internal FP registers

### Undefined Behavior
> "The effect of obeying an instruction in the second half of a word which has just been altered by the instruction in the first half of the same word is **not defined**."

**Emulator decision:** Execute as-is (fetch word once, don't re-fetch after first half modifies).

### Standard I/O Interface
- 8 data-in lines
- 8 data-out lines
- 3 interrupt lines
- 11 control/status/timing signals

### Graphical Display (Type 4280)
- 1024 x 1024 addressable positions (10" x 10")
- 10Hz refresh from display file in main memory
- 100us per displayed inch
- Vector generator, character generator (3 sizes), light pen

---

## 5. Testable Requirements

### REQ-E6X2-01: Bit Numbering Convention
Bit 24 is MSB (0x800000), bit 1 is LSB (0x000001).

### REQ-E6X2-02: Register Sizes
- M: exactly 24 bits
- R: exactly 24 bits
- S: exactly 17 bits (0x00000-0x1FFFF)
- K: exactly 12 bits (0x000-0xFFF)
- C: exactly 14 bits (bits 24-17, 6-1; bits 16-7 reserved)

### REQ-E6X2-03: S is Half-Word Addressed
S points to half-words, not full words.
- Word address = S >> 1
- Half select = S & 1 (0=upper, 1=lower)

### REQ-E6X2-04: Short Instruction Packing
Two 12-bit short instructions packed per 24-bit word.
- Upper half: bits 24-13 (when S is even)
- Lower half: bits 12-1 (when S is odd)

### REQ-E6X2-05: Two's Complement Integers
All integer arithmetic uses two's complement.
- Positive max: 0x7FFFFF (+8,388,607)
- Negative max: 0x800000 (-8,388,608)

### REQ-E6X2-06: FP Memory Format
Floating-point numbers occupy two consecutive words with 39-bit mantissa, 9-bit exponent.

### REQ-E6X2-07: Character Packing
Four 6-bit characters per 24-bit word.
- Char 1: bits 24-19
- Char 2: bits 18-13
- Char 3: bits 12-7
- Char 4: bits 6-1

---

## 6. Test Cases

### TC-01: Short Instruction at Even S
```
Setup: S=100 (even), mem[50]=0xABC123
       Upper half = 0xABC (F=0o25, N=0o74)
       Lower half = 0x123
Execute: One step
Expected: S=101, instruction 0xABC executed
```

### TC-02: Short Instruction at Odd S
```
Setup: S=101 (odd), mem[50]=0xABC123
       Lower half = 0x123 (F=0o04, N=0o43)
Execute: One step
Expected: S=102, instruction 0x123 executed
```

### TC-03: Long Instruction Advances S by 2
```
Setup: S=100, mem[50]=long instruction (F>=0o40)
Execute: One step
Expected: S=102 (advanced by 2 half-words = 1 word)
```

### TC-04: S Register Wraps at 17 bits
```
Setup: S=0x1FFFF
Execute: Increment S
Expected: S=0x00000 (wrap)
```

### TC-05: K Register 12-bit Mask
```
Setup: K=0xFFF
Execute: K := K + 1
Expected: K=0x000 (wrap at 12 bits)
```

### TC-06: Two's Complement Negative
```
Setup: M=0x800000
Test: Sign-extend to JS integer
Expected: -8388608
```

### TC-07: Character Packing (4 chars)
```
Value: 0xAAAAAA
Char 1: (0xAAAAAA >> 18) & 0x3F = 42
Char 2: (0xAAAAAA >> 12) & 0x3F = 42
Char 3: (0xAAAAAA >> 6) & 0x3F = 42
Char 4: 0xAAAAAA & 0x3F = 42
```

### TC-08: Self-Modifying Code (Undefined)
```
Setup: S=100, mem[50] contains two short instructions where
       first instruction modifies mem[50]
Execute: One step (first half)
Note: Second half behavior is UNDEFINED per spec
Emulator policy: Use original fetched word (don't re-fetch)
```

---

## 7. Emulator Implementation Status

### Implemented (elliott4130-core.js)
- [x] 24-bit word, two's complement
- [x] All 5 registers (M, R, S, K, C)
- [x] S half-word addressing
- [x] Short/long instruction decode
- [x] Condition flags (NEG, ST, NZ, CA, OF)
- [x] Hardware FP (4130 mode)
- [x] Two-word FP format (39-bit mantissa, 9-bit exponent)
- [x] Character I/O (6-bit)
- [x] Interrupt system (Normal, Attention, Hesitation)
- [x] Protected mode (Base/Range registers)

### Not Implemented / Partial
- [ ] C register should be 14 bits (currently uses upper 5 bits only)
- [ ] DPA (87-bit mantissa double-length FP)
- [ ] CPA (Complex FP accumulator)
- [ ] Type 4280 Graphical Display
- [ ] Disc controller (10 surfaces, 100 tracks, 16 sectors)
- [ ] Split long instruction across two words

### Discrepancies to Verify
1. **C register bits:** E6X2 says 14-bit with bits 16-7 unallocated. Emulator uses bits 23-19 (Elliott 24-20). Need E6X3 for exact condition flag positions.
2. **Long instruction spanning:** Emulator assumes long instructions start at even S. Need to verify handling of odd-S long instruction start.

---

## References

- E6X2: Systems architectures (this document)
- E6X3: Instruction set details (see separate notes)
- E6X4: Interrupts, I/O, Protected Mode (see separate notes)
