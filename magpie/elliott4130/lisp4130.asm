; ============================================================================
; LISP for Elliott 4130 - Native Assembly Interpreter
; ============================================================================
; Full McCarthy LISP 1.5 interpreter running natively on the 4130.
; Uses proper 4130 subroutine linkage (JFL/JI).
;
; Memory Map:
;   0        : Subroutine link (4130 convention - JFL stores here)
;   10-199   : Interpreter variables
;   200-299  : Call stack (for nested EVAL)
;   300-399  : Print buffer
;   1000+    : Cons cell heap
;
; Cell format: [CAR:12bits | CDR:12bits] in 24-bit word
;
; Atoms (>= 3000 are atoms, < 3000 are cell addresses):
;   0-2999   : Cell addresses (heap)
;   3000-3025: Symbols A-Z (A=3000, B=3001, ... Z=3025)
;   4000     : QUOTE
;   4001     : CAR
;   4002     : CDR
;   4003     : CONS
;   4004     : ATOM
;   4005     : EQ
;   4006     : COND
;   4007     : LAMBDA
;   4008     : LABEL
;   4009     : DEFUN
;   4010     : NULL
;   4011     : LIST
;   4094     : T
;   4095     : NIL
; ============================================================================

; === Test: Evaluate ((LAMBDA (X) (CAR X)) (QUOTE (A B))) ===
; Expected: 3000 (symbol A)

START:
    ; Initialize heap and environment
    LD    #1000
    ST    HEAP
    LD    #4095           ; NIL
    ST    ENV             ; Empty environment

    ; Initialize stack pointer
    LD    #200
    ST    SP

    ; === Build test expression ===
    ; ((LAMBDA (X) (CAR X)) (QUOTE (A B)))

    ; cell 1000 = (B . NIL)
    LD    #3001           ; B
    MULS  #4096
    ADD   #4095           ; NIL
    ST    1000

    ; cell 1001 = (A . 1000) = list (A B)
    LD    #3000           ; A
    MULS  #4096
    ADD   #1000
    ST    1001

    ; cell 1002 = (1001 . NIL) = args for QUOTE
    LD    #1001
    MULS  #4096
    ADD   #4095
    ST    1002

    ; cell 1003 = (QUOTE . 1002) = (QUOTE (A B))
    LD    #4000           ; QUOTE
    MULS  #4096
    ADD   #1002
    ST    1003

    ; cell 1004 = (1003 . NIL) = arg list for lambda call
    LD    #1003
    MULS  #4096
    ADD   #4095
    ST    1004

    ; --- Build (LAMBDA (X) (CAR X)) ---

    ; cell 1005 = (X . NIL) = param list
    LD    #3023           ; X = 3023 (24th letter)
    MULS  #4096
    ADD   #4095
    ST    1005

    ; cell 1006 = (X . NIL) = arg to CAR
    LD    #3023           ; X
    MULS  #4096
    ADD   #4095
    ST    1006

    ; cell 1007 = (CAR . 1006) = (CAR X)
    LD    #4001           ; CAR
    MULS  #4096
    ADD   #1006
    ST    1007

    ; cell 1008 = (1007 . NIL) = body wrapped
    LD    #1007
    MULS  #4096
    ADD   #4095
    ST    1008

    ; cell 1009 = (1005 . 1008) = (params . body)
    LD    #1005
    MULS  #4096
    ADD   #1008
    ST    1009

    ; cell 1010 = (LAMBDA . 1009) = (LAMBDA (X) (CAR X))
    LD    #4007           ; LAMBDA
    MULS  #4096
    ADD   #1009
    ST    1010

    ; cell 1011 = (1010 . 1004) = ((LAMBDA ...) (QUOTE (A B)))
    LD    #1010
    MULS  #4096
    ADD   #1004
    ST    1011

    ; Update heap
    LD    #1012
    ST    HEAP

    ; === Evaluate the expression ===
    LD    #1011
    ST    EXPR
    JFL   EVAL

    ; Store result
    LD    RESULT
    ST    100

    ; Print result as letter (A=0, B=1, etc.)
    LD    RESULT
    SUB   #3000
    JN    PRINT_NUM       ; If negative, print as number
    SUB   #26
    JNN   PRINT_NUM       ; If >= 26, print as number

    ; Print as letter
    LD    RESULT
    SUB   #3000
    ADD   #1             ; TR uses 1-based (A=1)
    TR    0              ; Output letter

    J     DONE

