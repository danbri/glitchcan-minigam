# E6X4 Test Coverage Review

**Document:** E6X4 Emulation Notes - Programming and Software
**Reviewer:** Claude Code Analysis
**Date:** 2026-01-30

---

## Executive Summary

The existing test suite provides **partial coverage** of E6X4 requirements. Interrupt priority ordering and basic Protected Mode mechanics are well-tested, but several critical areas have gaps:

| Area | Coverage | Status |
|------|----------|--------|
| Interrupt Priority | Good | Tested in test-interrupts.js |
| Context Save | Good | Locations 0, 3-5 tested |
| checkProtection() | Good | Bounds checking tested |
| Base/Range Registers | Partial | Basic load/read tested, edge cases missing |
| EXEN Instruction | Partial | Only tested from Executive Mode |
| PMEN Instruction | Poor | Only mode transition tested, not full behavior |
| Real-Time Clock | **None** | Completely untested |
| Alarm Clock | **None** | Completely untested |
| Interrupt Preemption | **None** | Only pending priority tested |

---

## 1. What Is Well Tested

### 1.1 Interrupt Priority Order (test-interrupts.js)

**Specification (E6X4 Section 4):**
- Hesitation (0) > Attention (1) > Normal (2)
- Lower level number = higher priority

**Test Coverage:** ADEQUATE

The following tests correctly verify priority:
- `INT_HESITATION should be 0 (highest priority)`
- `INT_ATTENTION should be 1 (middle priority)`
- `INT_NORMAL should be 2 (lowest priority)`
- `Higher priority interrupt processed first when multiple pending`
- `Attention processed before Normal when both pending`

**Verdict:** These tests correctly implement TC-E6X4-06 from the spec.

---

### 1.2 Interrupt Context Save (test-interrupts.js)

**Specification (E6X4 Section 4, implied from E6X3):**
- Context saved to locations 0, 3-5 before jumping to handler
- Location 0: Return address (S)
- Location 3: Mode flag (0=Executive, 1=Protected)
- Location 4: Base register
- Location 5: Range register

**Test Coverage:** ADEQUATE

Tests correctly verify:
- `Context saved: mode to location 3`
- `Context saved: mode flag 0 when was Executive`
- `Context saved: base register to location 4`
- `Context saved: range register to location 5`
- `Return address saved to location 0`
- `Full interrupt context save and vector jump (Executive Mode start)`

**Verdict:** Context save mechanism is well-tested.

---

### 1.3 Executive Mode Entry on Interrupt (test-interrupts.js)

**Specification (E6X4 Section 2):**
- Interrupt handlers run in Executive Mode with full memory access

**Test Coverage:** ADEQUATE

Test `Interrupt handler enters Executive Mode` correctly verifies that `executiveMode` becomes `true` when processing an interrupt from Protected Mode.

---

### 1.4 Memory Protection Bounds (test-advanced-ops.js)

**Specification (E6X4 Section 3):**
- Permitted region: [Base * 1024, (Base + Range) * 1024)
- Executive Mode bypasses protection
- Protected Mode enforces bounds

**Test Coverage:** ADEQUATE for basic cases

Tests verify:
- `checkProtection: Executive Mode has full access`
- `checkProtection: Protected Mode allows access within bounds`
- `checkProtection: Protected Mode denies access outside bounds`
- `checkProtection: Violation raises attention interrupt`

---

### 1.5 Base/Range Register Instructions (test-advanced-ops.js)

**Test Coverage:** PARTIAL

Tests cover:
- LDBR loads Base Register in Executive Mode
- LDBR ignored in Protected Mode
- LDBR masks to 10 bits
- LDRR loads Range Register in Executive Mode
- LDRR ignored in Protected Mode
- BRTM reads Base Register to M
- RRTM reads Range Register to M

**Missing:** LDRR mask to 10 bits test (parallel to LDBR test).

---

## 2. What Is Incorrectly Tested

### 2.1 EXEN Instruction (test-advanced-ops.js)

**Specification (TC-E6X4-02):**
```
Setup: In Protected Mode
Test: Execute EXEN
Verify: executiveMode becomes true
```

**Actual Test:**
```javascript
test('EXEN: Stays in Executive Mode when already Executive', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;  // WRONG - should start in Protected Mode
    cpu.regOpExtra(0o01000);   // EXEN
    assertEqual(cpu.executiveMode, true, 'Should stay in Executive Mode');
});
```

**Problem:** The test starts in Executive Mode, which trivially passes. The E6X4 spec requires testing EXEN when starting from Protected Mode.

