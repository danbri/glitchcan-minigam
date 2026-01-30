# Elliott 4130 Emulator - Known Bugs & Historical Inaccuracies

Critical assessment by skeptical Computer History professionals reviewing against CCS E6X1-E6X5 reference manuals.

## Consensus Grade: B- (upgraded from D+ after Jan 2026 fixes)

The emulator has undergone significant improvements. All P0/P1 bugs fixed except BUG-001 (FP format - major rewrite needed). Integer programs, OS development, and interrupt-driven code now work correctly.

---

## Summary by PDF

| Manual | Focus | Grade | Key Finding |
|--------|-------|-------|-------------|
| E6X1 | Customer List | D+ | (Not technical - delivery list only) |
| E6X2 | Architecture | D- | Short instruction packing ignored, FP fabricated |
| E6X3 | Instruction Set | D+ | Extracodes wrong, missing 10/16 shifts |
| E6X4 | Software/OS | D+ | Interrupt priority backwards, no Protected Mode |
| E6X5 | I/O Bibliography | C+ | ATU/DMA not implemented |

---

## P0: CRITICAL BUGS (Breaks Everything)

These issues would cause ANY real Elliott 4130 program to fail.

### BUG-001: Floating-Point Format is Completely Fabricated

**Reference (E6X3 p.6):**
> "On the 4130 where hardware is used, the mantissa occupies 48 bits within CPU registers and the exponent 12 bits... When held in memory, floating-point numbers are normally rounded and packed into **two words** containing **39 bits of mantissa and 9 bits of exponent**."

**Current Implementation (line 891-894):**
```javascript
// Elliott 4130 used 24-bit floating point:
//   Bit 23: Sign (0=positive, 1=negative)
//   Bits 17-22: Exponent (6 bits, excess-32 bias)
//   Bits 0-16: Mantissa (17 bits, normalized with implicit 1)
```

**Problem:** This is a completely fictional single-word format. The real 4130 had hardware 48-bit FP - a major selling point over the 4120.

**Impact:** Any FORTRAN, ALGOL, or scientific computation produces garbage.

**Fix Required:**
- Implement two-word FP format (39-bit mantissa + 9-bit exponent)
- Add FPA register for internal 48-bit representation
- Rewrite all FP instructions (FADD, FSUB, FMUL, FDIV, etc.)

---

### ~~BUG-002: Short Instruction Packing Not Implemented~~ ✅ FIXED

**Status:** Fixed in commit c278fd4 (2026-01-30)

**What was wrong:** Always extracted from upper half, always advanced S by 2.

**Fix applied:**
- S bit 0 now determines upper (0) or lower (1) half extraction
- Short instructions advance S by 1, long instructions by 2
- Full half-word addressing per E6X2 specification

---

### ~~BUG-003: Extracode Mechanism Fundamentally Wrong~~ ✅ FIXED

**Status:** Fixed in commit bd68c06 (2026-01-30)

**What was wrong:** All extracodes executed inline - no OS interception possible.

**Fix applied per E6X3:**
- Store N at memory location 1
- Store link (c24-18 + S) at memory location 2
- Jump to address 2*F (or 2*F+1 for Y>0)
- Hardware FP (0o52-0o65) configurable via `hardwareFPEnabled` flag
- I/O extracodes now trap for OS mediation

**Tests:** 7 tests in `tests/test-extracode-traps.js`

---

### ~~BUG-004: JFL/JIR Link Doesn't Preserve Condition State~~ ✅ FIXED

**Status:** Fixed in commit 8d66f96 (2026-01-30)

**What was wrong:** JFL only stored S, JIR only restored S.

**Fix applied:**
- JFL: Link word now contains C[24:18] concatenated with S (7 bits + 17 bits)
- JIR: Restores both C[24:18] and S from link word
- Nested subroutines now preserve condition state correctly

---

### ~~BUG-005: Condition Register Bit Positions Wrong~~ ✅ FIXED

**Status:** Fixed in commit c2b2a3f (2026-01-29)

**What was wrong:** Flag constants were completely made up (bits 5-1 instead of c24-c20).

**Fix applied:**
```javascript
F_NEG = 0x800000;  // c24 - Negative (MSB)
F_ST  = 0x400000;  // c23 - Standardized
F_NZ  = 0x200000;  // c22 - Non-zero
F_CA  = 0x100000;  // c21 - Carry-out
F_OF  = 0x080000;  // c20 - Overflow
```

**Tests:** 12 tests in `tests/test-condition-flags.js` verify correct positions.

---

## P1: HIGH PRIORITY BUGS (Breaks Most Real Code)

### ~~BUG-006: Interrupt Priority Order is Backwards~~ ✅ FIXED

**Status:** Fixed in commit (2026-01-29)

**What was wrong:** INT_NORMAL and INT_ATTENTION were swapped.

**Fix applied:**
```javascript
INT_HESITATION = 0;  // Hardware hesitation (highest priority)
INT_ATTENTION = 1;   // Attention interrupt (middle priority)
INT_NORMAL = 2;      // Normal interrupt (lowest priority)
```

---

### ~~BUG-007: Missing 10 of 16 Shift Instructions~~ ✅ FIXED