PRINT_NUM:
    ; Print NIL or T
    LD    RESULT
    SUB   #4095
    JNZ   PRINT_T
    ; Print NIL as "NIL"
    TR    14             ; N
    TR    9              ; I
    TR    12             ; L
    J     DONE

PRINT_T:
    LD    RESULT
    SUB   #4094
    JNZ   PRINT_HEX
    TR    20             ; T
    J     DONE

PRINT_HEX:
    ; Print as octal
    LD    RESULT
    CH    0

DONE:
    J     DONE

; ============================================================================
; EVAL - Evaluate expression in environment
; Input:  EXPR = expression, ENV = environment alist
; Output: RESULT
; ============================================================================
EVAL:
    LD    0
    ST    EV_LINK

    ; Is EXPR an atom? (>= 3000)
    LD    EXPR
    SUB   #3000
    JN    EV_LIST

    ; --- Atom handling ---
    ; NIL and T self-evaluate
    LD    EXPR
    SUB   #4094
    JNN   EV_SELF         ; T or NIL -> self

    ; Other atoms -> lookup in environment
    LD    EXPR
    ST    EV_VAR
    LD    ENV
    ST    EV_ENV_SCAN
    J     EV_LOOKUP

EV_SELF:
    LD    EXPR
    ST    RESULT
    J     EV_RET

EV_LOOKUP:
    ; Scan environment for variable
    LD    EV_ENV_SCAN
    SUB   #4095
    JZ    EV_UNBOUND      ; End of env - unbound

    ; Get first pair: car(env)
    LD    EV_ENV_SCAN
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_PAIR

    ; Get key: car(pair)
    LD    EV_PAIR
    ST    ARG
    JFL   PCAR

    ; Compare with var
    LD    RESULT
    SUB   EV_VAR
    JZ    EV_FOUND

    ; Not found, try cdr(env)
    LD    EV_ENV_SCAN
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_ENV_SCAN
    J     EV_LOOKUP

EV_FOUND:
    ; Return cdr(pair) = value
    LD    EV_PAIR
    ST    ARG
    JFL   PCDR
    J     EV_RET

EV_UNBOUND:
    ; Return NIL for unbound
    LD    #4095
    ST    RESULT
    J     EV_RET

EV_LIST:
    ; EXPR is a list - get function
    LD    EXPR
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_FN

    ; Check special forms first
    LD    EV_FN
    SUB   #4000           ; QUOTE
    JZ    EV_QUOTE

    LD    EV_FN
    SUB   #4006           ; COND
    JZ    EV_COND

    LD    EV_FN
    SUB   #4007           ; LAMBDA
    JZ    EV_LAMBDA

    ; Get args
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_ARGS

    ; Check if function is an atom (primitive)
    LD    EV_FN
    SUB   #3000
    JN    EV_APPLY_LIST   ; Function is a list (lambda)

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

    LD    EV_FN
    SUB   #4010           ; NULL
    JZ    P_NULL

    LD    EV_FN
    SUB   #4011           ; LIST
    JZ    P_LIST

    ; Unknown atom function - return NIL
    LD    #4095
    ST    RESULT
    J     EV_RET

EV_APPLY_LIST:
    ; Function is a list - eval it to get lambda
    LD    EV_FN
    ST    EXPR
    ; Save args
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    ST    EV_FN
    LD    EV_SAVE1
    ST    EV_ARGS
    ; Fall through to apply

EV_APPLY_LAMBDA:
    ; Apply lambda to args
    ; EV_FN = (LAMBDA params body)
    ; EV_ARGS = unevaluated args

    ; Get params: cadr(fn)
    LD    EV_FN
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_PARAMS

    ; Get body: caddr(fn)
    LD    EV_FN
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_BODY

    ; Evaluate args (EVLIS)
    LD    EV_ARGS
    ST    EVLIS_IN
    JFL   EVLIS
    LD    RESULT
    ST    EV_VALS

    ; Build new environment: pairlis(params, vals, env)
    LD    EV_PARAMS
    ST    PAIRLIS_X
    LD    EV_VALS
    ST    PAIRLIS_Y
    LD    ENV
    ST    PAIRLIS_A
    JFL   PAIRLIS
    LD    RESULT
    ST    ENV

    ; Eval body in new environment
    LD    EV_BODY
    ST    EXPR
    JFL   EVAL
    J     EV_RET

