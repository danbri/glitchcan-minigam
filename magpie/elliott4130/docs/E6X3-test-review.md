# E6X3 Test Coverage Review

**Document**: E6X3-emulation-notes.md (CCS E6X3 Version 2, November 2011)
**Reviewed**: 2026-01-30
**Test Files Examined**:
- test-condition-flags.js
- test-extracode-traps.js
- test-floating-point.js
- test-advanced-ops.js
- test-instruction-format.js
- test-interrupts.js

---

## Executive Summary

The test suite provides reasonable coverage of core functionality but has significant gaps in instruction coverage. **Only 6 of 16 shift instructions are tested**, several critical instructions (DKJN, MULM, block moves) have no tests, and the GET/PUT tests simulate behavior rather than exercising actual instruction execution.

### Coverage Statistics

| Category | E6X3 Items | Tested | Coverage |
|----------|-----------|--------|----------|
| Shift Instructions | 16 | 6 | 37.5% |
| Register-to-Register | 16 | 0 | 0% |
| Condition Flags | 5 core + 6 auxiliary | 3 | ~27% |
| FP Operations | 14 | 11 | 79% |
| Address Modes | 4 | 2 | 50% |

---

## Section-by-Section Analysis

### 1. Condition Register (E6X3 Section 1)

**Tested:**
- c24 (Neg) - Negative flag position and setting
- c22 (Nz) - Non-zero flag position and setting
- Link word preservation of c24-c18

**NOT Tested:**
- c23 (St) - Standardized flag logic (bits 22,23 equal OR value=0)
- c21 (Ca) - Carry-out flag
- c20 (Of) - Overflow flag (except in FP tests)
- c19 - Normal interrupt permit
- c18 - Attention interrupt permit
- c17 - Invalid information transfer
- c6-c1 - Manual console switches

**Issues Found:**
```javascript
// test-condition-flags.js does NOT verify standardization definition
// E6X3: "bits 22 and 23 equal OR value=0"
// Missing test: setC(0x600000) should set St (both bits same)
// Missing test: setC(0x400000) should NOT set St (bits differ)
```

**Proposed Tests:**
```javascript
test('St flag set when bits 22,23 are equal (both 0)', () => {
    const cpu = createCPU();
    cpu.setC(0x000001);  // Bits 22,23 both 0
    assertEqual((cpu.C & cpu.F_ST) !== 0, true);
});

test('St flag set when bits 22,23 are equal (both 1)', () => {
    const cpu = createCPU();
    cpu.setC(0xC00000);  // Bits 22,23 both 1
    assertEqual((cpu.C & cpu.F_ST) !== 0, true);
});

test('St flag NOT set when bits 22,23 differ', () => {
    const cpu = createCPU();
    cpu.setC(0x400000);  // Bit 22=1, bit 23=0
    assertEqual((cpu.C & cpu.F_ST) !== 0, false);
});

test('Ca (carry) flag set on add overflow', () => {
    const cpu = createCPU();
    cpu.M = 0xFFFFFF;
    // Execute ADD with 1 - should set carry
    // ...verify cpu.C & cpu.F_CA
});
```

---

### 2. Instruction Format (E6X3 Section 2)

**Tested:**
- Short instruction half-word packing
- Upper/lower half extraction
- S advancement (by 1 for short, by 2 for long)
- Y=0 (literal) addressing
- Y=1 (direct) addressing

**NOT Tested:**
- Y=2 (modified) addressing: effective address = N + R
- Y=3 (indirect) addressing: effective address = [N]
- 64K block limit check (bits 16-22 of final address must be zero)
- Z bit extracode detection in long format

