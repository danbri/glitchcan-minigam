; McCarthy 1960 "Recursive Functions of Symbolic Expressions"
; Test cases extracted from the original paper
; For implementing on Elliott 4130 emulator

; =============================================================================
; ELEMENTARY FUNCTIONS (Section 2)
; =============================================================================

; atom[x] - true if x is an atomic symbol
(atom A)           ; => T
(atom (A B))       ; => NIL

; eq[x;y] - true if x and y are the same atom
(eq A A)           ; => T
(eq A B)           ; => NIL

; car[x] - first element of list
(car (A B C))      ; => A
(car ((A B) C))    ; => (A B)

; cdr[x] - rest of list after first element
(cdr (A B C))      ; => (B C)
(cdr ((A B) C))    ; => (C)

; cons[x;y] - construct list with x as car and y as cdr
(cons A (B C))     ; => (A B C)
(cons (A B) (C D)) ; => ((A B) C D)

; =============================================================================
; COMPOSITIONS (Section 2)
; =============================================================================

; cadr = car of cdr
(car (cdr (A B C)))    ; => B
; caddr = car of cdr of cdr
(car (cdr (cdr (A B C)))) ; => C
; cadar = car of cdr of car
(car (cdr (car ((A B) C)))) ; => B

; =============================================================================
; RECURSIVE FUNCTIONS (Section 3)
; =============================================================================

; ff[x] - find first atom
; ff[x] = [atom[x] -> x; T -> ff[car[x]]]
(ff A)             ; => A
(ff (A B))         ; => A
(ff ((A B) C))     ; => A

; subst[x;y;z] - substitute x for y in z
; subst[x;y;z] = [atom[z] -> [eq[z;y] -> x; T -> z];
;                T -> cons[subst[x;y;car[z]]; subst[x;y;cdr[z]]]]
(subst A B (B C D))     ; => (A C D)
(subst A B ((B C) B))   ; => ((A C) A)

; equal[x;y] - structural equality
; equal[x;y] = [atom[x] ^ atom[y] -> eq[x;y];
;               atom[x] v atom[y] -> NIL;
;               equal[car[x];car[y]] -> equal[cdr[x];cdr[y]];
;               T -> NIL]
(equal A A)             ; => T
(equal (A B) (A B))     ; => T
(equal (A B) (A C))     ; => NIL

; null[x] - true if x is NIL
(null NIL)              ; => T
(null A)                ; => NIL
(null (A))              ; => NIL

; append[x;y] - concatenate two lists
; append[x;y] = [null[x] -> y; T -> cons[car[x]; append[cdr[x];y]]]
(append (A B) (C D))    ; => (A B C D)
(append NIL (A B))      ; => (A B)
(append (A) NIL)        ; => (A)

; pair[x;y] - zip two lists into pairs
; pair[x;y] = [null[x] ^ null[y] -> NIL;
;              ~atom[x] ^ ~atom[y] -> cons[list[car[x];car[y]];
;                                         pair[cdr[x];cdr[y]]]]
(pair (A B C) (X Y Z))  ; => ((A X) (B Y) (C Z))

; assoc[x;y] - association list lookup
; assoc[x;y] = [eq[caar[y];x] -> cadar[y]; T -> assoc[x;cdr[y]]]
(assoc B ((A 1) (B 2) (C 3)))  ; => 2

; =============================================================================
; THE UNIVERSAL FUNCTION apply (Section 4)
; =============================================================================

; apply[f;args] applies function f to arguments
; This is the heart of the Lisp interpreter

; eval[e;a] evaluates expression e in environment a
; Together, apply and eval are "Maxwell's equations of Lisp"

; =============================================================================
; LAMBDA AND LABEL (Section 5)
; =============================================================================

; lambda creates anonymous functions
((lambda (x) (cons x x)) A)  ; => (A . A)

; label allows recursive definitions
((label ff (lambda (x)
    (cond ((atom x) x)
          (T (ff (car x))))))
 ((A B) C))  ; => A

; =============================================================================
; PROPERTY LIST FUNCTIONS (Section 6)
; =============================================================================

; get[x;y] - get property y from atom x
; put[x;y;z] - set property y of atom x to z
; remprop[x;y] - remove property y from atom x

; =============================================================================
; NOTE ON IMPLEMENTATION
; =============================================================================
; McCarthy's original Lisp on IBM 704:
; - 36-bit words
; - car = Contents of Address Register (15 bits)
; - cdr = Contents of Decrement Register (15 bits)
; - 6 bits for type tags and GC marks
;
; Elliott 4130:
; - 24-bit words
; - Need to pack two 12-bit pointers per word
; - Or use two words per cons cell (car+cdr)
; - Reference counting with 3-4 bits
