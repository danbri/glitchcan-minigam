# Lisp Integrity Unit Tests for Quirky Hardware

**Target Systems:** Elliott 4130 (24-bit), IBM 704 (36-bit), PDP-1 (18-bit) and other minicomputers

**Purpose:** Document historical test cases and edge cases for Lisp implementations on early computers with limited memory, small word sizes, and hardware-specific cons cell packing constraints.

## 1. McCarthy's 1960 Paper Test Cases

**Source:** "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I" (Communications of the ACM, April 1960)
**Reference:** https://www-formal.stanford.edu/jmc/recursive.pdf

### Elementary Functions (Section 2)

These are the fundamental operations McCarthy defined:

| Test Case | Expression | Expected Result | Purpose |
|-----------|-----------|-----------------|---------|
| atom test | `(atom A)` | T | Verify atomic symbol recognition |
| atom of list | `(atom (A B))` | NIL | Verify non-atomic detection |
| eq identity | `(eq A A)` | T | Verify symbol equality |
| eq difference | `(eq A B)` | NIL | Verify inequality |
| car (head) | `(car (A B C))` | A | Verify CAR extraction |
| car nested | `(car ((A B) C))` | (A B) | Verify CAR of nested list |
| cdr (tail) | `(cdr (A B C))` | (B C) | Verify CDR extraction |
| cdr nested | `(cdr ((A B) C))` | (C) | Verify CDR of nested list |
| cons construction | `(cons A (B C))` | (A B C) | Verify list construction |
| cons nested | `(cons (A B) (C D))` | ((A B) C D) | Verify cons with nested car |

### Composition Functions (Section 2)

These test combinations of CAR/CDR operations:

