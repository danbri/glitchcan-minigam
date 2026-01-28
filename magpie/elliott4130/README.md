# Elliott 4130 Emulator & Lisp

Browser-based emulator for the Elliott 4130 computer with Lisp implementation targeting the 24-bit architecture.

**Live Demo:** [elliott4130.html](elliott4130.html)

## Architecture

- **24-bit words** - allows 2x 12-bit pointers per word for cons cells
- **NEAT 4100** assembly language
- **Registers:** M (accumulator), R (reserve), S (program counter), K (count), C (conditions)
- **Reference counting GC** - like Pat Hayes' 1967 implementation

## Test Suite Status: 133/133 passing ✅

All tests passing including:
- Basic arithmetic (ADD, SUB, MULS, DIV)
- Condition flags (NEG, NZ, Z, CA, OF)
- Addressing modes (literal, direct, indirect)
- Conditional jumps (JN, JNN, JZ, JNZ, DKJN)
- LISP primitives (CAR, CDR, CONS, ATOM, EQ, NULL)
- McCarthy's EVAL/APPLY
- Recursive functions with call stack
- Higher-order functions (MAP1, APPLY)
- 3-bit reference counting GC

### Test Specification

See `tests/lisp-integrity-tests.md` for the comprehensive test specification covering:
- McCarthy 1960 paper test cases
- IBM 704 cons cell layout (historical reference)
- Elliott 4130 specific edge cases (12-bit pointers, 3-bit refcounts)
- Validation checklist for LISP implementations on quirky hardware

## Files

### Emulator
- `elliott4130.html` - Main webapp (responsive, smartphone-friendly)
- `elliott4130-core.js` - CPU core (559 lines)
- `elliott4130-asm.js` - NEAT assembler (388 lines)
- `elliott4130-tests.js` - Test suite (1096 lines, 78 tests)
- `elliott4130-debug.js` - Debug interface (527 lines)
- `elliott4130-ui.js` - UI/visualization (521 lines)

### Lisp Implementation
- `lisp-repl.js` - S-expression parser & 4130 assembly generator (browser)
- `lisp.mjs` - JavaScript Lisp interpreter (340 lines)
- `microlisp.mjs` - Lightweight variant (458 lines)
- `test-lisp.mjs` - Test suite (143 lines)
- `test-cases.lisp` - McCarthy 1960 paper tests (131 lines)
- `demo-memory-leak.mjs` - 3-bit reference counting GC demonstration

### Test Specification
- `tests/lisp-integrity-tests.md` - McCarthy 1960 tests, IBM 704/Elliott 4130 edge cases

### Reference Documentation
CCS Elliott reference manuals in `docs/`:
- `ccs-e6x1.pdf` through `ccs-e6x5.pdf`

## UI Features

- **Compact header** with M register and S (PC) visible at all times
- **Lisp button** loads McCarthy-style cons cell demo
- **Copy Logs** button for sharing test results
- **Mobile-first** responsive layout