**Proposed Tests:**
```javascript
test('Y=2 modified addressing adds R to N', () => {
    const cpu = createCPU();
    cpu.R = 100;  // Modifier
    // Long LD with Y=2, N=50 should access mem[150]
    const instr = (0o43 << 18) | (2 << 16) | (0 << 15) | 50;
    cpu.mem[100] = instr;
    cpu.mem[150] = 0xABCDEF;
    cpu.S = 200;
    cpu.step();
    assertEqual(cpu.M, 0xABCDEF);
});

test('Y=3 indirect addressing uses contents of N', () => {
    const cpu = createCPU();
    // Long LD with Y=3, N=50 should access mem[[50]]
    const instr = (0o43 << 18) | (3 << 16) | (0 << 15) | 50;
    cpu.mem[100] = instr;
    cpu.mem[50] = 200;     // Pointer
    cpu.mem[200] = 0x123456;  // Actual value
    cpu.S = 200;
    cpu.step();
    assertEqual(cpu.M, 0x123456);
});
```

---

### 3. Shift Instructions (E6X3 Section 4) - CRITICAL GAP

**E6X3 defines 16 shift instructions. Only 6 are tested:**

| N (oct) | Mnemonic | Description | Tested? |
|---------|----------|-------------|---------|
| 00 | SRL | R left arithmetic | NO |
| 01 | SRLA | R left circular | NO |
| 02 | SRR | R right arithmetic | NO |
| 03 | SRLC | R character circular | NO |
| 04 | SML | M left arithmetic | NO |
| 05 | SMLA | M left circular | YES |
| 06 | SMR | M right arithmetic | NO |
| 07 | SMLC | M character circular | YES |
| 12 | SRRL | R right logical | NO |
| 16 | SMRL | M right logical | NO |
| 20 | SRST | R standardize | YES |
| 24 | SMST | M standardize | YES |
| 40 | SBL | Both left arithmetic | YES |
| 42 | SBR | Both right arithmetic | NO |
| 52 | SBRL | Both right logical | YES |
| 62 | SBST | Both standardize | NO |

**Critical Missing: 10 shift instructions have zero test coverage.**

**Proposed Tests:**
```javascript
// SRL (0o00) - R left arithmetic
test('SRL: R left arithmetic preserves sign', () => {
    const cpu = createCPU();
    cpu.R = 0xC00000;  // Negative value
    cpu.K = 1;
    cpu.shift(0o00);
    assertEqual(cpu.R, 0x800000);  // Sign bit preserved, shifted left
});

// SRR (0o02) - R right arithmetic
test('SRR: R right arithmetic extends sign', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Negative (sign bit set)
    cpu.K = 1;
    cpu.shift(0o02);
    assertEqual(cpu.R, 0xC00000);  // Sign extended
});

// SRRL (0o12) - R right logical
test('SRRL: R right logical zero-fills', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;
    cpu.K = 1;
    cpu.shift(0o12);
    assertEqual(cpu.R, 0x400000);  // Zero-filled, not sign-extended
});

// SBR (0o42) - Both right arithmetic
test('SBR: 48-bit right arithmetic shift', () => {
    const cpu = createCPU();
    cpu.R = 0x800000;  // Sign bit in R
    cpu.M = 0x000000;
    cpu.K = 1;
    cpu.shift(0o42);
    // Should sign-extend into R, carry LSB of R into MSB of M
    assertEqual(cpu.R, 0xC00000);
    assertEqual(cpu.M, 0x000000);
});

// SBST (0o62) - Both standardize
test('SBST: 48-bit standardize counts shifts in K', () => {
    const cpu = createCPU();
    cpu.R = 0x000001;
    cpu.M = 0x000000;
    cpu.K = 99;
    cpu.shift(0o62);
    // Should shift 48-bit (R,M) until standardized
    // K receives count
    assertEqual(cpu.K > 0, true);  // Some shifts occurred
});
```

---

### 4. Register-to-Register (E6X3 Section 5) - ZERO COVERAGE

**None of the 16 register-to-register instructions are tested!**

