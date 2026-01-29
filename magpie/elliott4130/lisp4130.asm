; ============================================================================
; LISP for Elliott 4130 - Native Assembly Interpreter
; ============================================================================
; Uses proper 4130 subroutine linkage (JFL/JIR).
;
; Memory Map:
;   0        : Subroutine link (4130 convention - JFL stores here)
;   10-99    : Interpreter variables
;   100      : Final result
;   1000+    : Cons cell heap
;
; Cell format: [CAR:12bits | CDR:12bits] in 24-bit word
;
; Atoms (>= 3000 are atoms, < 3000 are cell addresses):
;   0-2999   : Cell addresses (heap)
;   3000-3999: Symbols (A=3000, B=3001, ...)
;   4000     : QUOTE
;   4001     : CAR
;   4002     : CDR
;   4003     : CONS
;   4004     : ATOM
;   4005     : EQ
;   4006     : COND
;   4007     : LAMBDA
;   4094     : T
;   4095     : NIL
; ============================================================================

; === Test: Evaluate (CAR (QUOTE (A B))) ===
; Expected result: 3000 (symbol A)

START:
    ; Initialize heap
    LD    #1000
    ST    HEAP

    ; Build test expression: (CAR (QUOTE (A B)))

    ; cell 1000 = (B . NIL) = (3001 . 4095)
    LD    #3001           ; B
    MULS  #4096
    ADD   #4095           ; NIL
    ST    1000

    ; cell 1001 = (A . 1000) = (A B)
    LD    #3000           ; A
    MULS  #4096
    ADD   #1000
    ST    1001

    ; cell 1002 = (1001 . NIL) - arg list for QUOTE
    LD    #1001
    MULS  #4096
    ADD   #4095
    ST    1002

    ; cell 1003 = (QUOTE . 1002) = (QUOTE (A B))
    LD    #4000           ; QUOTE
    MULS  #4096
    ADD   #1002
    ST    1003

    ; cell 1004 = (1003 . NIL) - arg list for CAR
    LD    #1003
    MULS  #4096
    ADD   #4095
    ST    1004

    ; cell 1005 = (CAR . 1004) = (CAR (QUOTE (A B)))
    LD    #4001           ; CAR
    MULS  #4096
    ADD   #1004
    ST    1005

    ; Update heap pointer
    LD    #1006
    ST    HEAP

    ; Call EVAL(1005)
    LD    #1005
    ST    EXPR
    JFL   EVAL

    ; Store result
    LD    RESULT
    ST    100

    ; Also print it (result - 3000 = letter index)
    ; A=0, B=1, etc.
    LD    RESULT
    SUB   #3000
    ST    PRINT_N
    ; TR extracode: display nth letter
    ; The assembler should encode this properly

HALT:
    J     HALT

; ============================================================================
; EVAL - Evaluate expression
; Input:  EXPR = expression
; Output: RESULT
; Clobbers: EV_*
; ============================================================================
EVAL:
    ; Save link (JFL put it at 0, we save to our variable)
    LD    0
    ST    EV_LINK

    ; Is EXPR an atom? (>= 3000)
    LD    EXPR
    SUB   #3000
    JNN   EV_ATOM         ; It's an atom

    ; EXPR is a cell - get CAR
    LD    EXPR
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_FN           ; Function/special form

    ; Check for QUOTE (4000)
    LD    EV_FN
    SUB   #4000
    JZ    EV_QUOTE

    ; Check for COND (4006)
    LD    EV_FN
    SUB   #4006
    JZ    EV_COND

    ; Get args (cdr of expr)
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_ARGS

    ; Check primitives
    LD    EV_FN
    SUB   #4001           ; CAR
    JZ    P_CAR

    LD    EV_FN
    SUB   #4002           ; CDR
    JZ    P_CDR

    LD    EV_FN
    SUB   #4003           ; CONS
    JZ    P_CONS

    LD    EV_FN
    SUB   #4004           ; ATOM
    JZ    P_ATOM

    LD    EV_FN
    SUB   #4005           ; EQ
    JZ    P_EQ

    ; Unknown function - return NIL
    LD    #4095
    ST    RESULT
    J     EV_RET

EV_ATOM:
    ; Atoms self-evaluate
    LD    EXPR
    ST    RESULT
    J     EV_RET

EV_QUOTE:
    ; (QUOTE x) -> cadr(expr)
    LD    EXPR
    ST    ARG
    JFL   PCDR            ; cdr(expr)
    LD    RESULT
    ST    ARG
    JFL   PCAR            ; car(cdr(expr))
    J     EV_RET

EV_COND:
    ; (COND clauses...) -> evcon
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_CLAUSES