| Test Case | Expression | Expected Result | Notes |
|-----------|-----------|-----------------|-------|
| cadr (2nd element) | `(car (cdr (A B C)))` | B | Requires CDR then CAR |
| caddr (3rd element) | `(car (cdr (cdr (A B C))))` | C | Two successive CDRs |
| cadar (1st of 2nd's car) | `(car (cdr (car ((A B) C))))` | B | Nested extraction |

### Recursive Functions (Section 3)

These test true recursive evaluation:

| Test Case | Function | Input | Expected | Validation |
|-----------|----------|-------|----------|-----------|
| find first atom | `ff[x]` | `(A B)` | A | Tests recursion termination |
| find first nested | `ff[x]` | `((A B) C)` | A | Tests deep recursion |
| substitute simple | `subst[x;y;z]` | `subst A B (B C D)` | `(A C D)` | Tests conditional recursion |
| substitute nested | `subst[x;y;z]` | `subst A B ((B C) B)` | `((A C) A)` | Tests recursion depth |
| structural equality | `equal[x;y]` | `equal (A B) (A B)` | T | Tests list comparison |
| structural inequality | `equal[x;y]` | `equal (A B) (A C)` | NIL | Tests negative case |
| append lists | `append[x;y]` | `append (A B) (C D)` | `(A B C D)` | Tests recursive construction |
| pair (zip) | `pair[x;y]` | `pair (A B C) (X Y Z)` | `((A X) (B Y) (C Z))` | Tests parallel recursion |
| assoc lookup | `assoc[x;y]` | `assoc B ((A 1) (B 2) (C 3))` | 2 | Tests search termination |
| null termination | `null[x]` | `null NIL` | T | Tests NIL detection |
| null negation | `null[x]` | `null A` | NIL | Tests non-NIL detection |

## 2. IBM 704 Lisp Implementation (1958-1959)

**Source:** McCarthy's original implementation
**Hardware:** IBM 704 (36-bit word, 15-bit address fields)

### Cons Cell Layout on IBM 704

```
36-bit word:
[35:21] CAR pointer (15 bits)  - "Contents of Address Register"
[20:6]  CDR pointer (15 bits)  - "Contents of Decrement Register"
[5:0]   Tag/GC bits (6 bits)   - Type discriminators, marks
```

### Key Edge Cases for 36-bit Cons Cells

| Issue | Test Case | Expected Behavior | Root Cause |
|-------|-----------|------------------|-----------|
| Pointer overflow | CAR/CDR > 32767 | Should wrap or signal overflow | 15-bit addresses only address 32K words |
| Tag bit collision | Tag bits = 63 | Reserved for GC marking | Early implementations used bits 5:0 |
| NIL encoding | `(car NIL)` | Should signal error or return NIL | NIL often at address 0 |
| Atom vs cons discrimination | Create atom with car/cdr | Type bits must distinguish | 2-3 bits used for type |

## 3. Elliott 4130 Implementation (24-bit)

**Source:** Elliott-Automation NEAT 4100 series computers (1960s)
**Architecture:** 24-bit word length, 65536 word memory

### Elliott 4130 Hardware Specifics

From `magpie/elliott4130/`:

- **Word size:** 24 bits (vs. 36-bit IBM 704, 18-bit PDP-1)
- **Registers:** M (accumulator), R (reserve), S (program counter), K (count), C (conditions)
- **Memory:** 65536 × 24-bit words (65K addressable with 16-bit addresses)
- **Cons cell packing:** Can fit 2 × 12-bit pointers per word (elegant fit)
- **GC strategy:** Reference counting with 3-4 bit counters

### Cons Cell Layout on Elliott 4130

Proposed 24-bit packing:

```
24-bit word (Option 1: Two pointers):
[23:12] CAR pointer (12 bits)  - 4096 cells max
[11:0]  CDR pointer (12 bits)  - 4096 cells max

24-bit word (Option 2: Reference counted):
[23:21] RefCount (3 bits)       - 0-7, saturates
[20:10] CAR pointer (11 bits)   - 2048 cells
[9:0]   CDR pointer (10 bits)   - 1024 cells
[with type bits in either scheme]
```

### Elliott 4130 Specific Edge Cases

| Test Category | Test Case | Constraint | Expected | Root Cause |
|---------------|-----------|-----------|----------|-----------|
| **Pointer Width** | Create 4097th cons | 12-bit pointers | Wraparound or error | Only 4096 addressable cells |
| **Pointer Width** | Create 4095 + 1 cell | Heap saturation | GC triggered or allocation fails | Reference counting limits |
| **RefCount Saturation** | Share object with 8+ references | 3-bit counter | Saturates at 7 (immortal) | Prevents decrement-triggered collection |
| **RefCount Saturation** | Store saturated object | Counter at max | Won't decrement | Immortal object behavior |
| **Sign Extension** | Negative numbers | 24-bit 2's complement | Proper sign bit 23 handling | NEG flag issues |
| **Condition Flags** | NEG flag after ADD | Arithmetic ops | Should set/clear properly | Flag setting behavior |

## 4. Edge Cases Specific to Small Hardware

### 4.1 Pointer Width Issues

| Issue | Hardware | Impact | Test Strategy |
|-------|----------|--------|---------------|
| 12-bit pointers (4K cells) | Elliott 4130 | Heap limited to 4096 cons cells | Allocate up to limit, test wraparound |
| 15-bit pointers (32K cells) | IBM 704 | Comfortable for small programs | Address all 32K, test at boundaries |

### 4.2 Reference Counting Edge Cases

| Test | Scenario | Expected Behavior | Validation |
|------|----------|-------------------|-----------|
| Circular references | `(cons A (cons B A))` | Proper cleanup with cycle detection | Reference count never reaches 0 |
| Object sharing | Create A, share in 10 lists | Increment refcount to N | Decrement correctly N times |
| Refcount saturation | 7+ shared references | Saturate counter, object immortal | Verify 3-bit saturation bit |
| Premature collection | Refcount = 1, release | Object collected immediately | Verify heap reuse |
| Double free | Collect same object twice | Should not collect twice | Verify freelist corruption doesn't occur |

### 4.3 Two's Complement Edge Cases

| Test | Value | 24-bit Representation | Expected | Purpose |
|------|-------|----------------------|----------|---------|
| Negative zero | -0 | 0x000000 | T (same as +0) | 2's complement property |
| Min negative | -8,388,608 | 0x800000 | Representable | Minimum value (bit 23 set) |
| Max positive | +8,388,607 | 0x7FFFFF | Representable | Maximum value |
| Sign bit | 0x800000 | Bit 23 = 1 | Negative interpretation | Sign extension correctness |
| Overflow negation | Negate 0x800000 | -(-8388608) | Should overflow | Unrepresentable in 24-bit |

### 4.4 List Operation Edge Cases

| Test | Input | Constraint | Expected | Notes |
|------|-------|-----------|----------|-------|
| Empty list (NIL) | `()` | Pointer 0 or reserved | Works as base case | Recursion terminator |
| Single element | `(A)` | One cons cell | car = A, cdr = NIL | Minimal valid list |
| Very deep list | 1000+ elements | Stack/memory limits | May hit recursion limit | Deep recursion test |
| Cyclic list | `(A . A)` | Self-referential cons | car = A, cdr = A (same cell) | Should not infinite loop on GC |
| Shared structure | Same cons in 2 places | Multiple references | Shared object tracked | Refcount = 2 |

## 5. From McCarthy 1960 Paper Examples

### Section 4: The Universal Function `apply`

The paper defines `apply[f;args]` which applies function `f` to arguments. This is critical to test:

```lisp
; Test: apply elementary function
(apply 'cons '(A (B C)))        ; => (A B C)
(apply 'car '((A B C)))         ; => A

; Test: apply with lambdas
(apply '(lambda (x) (cons x x)) '(A))  ; => (A . A)

; Test: nested apply
(apply 'apply '((lambda (x) x) (A)))   ; => A
```

### Section 5: Lambda and Label

```lisp
; Test: lambda creates closure
((lambda (x) (cons x x)) A)      ; => (A . A)

; Test: label enables recursion
((label ff (lambda (x)
    (cond ((atom x) x)
          (T (ff (car x))))))
 ((A B) C))  ; => A

; Test: nested labels
((label f (lambda (x)
    (cond ((null x) 1)
          (T (* x (f (cdr x)))))))
 (1 2 3))  ; => 6 (factorial via cons list)
```

## 6. Validation Checklist for Elliott 4130 Lisp

- [ ] All McCarthy 1960 Section 2 elementary functions working
- [ ] All McCarthy 1960 Section 3 recursive functions working
- [ ] CAR/CDR on nested lists to 5+ levels deep
- [ ] CONS cell pointer packing verified (12-bit boundaries)
- [ ] Reference counting at saturation (7 references)
- [ ] Reference counting at release (refcount 0 triggers GC)
- [ ] Arithmetic with sign extension (NEG flag behavior)
- [ ] Condition flags (NEG, NZ, Z, CA, OF) all tested
- [ ] Negative number representation (2's complement)
- [ ] Memory wraparound at 65536
- [ ] Recursive function depth to 100+ levels
- [ ] Circular data structure handling
- [ ] Empty list (NIL) as recursion base case

## Sources

This research draws from:

- [McCarthy 1960 "Recursive Functions of Symbolic Expressions"](https://www-formal.stanford.edu/jmc/recursive.pdf)
- [CAR and CDR Wikipedia](https://en.wikipedia.org/wiki/CAR_and_CDR)
- [IBM 704 Wikipedia](https://en.wikipedia.org/wiki/IBM_704)
- Elliott 4130 NEAT assembly documentation: `magpie/elliott4130/docs/ccs-e6x*.pdf`
- Current implementation: `magpie/elliott4130/test-cases.lisp`, `magpie/foafng/lisp.mjs`, `magpie/foafng/microlisp.mjs`