**Impact:** If EXEN doesn't actually transition from Protected to Executive, the test wouldn't catch it.

---

### 2.2 PMEN Instruction (test-advanced-ops.js)

**Specification (TC-E6X4-03):**
```
Setup: In Executive Mode
Test: Execute PMEN with Base=5, Range=3, Alarm=10
Verify:
  - baseReg = 5
  - rangeReg = 3
  - rtcDelay = 10
  - executiveMode becomes false
```

**Actual Test:**
```javascript
test('PMEN: Enters Protected Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.regOpExtra(0o02000);  // PMEN
    assertEqual(cpu.executiveMode, false, 'Should enter Protected Mode');
});
```

**Problems:**
1. Only tests mode transition, not register loading
2. No operand provided to set Base, Range, Alarm
3. E6X4 says PMEN "loads Base, Range, Alarm Clock" but test doesn't verify this

**Impact:** PMEN may not actually load registers, just flip the mode flag.

---

### 2.3 Interrupt Vector Calculation (test-interrupts.js)

**Test Assumption:**
```javascript
// S should jump to vector 30 * 2 = 60 (vector is half-word address)
assertEqual(cpu.S, 60, 'First interrupt should be Hesitation with vector 30');
```

**Potential Issue:** The test assumes vector * 2 conversion, but E6X4/E6X3 documentation should be verified for the exact interrupt vector table layout. If the hardware uses a different formula (e.g., base + vector * 2), tests would pass incorrectly.

---

## 3. What Is Missing

### 3.1 Real-Time Clock Interrupt (TC-E6X4-04)

**Specification:**
```
Setup: rtcCounter at 0
Test: Advance simulated time by 1 second
Verify: Hesitation-level interrupt raised
```

**Coverage:** NONE

No existing test verifies that the RTC generates periodic interrupts. The emulator has `rtcCounter` and `rtcDelay` fields, but no test exercises them.

**Proposed Test:**
```javascript
test('RTC raises Hesitation interrupt every second', () => {
    const cpu = createCPU();
    cpu.rtcEnabled = true;
    cpu.rtcCounter = 0;
    cpu.pendingInterrupts = [];

    // Simulate 1 second of time passing
    cpu.advanceRTC(1000);  // 1000ms

    assertEqual(cpu.pendingInterrupts.length, 1, 'Should have 1 pending interrupt');
    assertEqual(cpu.pendingInterrupts[0].level, cpu.INT_HESITATION, 'RTC interrupt should be Hesitation level');
});
```

---

### 3.2 Alarm Clock Termination (TC-E6X4-05)

**Specification:**
```
Setup:
  - Protected Mode with Alarm=3 seconds
  - Running user program

Test: Advance simulated time by 3 seconds

Verify:
  - User program terminated/suspended
  - Executive Mode entered
```

**Coverage:** NONE

No test verifies that Protected Mode programs are terminated when the Alarm Clock expires.

**Proposed Test:**
```javascript
test('Alarm Clock terminates Protected Mode after N seconds', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;
    cpu.rangeReg = 5;
    cpu.rtcDelay = 3;  // Alarm set for 3 seconds
    cpu.rtcCounter = 0;

    // Simulate 3 seconds
    cpu.advanceRTC(3000);

    assertEqual(cpu.executiveMode, true, 'Should enter Executive Mode after alarm');
});
```

---

### 3.3 EXEN from Protected Mode

**Coverage:** NONE (existing test starts in Executive Mode)

**Proposed Test:**
```javascript
test('EXEN transitions from Protected Mode to Executive Mode', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;  // Start in Protected Mode
    cpu.baseReg = 10;
    cpu.rangeReg = 5;

    cpu.regOpExtra(0o01000);  // EXEN

    assertEqual(cpu.executiveMode, true, 'EXEN should enter Executive Mode');
});

test('EXEN from Protected Mode bypasses subsequent protection checks', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;  // Permits 10240-15359
    cpu.rangeReg = 5;

    // This address is outside permitted region
    assertEqual(cpu.checkProtection(0), false, 'Address 0 denied before EXEN');

    cpu.regOpExtra(0o01000);  // EXEN

    // Now should have full access
    assertEqual(cpu.checkProtection(0), true, 'Address 0 allowed after EXEN');
});
```

---

### 3.4 PMEN Full Behavior

**Coverage:** Mode transition only, register loading untested

