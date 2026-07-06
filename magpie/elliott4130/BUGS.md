# Elliott 4130 Emulator - Known Bugs & Historical Inaccuracies

Critical assessment against the CCS E6X1-E6X5 reference manuals. Earlier reviewers (see `docs/historian-reviews.md`) identified five P0 issues; those have been addressed. P2/P3 gaps remain and are listed below.

## Status

The CPU core's instruction set, condition flags, two-word floating point, extracode trap mechanism, and three-level interrupt priority all match the spec well enough that the modern test suite (~350 cases across ten files) passes. What this proves is that *small targeted programs* exercising those mechanisms work as documented; it does **not** prove that real Elliott software (FORTRAN, ALGOL, KOS) runs without further work, and we have not attempted to load any. See *What we have not demonstrated* below.

---

## Summary by PDF

| Manual | Focus | Grade | Key Finding |
|--------|-------|-------|-------------|
| E6X1 | Customer List | N/A | (Not technical - delivery list only) |
| E6X2 | Architecture | A- | Short instruction packing FIXED, FP format FIXED |
| E6X3 | Instruction Set | A- | Extracodes FIXED, all 16 shifts implemented |
| E6X4 | Software/OS | A- | Interrupt priority FIXED, Protected Mode FIXED |
| E6X5 | I/O Bibliography | C+ | ATU/DMA not implemented |

---

## P0: CRITICAL BUGS (Breaks Everything)

All P0 bugs have been fixed.

### ~~BUG-001: Floating-Point Format is Completely Fabricated~~ FIXED

**Status:** Fixed in commit (2026-01-30)

**What was wrong:** Completely fictional single-word format:
- 17-bit mantissa, 6-bit exponent in single 24-bit word
- Only ~5 decimal digits precision
- Would produce garbage for any FORTRAN/ALGOL computation

**Fix applied per E6X3 p.6:**

Memory format (two 24-bit words):
```
Word 1: [Sign(1)] [Exponent(9)] [Mantissa high(14)]
Word 2: [Mantissa low(24)]
Total: 39-bit mantissa (38 stored + 1 implicit), 9-bit exponent, 1-bit sign
```

Internal format (during computation):
- `fpAccum` JavaScript number (53-bit mantissa, sufficient for 48-bit emulation)
- Gives ~12 decimal digits precision (vs ~5 with old format)

**Changes:**
- `fpToFloat(addr)` - reads TWO words from memory, returns JavaScript number
- `floatToFp(value, addr)` - writes TWO words to memory
- Added `fpAccum` internal FP accumulator
- All FP instructions (FADD, FSUB, FMUL, FDIV, FLD, FST, etc.) use two-word format

**Tests:** 26 tests in `tests/test-floating-point.js`

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

## What we have demonstrated runs

Anything covered by the test suite under `tests/`:
- Targeted integer arithmetic with both packed short and long instructions
- Two-word floating-point arithmetic (39-bit mantissa, 9-bit exponent) on synthetic test inputs
- The extracode trap sequence (mem[1]=N, mem[2]=link, S=2*F[+1])
- JFL/JIR linkage with C[24:18] preservation
- All 16 documented shift instructions
- Three-level interrupt priority and Protected Mode bookkeeping

`tests/test-lisp-smoke.mjs` additionally exercises the LISP image far enough to print its banner and to handle a bare unbound atom (returns NIL).

## What we have not demonstrated

We have not actually run any of these. Don't claim the emulator supports them until you have:

- Real-world FORTRAN, ALGOL, or COBOL programs from the era
- The `lisp4130.asm` interpreter's remaining EVAL gaps. **Correction (verified 2026-07-06 via `node cli.mjs --repl`):** EVAL does NOT "return NIL for any list expression" — `CAR`/`CDR`/`CONS`/`ATOM`/`EQ`/`NULL`/`COND` and integer literals all evaluate correctly today. The genuinely-broken cases are **LAMBDA/LABEL application** (infinite loop → max-steps), `(QUOTE n)` for numeric n, and the reader's inability to skip `;` comments (so the comment-laden `tapes/*.lisp` files produce garbage as-is). Multi-char user atoms also truncate to their first letter (only built-in keywords are recognised).
- Any operating system: EASE, DES, KOS, TSS
- Any multi-user / time-sharing workload
- Block-mode I/O via ATU/DMA (not implemented)

---

## What Would Fail (P2/P3 Issues Remaining)

| Code Type | Why It Might Fail |
|-----------|-------------------|
| Large programs | 64K limit (should be 256K) |
| Block transfers | ATU/DMA not implemented |
| Hardware debugging | Hesitation interrupt missing |
| Console panel ops | Switch bits missing |
| Magnetic tape I/O | Only paper tape implemented |

---

## Priority Fix Order

1. ~~**Fix P0 bugs first**~~ ALL DONE
2. ~~**Then P1**~~ ALL DONE
3. **Then P2** - for completeness (in progress)
4. **P3 is optional** - nice to have
