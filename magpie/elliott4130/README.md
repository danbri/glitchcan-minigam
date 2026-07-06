# Elliott 4130 Emulator

Browser-based emulator for the Elliott 4130 computer, plus an in-progress LISP interpreter written in 4130 assembly.

**Live Demo:** [elliott4130.html](elliott4130.html)

## Architecture

- **24-bit words** - allows 2x 12-bit pointers per word for cons cells
- **NEAT 4100** assembly language
- **Registers:** M (accumulator), R (reserve), S (program counter), K (count), C (conditions)
- **JFL/JIR subroutine linkage** - call via JFL (stores `(C[24:18]<<17)|S` at address 0), return via JIR (decodes link to restore both S and condition bits)
- **3-bit reference counting** - historical limitation (max refcount 7)

## LISP Interpreter (work in progress)

`lisp4130.asm` is a hand-written LISP interpreter in 4130 assembly. It assembles cleanly (~1150 words). What works today:

- Banner prints (via the `TR` extracode trap, handled by the CLI's host trap handlers).
- The REPL terminates cleanly on EOF (empty tape, whitespace-only tape, tape ending mid-token).
- A bare atom evaluates to NIL (McCarthy's behaviour for an unbound atom).
- Bare `NIL` prints `NIL`; bare `T` self-evaluates to `T`.
- The reader correctly parses `(A)` and `(A B)` into the expected cons-cell layout in heap (verified by direct memory inspection in the smoke tests).

What does *not* work yet — see *Known LISP bugs* below.

Run it from the CLI:

```bash
# Single tape:
node cli.mjs --asm lisp4130.asm --tape tapes/basic-tests.lisp

# Interactive console (type one S-expression per line):
node cli.mjs --repl
```

The CLI provides host-side trap handlers for `TR` (letter display) and `CH` (octal display), which per E6X3 are software extracodes - i.e. the OS supplies them. `cli.mjs` plays the role of that OS at runtime, and also detects the standard `J HALT` self-jump idiom so the runner exits cleanly when the LISP REPL reaches `END`.

### Subroutine Linkage Pattern

```asm
EVAL:
    LD    0              ; JFL stored link (C[24:18]+S) here
    ST    EV_LINK        ; Save to our variable
    ; ... evaluation logic ...
EV_RET:
    LD    EV_LINK
    ST    0
    JIR   0              ; Indirect return: decode link, restore S and C[24:18]
```

### Known LISP bugs

All of these are localised `lisp4130.asm` changes; none requires touching the Elliott emulator.

**Fixed in this initiative (Bugs 1, 2 and A, B, C, D, E, plus EVAL/PRINT recursion and a cli.mjs trap-detection bug):**

- ~~`PR_SYMBOL` emitted `TR 0` after computing a letter index in M, but `TR`'s operand is a literal N, so symbol output went via `PR_OCTAL`.~~ Now uses `ODUM 0`.
- ~~`RD_ATOM_LOOP` had no EOF check, so a tape ending mid-token spun.~~ Now treats EOF as a delimiter.
- ~~`RD_LIST` built the cons list reversed and never reversed it back (the `RD_LIST_DONE` comment described a step that was never written).~~ Now reverses in place using a small loop and four new state vars (`RD_REV_NEW/OLD/NEXT/TMP`).
- ~~`RD_NOT_NUMBER` mapped every input letter to `3000+(L-A)`, so `"T"` read as atom 3019 instead of 4094.~~ Now routes `'T'` and `'N'` first chars to `RD_ATOM_SPECIAL` for the canonical T (4094) and NIL (4095) codes.
- ~~`RD_LIST_SKIP` had no EOF check.~~ Now closes the list cleanly on EOF.

- ~~`RD_ATOM` had no way to distinguish typed `QUOTE`/`CAR`/`CDR` from the single-letter atoms `Q`/`C`.~~ Now the reader tracks first char and second char in `RD_ABUF`/`RD_ABUF2` plus a length count `RD_ALEN`, and recognises QUOTE (4000), CAR (4001), CDR (4002).
- ~~The cons heap was initialised at address 1000, which collided with the assembled code once the keyword recogniser pushed the program past 1000 words; the first cons cell silently overwrote the start of `RD_ATOM_LOOP`.~~ HEAP base bumped to 2000, with a regression test that fails if HEAP ever drops below `max(code addr)`.

- ~~Same Bug E pattern existed in `EVAL` (recurses via P_CAR/P_CDR/EV_APPLY_LIST) and `PRINT` (recurses through PR_LIST_LOOP and PR_DOTTED).~~ Both fixed by pushing their caller links onto the same SP stack used by READ. PRINT additionally pushes its current `PR_EXPR` so the outer loop's tail pointer survives the inner print.
- ~~`PRINT` emitted ASCII codes (`#40` for `'('` etc.) but ODUM 0 expects 6-bit Elliott codes, which then get mapped back to ASCII by the host. Output came out as `#A$` instead of `(A)`.~~ Now uses the correct 6-bit codes (45 for `(`, 46 for `)`, 0 for space, 51 for `.`).
- ~~`cli.mjs` detected the TR/CH software-extracode trap by checking `cpu.S === 252/254` after every step, but the LISP code happens to occupy those addresses (word 126 falls inside `PR_LIST_LOOP`). Whenever the print loop's NIL-check fell through, the cli misfired and warped S to whatever stale link `mem[2]` happened to hold, truncating any list output after one element.~~ Now the cli only treats S=252/254 as a trap when the just-executed instruction was actually the long-form extracode (F=0o77, Z=1).
- ~~`READ` stored its caller link in a single global `RD_LINK`, so the inner `READ` invoked by `RD_LIST_LOOP` (or `RD_QUOTE`) overwrote the outer caller's return address. The top-level `READ` returned not to `REPL` but back into `RD_LIST_LOOP`, sending the program into an infinite loop on any list input.~~ Now `READ`'s entry pushes the JFL link onto a small stack at `SP` (initialised to 5000, well above the heap), and `RD_RET` pops it. EVAL/APPLY for list expressions is still unimplemented (they currently fall through to the unbound-atom path and return NIL), but the reader can now handle nested lists end-to-end.

**End-to-end working today:**

The interpreter handles the McCarthy 1960 core:

| Tape input | Output |
|---|---|
| `T` | `T` |
| `NIL` | `NIL` |
| `(QUOTE A)` | `A` |
| `(QUOTE (A B C))` | `(A B C)` |
| `(CAR (QUOTE (A B C)))` | `A` |
| `(CDR (QUOTE (A B C)))` | `(B C)` |
| `(CAR (CDR (QUOTE (A B C))))` | `B` |
| `(CADR (QUOTE (A B C)))` | `B` |
| `(CADDR (QUOTE (A B C)))` | `C` |
| `(CONS (QUOTE A) (QUOTE (B C)))` | `(A B C)` |
| `(ATOM (QUOTE A))` | `T` |
| `(ATOM (QUOTE (A B)))` | `NIL` |
| `(EQ (QUOTE A) (QUOTE A))` | `T` |
| `(EQ (QUOTE A) (QUOTE B))` | `NIL` |
| `(NULL (QUOTE NIL))` | `T` |
| `(NULL (QUOTE A))` | `NIL` |
| `42` | `42` |
| `999` | `999` |

Lowercase input is folded to upper case in the reader, so `(car (quote (a b c)))` works too.

Try it interactively:

```bash
node cli.mjs --repl
4130> (CAR (QUOTE (HELLO WORLD)))
HELLO
4130> (CONS (QUOTE A) (CONS (QUOTE B) NIL))
(A B)
```

**Still open:**

- **COND, LAMBDA, LABEL** — special forms are wired up but untested end-to-end.
- **DEFUN, IF, arithmetic operators (`<=`, `*`, `-`)** — out of scope for this round; needed by the symbolic-differentiator and factorial example programs.
- **Multi-character user-defined atom names** — the reader keeps only first+second+third+fourth char (enough for built-in keyword recognition: QUOTE/CAR/CDR/CADR/CADDR/CONS/COND/ATOM/EQ/NULL/NIL/T/LIST/LAMBDA/LABEL/DEFUN/IF), but a fresh user atom like `FOO` aliases to its first letter `F`.
- **`(QUOTE n)` for numeric `n`** — currently spins; numbers reach EVAL via the literal-number path but the EVAL number-literal branch is incomplete.
- **EVAL on a malformed program** doesn't error cleanly — e.g. `((A) (B C))` tries to apply `(A)` as a lambda and spins. A real LISP would print an error.

`tests/test-lisp-smoke.mjs` pins down what works (banner, EOF handling, atom evaluation, cons-cell layout, keyword recognition for QUOTE/CAR/CDR, recursive READ via the SP stack) and includes plausibility checks against hardware limits (12-bit cell pointers, 12-bit atom codes, garbage-tape robustness, deep-nesting bounds).

## Test Suite Status

Run individual files directly with `node tests/<file>.js`. As of the last run, the modern test suite reports:

| File | Result |
|---|---|
| test-advanced-ops.js | 41/41 ✓ |
| test-architecture-e6x2.js | 43/43 ✓ |
| test-condition-flags.js | 12/12 ✓ |
| test-extracode-traps.js | 7/7 ✓ |
| test-floating-point.js | 26/26 ✓ |
| test-instruction-format.js | 18/18 ✓ |
| test-instructions-e6x3.js | 100/100 ✓ |
| test-interrupts.js | 19/19 ✓ |
| test-io-e6x5.js | 51/52 (1 failing: 6-bit vs 7-bit tape input) |
| test-os-e6x4.js | 38/38 ✓ |
| test-lisp-smoke.mjs | 43/43 ✓ (banner, EOF, atom eval, cons-cell layout, keyword recognition, recursive READ/EVAL/PRINT, end-to-end QUOTE/CAR/CDR/CONS/COND, plausibility limits) |

The one io-e6x5 failure is a deliberate divergence: core uses 7-bit ASCII for tape input so the LISP reader can compare against ASCII codes directly. The test was written for the historically-correct 6-bit masking; reconciling these is a TODO.

Covers:
- Basic arithmetic (ADD, SUB, MULS, DIV)
- Condition flags and addressing modes
- Conditional jumps (JN, JNN, JZ, JNZ, DKJN)
- Two-word floating point (39-bit mantissa, 9-bit exponent)
- Extracode trap mechanism (Z=1 → mem[1]=N, mem[2]=link, S=2*F[+1])
- Protected Mode (Base/Range, EXEN/PMEN)
- Three-level interrupt priority

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

### LISP (4130 Assembly, in progress)
- `lisp4130.asm` - In-progress LISP interpreter, JFL/JIR linkage
  - Recursive EVAL is *intended* to run on the 4130, not in JavaScript
  - Currently working (verified 2026-07-06 via `node cli.mjs --repl`): assembles cleanly, prints banner, reads atoms/lists/nested lists, and **EVAL genuinely evaluates** `QUOTE`, `CAR`, `CDR`, `CONS`, `ATOM`, `EQ`, `NULL`, `COND`, and integer literals — e.g. `(CAR (QUOTE (A B C)))` → `A`, `(CONS (QUOTE A) (QUOTE (B C)))` → `(A B C)`, `(COND ((ATOM (QUOTE A)) (QUOTE Y)) (T ...))` → `Y`
  - Not currently working: **LAMBDA/LABEL application** (infinite loop → max-steps), `(QUOTE n)` for numeric n, `;`-comment skipping in the reader, and multi-char user atom names (they truncate to the first letter; only built-in keywords are recognised). The earlier claim that "everything evaluates to NIL" was stale.
- `cli.mjs` - CLI runner used by `tests/test-lisp-smoke.mjs`. Provides JS-side handlers for the `TR`/`CH` software-trap extracodes

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

### Authenticity Guidelines (Do Not Backslide!)

**NO JavaScript LISP**: All S-expression parsing must happen in the READER subroutine (lisp4130.asm) using machine instructions, not JavaScript shortcuts.

**NO memory buffer I/O shortcuts**: Use actual IDUM/ODUM instructions for tape I/O.

**Authentic workflow**:
1. Load LISP tape via Paper Tape I/O panel
2. READER parses S-expressions using IDUM I/O instruction (channel 1)
3. EVAL evaluates expressions in native 4130 assembly
4. PRINT outputs results using ODUM I/O instruction (channel 2)


## Paper Tape I/O

The emulator implements authentic I/O instructions for paper tape:

- **IDUM 1** - Read 6-bit character from paper tape reader to M register
- **ODUM 2** - Write 6-bit character from M register to paper tape punch

### 6-Bit Characters ("6-Bit Bytes")

The Elliott 4130 uses **6-bit characters**, not modern 8-bit octets:
- 4 characters pack into one 24-bit word
- Character set: space, A-Z, 0-9, punctuation (64 values)
- Modern readers: think "6-bit byte" when you see "byte" in historical docs

The on-disk tape format (currently ASCII `.lisp` files) is a placeholder.
The emulator masks input to 6 bits at the I/O layer, so disk format
can be changed later without affecting the core emulation.

### LISP Tapes

Example LISP programs in `tapes/`:
- `basic-tests.lisp` - Simple S-expressions
- `advanced-tests.lisp` - Complex nested expressions
- `meta-circular.lisp` - McCarthy's eval/apply

## UI Features

- **Native LISP demo** in dropdown menu
- **Teleprinter** display for console output
- **Copy Logs** button for sharing test results
- **Mobile-first** responsive layout
