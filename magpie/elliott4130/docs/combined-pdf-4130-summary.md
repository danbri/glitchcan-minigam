# E6X1 Emulation Notes

**Source:** CCS-E6X1 "Elliott 4100 series deliveries" Issue 1, March 2004
**Original:** Pages 18-20 of "Elliott-Automation: computer orders and deliveries, 1947-1966"
**Published:** Elliott-Automation Ltd., early 1967

## Document Overview

**This is a customer delivery list, NOT a technical manual.**

Contains partial listings of:
- NCR/Elliott 4120 computers (40 delivered, 40 on order = 80 total by end-1966)
- ARCH 2020 Industrial Control Systems
- NCR/Elliott 4130 computers (20 on order by end-1966)

## Emulation-Relevant Details

**NONE.** No technical specifications, instruction details, memory layouts, timing, or hardware configurations are included in this document.

## Historical Context (Indirect Value)

### Model Differentiation
- 4120 and 4130 were distinct models in the 4100 series
- ARCH 2020 was a related Industrial Control System product

### Application Types (May Inform Test Scenarios)
Systems marked `*` were "on line" (real-time/interactive):

| Category | Examples |
|----------|----------|
| Real-time control | Refinery control, traffic control, telescope control, message switching |
| Interactive research | Conversational programming (NPL), multi-access computing (Dundee) |
| Hybrid systems | Cambridge process control research |
| Batch processing | Accounting, statistics, engineering calculations |

### Notable 4130 Customers (1966)
- Sussex University - animal behaviour study (on-line)
- Queen's College Dundee - multi-access computing system
- Cambridge University - hybrid system for process control
- Royal Observatory Edinburgh - telescope & instrument control

### Geographic Distribution
International sales: Hungary (Csepel), Czechoslovakia, Romania, East Germany (Schwedt), Australia

## Testable Requirements

**NONE derivable from this document.**

## Test Cases

**NONE derivable from this document.**

---

