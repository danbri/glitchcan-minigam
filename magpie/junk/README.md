# Junk - Moved from elliott4130/

These files were moved here because they don't represent authentic Elliott 4130 LISP implementation.

## Why these files are junk

### lisp-repl.js
**Problem:** JavaScript cross-compiler that does all LISP logic (parsing, structure understanding, recursion) in JavaScript. The 4130 just runs resulting flat arithmetic. This isn't LISP on the 4130 - it's JavaScript pretending to be LISP.

### lisp-interpreter.asm
**Problem:** Claims to be "Full EVAL/APPLY interpreter (~1000 lines)" but has broken control flow. Inline CAR/CDR/CONS routines all end with `J HALT` and cannot return to caller:
```asm
CAR_INLINE:
    ...
    J     CAR_RET
CAR_RET:
    J     HALT    ; <-- Can't return! Dead end.
```

### lisp-eval.asm
**Problem:** Single-shot evaluator where every code path ends at `J HALT`. No actual recursive evaluation - can only evaluate one trivial expression then stops.

### demo-memory-leak.mjs
**Problem:** Node.js JavaScript script demonstrating 3-bit reference counting. The concept is valid but this is JavaScript, not 4130 assembly.

### run-tests.mjs
**Problem:** JavaScript test runner. Not relevant to authentic 4130 implementation.

## What's authentic

The working native LISP interpreter is in `../elliott4130/lisp4130.asm` which uses proper Elliott 4130 subroutine linkage:
- **JFL** (opcode 53, y=0): stores return address at location 0, jumps to subroutine
- **JI** (opcode 45, y>0): indirect jump via address 0 to return

This allows real recursive EVAL/APPLY on the 4130.