| N (oct) | Mnemonic | Action | Tested? |
|---------|----------|--------|---------|
| 00020 | KTOR | r' = k | NO |
| 00402 | MTOR | r' = m | NO |
| 00404 | STOR | r' = s | NO |
| 00441 | CAIR | r' = r + 1 if carry | NO |
| 00541 | CADR | r' = r - 1 if carry | NO |
| 01001 | RTOM | m' = r | NO |
| 01003 | MORR | m' = m OR r | NO |
| 01010 | CTOM | m' = c | NO |
| 02001 | RTOS | s' = r | NO |
| 02002 | MTOS | s' = m | NO |
| 04002 | MTOC | c' = m | NO |
| 10001 | RTOK | k' = r | NO |
| 10002 | MTOK | k' = m | NO |
| 10201 | RNTK | k' = -r | NO |
| 21000 | ITOM | m' = interrupt word | NO |
| 41000 | ATOM | m' = attention word | NO |

**Proposed Tests:**
```javascript
test('KTOR: K to R transfer', () => {
    const cpu = createCPU();
    cpu.K = 0x123;
    cpu.R = 0;
    cpu.regOp(0o00020);  // KTOR
    assertEqual(cpu.R, 0x123);
});

test('MTOR: M to R transfer', () => {
    const cpu = createCPU();
    cpu.M = 0xABCDEF;
    cpu.R = 0;
    cpu.regOp(0o00402);  // MTOR
    assertEqual(cpu.R, 0xABCDEF);
});

test('CAIR: Conditional add to R if carry set', () => {
    const cpu = createCPU();
    cpu.R = 100;
    cpu.C = cpu.F_CA;  // Carry flag set
    cpu.regOp(0o00441);
    assertEqual(cpu.R, 101);
});

test('CAIR: No change if carry clear', () => {
    const cpu = createCPU();
    cpu.R = 100;
    cpu.C = 0;  // Carry flag clear
    cpu.regOp(0o00441);
    assertEqual(cpu.R, 100);
});

test('MORR: M OR R', () => {
    const cpu = createCPU();
    cpu.M = 0xF0F0F0;
    cpu.R = 0x0F0F0F;
    cpu.regOp(0o01003);
    assertEqual(cpu.M, 0xFFFFFF);
});

test('RNTK: Negate R to K', () => {
    const cpu = createCPU();
    cpu.R = 5;
    cpu.regOp(0o10201);
    assertEqual(cpu.K, 0xFFB & 0xFFF);  // -5 in 12-bit
});
```

---

### 5. DKJN Instruction - COMPLETELY MISSING

**E6X3 Section 10 specifically lists DKJN as a testable requirement.**

```
DKJN: Decrements K by 1; Jumps if k12=1 (bit 12 set, i.e., K went negative)
```

**No tests exist for DKJN!**

**Proposed Tests:**
```javascript
test('DKJN: Decrements K by 1', () => {
    const cpu = createCPU();
    cpu.K = 5;
    cpu.S = 200;
    // DKJN short (0o27) with offset 10
    const word = packShortInstructions(0o27, 10, 0, 0);
    cpu.mem[100] = word;
    cpu.step();
    assertEqual(cpu.K, 4);
});

test('DKJN: Does NOT jump when K positive (k12=0)', () => {
    const cpu = createCPU();
    cpu.K = 5;
    cpu.S = 200;
    const word = packShortInstructions(0o27, 10, 0, 0);
    cpu.mem[100] = word;
    cpu.step();
    assertEqual(cpu.S, 201);  // Just advanced, no jump
});

test('DKJN: Jumps when K goes negative (k12=1)', () => {
    const cpu = createCPU();
    cpu.K = 0;  // Will decrement to -1 = 0xFFF (12-bit)
    cpu.S = 200;
    const word = packShortInstructions(0o27, 10, 0, 0);
    cpu.mem[100] = word;
    cpu.step();
    // K should be 0xFFF, k12 (bit 11 in 0-indexed) = 1
    assertEqual(cpu.K, 0xFFF);
    // Should have jumped: S = S + 1 + 10 = 211
    assertEqual(cpu.S, 211);
});

test('DKJN: k12 bit test is on bit 12 (Elliott numbering)', () => {
    const cpu = createCPU();
    cpu.K = 0x800;  // k12 already set (bit 11 in 0-indexed = bit 12 Elliott)
    cpu.S = 200;
    const word = packShortInstructions(0o27, 5, 0, 0);
    cpu.mem[100] = word;
    cpu.step();
    assertEqual(cpu.K, 0x7FF);  // Decremented
    // k12 was set BEFORE decrement, but we check AFTER
    // After decrement: 0x7FF has k12=0, so no jump
    assertEqual(cpu.S, 201);
});
```