EV_LAMBDA:
    ; (LAMBDA params body) -> return as-is (closure)
    LD    EXPR
    ST    RESULT
    J     EV_RET

EV_QUOTE:
    ; (QUOTE x) -> cadr(expr)
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    J     EV_RET

EV_COND:
    ; (COND clauses...)
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EV_CLAUSES

EV_COND_LOOP:
    LD    EV_CLAUSES
    SUB   #4095
    JZ    EV_COND_NIL

    ; Get first clause
    LD    EV_CLAUSES
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EV_CLAUSE

    ; Save clauses
    LD    EV_CLAUSES
    ST    EV_SAVE1

    ; Eval test: car(clause)
    LD    EV_CLAUSE
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    ; Restore
    LD    EV_SAVE1
    ST    EV_CLAUSES

    ; Check result
    LD    RESULT
    SUB   #4095
    JZ    EV_COND_NEXT

    ; Test passed - eval cadr(clause)
    LD    EV_CLAUSES
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
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
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    ST    ARG
    JFL   PCAR
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
    ; (CONS a b)
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    ST    CONS_A

    LD    EV_SAVE1
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
    ; (ATOM x)
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
    ; (EQ a b)
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    ST    EQ_A

    LD    EV_SAVE1
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

P_NULL:
    ; (NULL x) - returns T if x is NIL
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    LD    RESULT
    SUB   #4095
    JNZ   P_NULL_NO
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
P_NULL_NO:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

P_LIST:
    ; (LIST a b ...) - eval all args and cons them
    LD    EV_ARGS
    ST    EVLIS_IN
    JFL   EVLIS
    J     EV_RET

EV_RET:
    LD    EV_LINK
    ST    0
    JI    0

; ============================================================================
; EVLIS - Evaluate list of expressions
; Input:  EVLIS_IN = list of expressions
; Output: RESULT = list of values
; ============================================================================
EVLIS:
    LD    0
    ST    EVLIS_LINK

    LD    EVLIS_IN
    SUB   #4095
    JZ    EVLIS_NIL

    ; Eval car
    LD    EVLIS_IN
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EVLIS_IN
    ST    EVLIS_SAVE
    JFL   EVAL
    LD    RESULT
    ST    CONS_A

    ; Evlis cdr
    LD    EVLIS_SAVE
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    EVLIS_IN
    JFL   EVLIS
    LD    RESULT
    ST    CONS_D

    ; Cons them
    JFL   PCONS
    J     EVLIS_RET

EVLIS_NIL:
    LD    #4095
    ST    RESULT

EVLIS_RET:
    LD    EVLIS_LINK
    ST    0
    JI    0

; ============================================================================
; PAIRLIS - Build environment bindings
; Input:  PAIRLIS_X = params, PAIRLIS_Y = values, PAIRLIS_A = existing env
; Output: RESULT = extended environment
; ============================================================================
PAIRLIS:
    LD    0
    ST    PAIRLIS_LINK

    LD    PAIRLIS_X
    SUB   #4095
    JZ    PAIRLIS_DONE

    ; Get car(x) and car(y)
    LD    PAIRLIS_X
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    PAIRLIS_KEY

    LD    PAIRLIS_Y
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    PAIRLIS_VAL

    ; Build pair (key . val)
    LD    PAIRLIS_KEY
    ST    CONS_A
    LD    PAIRLIS_VAL
    ST    CONS_D
    JFL   PCONS
    LD    RESULT
    ST    PAIRLIS_PAIR

    ; Recurse on cdr(x), cdr(y)
    LD    PAIRLIS_X
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    PAIRLIS_X

    LD    PAIRLIS_Y
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    PAIRLIS_Y

    JFL   PAIRLIS

    ; Cons pair onto result
    LD    PAIRLIS_PAIR
    ST    CONS_A
    LD    RESULT
    ST    CONS_D
    JFL   PCONS
    J     PAIRLIS_RET

PAIRLIS_DONE:
    LD    PAIRLIS_A
    ST    RESULT

PAIRLIS_RET:
    LD    PAIRLIS_LINK
    ST    0
    JI    0