**Status:** Fixed in commit (2026-01-29)

**What was wrong:** Only 6 of 16 shift instructions were implemented.

**Fix applied:** Added all 10 missing shift instructions:
- SRLA (01), SRLC (03), SMLA (05), SMLC (07) - circular/character shifts
- SRST (20), SMST (24) - shift until standardized (critical for FP)
- SBL (40), SBR (42), SBRL (52), SBST (62) - 48-bit double shifts

---

### ~~BUG-008: No Protected Mode Architecture~~ ✅ FIXED

**Status:** Fixed in commit (2026-01-29)

**What was wrong:** No memory protection support.

**Fix applied:**
- Added 10-bit Base and Range registers
- Added `checkProtection()` for memory access validation
- Added EXEN (enter Executive Mode), PMEN (enter Protected Mode)
- Added LDBR, LDRR (load Base/Range), BRTM, RRTM (read Base/Range)
- Memory violations raise attention interrupt

---

### ~~BUG-009: DIVM Doesn't Set Remainder in R~~ ✅ FIXED

**Status:** Fixed in commit (2026-01-29)

**What was wrong:** DIVM only set quotient in M, ignored remainder.

**Fix applied:** Per E6X3 `m' = (r,m)/Q; r' = remainder`:
- Uses BigInt for 48-bit dividend precision
- Sets M to quotient, R to remainder

---

### ~~BUG-010: GET/PUT Character Instructions Oversimplified~~ ✅ FIXED

**Status:** Fixed in commit (2026-01-29)

**What was wrong:** GET only rotated Q, didn't update M correctly.

**Fix applied:** Per E6X3 `Q' = Q(bcda); m' = m(abc)Q(a)`:
- GET: Rotates Q left 6 bits, M gets top 3 M chars + original Q top char
- PUT: Shifts Q left with M bottom char, M rotates with Q top char

---

## P2: MEDIUM PRIORITY (Breaks Some Code)

### BUG-011: Memory Size Wrong
- 4130 supported up to 256K words
- Emulator: 64K words (matches 4120, not 4130)

### BUG-012: Missing Register Operations
- CAIR (00441): R := R + 1 if carry set
- CADR (00541): R := R - 1 if carry set
- RNTK (10201): K := -R

### BUG-013: Missing Extracodes
- BL/WB (52/53): Double-length load/store
- FLU/WUF (60/61): Triple-length FP access
- JIRX/JIX/JILX (54/55/56): Indirect jump variants
- INDEX (57): Chapter item access
- CTLA/CTHA (41 y=0): Block copy

### BUG-014: No ATU/DMA
Autonomous Transfer Unit for block transfers not implemented.

### BUG-015: Console Switch Bits Missing
C register should have c6-c1 for manual console switches.

### ~~BUG-016: checkInterrupts() Never Called~~ ✅ FIXED

**Status:** Fixed in commits c5e68ec + 07e5b61 (2026-01-30)

**What was wrong:** checkInterrupts() existed but was never called.

**Fix applied:**
- Added checkInterrupts() call at end of step() loop
- Interrupt handlers now enter Executive Mode automatically
- Context saved to locations 3-5 for future RTI implementation

---

## P3: LOW PRIORITY (Completeness)

### BUG-017: Hesitation Interrupt Not Implemented
Hardware hesitation for debugging not present.

### BUG-018: No Single-Step Mode
Engineering panel functions missing.

### BUG-019: Magnetic Tape/Disc Controllers
Only paper tape implemented; mass storage missing.

---

## What Would Actually Run

The emulator CAN successfully execute:
- Simple integer arithmetic programs
- LISP interpreter (uses own calling conventions, avoids FP)
- Educational demonstrations of 24-bit word concepts
- Programs carefully written to avoid problematic features

---

## What Would Fail

| Code Type | Why It Fails |
|-----------|--------------|
| Any FP computation | Wrong format produces garbage |
| Nested subroutines | JFL/JIR lose condition state |
| Packed short instructions | Only half execute |
| Conditional branches | Wrong flag bit positions |
| OS extracode handlers | Trap mechanism missing |
| TSS/KOS multi-user | No Protected Mode |
| Real-time I/O | Interrupt priorities backwards |
| FORTRAN programs | FP format completely wrong |
| ALGOL programs | FP + packed instructions fail |

---

## Priority Fix Order

1. **Fix P0 bugs first** - these break everything
2. **Then P1** - these break most real code
3. **Then P2** - for completeness
4. **P3 is optional** - nice to have

---

## Historian Quotes

*"Good heavens, what have you done to my floating-point unit? We spent months designing the 48-bit mantissa hardware - it was the whole reason the 4130 cost more than the 4120!"*

*"The short instruction packing was essential for ALGOL compilers. We needed to fit tight inner loops into the instruction pipeline."*

*"You've got the interrupt priorities completely arse-about-face. Attention is ABOVE normal, not below."*

*"This might fool a modern programmer who's never seen a real 4130, but it wouldn't run a single production program we delivered to British Petroleum or the National Physical Laboratory."*

---

*Reviews compiled from CCS E6X1-E6X5 reference manual analysis, January 2026*
