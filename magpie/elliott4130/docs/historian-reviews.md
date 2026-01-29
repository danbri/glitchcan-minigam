# Elliott 4130 Emulator - Full Computer Historian Reviews

Complete reviews from skeptical Computer History professionals analyzing the emulator against CCS E6X1-E6X5 reference manuals.

---

## Review 1: E6X1 Analysis

### Note on Document
CCS-E6X1 is a **customer delivery list** showing who purchased Elliott 4120/4130 computers between 1965-1966 (G. Maunsell & Partners, Sussex University, British Petroleum, etc.), NOT a technical reference manual.

Technical specifications are in E6X2 (architecture) and E6X3 (instruction set).

### Grade: D+

The emulator captures the general flavor of a 24-bit 1960s minicomputer but contains fundamental inaccuracies that would cause virtually any real Elliott 4130 software to fail. It is useful for educational demonstration only.

### Critical Issues

#### 1.1 Floating-Point Format is Completely Fabricated

**E6X2/E6X3 Reference:**
> "On the 4130 where hardware is used, the mantissa occupies 48 bits within CPU registers and the exponent 12 bits... When held in memory, floating-point numbers are normally rounded and packed into **two words** containing **39 bits of mantissa and 9 bits of exponent**."

**Emulator (lines 891-894):**
```javascript
// Elliott 4130 used 24-bit floating point:
//   Bit 23: Sign (0=positive, 1=negative)
//   Bits 17-22: Exponent (6 bits, excess-32 bias)
//   Bits 0-16: Mantissa (17 bits, normalized with implicit 1)
```

This is **completely fictional**. The real 4130 had one of the most sophisticated floating-point units of its era, with 48-bit internal precision.

#### 1.2 Short Instruction Packing Ignored

**E6X2 Table 1:** "Number of instructions per word: **1 or 2**"

The emulator treats every instruction as consuming an entire word. Real Elliott code using packed short instructions would execute only **half** its instructions.

#### 1.3 Extracode Mechanism Fundamentally Wrong

Real 4130 implemented extracodes as **software traps** to addresses 64-127, where the operating system provides handlers.

**Emulator:** Executes extracodes inline as if they were hardware instructions, completely bypassing the trap mechanism.

#### 1.4 JFL/JIR Link Preservation Broken

The link stored at address 0 must include **bits 24-18 of the C register concatenated with S**.

**Emulator:**
```javascript
this.wr(0, this.S);  // WRONG: Only stores S, not c24-18 + s
```

#### 1.5 Condition Register Bit Positions Wrong

Flags are in completely wrong bit positions. When a program uses CTOM and inspects the flags, they would be in wrong positions.

### What Would an Elliott Engineer Say?

*"Good heavens, man, what have you done to my floating-point unit? We spent six months designing the 48-bit mantissa hardware - it was faster than the 4120's software emulation! You've turned it into some sort of pocket calculator."*

*"The short instruction packing was essential for ALGOL compilers. We needed to fit tight inner loops into the instruction pipeline. Your version wastes half the memory bandwidth."*

---

## Review 2: E6X2 Analysis (Full Architecture)

### Grade: D-

This emulator captures the broad spirit of the 4100 series but contains fundamental inaccuracies that would cause any real Elliott 4130 program to fail catastrophically.

### Critical Issues

#### 2.1 Floating-Point Format is Completely Fabricated

**Reference (E6X3 p.6):**
> "On the 4130 where hardware is used, the mantissa occupies 48 bits within CPU registers and the exponent 12 bits... When held in memory, floating-point numbers are normally rounded and packed into two words containing 39 bits of mantissa and 9 bits of exponent."

**Emulator:** Uses completely fictional single-word 24-bit format with 17-bit mantissa and 6-bit exponent. **Any floating-point code would produce garbage results.**

#### 2.2 Short Instruction Packing is Ignored

A 24-bit word can hold TWO 12-bit short instructions. The emulator ALWAYS reads from the upper half of the word and increments S by 2, completely ignoring the second half-word.

#### 2.3 Extracode Mechanism is Fundamentally Wrong

The real 4130 implemented most extracodes as software subroutines at fixed memory addresses (64-127). Only the 14 floating-point extracodes were hardware on the 4130.

**Emulator:** Directly implements extracodes inline as if they were hardware instructions.

