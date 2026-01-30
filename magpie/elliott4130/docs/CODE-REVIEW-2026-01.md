# Elliott 4130 Emulator Code Review - January 2026

## 5-Agent Computer History Review Summary

**Date:** 2026-01-30
**Reviewers:** CCS Historian, FP Specialist, Instruction Format Expert, OS Specialist, KOS Developer
**Grade:** D+ → C- (after P1 fixes)

---

## Verified P1 Fixes (All Correct)

| Bug | Fix | Verification |
|-----|-----|--------------|
| BUG-006 | Interrupt priority order | INT_HESITATION=0 > INT_ATTENTION=1 > INT_NORMAL=2 |
| BUG-007 | 16 shift instructions | All variants including SRST/SMST/SBST verified |
| BUG-008 | Protected Mode | Base/Range registers, checkProtection() correct |
| BUG-009 | DIVM remainder | Uses BigInt, stores remainder in R |
| BUG-010 | GET/PUT chars | Rotation follows E6X3 spec exactly |

---

## Critical Issues Remaining

### BUG-016: checkInterrupts() Never Called (ALL REVIEWERS)

```javascript
// step() function ends without:
this.checkInterrupts();  // MISSING - interrupts queue but never process
```

**Impact:** All interrupt-driven code fails. Timer interrupts, protection violations, I/O completion - all dead.

### BUG-001: Floating-Point Format Fabricated (FP SPECIALIST)

| Attribute | Emulator | Real 4130 |
|-----------|----------|-----------|
| Mantissa | 17 bits (~5 digits) | 39 bits (~12 digits) |
| Exponent | 6 bits | 9 bits |
| Format | Single 24-bit word | Two 24-bit words |

**Impact:** Scientific code produces garbage. Factor of 4 million precision difference.

### BUG-002: Short Instruction Packing Broken (INSTRUCTION EXPERT)

```javascript
// Current: Always extracts upper half, always advances S by 2
const f = (w >> 18) & 0x3F;  // Only upper half
this.S = (this.S + 2) & this.MASK17;  // Always full word

// Should: Check S bit 0 for upper/lower, advance by 1 for short
```

**Impact:** 50-100% of compiled ALGOL fails. Only executes half the instructions.

### BUG-003: Extracode Trap Missing (OS SPECIALIST)

Per E6X3, extracodes (Z=1) should:
1. Store N at location 1
2. Store link (c24-18 + S) at location 2
3. Jump to address 2*F

**Current:** Executes inline as JavaScript - no trap, no OS interception possible.

**Impact:** No supervisor calls. KOS/TSS impossible. No debugger instrumentation.

### BUG-004: JFL/JIR Link Corruption (CCS HISTORIAN)

```javascript
// Current:
this.wr(0, this.S);  // Only stores S

// Should:
const link = ((this.C >> 17) & 0x7F) << 17 | (this.S & this.MASK17);
this.wr(0, link);  // Store C[24:18] + S
```

**Impact:** Nested subroutines corrupt state. Recursive algorithms fail.

### Interrupt Handler Mode Bug (KOS SPECIALIST)

```javascript
// checkInterrupts() does NOT set:
this.executiveMode = true;  // MISSING

// Result: OS handler runs in user's Protected Mode sandbox
// OS can't access its own tables - immediate crash
```

### No RTI Instruction (KOS SPECIALIST)

Cannot return from interrupt to user context. No way to restore:
- Previous S and C
- Previous executiveMode
- Previous base/range

---

## Priority Fix Order (Unanimous)

1. **BUG-016**: Add `this.checkInterrupts()` to `step()` (~1 line)
2. **BUG-004**: Fix JFL/JIR link preservation (~4 lines)
3. **Interrupt mode**: Set `executiveMode = true` on entry (~1 line)
4. **BUG-002**: Short instruction packing (~20 lines)
5. **BUG-003**: Extracode trap mechanism (~30 lines)
6. **BUG-001**: FP rewrite (500-800 lines)

---

## What Can/Cannot Run

### CAN Run:
- Integer-only assembly (no packed shorts)
- Character processing (GET/PUT)
- Simple test programs
- Custom LISP (avoids traps)

### CANNOT Run:
- Any FORTRAN program (FP wrong)
- Any ALGOL program (packed shorts + FP)
- KOS multi-user BASIC (no RTI, no traps)
- TSS time-sharing (extracode traps missing)
- Recursive algorithms (link corruption)
- Any interrupt-driven code

---

## Historian Quotes

> "The FP implementation provides ~5 digits precision. The real 4130 provided ~12."

> "The short instruction packing was essential for ALGOL compilers."

> "Watching interrupts fire without entering Executive Mode would have given me nightmares."

> "The whole POINT was that we could extend the instruction set through software at those trap addresses."

---

*Review archived for future development reference.*