**Recommendation:** This document provides historical context only. For emulation specifications, refer to E6X2 (Programmer's Guide), E6X3 (Floating-Point), and other technical manuals.


---

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

### Implemented (elliott4130-core.js) - Updated January 2026
- [x] 24-bit word, two's complement
- [x] All 5 registers (M, R, S, K, C)
- [x] S half-word addressing
- [x] Short/long instruction decode
- [x] Short instruction half-word packing (with padding marker 0o0577)
- [x] Condition flags (NEG, ST, NZ, CA, OF)
- [x] Hardware FP (4130 mode)
- [x] Two-word FP format (39-bit mantissa, 9-bit exponent)
- [x] Character I/O (6-bit) with proper masking
- [x] Interrupt system (Normal, Attention, Hesitation)
- [x] Protected mode (Base/Range registers)
- [x] I/O instructions: IDUM, ODUM, ISUM, OCUM (January 2026)
- [x] Paper tape reader (channel 1) with 6-bit character support
- [x] Paper tape punch (channel 2)
- [x] MULS extracode (F=0o50) - inline execution on 4130

### Not Implemented / Partial
- [ ] C register should be 14 bits (currently uses upper 5 bits only)
- [ ] DPA (87-bit mantissa double-length FP)
- [ ] CPA (Complex FP accumulator)
- [ ] Type 4280 Graphical Display
- [ ] Disc controller (10 surfaces, 100 tracks, 16 sectors)
- [ ] Split long instruction across two words
- [ ] DIV extracode (F=0o51) - store instructions have addressing issues

### Discrepancies to Verify
1. **C register bits:** E6X2 says 14-bit with bits 16-7 unallocated. Emulator uses bits 23-19 (Elliott 24-20). Need E6X3 for exact condition flag positions.
2. **Long instruction spanning:** Emulator assumes long instructions start at even S. Need to verify handling of odd-S long instruction start.

---

## References

- E6X2: Systems architectures (this document)
- E6X3: Instruction set details (see separate notes)
- E6X4: Interrupts, I/O, Protected Mode (see separate notes)


---

# E6X3 Emulation Notes
## Elliott 4100 Series Instruction Set Reference

**Source**: CCS E6X3 Version 2, November 2011
**Scope**: Instruction sets and instruction times for Elliott 4100 Series computers

---

## 1. Architecture Summary

| Register | Bits | Description |
|----------|------|-------------|
| M | 24 | Main accumulator |
| R | 24 | Reserve accumulator, address modification |
| S | 17 | Sequence control (program counter) |
| K | 12 | Count register |
| C | 14 | Conditions register |

**Bit Numbering**: Bit 24 = MSB (0x800000), Bit 1 = LSB (0x000001)

### Condition Register C Flags
| Bit | Name | Description |
|-----|------|-------------|
| c24 | Neg | Result negative |
| c23 | St | Result standardized (bits 22,23 equal OR value=0) |
| c22 | Nz | Result non-zero |
| c21 | Ca | Carry-out from MS bit during add/sub |
| c20 | Of | Arithmetic overflow |
| c19 | - | Normal interrupt permit |
| c18 | - | Attention interrupt permit |
| c17 | - | Invalid information transfer |
| c6-c1 | - | Manual console switches |

---

## 2. Instruction Format

### Short Format (12 bits)
```
| F (6) | N (6) |
  Op code  Address
```
- F range: 00-37 octal
- N: Address in first 64 words only

### Long Format (24 bits)
```
| F (6) | Y (2) | Z (1) | N (15) |
  Op code  Mode   Extra   Address
```
- F range: 40-77 octal
- Z=1: Extracode instruction

### Addressing Modes (Y bits)
| Y | Mode | Effective Address |
|---|------|-------------------|
| 0 | Literal | N (unsigned positive) |
| 1 | Direct | N |
| 2 | Modified | N + R |
| 3 | Indirect | [N] (contents of location N) |

**Note**: For Y=2,3: bits 16-22 of final address must be zero (64K block limit)

---

## 3. Instruction Categories

### Group A: Arithmetic/Logic/Control (F=00-37 short, 40-77 long)
| F(s) | F(l) | Y | Action | Mnemonic |
|------|------|---|--------|----------|
| 00 | 40 | - | m' = m + Q | ADD |
| 01 | 41 | - | m' = m - Q | SUB |
| 02 | 42 | - | m' = Q - m | NADD |
| 03 | 43 | - | m' = Q | LD |
| 04 | 44 | - | r' = Q | LDR |
| 05 | - | - | s' = n; c'24-18 = n24-18 | JIR |
| - | 45 | 0 | s' = N | J |
| - | 45 | 1-3 | s' = Q | JI |
| 06 | 46 | - | m' = m & Q | AND |
| 07 | 47 | - | m' = m & ~Q | ANDN |
| 10 | 50 | - | r' = r + Q | ADDR |
| 11 | 51 | - | r' = r - Q | SUBR |
| 12 | 52 | - | r' = Q - r | NADR |
| - | 53 | 0 | [0]' = c24-18 + s; s' = s + N | JFL |
| 13 | 53 | 1-3 | [0]' = c24-18 + s; s' = Q | JIL |
| 14 | 54 | - | k' = Q | LDK |
| 15 | - | - | Shift instructions | (see below) |
| - | 55 | - | compare (m - Q) | COMP |
| 16 | 56 | 0 | s' = s + N | JF |
| - | 56 | 1-3 | s' = s + Q | JA |
| 17 | 57 | 0 | s' = s - N | JB |
| - | 57 | 1-3 | s' = s - Q | JS |
| 20 | 60 | 0 | if Neg: s' = s + Q | JN |
| 21 | 61 | 0 | if !Neg: s' = s + Q | JNN |
| 22 | 62 | 0 | if !Nz: s' = s + Q | JZ |
| 23 | 63 | 0 | if Nz: s' = s + Q | JNZ |
| 24 | 64 | 0 | if St: s' = s + Q | JST |
| 25 | 65 | 0 | if Of: s' = s + Q | JOF |
| 27 | 67 | 0 | k' = k - 1; if k12=1: s' = s + Q | DKJN |
| 30 | 60 | 1-3 | Q' = m | ST |
| 31 | 61 | 1-3 | Q' = r | STR |
| 32 | 62 | 1-3 | Q' = -Q | NEGS |
| 33 | 63 | 1-3 | Q' = Q - m | SUBS |
| 34 | 64 | 1-3 | Q' = Q + m | ADDS |
| 35 | 65 | 1-3 | Q' = 0 | CLS |
| 36 | 66 | 1-3 | Q' = Q + 1 | INCS |
| 37 | 67 | 1-3 | Q' = Q - 1 | DECS |

### Special Long Instructions (F=70-77)
| F | Y | Action | Mnemonic |
|---|---|--------|----------|
| 70 | 0 | Register-to-register | (see below) |
| 70 | 1-3 | Q' = Q(bcda); m' = m(abc)Q(a) | GET |
| 71 | 1-3 | Q' = Q(bcd)m(d) | PUT |
| 72 | 1-3 | m' = (r,m)/Q; r' = remainder | DIVM |
| 73 | 1-3 | (r,m)' = m × Q | MULM |
| 74 | 1-3 | m' = Q; [r]' = m; r' = r - 1 | MVE |
| 75 | 1-3 | Q' = m; m' = [r]; r' = r + 1 | MVB |
| 76 | 1-3 | swap Q and m | EXC |
| 77 | 1-3 | swap Q and r | EXCR |

---

## 4. Shift Instructions (Group B)

**Format**: F=15 (octal), N selects shift type, K register holds count

| N (oct) | Action | Mnemonic |
|---------|--------|----------|
| 00 | Shift R left arithmetically k places | SRL |
| 01 | Shift R left circularly k places | SRLA |
| 02 | Shift R right arithmetically k places | SRR |
| 03 | Shift R by k 6-bit characters left (circular) | SRLC |
| 04 | Shift M left arithmetically k places | SML |
| 05 | Shift M left circularly k places | SMLA |
| 06 | Shift M right arithmetically k places | SMR |
| 07 | Shift M by k 6-bit characters left (circular) | SMLC |
| 12 | Shift R right logically k places | SRRL |
| 16 | Shift M right logically k places | SMRL |
| 20 | Shift R until standardized, max k places; **k' = shift count** | SRST |
| 24 | Shift M until standardized, max k places; **k' = shift count** | SMST |
| 40 | Shift both (R,M) left arithmetically k places | SBL |
| 42 | Shift both (R,M) right arithmetically k places | SBR |
| 52 | Shift both (R,M) right logically k places | SBRL |
| 62 | Shift both (R,M) until standardized, max k places | SBST |

### Standardization Definition
A value is **standardized** when bits 22 and 23 differ (for non-zero values).
This is critical for floating-point normalization.

**SMST/SRST behavior**: Shifts left until standardized, K receives the count of shifts performed.

---

## 5. Register-to-Register Instructions (Group C)

**Format**: F=70, Y=0, N specifies registers

| N (oct) | Action | Mnemonic |
|---------|--------|----------|
| 00020 | r' = k | KTOR |
| 00402 | r' = m | MTOR |
| 00404 | r' = s | STOR |
| 00441 | r' = r + 1 if carry set | CAIR |
| 00541 | r' = r - 1 if carry set | CADR |
| 01001 | m' = r | RTOM |
| 01003 | m' = m OR r | MORR |
| 01010 | m' = c | CTOM |
| 02001 | s' = r | RTOS |
| 02002 | s' = m | MTOS |
| 04002 | c' = m | MTOC |
| 10001 | k' = r | RTOK |
| 10002 | k' = m | MTOK |
| 10201 | k' = -r | RNTK |
| 21000 | m' = interrupt word | ITOM |
| 41000 | m' = attention word | ATOM |

---

## 6. Extracode Trap Mechanism (Group E)

**Trigger**: Z=1 in long instruction, F in range 40-77 octal

### Trap Sequence for Y=0 (Literal Mode)
1. Place N in memory location 1
2. Place link (c24-18 + S) in memory location 2
3. Jump to address 2×F (even addresses 64-126)

### Trap Sequence for Y=1,2,3 (Other Modes)
1. Place effective address in memory location 1:
   - Y=1: N
   - Y=2: N + r
   - Y=3: [N]
2. Place link (c24-18 + S) in memory location 2
3. Jump to address 2×F + 1 (odd addresses 65-127)

### Link Word Format
```
| c24-c18 (7 bits) | S (17 bits) |
  Condition bits     Program counter
```
Total: 24 bits. Used by JFL, JIL, JIR for subroutine calls/returns.

---

## 7. Floating-Point Format

### Memory Format (Two 24-bit Words)
```
Word 1: | Sign (1) | Exponent (9) | Mantissa high (14) |
Word 2: | Mantissa low (24) |
```
- **Mantissa**: 39 bits total (38 stored + 1 implicit leading bit)
- **Exponent**: 9 bits, excess-256 bias (range -256 to +255)
- **Sign**: 1 bit in MSB of Word 1

### Internal Format (4130 Hardware FP)
- **Mantissa**: 48 bits (in R,M register pair)
- **Exponent**: 12 bits
- Accessed via FLU/WUF extracodes for unrounded representation

### FP Extracodes (Hardware on 4130, Software trap on 4120)
| F | Y | Z | N | Action | Mnemonic |
|---|---|---|---|--------|----------|
| 40 | 0 | 1 | 0 | fpa' = -fpa | FN |
| 40 | 0 | 1 | 2 | fpa' = float(m) | FCP |
| 40 | 0 | 1 | 4 | fpa' = abs(fpa) | FMOD |
| 40 | 0 | 1 | 6 | m' = entier(fpa) | FENT |
| 41 | 0 | 1 | 10 | m' = sign(fpa) {-1,0,+1} | FSIG |
| 40 | y | 1 | n | fpa' = fQ | FL |
| 41 | y | 1 | n | fQ' = fpa | WF |
| 42 | y | 1 | n | fpa' = fpa + fQ | FA |
| 43 | y | 1 | n | fpa' = fpa - fQ | FS |
| 44 | y | 1 | n | fpa' = fpa × fQ | FM |
| 45 | y | 1 | n | fpa' = fpa / fQ | FD |
| 46 | y | 1 | n | set c24-22 from (fpa - fQ) | FCP |
| 60 | y | 1 | n | fpa' = tQ (unrounded, 3 words) | FLU |
| 61 | y | 1 | n | tQ' = fpa (unrounded, 3 words) | WUF |

---

## 8. GET/PUT Character Instructions

Characters are 6-bit, packed 4 per 24-bit word as {a, b, c, d} where 'a' is MSB.

### GET (F=70, Y=1-3)
```
Q' = Q rotated left 6 bits: (bcda)
m' = m rotated left 6 bits with Q's old 'a' inserted: m(abc) + Q(a)
```
Fetches character from Q into low 6 bits of M, rotating both.

### PUT (F=71, Y=1-3)
```
Q' = Q rotated left 6 bits with m's low char: Q(bcd) + m(d)
```
Stores low 6 bits of M into Q, rotating Q.

---

## 9. I/O Instructions (Group D)

**Format**: F=74-77, Y=0, N encodes operation and channel

```
N format: | Operation (3 oct) | Channel (2 oct) |
```

| F | N prefix | Action | Mnemonic |
|---|----------|--------|----------|
| 74 | 000nn | Input data packed repetitive | IDPR |
| 74 | 100nn | Output data packed repetitive | ODPR |
| 74 | 200nn | Input data unpacked repetitive | IDUR |
| 74 | 300nn | Output data unpacked repetitive | ODUR |
| 75 | 000nn | Input status packed | ISPR |
| 75 | 100nn | Output control packed | OCPR |
| 75 | 200nn | Input status unpacked | ISUR |
| 75 | 300nn | Output control unpacked | OCUR |
| 76 | 200nn | Input data unpacked single to M | IDUM |
| 76 | 300nn | Output data unpacked single from M | ODUM |
| 77 | 200nn | Input status unpacked single to M | ISUM |
| 77 | 300nn | Output control unpacked single from M | OCUM |

---

## 10. Testable Requirements

### DKJN (Decrement K, Jump if Negative)
- Decrements K by 1
- Jumps if **k12=1** (bit 12 of K is set, i.e., K went negative in 12-bit signed)
- K is 12-bit, so negative means K & 0x800 != 0

### SMST (Shift M Until Standardized)
- Shifts M left until bits 22 and 23 differ
- Stops if M becomes zero OR k shifts performed
- K receives count of actual shifts

### JFL/JIL Link Format
- Link = (c24-18 << 17) | (S & 0x1FFFF)
- Stored at address 0
- JIR restores: S from bits 0-16, C bits 24-18 from bits 17-23

### Extracode Trap Addresses
- Y=0: Jump to 2×F (even: 0x40→128, 0x41→130, etc.)
- Y>0: Jump to 2×F+1 (odd: 0x40→129, 0x41→131, etc.)

---

## 11. Test Cases

### Shift Tests
```
Test: SMST on M=0x100000 (bit 20 set, bits 22,23 both 0)
Expected: M shifts left 1 place → M=0x200000, K=1
Reason: After 1 shift, bit 23=0, bit 22=1 → standardized

Test: SMST on M=0x000001
Expected: M=0x400000 after 22 shifts, K=22
Reason: Shifts until bit 22=1, bit 23=0

Test: SMST on M=0x000000
Expected: M=0, K=0
Reason: Zero is considered standardized, no shift needed

Test: SRLA (circular left) with K=25, R=0x800001
Expected: R=0x000003 (25 mod 24 = 1 shift, wraps MSB to LSB)
```

### Extracode Trap Tests
```
Test: Execute extracode F=0x42 (FA), Y=0, N=100
Expected: mem[1]=100, mem[2]=link, S=0x84*2=0x108 (half-word addr)

Test: Execute extracode F=0x42, Y=1, N=100
Expected: mem[1]=100, mem[2]=link, S=0x85*2=0x10A
```

### Floating-Point Format Tests
```
Test: Store 1.0 in FP format
Expected: Word1=0x400000 (sign=0, exp=256, mant=0), Word2=0x000000

Test: Store 2.0 in FP format
Expected: Word1=0x404000 (sign=0, exp=257, mant=0), Word2=0x000000

Test: Store -1.0 in FP format
Expected: Word1=0xC00000 (sign=1, exp=256, mant=0), Word2=0x000000

Test: Store 0.5 in FP format
Expected: Word1=0x3FC000 (sign=0, exp=255, mant=0), Word2=0x000000
```

### Link Word Tests
```
Test: JFL with S=0x100, C=0xFE0000
Expected: mem[0] = 0x7F0100 (upper 7 bits of C + S)
          S advances by N (relative jump)

Test: JIR from link=0x7F0100
Expected: S=0x100, C bits 24-18 restored to 0xFE
```

### GET/PUT Character Tests
```
Test: GET with Q=0xABCDEF, M=0x123456
Expected: Q=0xBCDEFA (rotated left, 'a' to low)
          M=0x23456A (rotated left, Q's old 'a' inserted)

Test: PUT with Q=0xABCDEF, M=0x123456
Expected: Q=0xBCDEF6 (rotated left, M's low char '6' inserted)
```

---

## 12. Implementation Notes

### Half-Word Addressing
S register addresses half-words (12-bit instruction positions):
- S bit 0 = 0: Upper half of word (bits 23-12)
- S bit 0 = 1: Lower half of word (bits 11-0)
- Word address = S >> 1

### Q Notation in Documentation
In E6X3, "Q" represents the operand value based on addressing mode:
- Y=0: Q = N (literal)
- Y=1: Q = [N] (contents of N)
- Y=2: Q = [N+R] (modified addressing)
- Y=3: Q = [[N]] (indirect addressing)

### Standardization Flag
The St (standardized) flag in C register is set when:
- Bits 22 and 23 of result are different, OR
- Result is zero

This supports floating-point normalization detection.


---

# E6X4 Emulation Notes - Programming and Software

**Source:** CCS E6X4 Version 2, November 2011

## 1. Document Overview

E6X4 covers programming and software for Elliott 4100 Series computers:
- Assemblers (NEAT, SAP families)
- High-level languages (ALGOL 60, FORTRAN 66, COBOL)
- Operating systems (EASE, DES, KOS)
- Multiprogramming hardware facilities

**Emulation relevance:** Defines OS-level behaviors the hardware must support.

---

## 2. Programming Modes

### Executive Mode
- Full memory access
- No restrictions on peripherals
- Operating system runs in this mode

### Protected Mode
- Normal user mode under multiprogramming
- Restricted to allocated memory region
- Limited peripheral access
- Memory violations trigger Executive Mode entry

### Mode Transition Instructions
| Instruction | Action |
|-------------|--------|
| `EXEN` | Enter Executive Mode |
| `PMEN` | Load Base, Range, Alarm Clock; enter Protected Mode |

---

## 3. Memory Protection

### Base and Range Registers
- **Two 10-bit registers** define permitted memory region
- `Base`: Starting address (units of 1024 words implied)
- `Range`: Size of permitted region

### Protection Behavior
```
Permitted region: [Base * 1024, (Base + Range) * 1024)

On access outside region:
  1. User program suspended
  2. Executive Mode entered
  3. (Implied: trap to OS handler)
```

**Note:** E6X4 states these facilities "were seldom activated... except in KOS"

---

## 4. Interrupt System

### Three Priority Levels

| Level | Name | Priority | Purpose |
|-------|------|----------|---------|
| 1 | **Interrupt** (Hesitation) | Highest | Hardware events |
| 2 | **Attention** | Middle | Device completion, SI channels |
| 3 | **Normal** | Lowest | Normal computation |

### TSS Interrupt Handling
- TSS (Time Sharing Supervisor) routes interrupts to appropriate handlers
- Maintains per-device routines for each Standard Interface channel
- Organizes queues and buffers for I/O transfers

### Level Transitions
Occur via:
1. Hardware Interrupt or Attention signal
2. Subroutine entry/exit within TSS

---

## 5. Real-Time Clock (Alarm Clock)

### Specification
- Standard on Elliott 4130
- Produces interrupt once every second
- Can be set to "ring" after N seconds

### Behavior
```
PMEN instruction sets:
  - Base register
  - Range register
  - Alarm Clock setting

When Alarm Clock expires:
  - Protected Mode program terminated
  - (Implied: return to Executive/OS)
```

---

## 6. Operating System Components

### EASE (Systems Executive)
Three independent modules:

| Module | Name | Function |
|--------|------|----------|
| NICE | Normal Input and Control Executive | Operator interface, paper tape loading |
| SPAN | Storage Planning and Allocation | Primary/secondary memory management |
| TSS | Time Sharing Supervisor | Interrupt handling, I/O management |

### SPAN Utilities
| Call | Action |
|------|--------|
| `ALLOC` | Reserve space in primary memory (may return "No Room") |
| `DELETE` | Free space no longer needed |
| `BANISH` | Move chapter to secondary storage |
| `RECALL` | Bring chapter into primary storage |

### Other Systems Mentioned
- **SysD**: Simple paper tape loader (commissioning floor)
- **DES**: Disc Executive System (standalone, full memory access)
- **DES2**: DES with slave area for second program
- **DES BATCH**: Batch job operating system
- **T30C**: Batch mode system
- **KOS**: Kent On-line System (multi-access, used Protected Mode)

---

## 7. Testable Requirements

### Memory Protection
1. Base/Range registers must be 10-bit each
2. Access outside `[Base*1024, (Base+Range)*1024)` must trap
3. Trap must switch to Executive Mode
4. Executive Mode bypasses all protection checks

### Mode Transitions
1. `EXEN` must enter Executive Mode immediately
2. `PMEN` must load Base, Range, Alarm Clock, then enter Protected Mode
3. Protection violation in Protected Mode must enter Executive Mode

### Real-Time Clock
1. Clock must interrupt once per second
2. Alarm setting via PMEN must trigger termination after N seconds
3. Alarm only applies in Protected Mode

### Interrupt Priorities
1. Hesitation > Attention > Normal
2. Higher priority interrupts must preempt lower
3. TSS-style handlers must be callable at each level

---

## 8. Test Cases

### TC-E6X4-01: Memory Protection Enforcement
```
Setup:
  - Base = 10 (permits 10240-...)
  - Range = 2 (permits ...through 12287)
  - Enter Protected Mode via PMEN

Test:
  - Access address 10240: SHOULD succeed
  - Access address 12287: SHOULD succeed
  - Access address 12288: SHOULD trap to Executive Mode
  - Access address 10239: SHOULD trap to Executive Mode

Verify: executiveMode flag becomes true after violation
```

### TC-E6X4-02: EXEN Instruction
```
Setup: In Protected Mode

Test: Execute EXEN

Verify:
  - executiveMode becomes true
  - No protection checking on subsequent accesses
```

### TC-E6X4-03: PMEN Instruction
```
Setup: In Executive Mode

Test: Execute PMEN with Base=5, Range=3, Alarm=10

Verify:
  - baseReg = 5
  - rangeReg = 3
  - rtcDelay = 10 (or equivalent)
  - executiveMode becomes false
```

### TC-E6X4-04: Real-Time Clock Interrupt
```
Setup: rtcCounter at 0

Test: Advance simulated time by 1 second

Verify: Hesitation-level interrupt raised
```

### TC-E6X4-05: Alarm Clock Termination
```
Setup:
  - Protected Mode with Alarm=3 seconds
  - Running user program

Test: Advance simulated time by 3 seconds

Verify:
  - User program terminated/suspended
  - Executive Mode entered
```

### TC-E6X4-06: Interrupt Priority
```
Setup: All three levels pending

Test: Process interrupts

Verify:
  - Hesitation serviced first
  - Then Attention
  - Then Normal
```

---

## 9. Implementation Notes

### Current Emulator Status
The emulator (`elliott4130-core.js`) already implements:
- `executiveMode` flag
- `baseReg` and `rangeReg` (10-bit)
- `checkProtection()` method
- Three interrupt levels (`INT_HESITATION`, `INT_ATTENTION`, `INT_NORMAL`)
- `rtcCounter` and `rtcDelay` for Real-Time Clock

### Gaps Identified
1. **EXEN/PMEN instructions**: Need to verify implementation exists
2. **Alarm clock termination**: Need to verify it enters Executive Mode
3. **Protection violation vector**: Need to verify trap address

### Historical Note
Per E6X4: "multiprogramming facilities were seldom activated... except in KOS"
- Most software ran in Executive Mode
- Protection primarily used by KOS (Kent On-line System, 1968-1970)
- Emulator can default to Executive Mode for compatibility


---

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
I/O instruction encoding (January 2026):
- `IDUM n` - F=76, Y=0, Z=0, N bits 14-12=2, bits 5-0=channel
- `ODUM n` - F=76, Y=0, Z=0, N bits 14-12=3, bits 5-0=channel

#### 6-Bit Character Notes
Elliott 4130 uses 6-bit characters ("6-bit bytes"), not 8-bit octets:
- 4 characters pack into one 24-bit word
- Tape reader masks input to 6 bits (`& 0x3F`)
- On-disk tape format (ASCII `.lisp` files) is a development placeholder

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