#### 2.4 Condition Register Bit Positions Are Wrong

**Reference (E6X3 p.2):**
> "c24: result negative... c23: result standardized... c22: result non-zero... c21: carry-out... c20: arithmetic overflow"

**Emulator:**
```javascript
F_NEG = 32;  // Bit 5 (0-indexed)
F_ST = 16;   // Bit 4
F_NZ = 8;    // Bit 3
F_CA = 4;    // Bit 2
F_OF = 2;    // Bit 1
```

The flags are in completely wrong bit positions.

### What Would an Elliott Engineer Say?

*"The floating-point unit - you've made it into some sort of toy! We spent months designing the 48-bit mantissa hardware to give proper scientific precision, and you've replaced it with... what, 17 bits? You couldn't calculate a decent sine table with that."*

*"And the extracodes - the whole POINT was that we could extend the instruction set through software at those trap addresses. The operators could even patch them for debugging! Your emulator just... does things directly. How would one ever implement a proper supervisor?"*

*"The short instructions - we packed them two to a word specifically for tight loops. Your version wastes half the memory bandwidth. The assembler would generate code that simply runs off into nowhere."*

*"I must say the I/O channels are a reasonable attempt, but the condition register - you've moved all the flags to the wrong bits! Every conditional jump in every program we ever wrote would branch to the wrong place."*

*"This might be useful for demonstrating the CONCEPT of a 4100 to schoolchildren, but please, for the sake of computer history, don't call it an emulator. It's a... a fantasy inspired by our work."*

### Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Basic Architecture | C | Word size, registers present, but details wrong |
| Integer ALU | C+ | Basic ops work, but flags/overflow wrong |
| Floating Point | F | Completely fabricated format |
| Instruction Fetch | D | Ignores short instruction packing |
| Addressing Modes | B- | Mostly correct |
| Shifts | D | Missing 10 of 16 modes |
| I/O System | C | Reasonable structure, incomplete |
| Extracodes | F | Fundamentally wrong mechanism |

---

## Review 3: E6X3 Analysis (Instruction Set Detail)

### Grade: D+

### Critical Issues

#### 3.1 Extracodes are SUBROUTINES not Hardware Operations

**Reference:** Extracodes should trap to address 2*F where user-supplied routines handle them.

**Emulator:** Executes them as native JavaScript inline.

#### 3.2 FP Format Wrong

**Spec:** 48-bit across TWO words (39-bit mantissa + 9-bit exponent)

**Emulator:** 24-bit single word (fictional format)

#### 3.3 JFL/JIR Lose Control State

The link should preserve C register bits c24-c18 for proper subroutine return.

**Emulator:** Only stores S register.

#### 3.4 50% of Shift Instructions Missing

- Missing circular shifts (SRLA, SMLA)
- Missing character shifts (SRLC, SMLC)
- Missing standardize shifts (SRST, SMST) - **critical for FP normalization**
- Missing dual-register shifts (SBL, SBR, SBRL, SBST)

#### 3.5 FP Opcodes Off by 10 Octal

Should be 42 for FADD, emulator uses 52.

#### 3.6 checkInterrupts() Never Called

The interrupt checking function exists but is never invoked in the step() loop.

### Missing Features

- ATU/DMA for autonomous transfers
- Protected Mode (EXEN, PMEN instructions)
- Console switch testing (c6-c1)

---

## Review 4: E6X4 Analysis (Software/Operating Systems)

### Grade: D+

### Critical Issues

#### 4.1 Interrupt Priority Order is BACKWARDS

**Reference:**
> "The Elliott 4100 series defines three levels of program priority, the highest being called the **Interrupt level**, the intermediate one being called the **Attention level** and the lowest level being that of **normal computation**."

**Emulator:**
```javascript
INT_HESITATION = 0;  // Hardware hesitation (highest)
INT_NORMAL = 1;      // Normal interrupt
INT_ATTENTION = 2;   // Attention interrupt
```

**Problem:** NORMAL is placed above ATTENTION, which is exactly backwards. TSS (Time Sharing Supervisor) relied on Attention interrupts having higher priority than normal processing.

#### 4.2 Missing Protected Mode Architecture

**Reference:**
> "Within Protected Mode, core store was to be allocated to a user program via two **10-bit registers** that gave the **Base address** and the **Range** of permitted memory."