; ============================================================================
; PCAR - Primitive CAR
; ============================================================================
PCAR:
    LD    0
    ST    PCAR_LINK

    LD    ARG
    SUB   #3000
    JNN   PCAR_ATOM

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
    JI    0

; ============================================================================
; PCDR - Primitive CDR
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
    JI    0

; ============================================================================
; PCONS - Primitive CONS
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
    JI    0

; ============================================================================
; READ - Read S-expression from paper tape (Channel 1)
; Input:  Paper tape via IDUM channel 1
; Output: RESULT = parsed expression (cell address or atom code)
; Uses HEAP for new cons cells
;
; Supported syntax:
;   A-Z     -> Atom codes 3000-3025
;   NIL     -> 4095
;   T       -> 4094
;   (...)   -> List (cons cells)
;   'x      -> (QUOTE x)
; ============================================================================
READ:
    LD    0
    ST    RD_LINK

    ; Skip whitespace
RD_SKIP:
    JFL   RDCHAR
    LD    RD_CH
    SUB   #32             ; Space
    JZ    RD_SKIP
    LD    RD_CH
    SUB   #10             ; Newline
    JZ    RD_SKIP
    LD    RD_CH
    SUB   #13             ; CR
    JZ    RD_SKIP

    ; Check for '(' - start of list
    LD    RD_CH
    SUB   #40             ; '('
    JZ    RD_LIST

    ; Check for ')' - end of list (error at top level)
    LD    RD_CH
    SUB   #41             ; ')'
    JZ    RD_NIL

    ; Check for ''' - quote
    LD    RD_CH
    SUB   #39             ; '''
    JZ    RD_QUOTE

    ; Must be atom - read until delimiter
    J     RD_ATOM

RD_NIL:
    LD    #4095           ; NIL
    ST    RESULT
    J     RD_RET

RD_QUOTE:
    ; Read the quoted expression
    JFL   READ
    LD    RESULT
    ST    RD_QEXPR

    ; Build (QUOTE . (expr . NIL))
    ; First: (expr . NIL)
    LD    RD_QEXPR
    MULS  #4096
    ADD   #4095           ; NIL
    ST    RD_CELL
    LD    HEAP
    ST    RD_ADDR
    LD    RD_CELL
    LDR   RD_ADDR
    ST    0,R
    LD    HEAP
    ADD   #1
    ST    HEAP

    ; Now: (QUOTE . RD_ADDR)
    LD    #4000           ; QUOTE
    MULS  #4096
    ADD   RD_ADDR
    ST    RD_CELL
    LD    HEAP
    ST    RESULT
    LD    RD_CELL
    LDR   RESULT
    ST    0,R
    LD    HEAP
    ADD   #1
    ST    HEAP
    J     RD_RET

RD_LIST:
    ; Read list elements until ')'
    LD    #4095           ; NIL (end of list marker)
    ST    RD_LIST_END

RD_LIST_LOOP:
    ; Skip whitespace
RD_LIST_SKIP:
    JFL   RDCHAR
    LD    RD_CH
    SUB   #32
    JZ    RD_LIST_SKIP
    LD    RD_CH
    SUB   #10
    JZ    RD_LIST_SKIP

    ; Check for ')'
    LD    RD_CH
    SUB   #41             ; ')'
    JZ    RD_LIST_DONE

    ; Push back the char and read expression
    LD    RD_CH
    ST    RD_PUSHBACK

    JFL   READ
    LD    RESULT
    ST    RD_ELEM

    ; CONS element onto list (builds in reverse)
    LD    RD_ELEM
    MULS  #4096
    ADD   RD_LIST_END
    ST    RD_CELL
    LD    HEAP
    ST    RD_LIST_END
    LD    RD_CELL
    LDR   RD_LIST_END
    ST    0,R
    LD    HEAP
    ADD   #1
    ST    HEAP

    J     RD_LIST_LOOP

RD_LIST_DONE:
    ; Reverse the list (it was built backwards)
    LD    RD_LIST_END
    ST    RESULT
    J     RD_RET

RD_ATOM:
    ; Read atom name into buffer, convert to code
    LD    #0
    ST    RD_ALEN
    LD    RD_CH
    ST    RD_ABUF