---

### 6. Extracode Trap Mechanism (E6X3 Section 6)

**Tested:**
- N stored at location 1
- Link stored at location 2
- Jump to 2*F for Y=0
- Jump to 2*F+1 for Y>0
- Hardware FP bypass

**NOT Tested:**
- Y=2 effective address calculation (N + r)
- Y=3 effective address calculation ([N])
- Link word format verification (c24-18 preserved correctly)

**Issues Found:**
```javascript
// test-extracode-traps.js line 91 only checks lower 17 bits
// Does NOT verify C[24:18] preservation in link
assertEqual(link & 0x1FFFF, 202, 'Link lower 17 bits should be return S');
// MISSING: Verify (link >> 17) & 0x7F equals (originalC >> 17) & 0x7F
```

**Proposed Tests:**
```javascript
test('Extracode Y=2 stores N+R at location 1', () => {
    const cpu = createCPU();
    cpu.R = 50;  // Modifier
    cpu.hardwareFPEnabled = false;
    // Extracode F=0o50, Y=2, Z=1, N=100
    const instr = (0o50 << 18) | (2 << 16) | (1 << 15) | 100;
    cpu.mem[100] = instr;
    cpu.S = 200;
    cpu.step();
    assertEqual(cpu.mem[1], 150);  // N + R = 100 + 50
});

test('Extracode Y=3 stores [N] at location 1', () => {
    const cpu = createCPU();
    cpu.mem[100] = 0o50 << 18 | (3 << 16) | (1 << 15) | 75;  // F=0o50, Y=3, N=75
    cpu.mem[75] = 500;  // Pointer target
    cpu.hardwareFPEnabled = false;
    cpu.S = 200;
    cpu.step();
    assertEqual(cpu.mem[1], 500);  // [N] = [75] = 500
});

test('Extracode link preserves C[24:18] correctly', () => {
    const cpu = createCPU();
    cpu.C = 0x5A0000;  // Pattern in upper bits
    cpu.hardwareFPEnabled = false;
    const instr = (0o50 << 18) | (0 << 16) | (1 << 15) | 42;
    cpu.mem[100] = instr;
    cpu.S = 200;
    cpu.step();
    const link = cpu.mem[2];
    const savedC = (link >> 17) & 0x7F;
    const expectedC = (0x5A0000 >> 17) & 0x7F;
    assertEqual(savedC, expectedC);
});
```

---

### 7. Floating-Point (E6X3 Section 7)

**Tested:**
- Two-word format (sign, exponent, mantissa)
- Basic arithmetic (FL, WF, FA, FS, FM, FD)
- FN (negate), FMOD (absolute), FENT (entier/fix), FCP (convert/compare)
- FSIG (sign function)
- FSQRT (square root)

**NOT Tested:**
- FLU (load unrounded, 3 words) - internal 48-bit format
- WUF (write unrounded, 3 words) - internal 48-bit format
- Different addressing modes for FP operations (Y=0,1,2,3)
- Overflow/underflow behavior with exponent limits

**Issues Found:**
```javascript
// test-floating-point.js uses helper functions like fpStore(1, 70)
// E6X3 shows: WF (F=41) y, z, n format
// Tests don't verify actual instruction execution via step()
```

