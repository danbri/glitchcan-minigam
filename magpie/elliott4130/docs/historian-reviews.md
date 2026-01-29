# Elliott 4130 Emulator - Computer Historian Reviews

Critical assessment by skeptical Computer History professionals reviewing the emulator against CCS E6X1-E6X5 reference manuals.

---

## Summary Table

| Manual | Focus Area | Grade | Critical Issues |
|--------|-----------|-------|-----------------|
| E6X1 | Basic Architecture | C- | FP format wrong, extracodes inline, JFL broken |
| E6X2 | Full Architecture | D- | Short instruction packing ignored, FP fabricated, flags wrong positions |
| E6X3 | Instruction Set | D+ | Extracodes as hardware not subroutines, FP 24-bit not 48-bit, missing shifts |
| E6X4 | Software/OS | C- | Interrupt priority backwards, no Protected Mode, no Base/Range registers |
| E6X5 | I/O System | C- | Short instructions broken, FP completely wrong, condition bits wrong |

**Consensus Grade: D+**

---

## Review 1: E6X1 (Basic Architecture)

### Grade: C-

The emulator is functional for basic computation and succeeds in running a LISP interpreter, but contains significant deviations from the documented Elliott 4130 architecture that would cause real historical software to fail.

### CRITICAL Issues

#### 1.1 Floating-Point Format is Completely Wrong
**Reference (E6X3 p.6):** "48 bits mantissa and 12 bits exponent" in CPU registers, "39 bits mantissa and 9 bits exponent" when packed in memory (two 24-bit words).

**Emulator implements:**
```javascript
// Bit 23: Sign (0=positive, 1=negative)
// Bits 17-22: Exponent (6 bits, excess-32 bias)
// Bits 0-16: Mantissa (17 bits, normalized with implicit 1)
```

This is a **completely fabricated** single-word format. The real Elliott 4130 had **hardware floating-point** using double-word (48-bit) representation.

#### 1.2 Extracode Mechanism Not Implemented
**Reference:** Extracodes should:
- Place operand/address in location 1
- Place link (c24-18 + S) in location 2
- Jump to memory location 2*F (or 2*F+1 for Y>0)

**Emulator:** Executes extracodes inline as if they were hardware instructions.

#### 1.3 JFL Subroutine Linkage is Wrong
**Reference:** `0' = c24-18 + s; s' = s + N`

The link stored at address 0 should include **bits 24-18 of C concatenated with S**.

**Emulator:**
```javascript
this.wr(0, this.S);  // WRONG: Only stores S, not the link
```

#### 1.4 JIR Exit Instruction Incomplete
**Reference:** `s' = n; c'24-18 = n24-18`

JIR should restore both S **and** bits 24-18 of C from the stored link.

**Emulator:**
```javascript
this.S = n & this.MASK17;  // WRONG: Doesn't restore C bits
```

#### 1.5 Condition Register Missing Critical Bits
**Reference:** C is 14 bits with:
- c24: Negative, c23: Standardized, c22: Non-zero, c21: Carry, c20: Overflow
- c19: Normal interrupt permit
- c18: Attention interrupt permit
- c17: Invalid information transfer
- c6-c1: Manual console switches

**Emulator:** Only implements c24-c20. Missing c19-c17 means no proper interrupt masking.

### WRONG Implementations