**Proposed Tests:**
```javascript
test('PMEN loads Base Register from operand', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.baseReg = 0;
    cpu.M = 5;  // Assuming PMEN takes operands from M or N field

    cpu.regOpExtra(0o02000);  // PMEN

    assertEqual(cpu.baseReg, 5, 'PMEN should load Base Register');
});

test('PMEN loads Range Register from operand', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.rangeReg = 0;
    // Set up operand for Range

    cpu.regOpExtra(0o02000);  // PMEN

    // Verify rangeReg was loaded
});

test('PMEN sets Alarm Clock delay', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.rtcDelay = 0;
    // Set up operand for Alarm

    cpu.regOpExtra(0o02000);  // PMEN

    assertEqual(cpu.rtcDelay, expectedValue, 'PMEN should set Alarm Clock');
});
```

**Note:** The exact operand format for PMEN needs verification against E6X4/E6X3. The test structure depends on how Base, Range, and Alarm values are passed to the instruction.

---

### 3.5 Interrupt Preemption During Handler

**Specification (E6X4 Section 4):**
- Higher priority interrupts must preempt lower

**Current Tests:** Only test pending interrupt ordering, not preemption of running handlers.

**Proposed Test:**
```javascript
test('Hesitation interrupt preempts Attention handler', () => {
    const cpu = createCPU();

    // Set up Attention-level handler code at vector 20
    cpu.mem[40] = someInstruction;  // Handler code at vector*2

    // Raise Attention interrupt and enter handler
    cpu.raiseInterrupt(cpu.INT_ATTENTION, 20);
    cpu.checkInterrupts();

    // Now handler is "running" at Attention level
    // Store current handler level
    const handlerLevel = cpu.currentInterruptLevel;

    // Raise Hesitation interrupt while in Attention handler
    cpu.raiseInterrupt(cpu.INT_HESITATION, 30);
    cpu.checkInterrupts();

    // Should preempt to Hesitation handler
    assertEqual(cpu.S, 60, 'Should jump to Hesitation handler');

    // Context should be saved for Attention handler return
});
```

---

### 3.6 Memory Protection Violation During Instruction Execution

**Current Tests:** Call `checkProtection()` directly, not during actual instruction execution.

**Proposed Test:**
```javascript
test('LD instruction triggers protection violation when accessing forbidden address', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 10;   // Permits 10240-15359
    cpu.rangeReg = 5;

    // Set up LD instruction to fetch from address 0 (forbidden)
    const ldInstr = (0o43 << 18) | (1 << 16) | (0 << 15) | 0;  // LD from addr 0
    cpu.mem[10240] = ldInstr;  // Instruction in permitted region
    cpu.S = 20480;  // Half-word address in permitted region

    cpu.pendingInterrupts = [];

    cpu.step();

    // Should have raised attention interrupt for protection violation
    assertEqual(cpu.pendingInterrupts.length > 0, true, 'Should raise interrupt');
    assertEqual(cpu.pendingInterrupts[0].level, cpu.INT_ATTENTION, 'Should be Attention level');
});
```

---

### 3.7 Base/Range Register Edge Cases

**Proposed Tests:**
```javascript
test('LDBR/LDRR with maximum 10-bit value (1023)', () => {
    const cpu = createCPU();
    cpu.executiveMode = true;
    cpu.M = 1023;

    cpu.regOpExtra(0o04000);  // LDBR
    assertEqual(cpu.baseReg, 1023, 'Should accept maximum 10-bit value');

    cpu.regOpExtra(0o10000);  // LDRR
    assertEqual(cpu.rangeReg, 1023, 'Should accept maximum 10-bit value');
});

test('Protection with Base=0, Range=0 denies all access', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 0;
    cpu.rangeReg = 0;

    // Permitted region: [0, 0) = empty
    assertEqual(cpu.checkProtection(0), false, 'Address 0 should be denied');
    assertEqual(cpu.checkProtection(1), false, 'Address 1 should be denied');
});

test('Protection with Base=1023, Range=1 permits highest memory block', () => {
    const cpu = createCPU();
    cpu.executiveMode = false;
    cpu.baseReg = 1023;
    cpu.rangeReg = 1;

    // Permitted: [1023*1024, 1024*1024) = [1047552, 1048576)
    assertEqual(cpu.checkProtection(1047552), true, 'Base address should be permitted');
    assertEqual(cpu.checkProtection(1048575), true, 'Last address should be permitted');
    assertEqual(cpu.checkProtection(1047551), false, 'Below base should be denied');
});
```

---

### 3.8 Context Save Order Verification