**Proposed Tests:**
```javascript
test('FLU loads 48-bit unrounded format (3 words)', () => {
    const cpu = createCPU();
    // Store 3-word unrounded format at address 50
    // Word 1: exponent (12 bits) + mantissa high (12 bits)
    // Word 2: mantissa mid (24 bits)
    // Word 3: mantissa low (24 bits)
    cpu.mem[50] = 0x100800;  // Example unrounded format
    cpu.mem[51] = 0x000000;
    cpu.mem[52] = 0x000000;
    cpu.fpLoadUnrounded(50);  // FLU
    // Verify internal format loaded correctly
});

test('WUF stores 48-bit unrounded format (3 words)', () => {
    const cpu = createCPU();
    cpu.floatToFp(3.14159, 50);
    cpu.fpLoad(50);
    cpu.fpStoreUnrounded(60);  // WUF
    // Verify 3 words written at 60, 61, 62
    assertEqual(cpu.mem[60] !== 0 || cpu.mem[61] !== 0 || cpu.mem[62] !== 0, true);
});

test('FP exponent overflow sets Of flag', () => {
    const cpu = createCPU();
    cpu.floatToFp(1e100, 50);  // Very large
    cpu.floatToFp(1e100, 52);
    cpu.fpLoad(50);
    cpu.fpMul(52);  // Should overflow
    assertEqual((cpu.C & cpu.F_OF) !== 0, true);
});
```

---

### 8. GET/PUT Character Instructions (E6X3 Section 8)

**Critical Issue: Tests simulate behavior rather than executing instructions.**

The existing tests in `test-advanced-ops.js` manually set `cpu.Q` and `cpu.M` to expected values instead of executing the actual GET (F=70, Y=1-3) and PUT (F=71, Y=1-3) instructions via `cpu.step()`.

**E6X3 Definition:**
```
GET (F=70, Y=1-3): Q' = Q(bcda); m' = m(abc)Q(a)
  - Q rotates left 6 bits
  - M gets its top 3 chars + Q's original top char

PUT (F=71, Y=1-3): Q' = Q(bcd)m(d)
  - Q shifts left 6 bits, M's bottom char inserted
```

**Proposed Tests (actual instruction execution):**
```javascript
test('GET instruction rotates Q and transfers char to M', () => {
    const cpu = createCPU();
    // Q = 0xABCDEF (chars: A=0x2A, B=0xF3, C=0x37, D=0xAF in 6-bit)
    // Actually: bits 23-18, 17-12, 11-6, 5-0
    cpu.Q = 0xFC0001;  // Top char = 0x3F, bottom char = 0x01
    cpu.M = 0x123456;
    cpu.mem[50] = cpu.Q;  // GET reads Q from memory

    // GET instruction: F=0o70, Y=1, N=50
    const instr = (0o70 << 18) | (1 << 16) | (0 << 15) | 50;
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // Q should have rotated left 6 bits
    // M should have top 3 chars of old M + top char of old Q
});

test('PUT instruction shifts Q and inserts M char', () => {
    const cpu = createCPU();
    cpu.Q = 0xABCDE0;  // Will lose top char, gain M's bottom
    cpu.M = 0x00003F;  // Bottom char = 0x3F
    cpu.mem[50] = cpu.Q;

    // PUT instruction: F=0o71, Y=1, N=50
    const instr = (0o71 << 18) | (1 << 16) | (0 << 15) | 50;
    cpu.mem[100] = instr;
    cpu.S = 200;

    cpu.step();

    // Result should be in mem[50] per PUT semantics
    const result = cpu.mem[50];
    assertEqual(result & 0x3F, 0x3F);  // Bottom char should be from M
});
```

---

### 9. Missing Instruction Tests

The following Group A instructions from E6X3 Section 3 have no test coverage:

