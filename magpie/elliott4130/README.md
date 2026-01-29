# Elliott 4130 Emulator & Native LISP

Browser-based emulator for the Elliott 4130 computer with native LISP interpreter running in pure 4130 assembly.

**Live Demo:** [elliott4130.html](elliott4130.html)

## Architecture

- **24-bit words** - allows 2x 12-bit pointers per word for cons cells
- **NEAT 4100** assembly language
- **Registers:** M (accumulator), R (reserve), S (program counter), K (count), C (conditions)
- **JFL/JI subroutine linkage** - proper call/return using address 0 for link storage
- **3-bit reference counting** - historical limitation (max refcount 7)

## Native LISP Interpreter

The interpreter in `lisp4130.asm` runs LISP evaluation directly on the 4130:

- **Proper subroutine calls** using JFL (stores link at addr 0) and JI (indirect return)
- **Recursive EVAL** - handles nested expressions at runtime
- **Primitives:** QUOTE, COND, CAR, CDR, CONS, ATOM, EQ
- **Cell format:** [CAR:12bits | CDR:12bits] packed in 24-bit word
- **Atoms:** NIL=4095, T=4094, symbols A=3000, B=3001, etc.

### Subroutine Linkage Pattern

```asm
EVAL:
    LD    0              ; JFL stored return address here
    ST    EV_LINK        ; Save to our variable
    ; ... evaluation logic ...
EV_RET:
    LD    EV_LINK
    ST    0
    JI    0              ; Indirect jump via address 0 to return
```

## Test Suite Status: 133/133 passing

Covers:
- Basic arithmetic (ADD, SUB, MULS, DIV)
- Condition flags and addressing modes
- Conditional jumps (JN, JNN, JZ, JNZ, DKJN)
- LISP primitives and cell operations

### Test Specification

See `tests/lisp-integrity-tests.md` for:
- McCarthy 1960 paper test cases
- IBM 704 cons cell layout (historical reference)
- Elliott 4130 specific edge cases (12-bit pointers, 3-bit refcounts)

## Files

### Emulator Core
- `elliott4130.html` - Main webapp
- `elliott4130-core.js` - CPU core (66 opcodes)
- `elliott4130-asm.js` - NEAT assembler
- `elliott4130-tests.js` - Test suite
- `elliott4130-debug.js` - Debug interface
- `elliott4130-ui.js` - UI/visualization

### Native LISP (Pure 4130 Assembly)
- `lisp4130.asm` - Working native interpreter using JFL/JI linkage
  - Recursive EVAL runs on the 4130, not in JavaScript
  - Test: evaluates (CAR (QUOTE (A B))) -> A at runtime

### Pure LISP Tests
- `test-cases.lisp` - McCarthy 1960 paper tests in pure LISP syntax

### Reference Documentation
CCS Elliott reference manuals in `docs/`:
- `ccs-e6x1.pdf` through `ccs-e6x5.pdf`

## Historical Authenticity

This implementation targets 1968 limitations:
- 3-bit reference counts (max 7, causes memory leaks with heavy sharing)
- 24-bit words with 12-bit pointers
- No stack - uses link storage at address 0

### Moved to junk/

Files that did LISP logic in JavaScript or had broken control flow were moved to `../junk/`:
- `lisp-repl.js` - JS cross-compiler (LISP logic in JavaScript)
- `lisp-interpreter.asm` - broken (inline routines end with J HALT)
- `lisp-eval.asm` - incomplete (single-shot, all paths end at HALT)

## UI Features

- **Native LISP demo** in dropdown menu
- **Teleprinter** display for console output
- **Copy Logs** button for sharing test results
- **Mobile-first** responsive layout