**Proposed Test:**
```javascript
test('Context save order: locations 0, 3-5 written before handler entry', () => {
    const cpu = createCPU();

    // Set up handler at vector 10 that reads the saved context
    // Handler will verify locations 0, 3-5 contain correct values
    cpu.executiveMode = false;
    cpu.baseReg = 100;
    cpu.rangeReg = 50;
    cpu.S = 1234;

    // Clear memory locations
    cpu.mem[0] = 0;
    cpu.mem[3] = 0xFF;  // Sentinel value
    cpu.mem[4] = 0;
    cpu.mem[5] = 0;

    cpu.raiseInterrupt(cpu.INT_NORMAL, 10);

    // Process interrupt - this should save context THEN jump
    cpu.checkInterrupts();

    // Verify context was saved with values from BEFORE mode change
    assertEqual(cpu.mem[0], 1234, 'S should be saved before jump');
    assertEqual(cpu.mem[3], 1, 'Mode should be saved as Protected (1)');
    assertEqual(cpu.mem[4], 100, 'Base should be saved');
    assertEqual(cpu.mem[5], 50, 'Range should be saved');

    // CPU should now be in Executive Mode at handler
    assertEqual(cpu.executiveMode, true, 'Should be in Executive Mode after save');
});
```

---

## 4. Potential Bugs Detected

### 4.1 LDRR Missing 10-bit Mask Test

`test-advanced-ops.js` has:
```javascript
test('LDBR: Masks to 10 bits', () => { ... })
```

But no corresponding test for LDRR. If LDRR doesn't mask to 10 bits, it could accept invalid values.

### 4.2 Inconsistent Mode Flag Encoding

Tests assume:
- `mem[3] = 0` means Executive Mode
- `mem[3] = 1` means Protected Mode

This should be explicitly documented and verified against the emulator code. If the encoding is inverted, mode restoration would fail silently.

### 4.3 Protection Violation Vector Address Unknown

Tests verify that protection violations raise Attention interrupts, but don't verify the vector address used. E6X4 doesn't explicitly state the protection fault vector, so the emulator may use an arbitrary value.

---

## 5. Recommended Test Additions

### Priority 1 (Critical - Core E6X4 Functionality)

1. **TC-E6X4-04-RTC**: Real-Time Clock generates 1-second interrupts
2. **TC-E6X4-05-ALARM**: Alarm Clock terminates Protected Mode
3. **TC-EXEN-TRANSITION**: EXEN from Protected Mode enters Executive Mode
4. **TC-PMEN-FULL**: PMEN loads Base, Range, and Alarm Clock

### Priority 2 (Important - Edge Cases)

5. **TC-PROTECT-EXECUTION**: Memory protection during instruction execution
6. **TC-PREEMPTION**: Higher priority interrupt preempts lower handler
7. **TC-REGISTER-EDGE**: Base/Range with values 0, 1023, and overflow

### Priority 3 (Nice to Have - Completeness)

8. **TC-LDRR-MASK**: LDRR masks to 10 bits
9. **TC-CONTEXT-ORDER**: Context saved before mode transition
10. **TC-PROTECTION-VECTOR**: Verify protection fault vector address

---

## 6. Conclusion

The existing test suite covers the "happy path" for most E6X4 features but lacks:

1. **Real-Time Clock tests** - A complete blind spot
2. **Alarm Clock tests** - Another complete blind spot
3. **EXEN transition tests** - Tests the trivial case, not the functional one
4. **PMEN completeness** - Only mode flag tested, not register loading

The test suite would benefit from a systematic approach following the TC-E6X4-XX test cases defined in the E6X4 emulation notes document. The existing tests are well-structured and could serve as templates for the missing coverage.

**Estimated effort:** 4-6 hours to implement Priority 1 and 2 tests, assuming the emulator already has the underlying functionality.

---

## Appendix: Test File Summary

| File | Lines | Tests | Focus |
|------|-------|-------|-------|
| test-interrupts.js | 308 | 20 | BUG-006, BUG-016: Priority, context save |
| test-advanced-ops.js | 608 | 47 | BUG-007-010: Shifts, Protected Mode, DIVM, GET/PUT |
| test-condition-flags.js | 202 | 11 | Condition register bit positions |
| test-extracode-traps.js | 181 | 7 | BUG-003: Extracode trap mechanism |
| test-floating-point.js | 460 | 28 | BUG-001: Two-word FP format |
| test-instruction-format.js | 516 | 27 | BUG-002, BUG-004: Half-word packing, JFL/JIR |