EV_COND_LOOP:
    ; Done if clauses = NIL
    LD    EV_CLAUSES
    SUB   #4095
    JZ    EV_COND_NIL

    ; Get first clause
    LD    EV_CLAUSES
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_CLAUSE       ; (test result)

    ; Save clauses for later
    LD    EV_CLAUSES
    ST    EV_SAVE

    ; Eval car(clause) = test
    LD    EV_CLAUSE
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    ; Restore clauses
    LD    EV_SAVE
    ST    EV_CLAUSES

    ; If result != NIL, return cadr(clause)
    LD    RESULT
    SUB   #4095
    JZ    EV_COND_NEXT

    ; Test passed - return cadr(clause)
    LD    EV_CLAUSES
    ST    ARG
    JFL   PCAR            ; Get clause again
    LD    RESULT
    ST    ARG
    JFL   PCDR            ; cdr(clause)
    LD    RESULT
    ST    ARG
    JFL   PCAR            ; car(cdr(clause))
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    J     EV_RET

EV_COND_NEXT:
    LD    EV_CLAUSES
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_CLAUSES
    J     EV_COND_LOOP

EV_COND_NIL:
    LD    #4095
    ST    RESULT
    J     EV_RET

; --- Primitives ---

P_CAR:
    ; (CAR x) - eval arg, then car
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR            ; Get first arg
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE
    JFL   EVAL            ; Eval it
    LD    RESULT
    ST    ARG
    JFL   PCAR            ; car(result)
    J     EV_RET

P_CDR:
    ; (CDR x) - eval arg, then cdr
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    ST    ARG
    JFL   PCDR
    J     EV_RET

P_CONS:
    ; (CONS a b) - eval both, cons
    ; First arg
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE
    JFL   EVAL
    LD    RESULT
    ST    CONS_A

    ; Second arg
    LD    EV_SAVE
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    ST    CONS_D

    JFL   PCONS
    J     EV_RET

P_ATOM:
    ; (ATOM x) - eval, return T if atom
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    LD    RESULT
    SUB   #3000
    JN    P_ATOM_NO
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
P_ATOM_NO:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

P_EQ:
    ; (EQ a b) - eval both, compare
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE
    JFL   EVAL
    LD    RESULT
    ST    EQ_A

    LD    EV_SAVE
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    LD    RESULT
    SUB   EQ_A
    JNZ   P_EQ_NO
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
P_EQ_NO:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

EV_RET:
    LD    EV_LINK
    ST    0
    JI    0               ; Indirect jump via address 0

; ============================================================================
; PCAR - Primitive CAR
; Input:  ARG = cell
; Output: RESULT = car(cell)
; ============================================================================
PCAR:
    LD    0
    ST    PCAR_LINK

    LD    ARG
    SUB   #3000
    JNN   PCAR_ATOM       ; Atom - return as-is

    ; Load cell, extract upper 12 bits
    LDR   ARG
    LD    0,R
    DIV   #4096
    ST    RESULT
    J     PCAR_RET

PCAR_ATOM:
    LD    ARG
    ST    RESULT

PCAR_RET:
    LD    PCAR_LINK
    ST    0
    JI    0               ; Indirect jump via address 0

; ============================================================================
; PCDR - Primitive CDR
; Input:  ARG = cell
; Output: RESULT = cdr(cell)
; ============================================================================
PCDR:
    LD    0
    ST    PCDR_LINK

    LD    ARG
    SUB   #3000
    JNN   PCDR_ATOM

    ; Load cell, extract lower 12 bits
    LDR   ARG
    LD    0,R
    ST    T1
    DIV   #4096
    MULS  #4096
    ST    T2
    LD    T1
    SUB   T2
    ST    RESULT
    J     PCDR_RET

PCDR_ATOM:
    LD    #4095           ; CDR of atom = NIL
    ST    RESULT

PCDR_RET:
    LD    PCDR_LINK
    ST    0
    JI    0               ; Indirect jump via address 0

; ============================================================================
; PCONS - Primitive CONS
; Input:  CONS_A, CONS_D
; Output: RESULT = new cell address
; ============================================================================
PCONS:
    LD    0
    ST    PCONS_LINK

    LD    HEAP
    ST    RESULT

    LD    CONS_A
    MULS  #4096
    ADD   CONS_D
    LDR   RESULT
    ST    0,R

    LD    HEAP
    ADD   #1
    ST    HEAP

    LD    PCONS_LINK
    ST    0
    JI    0               ; Indirect jump via address 0

; ============================================================================
; Data
; ============================================================================

; Subroutine links
EV_LINK:    #0
PCAR_LINK:  #0
PCDR_LINK:  #0
PCONS_LINK: #0

; EVAL state
EXPR:       #0
RESULT:     #0
EV_FN:      #0
EV_ARGS:    #0
EV_CLAUSES: #0
EV_CLAUSE:  #0
EV_SAVE:    #0

; Primitive args
ARG:        #0
CONS_A:     #0
CONS_D:     #0
EQ_A:       #0

; Temporaries
T1:         #0
T2:         #0

; Heap
HEAP:       #0

; Print
PRINT_N:    #0

; Output
100:        #0