- Double-Length Divide (DIVM) loses precision and doesn't set R to remainder
- GET/PUT character instructions use simplified rotation model
- Memory size is 64K words (matches 4120, not 4130's 256K max)

### MISSING Features

**Shift Instructions (6 of 16 implemented):**
- Missing: SRLA, SRLC, SMLA, SMLC, SRST, SMST, SBL, SBR, SBRL, SBST

**Register Operations:**
- CAIR, CADR, RNTK

**Extracodes:**
- BL/WB, JIRX/JIX/JILX, INDEX, FLU/WUF, CTLA/CTHA, FN/FCP/FMOD/FENT/FSIG

**System Features:**
- Executive/Protected mode, Base/Range registers, ATU/DMA, Hesitation interrupts

---

## Review 2: E6X2 (Full Architecture)

### Grade: D-

This emulator captures the broad spirit of the 4100 series but contains fundamental inaccuracies that would cause any real Elliott 4130 program to fail catastrophically.

### CRITICAL Issues

#### 2.1 Floating-Point Format is Completely Fabricated

**Reference (E6X3 p.6):**
> "On the 4130 where hardware is used, the mantissa occupies 48 bits within CPU registers and the exponent 12 bits... When held in memory, floating-point numbers are normally rounded and packed into two words containing 39 bits of mantissa and 9 bits of exponent."

**Emulator:** Uses completely fictional single-word 24-bit format with 17-bit mantissa and 6-bit exponent.

#### 2.2 Short Instruction Packing is Ignored

**Reference:** A 24-bit word can hold TWO 12-bit short instructions.

**Emulator:** ALWAYS reads from upper half of word and increments S by 2, completely ignoring the second half-word. Real Elliott code using packed short instructions would execute only half its instructions.

#### 2.3 Extracode Mechanism is Fundamentally Wrong

The real 4130 implemented most extracodes as software subroutines at fixed memory addresses (64-127). The emulator directly implements extracodes inline.

#### 2.4 Condition Register Bit Positions Are Wrong

**Reference:**
> "c24: result negative... c23: result standardized... c22: result non-zero... c21: carry-out... c20: arithmetic overflow"

**Emulator:**
```javascript
F_NEG = 32;  // Bit 5 (0-indexed)
F_ST = 16;   // Bit 4
F_NZ = 8;    // Bit 3
F_CA = 4;    // Bit 2
F_OF = 2;    // Bit 1
```

The flags are in completely wrong bit positions. When C is transferred to M (CTOM), real programs expect flags in bits 20-24.

### What Would an Elliott Engineer Say?

*"The floating-point unit - you've made it into some sort of toy! We spent months designing the 48-bit mantissa hardware."*

*"The short instructions - we packed them two to a word specifically for tight loops. Your version wastes half the memory bandwidth."*

---

## Review 3: E6X3 (Instruction Set Detail)

### Grade: D+

### CRITICAL Issues

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
- Missing standardize shifts (SRST, SMST) - critical for FP normalization
- Missing dual-register shifts (SBL, SBR, SBRL, SBST)

#### 3.5 FP Opcodes Off by 10 Octal
Should be 42 for FADD, emulator uses 52.

#### 3.6 checkInterrupts() Never Called
The interrupt checking function exists but is never invoked in the step() loop.

### MISSING Features

- ATU/DMA for autonomous transfers
- Protected Mode (EXEN, PMEN instructions)
- Console switch testing (c6-c1)

---

## Review 4: E6X4 (Software/Operating Systems)

### Grade: C-

### CRITICAL Issues

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

## Review 5: E6X5 (I/O System)

### Grade: C-

### CRITICAL Issues

#### 5.1 Short Instruction Packing NOT IMPLEMENTED

**Reference:** "Number of instructions per word: 1 or 2"

The Elliott 4100 could pack **two 12-bit short instructions** into a single 24-bit word.

**Emulator:** ALWAYS increments by 2 (one word), ignoring instruction packing.

#### 5.2 Floating-Point Format COMPLETELY WRONG

**Reference:** "floating-point numbers were normally rounded and packed into two words containing 39 bits of mantissa and 9 bits of exponent"

**Emulator:** Uses fictional single-word 24-bit format.

#### 5.3 Condition Register Bit Positions WRONG

**Reference:**
```
c24: result negative (Neg)
c23: result standardized (St)
c22: result non-zero (Nz)
c21: carry-out (Ca)
c20: arithmetic overflow (Of)
```

**Emulator:** Uses arbitrary low-order bits (5, 4, 3, 2, 1) instead of correct positions (24-20).

#### 5.4 JFL/JIL Link Storage WRONG

**Reference:** `0' = c24-18 + s`

The link should be the **concatenation of condition bits c24-c18 with S register**.

**Emulator:** Only stores S.

#### 5.5 Extracode Trapping Not Implemented

Real 4130 treated extracodes as **software traps** to locations 64-127, allowing OS to intercept and extend instruction set.

---

## Consolidated Findings

### Universally Agreed Critical Issues

1. **Floating-Point Format** - All reviewers agree the single-word 24-bit format is completely fictional. Real format is TWO words with 39-bit mantissa + 9-bit exponent.

2. **Extracode Mechanism** - Extracodes should be software traps to address 2*F, not inline hardware execution.

3. **JFL/JIR Link Preservation** - Link must include condition bits c24-c18 concatenated with S, not just S alone.

4. **Condition Register Bit Positions** - Flags are in wrong bit positions (should be c24-c20, not bits 5-1).

5. **Short Instruction Packing** - Two 12-bit instructions per word is ignored; emulator always processes one instruction per word.

### Priority Fix Order

1. **P0 (Breaks Everything):**
   - Fix JFL/JIR to preserve/restore c24-c18 bits
   - Fix condition register bit positions
   - Implement extracode trap mechanism

2. **P1 (Breaks Most Real Code):**
   - Rewrite FP to use two-word format (39-bit mantissa + 9-bit exponent)
   - Implement short instruction packing

3. **P2 (Breaks Some Real Code):**
   - Add missing shift instructions (standardize shifts critical for FP)
   - Fix interrupt priority order (Attention > Normal)
   - Add Protected Mode with Base/Range registers

4. **P3 (Completeness):**
   - Add console switch bits (c6-c1)
   - Implement ATU/DMA
   - Complete all register operations

### What Real Elliott Code Would Fail

| Code Type | Why It Fails |
|-----------|--------------|
| Any FP computation | Wrong format produces garbage |
| Nested subroutines | JFL/JIR lose condition state |
| Packed short instructions | Only half execute |
| Conditional branches on flags | Wrong bit positions |
| OS extracode handlers | Trap mechanism missing |
| TSS/KOS multi-user | No Protected Mode |
| Real-time I/O | Interrupt priorities backwards |

---

## What Would Pass

The emulator CAN successfully run:
- Simple integer arithmetic programs
- LISP interpreter (uses own calling conventions, avoids FP)
- Basic I/O demonstration programs
- Educational demonstrations of 24-bit word machines

---

*Reviews compiled from skeptical Computer History professional analysis of CCS E6X1-E6X5 reference manuals vs. emulator implementation.*
