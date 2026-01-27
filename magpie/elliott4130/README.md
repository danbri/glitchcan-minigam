# Elliott 4130 Lisp

Target: Tiny Lisp implementation for Elliott 4130 emulator

## Architecture
- 24-bit words (allows 2x 12-bit pointers per word for cons cells)
- NEAT 4100 assembly language
- Reference counting GC (like Pat Hayes' 1967 implementation)

## Reference Documentation

CCS Elliott reference manuals in `docs/`:
- `ccs-e6x1.pdf` - CCS Elliott 6x Series Reference (Part 1)
- `ccs-e6x2.pdf` - CCS Elliott 6x Series Reference (Part 2)
- `ccs-e6x3.pdf` - CCS Elliott 6x Series Reference (Part 3)
- `ccs-e6x4.pdf` - CCS Elliott 6x Series Reference (Part 4)
- `ccs-e6x5.pdf` - CCS Elliott 6x Series Reference (Part 5)

## Related Files
- `../lisp/` - JavaScript Lisp implementations (lisp.mjs, microlisp.mjs)
- `../mccarthy1960/` - McCarthy 1960 paper test cases
- `/demo/elliott4130.html` - Elliott 4130 emulator (webapp)

## Status
Lisp assembler awaiting integration with emulator.