| F | Mnemonic | Action | Priority |
|---|----------|--------|----------|
| 02/42 | NADD | m' = Q - m | MEDIUM |
| 10/50 | ADDR | r' = r + Q | MEDIUM |
| 11/51 | SUBR | r' = r - Q | MEDIUM |
| 12/52 | NADR | r' = Q - r | MEDIUM |
| 55 | COMP | compare (m - Q) | HIGH |
| 30/60 | ST | Q' = m | HIGH |
| 31/61 | STR | Q' = r | MEDIUM |
| 32/62 | NEGS | Q' = -Q | MEDIUM |
| 33/63 | SUBS | Q' = Q - m | MEDIUM |
| 34/64 | ADDS | Q' = Q + m | MEDIUM |
| 35/65 | CLS | Q' = 0 | LOW |
| 36/66 | INCS | Q' = Q + 1 | MEDIUM |
| 37/67 | DECS | Q' = Q - 1 | MEDIUM |
| 73 | MULM | (r,m)' = m x Q | HIGH |
| 74 | MVE | Block move forward | HIGH |
| 75 | MVB | Block move backward | HIGH |
| 76 | EXC | swap Q and m | MEDIUM |
| 77 | EXCR | swap Q and r | MEDIUM |

---

### 10. I/O Instructions (E6X3 Section 9) - NO COVERAGE

I/O instructions (F=74-77 with Y=0) are completely untested. While these may require hardware simulation, basic trap-to-OS behavior should be verified.

---

## Summary of Required Test Additions

### Critical Priority (Specification Compliance)
1. **DKJN instruction** - E6X3 Section 10 lists this as testable requirement
2. **10 missing shift instructions** - Only 6/16 tested
3. **All 16 register-to-register instructions** - 0% coverage
4. **Y=2 and Y=3 addressing modes** - Only Y=0,1 tested

### High Priority (Core Functionality)
5. **Condition flag tests** - St, Ca, Of flags
6. **GET/PUT actual instruction execution** - Current tests don't use step()
7. **COMP instruction** - Compare without storing
8. **MULM instruction** - 48-bit multiply
9. **ST/STR store instructions**
10. **MVE/MVB block moves**

### Medium Priority (Completeness)
11. **Extracode Y=2,Y=3 effective address**
12. **FLU/WUF unrounded FP format**
13. **NADD, ADDR, SUBR, NADR** - R register arithmetic
14. **NEGS, SUBS, ADDS, CLS, INCS, DECS** - Storage operations
15. **EXC, EXCR** - Exchange instructions
16. **Interrupt permit flags** - c19, c18

### Low Priority (Edge Cases)
17. **64K block limit checking**
18. **I/O instruction trapping**
19. **Console switch flags c6-c1**

---

## Appendix: Test File Issues

### test-advanced-ops.js
- Lines 492-598: GET/PUT tests manipulate registers directly instead of executing instructions
- Line 64: SRST test checks standardization but doesn't verify K count returned

### test-extracode-traps.js
- Line 91: Only verifies S in link, not C bits
- Missing Y=2, Y=3 effective address tests

### test-floating-point.js
- Uses helper functions instead of instruction execution
- Missing FLU/WUF (unrounded format) tests

### test-condition-flags.js
- Line 77-95: Tests flag positions but not actual setting logic
- Missing St flag definition test (bits 22,23 equal)

### test-instruction-format.js
- Good coverage of short/long format
- Missing Y=2, Y=3 addressing mode tests

---

## Recommended Next Steps

1. Create `test-shift-complete.js` with all 16 shift instructions
2. Create `test-register-ops.js` for register-to-register instructions
3. Create `test-dkjn.js` for the DKJN loop counter instruction
4. Update `test-advanced-ops.js` to execute GET/PUT via step()
5. Add Y=2/Y=3 addressing tests to `test-instruction-format.js`
6. Expand `test-condition-flags.js` with Ca, Of, St flag tests