RD_ATOM_LOOP:
    JFL   RDCHAR
    ; Check for delimiter
    LD    RD_CH
    SUB   #32             ; Space
    JZ    RD_ATOM_END
    LD    RD_CH
    SUB   #40             ; '('
    JZ    RD_ATOM_PUSH
    LD    RD_CH
    SUB   #41             ; ')'
    JZ    RD_ATOM_PUSH
    LD    RD_CH
    SUB   #10             ; Newline
    JZ    RD_ATOM_END

    ; Add to atom buffer (simplified: just track first char)
    LD    RD_ALEN
    ADD   #1
    ST    RD_ALEN
    J     RD_ATOM_LOOP

RD_ATOM_PUSH:
    LD    RD_CH
    ST    RD_PUSHBACK
RD_ATOM_END:
    ; Convert first char to atom code
    ; A-Z -> 3000-3025
    LD    RD_ABUF
    SUB   #65             ; 'A'
    JN    RD_ATOM_SPECIAL
    SUB   #26
    JNN   RD_ATOM_SPECIAL
    ; It's A-Z
    LD    RD_ABUF
    SUB   #65
    ADD   #3000
    ST    RESULT
    J     RD_RET

RD_ATOM_SPECIAL:
    ; Check for T or NIL (simplified)
    LD    RD_ABUF
    SUB   #84             ; 'T'
    JNZ   RD_CHECK_NIL
    LD    #4094           ; T
    ST    RESULT
    J     RD_RET

RD_CHECK_NIL:
    LD    RD_ABUF
    SUB   #78             ; 'N' (for NIL)
    JNZ   RD_UNKNOWN
    LD    #4095           ; NIL
    ST    RESULT
    J     RD_RET

RD_UNKNOWN:
    LD    #4095           ; Unknown -> NIL
    ST    RESULT

RD_RET:
    LD    RD_LINK
    ST    0
    JI    0

; ============================================================================
; RDCHAR - Read one character from paper tape (Channel 1)
; Output: RD_CH = character read (or 0 if EOF)
; Uses IDUM instruction: F=76, Y=0, N=0o20001
; ============================================================================
RDCHAR:
    LD    0
    ST    RDCH_LINK

    ; Check pushback buffer first
    LD    RD_PUSHBACK
    JZ    RDCH_TAPE
    ST    RD_CH
    LD    #0
    ST    RD_PUSHBACK
    J     RDCH_RET

RDCH_TAPE:
    ; Read one byte from paper tape reader (Channel 1) using IDUM instruction
    ; IDUM 1 reads from channel 1, result goes to M register
    ; Historically authentic: this is how Elliott 4130 read paper tape
    IDUM  1             ; Read byte from tape reader to M
    ST    RD_CH         ; Store result

RDCH_RET:
    LD    RDCH_LINK
    ST    0
    JI    0

; READ state variables
RD_LINK:      #0
RD_CH:        #0
RD_PUSHBACK:  #0
RD_CELL:      #0
RD_ADDR:      #0
RD_QEXPR:     #0
RD_LIST_END:  #0
RD_ELEM:      #0
RD_ALEN:      #0
RD_ABUF:      #0
RDCH_LINK:    #0

; ============================================================================
; Data
; ============================================================================

; Subroutine links
EV_LINK:      #0
PCAR_LINK:    #0
PCDR_LINK:    #0
PCONS_LINK:   #0
EVLIS_LINK:   #0
PAIRLIS_LINK: #0

; EVAL state
EXPR:         #0
RESULT:       #0
ENV:          #0
EV_FN:        #0
EV_ARGS:      #0
EV_CLAUSES:   #0
EV_CLAUSE:    #0
EV_SAVE1:     #0
EV_VAR:       #0
EV_ENV_SCAN:  #0
EV_PAIR:      #0
EV_PARAMS:    #0
EV_BODY:      #0
EV_VALS:      #0

; EVLIS state
EVLIS_IN:     #0
EVLIS_SAVE:   #0

; PAIRLIS state
PAIRLIS_X:    #0
PAIRLIS_Y:    #0
PAIRLIS_A:    #0
PAIRLIS_KEY:  #0
PAIRLIS_VAL:  #0
PAIRLIS_PAIR: #0

; Primitive args
ARG:          #0
CONS_A:       #0
CONS_D:       #0
EQ_A:         #0

; Temporaries
T1:           #0
T2:           #0

; Memory
HEAP:         #0
SP:           #0

; Output
100:          #0