**Missing:**
- No Base register (10-bit)
- No Range register (10-bit)
- No EXEN instruction (enter Executive Mode)
- No PMEN instruction (load Base/Range/Alarm, enter Protected Mode)
- No memory protection checking

**Impact:** KOS (Kent On-line System), the multi-user BASIC system, **cannot run**.

#### 4.3 JFL Saves to Wrong Location

Real Elliott subroutine linkage saved return addresses in the first word of the subroutine itself (self-modifying code pattern), not at fixed location 0.

### What Would an Elliott Engineer Say?

*"You've got the interrupt priorities completely arse-about-face. Attention is ABOVE normal, not below."*

*"Where's the Base and Range? That's the whole point of the 4130 over the 4120."*

---

## Review 5: E6X5 Analysis (I/O System)

### Note on Document
E6X5 Version 3 is a **bibliography of references** for the Elliott 4100 Series computers, containing citations to:
- Elliott 4150 digital computer functional specification
- 4100 computer system FACTS booklet
- NCR-Elliott 4100 Data Processing System specifications
- ICL Archive items

### Grade: C+

The implementation shows competent understanding of 1960s British computer architecture but contains several issues.

### Critical Issues

#### 5.1 Short Instruction Format is WRONG

```javascript
const n = (w >> 12) & 0x3F;  // This extracts 6 bits
this.S = (this.S + 2) & this.MASK17;
```

The Elliott 4100 series used **packed short instructions** - two 12-bit instructions per 24-bit word. The emulator treats each instruction as occupying a full word.

#### 5.2 Addressing Mode for Y=2 Uses Wrong Register

```javascript
case 2: return this.rd((n + this.R) & 0x7FFF);
```

Elliott documentation describes the B-register (index register) for modified addressing, not the R (reserve accumulator).

#### 5.3 Jump and Link (JFL) Stores Return Address at Location 0

This is a dangerous simplification. Real Elliott subroutine linkage conventions varied.

#### 5.4 Floating-Point Format is Speculative

The Elliott 4130's optional floating-point hardware used a **48-bit double-word format**, not single-word.

#### 5.5 I/O Channel Architecture is Oversimplified

The Elliott 4100 series had a sophisticated **Autonomous Transfer Unit (ATU)**. The emulator's simple `IOChannel` class does not capture:
- Block transfer modes
- Chained operations
- Priority arbitration
- Timing constraints

### Missing Features

- Memory Protection for multi-programming
- Autonomous Transfer Unit (ATU) / DMA
- Console/Engineering Panel Functions
- Magnetic Tape/Disc Controllers
- Proper Interrupt Vectoring

### What Would an Elliott Engineer Say?

*"Right then, let's have a look at what you've built here...*

*First off, where's your B-register? You've got M, R, S, K, C, Q - but the index register for address modification isn't the same as R.*

*Your short instruction handling is completely wrong. We packed two instructions per word to save core - that was the whole point!*

*This floating-point unit - did you just make it up? We didn't have single-word floats. The scientific chaps used double-precision in two consecutive words.*

*The I/O is laughably simple. Our ATU could handle block transfers autonomously while the processor continued - that was cutting-edge for 1965!*

*It's a reasonable educational toy, but don't call it an Elliott 4130 emulator. Call it 'inspired by' perhaps."*

---

## Consolidated Verdict

### What Would Pass

The emulator CAN successfully run:
- Simple integer arithmetic programs
- LISP interpreter (uses own calling conventions, avoids FP)
- Basic I/O demonstration programs
- Educational demonstrations of 24-bit word machines

### What Would Fail

| Code Type | Why It Fails |
|-----------|--------------|
| Any FP computation | Wrong format produces garbage |
| Nested subroutines | JFL/JIR lose condition state |
| Packed short instructions | Only half execute |
| Conditional branches on flags | Wrong bit positions |
| OS extracode handlers | Trap mechanism missing |
| TSS/KOS multi-user | No Protected Mode |
| Real-time I/O | Interrupt priorities backwards |

### Final Assessment

**Consensus Grade: D+**

The emulator succeeds at being "a 24-bit minicomputer emulator inspired by Elliott," but fails at being "an Elliott 4130 emulator." For computer history preservation purposes, this distinction matters enormously.

---

*Reviews compiled January 2026 from CCS E6X1-E6X5 reference manual analysis*
