# Elliott 4130 Emulator & Lisp

Browser-based emulator for the Elliott 4130 computer with Lisp implementation targeting the 24-bit architecture.

**Live Demo:** [elliott4130.html](elliott4130.html)

## Architecture

- **24-bit words** - allows 2x 12-bit pointers per word for cons cells
- **NEAT 4100** assembly language
- **Registers:** M (accumulator), R (reserve), S (program counter), K (count), C (conditions)
- **Reference counting GC** - like Pat Hayes' 1967 implementation

## Test Suite Status: 32/78 passing (41%)

### Failing Test Categories (Requiring Investigation)

| Category | Pass/Total | Key Failures |
|----------|-----------|--------------|
| Basic Arithmetic | 5/17 | ADD operations, literal mode |
| Condition Flags | 4/7 | NEG flag, NZ flag setting |
| Addressing Modes | 3/4 | Literal mode `#n` |
| Jumps/Branches | 1/8 | JN, JNN, JZ, JNZ, DKJN |

### Root Cause Analysis Plan

1. **Literal Mode (`#n`)** - Test shows `ADD #10` failing
   - Check assembler output for literal addressing encoding
   - Verify y-field encoding (y=0 for literal?)
   - Trace instruction decoding in `elliott4130-core.js`

2. **ADD Instruction** - `ADD 1+1=2` fails despite `ADD 0+0=0` passing
   - Check operand fetch vs literal fetch
   - Verify accumulator update logic
   - Compare against E6X3 specification

3. **Condition Flags** - NEG and NZ not setting correctly
   - Review flag update logic after arithmetic ops
   - Check bit 23 detection for negative
   - Verify NZ flag semantics (set when non-zero?)

4. **Conditional Jumps** - Most fail due to flag issues
   - These likely cascade from condition flag bugs
   - Fix flags first, then re-test jumps

### Debug Approach

1. Use "Copy Logs" button to capture test run state
2. Enable "Trace execution" in Debug tab
3. Single-step through failing tests
4. Compare against E6X3 manual behavior

## Files

### Emulator
- `elliott4130.html` - Main webapp (responsive, smartphone-friendly)
- `elliott4130-core.js` - CPU core (559 lines)
- `elliott4130-asm.js` - NEAT assembler (388 lines)
- `elliott4130-tests.js` - Test suite (1096 lines, 78 tests)
- `elliott4130-debug.js` - Debug interface (527 lines)
- `elliott4130-ui.js` - UI/visualization (521 lines)

### Lisp Implementation
- `lisp.mjs` - JavaScript Lisp interpreter (340 lines)
- `microlisp.mjs` - Lightweight variant (458 lines)
- `test-lisp.mjs` - Test suite (143 lines)
- `test-cases.lisp` - McCarthy 1960 paper tests (131 lines)

### Reference Documentation
CCS Elliott reference manuals in `docs/`:
- `ccs-e6x1.pdf` through `ccs-e6x5.pdf`

## UI Features

- **Compact header** with M register and S (PC) visible at all times
- **Lisp button** loads McCarthy-style cons cell demo
- **Copy Logs** button for sharing test results
- **Mobile-first** responsive layout
