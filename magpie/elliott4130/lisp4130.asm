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
;   4012     : PLUS (or +)
;   4013     : MINUS (or -)
;   4014     : TIMES (or *)
;   4015     : QUOTIENT (or //)
;   4016     : REMAINDER
;   4017     : LESSP
;   4018     : GREATERP
;   4019     : ZEROP
;   4020     : NUMBERP
;   4094     : T
;   4095     : NIL
;
; Numbers: 5000-7999 represent integers 0-2999
;   To get value: atom - 5000
;   To make number atom: value + 5000
; ============================================================================

; === REPL: Read-Eval-Print Loop ===
; Reads S-expressions from paper tape (Channel 1), evaluates, prints results
; Load a LISP tape into the tape reader before running

START:
    ; Initialize heap and environment
    LD    #2000           ; heap base (must be past assembled code)
    ST    HEAP
    LD    #4095           ; NIL
    ST    ENV             ; Empty environment

    ; Initialize stack pointer.
    ; Stack stores caller links for re-entrant subroutines (currently
    ; just READ; see Bug E in README). It must sit above HEAP so that
    ; cons cell allocation cannot collide with stack frames. HEAP is at
    ; 2000 and is bounded by the 12-bit cell-pointer limit (4095), so
    ; placing the stack at 5000 leaves 1000 addresses of headroom.
    LD    #5000
    ST    SP

    ; Print startup banner: "LISP"
    TR    12             ; L
    TR    9              ; I
    TR    19             ; S
    TR    16             ; P
    TR    0              ; newline

; === REPL Loop ===
REPL:
    ; Print prompt: "> "
    ; (Skip prompt for batch tape processing)

    ; Read S-expression from tape
    JFL   READ

    ; Check for EOF (RESULT = 0 means tape empty)
    LD    RD_CH
    JZ    REPL_DONE      ; EOF - stop

    ; Evaluate expression
    LD    RESULT
    ST    EXPR
    JFL   EVAL

    ; Print result
    JFL   PRINT
    TR    0              ; newline after each top-level print

    ; Loop for next expression
    J     REPL

REPL_DONE:
    ; Print "END"
    TR    5              ; E
    TR    14             ; N
    TR    4              ; D
    TR    0              ; newline
    J     HALT

HALT:
    J     HALT

; ============================================================================
; PRINT - Print S-expression to console
; Input: RESULT = expression to print
; ============================================================================
PRINT:
    ; PRINT is re-entrant: PR_LIST_LOOP recurses on each element via
    ; JFL PRINT, and PR_DOTTED recurses on the cdr. Both the caller
    ; link and PR_EXPR (the current sub-expression being printed) must
    ; survive the recursive call. Push both onto the SP stack.
    ;     [SP-2] = caller link
    ;     [SP-1] = saved PR_EXPR
    LD    0
    LDR   SP
    ST    0,R
    LD    SP
    ADD   #1
    ST    SP
    LD    PR_EXPR
    LDR   SP
    ST    0,R
    LD    SP
    ADD   #1
    ST    SP

    LD    RESULT
    ST    PR_EXPR

    ; Is it an atom? (>= 3000)
    LD    PR_EXPR
    SUB   #3000
    JN    PR_LIST

    ; --- Print atom ---
    ; Check for NIL
    LD    PR_EXPR
    SUB   #4095
    JNZ   PR_NOT_NIL
    TR    14             ; N
    TR    9              ; I
    TR    12             ; L
    J     PR_RET

PR_NOT_NIL:
    ; Check for T
    LD    PR_EXPR
    SUB   #4094
    JNZ   PR_SYMBOL
    TR    20             ; T
    J     PR_RET

PR_SYMBOL:
    ; Print A-Z (3000-3025)
    LD    PR_EXPR
    SUB   #3000
    JN    PR_NUM
    SUB   #26
    JNN   PR_NUM
    ; It's a letter - emit via ODUM 0 (channel 0 = console)
    ; sixBitToAscii maps 1->A, 2->B, ..., 26->Z, so we want index 1..26
    LD    PR_EXPR
    SUB   #3000
    ADD   #1
    ODUM  0
    J     PR_RET

PR_NUM:
    ; Check if it's a LISP number (5000-7999)
    LD    PR_EXPR
    SUB   #5000
    JN    PR_OCTAL        ; < 5000, print as octal
    SUB   #3000
    JNN   PR_OCTAL        ; >= 8000, print as octal
    ; It's a number - print decimal value (0-999)
    LD    PR_EXPR
    SUB   #5000
    ST    PR_N
    LD    #0
    ST    PR_HFLAG        ; have-printed-hundreds flag
    ; Hundreds
    LD    PR_N
    DIV   #100
    ST    PR_T            ; PR_T = hundreds digit
    LD    PR_T            ; reload to set flags (DIV does not)
    JZ    PR_TENS
    ADD   #27
    ODUM  0
    LD    #1
    ST    PR_HFLAG
    LD    PR_T
    MULS  #100
    ST    PR_T
    LD    PR_N
    SUB   PR_T
    ST    PR_N
PR_TENS:
    ; Tens digit
    LD    PR_N
    DIV   #10
    ST    PR_T            ; PR_T = tens digit
    LD    PR_T
    JZ    PR_TENS_ZERO    ; tens == 0
    ADD   #27
    ODUM  0
    LD    PR_T
    MULS  #10
    ST    PR_T
    LD    PR_N
    SUB   PR_T
    ST    PR_N
    J     PR_UNITS
PR_TENS_ZERO:
    ; If hundreds were printed, must emit '0' for tens
    LD    PR_HFLAG
    JZ    PR_UNITS
    LD    #27             ; 6-bit '0'
    ODUM  0
PR_UNITS:
    LD    PR_N
    ADD   #27
    ODUM  0
    J     PR_RET

PR_OCTAL:
    ; Print as octal for non-numbers
    LD    PR_EXPR
    CH    0
    J     PR_RET

; Print temporaries
PR_N:         #0
PR_T:         #0
PR_HFLAG:     #0

PR_LIST:
    ; Print list: (a b c ...)
    ; ODUM emits the low 6 bits of M as an Elliott 6-bit character,
    ; which the OS/host then maps to ASCII via sixBitToAscii. The 6-bit
    ; codes for parens/space/dot are NOT the same as ASCII (which is
    ; what the reader sees from the cli.mjs tape divergence). Use the
    ; 6-bit codes here:
    ;   space=0  '('=45  ')'=46  '.'=51  '0'..'9'=27..36
    LD    #45            ; '('
    ODUM  0              ; Output M to console (channel 0)

PR_LIST_LOOP:
    ; Print car
    LD    PR_EXPR
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    PR_SAVE
    JFL   PRINT          ; Recursive print

    ; Get cdr
    LD    PR_EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    PR_EXPR

    ; Check if cdr is NIL
    LD    PR_EXPR
    SUB   #4095
    JZ    PR_LIST_END

    ; Check if cdr is a list (< 3000)
    LD    PR_EXPR
    SUB   #3000
    JNN   PR_DOTTED

    ; More list elements - print space and continue
    LD    #0             ; Space (6-bit code 0)
    ODUM  0
    J     PR_LIST_LOOP

PR_DOTTED:
    ; Dotted pair: print " . x"
    LD    #0             ; Space
    ODUM  0
    LD    #51            ; '.' (6-bit code 51)
    ODUM  0
    LD    #0             ; Space
    ODUM  0
    LD    PR_EXPR
    ST    RESULT
    JFL   PRINT

PR_LIST_END:
    ; Output ')' (6-bit code 46)
    LD    #46
    ODUM  0

PR_RET:
    ; Pop saved PR_EXPR then caller link.
    LD    SP
    SUB   #1
    ST    SP
    LDR   SP
    LD    0,R
    ST    PR_EXPR
    LD    SP
    SUB   #1
    ST    SP
    LDR   SP
    LD    0,R
    ST    0
    JIR   0

; PRINT state
PR_LINK:      #0
PR_EXPR:      #0
PR_SAVE:      #0

; ============================================================================
; EVAL - Evaluate expression in environment
; Input:  EXPR = expression, ENV = environment alist
; Output: RESULT
; ============================================================================
EVAL:
    ; Bug E (part 2) fix: EVAL is re-entrant - P_CAR/P_CDR/P_CONS,
    ; EV_APPLY_LIST, EV_APPLY_LAMBDA and EV_COND all call JFL EVAL on
    ; a sub-expression. Push the caller link onto the SP stack rather
    ; than the single EV_LINK global, which would otherwise be lost
    ; when the inner EVAL stored its own caller link in the same slot.
    LD    0
    LDR   SP
    ST    0,R
    LD    SP
    ADD   #1
    ST    SP

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

    LD    EV_FN
    SUB   #4008           ; LABEL
    JZ    EV_LABEL

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

    LD    EV_FN
    SUB   #4012           ; PLUS
    JZ    P_PLUS

    LD    EV_FN
    SUB   #4013           ; MINUS
    JZ    P_MINUS

    LD    EV_FN
    SUB   #4014           ; TIMES
    JZ    P_TIMES

    LD    EV_FN
    SUB   #4015           ; QUOTIENT
    JZ    P_QUOTIENT

    LD    EV_FN
    SUB   #4016           ; REMAINDER
    JZ    P_REMAINDER

    LD    EV_FN
    SUB   #4017           ; LESSP
    JZ    P_LESSP

    LD    EV_FN
    SUB   #4018           ; GREATERP
    JZ    P_GREATERP

    LD    EV_FN
    SUB   #4019           ; ZEROP
    JZ    P_ZEROP

    LD    EV_FN
    SUB   #4020           ; NUMBERP
    JZ    P_NUMBERP

    LD    EV_FN
    SUB   #4030           ; CADR
    JZ    P_CADR

    LD    EV_FN
    SUB   #4031           ; CADDR
    JZ    P_CADDR

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

EV_LABEL:
    ; (LABEL name fn) - bind name to fn in environment, return fn
    ; This enables recursive functions: name is visible inside fn's body
    ; Get name: cadr(expr)
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    LBL_NAME

    ; Get fn: caddr(expr) - the lambda expression
    LD    EXPR
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    LBL_FN

    ; Build binding (name . fn)
    LD    LBL_NAME
    ST    CONS_A
    LD    LBL_FN
    ST    CONS_D
    JFL   PCONS
    LD    RESULT
    ST    LBL_PAIR

    ; Extend environment: ((name . fn) . env)
    LD    LBL_PAIR
    ST    CONS_A
    LD    ENV
    ST    CONS_D
    JFL   PCONS
    LD    RESULT
    ST    ENV             ; Update global ENV

    ; Return the fn (now with name bound in env)
    LD    LBL_FN
    ST    RESULT
    J     EV_RET

; LABEL temporaries
LBL_NAME:     #0
LBL_FN:       #0
LBL_PAIR:     #0

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

P_CADR:
    ; (CADR x) = (CAR (CDR x))
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
    J     EV_RET

P_CADDR:
    ; (CADDR x) = (CAR (CDR (CDR x)))
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCDR
    LD    RESULT
    ST    ARG
    JFL   PCAR
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

; ============================================================================
; Arithmetic Primitives - Numbers are atoms 5000-7999 (value = atom - 5000)
; ============================================================================

P_PLUS:
    ; (PLUS a b) or (+ a b) - add two numbers
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000           ; Extract numeric value
    ST    ARITH_A

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
    SUB   #5000           ; Extract numeric value

    ADD   ARITH_A         ; a + b
    ADD   #5000           ; Convert back to number atom
    ST    RESULT
    J     EV_RET

P_MINUS:
    ; (MINUS a b) or (- a b) - subtract: a - b
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000
    ST    ARITH_B

    LD    ARITH_A
    SUB   ARITH_B         ; a - b
    ADD   #5000
    ST    RESULT
    J     EV_RET

P_TIMES:
    ; (TIMES a b) or (* a b) - multiply
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000

    MULS  ARITH_A         ; a * b
    ADD   #5000
    ST    RESULT
    J     EV_RET

P_QUOTIENT:
    ; (QUOTIENT a b) or (// a b) - integer division
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000
    ST    ARITH_B

    LD    ARITH_A
    DIV   ARITH_B         ; a / b (integer)
    ADD   #5000
    ST    RESULT
    J     EV_RET

P_REMAINDER:
    ; (REMAINDER a b) - remainder after division
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000
    ST    ARITH_B

    ; remainder = a - (a/b)*b
    LD    ARITH_A
    DIV   ARITH_B
    MULS  ARITH_B
    ST    ARITH_C
    LD    ARITH_A
    SUB   ARITH_C
    ADD   #5000
    ST    RESULT
    J     EV_RET

P_LESSP:
    ; (LESSP a b) - T if a < b, NIL otherwise
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000
    ST    ARITH_B

    LD    ARITH_A
    SUB   ARITH_B         ; a - b
    JN    LESSP_TRUE      ; If negative, a < b
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET
LESSP_TRUE:
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET

P_GREATERP:
    ; (GREATERP a b) - T if a > b
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    LD    EV_ARGS
    ST    EV_SAVE1
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    ST    ARITH_A

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
    SUB   #5000
    ST    ARITH_B

    LD    ARITH_B
    SUB   ARITH_A         ; b - a
    JN    GREATERP_TRUE   ; If negative, a > b
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET
GREATERP_TRUE:
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET

P_ZEROP:
    ; (ZEROP n) - T if n = 0
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    SUB   #5000           ; 0 is represented as 5000
    JNZ   ZEROP_FALSE
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
ZEROP_FALSE:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

P_NUMBERP:
    ; (NUMBERP x) - T if x is a number (5000-7999)
    LD    EV_ARGS
    ST    ARG
    JFL   PCAR
    LD    RESULT
    ST    EXPR
    JFL   EVAL
    LD    RESULT
    SUB   #5000
    JN    NUMBERP_FALSE   ; < 5000, not a number
    SUB   #3000           ; Check if < 8000
    JNN   NUMBERP_FALSE   ; >= 8000, not a number
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
NUMBERP_FALSE:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

; Arithmetic temporaries
ARITH_A:      #0
ARITH_B:      #0
ARITH_C:      #0

EV_RET:
    LD    SP
    SUB   #1
    ST    SP
    LDR   SP
    LD    0,R
    ST    0
    JIR   0

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
    JIR   0

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
    JIR   0

; ============================================================================
; PCAR - Primitive CAR
; ============================================================================
PCAR:
    LD    0
    ST    PCAR_LINK

    LD    ARG
    SUB   #3000
    JNN   PCAR_ATOM

    ; Load cell, extract upper 12 bits (CAR)
    LDR   ARG
    LD    0,R
    LDK   #12
    SMRL
    ST    RESULT
    J     PCAR_RET

PCAR_ATOM:
    LD    ARG
    ST    RESULT

PCAR_RET:
    LD    PCAR_LINK
    ST    0
    JIR   0

; ============================================================================
; PCDR - Primitive CDR
; ============================================================================
PCDR:
    LD    0
    ST    PCDR_LINK

    LD    ARG
    SUB   #3000
    JNN   PCDR_ATOM

    ; Load cell, extract lower 12 bits (CDR)
    LDR   ARG
    LD    0,R
    ST    T1
    LDK   #12
    SMRL
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
    JIR   0

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
    JIR   0

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
    ; Bug E fix: READ is re-entrant (RD_LIST_LOOP calls READ for each
    ; element, and RD_QUOTE calls READ for the quoted form). Storing the
    ; caller link in a single global RD_LINK loses the outer caller's
    ; return address - and storing per-call list state in globals like
    ; RD_LIST_END loses the outer build's tail pointer when the inner
    ; RD_LIST overwrites it. Push both onto the SP stack on entry, pop
    ; on RD_RET. Stack frame per READ (SP grows up):
    ;     [SP-2] = caller link (saved JFL link from mem[0])
    ;     [SP-1] = saved RD_LIST_END
    LD    0                ; caller link
    LDR   SP
    ST    0,R              ; mem[SP] = link
    LD    SP
    ADD   #1
    ST    SP               ; SP++
    LD    RD_LIST_END
    LDR   SP
    ST    0,R              ; mem[SP] = RD_LIST_END
    LD    SP
    ADD   #1
    ST    SP               ; SP++

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
    JZ    RD_LIST_DONE    ; EOF inside list - close as if ')'
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
    ; The list was built by consing each new element onto the head, so
    ; (A B C) tape produced (C . (B . (A . NIL))). Reverse in place:
    ;   new = NIL; old = head
    ;   while old != NIL:
    ;       next = CDR(old)
    ;       set CDR(old) = new
    ;       new = old
    ;       old = next
    ;   return new
    LD    #4095
    ST    RD_REV_NEW              ; new = NIL
    LD    RD_LIST_END
    ST    RD_REV_OLD              ; old = head built so far

RD_REV_LOOP:
    LD    RD_REV_OLD
    SUB   #4095
    JZ    RD_REV_DONE             ; old == NIL: finished

    ; T1 = mem[old]  (full cell value: CAR<<12 | CDR)
    LDR   RD_REV_OLD
    LD    0,R
    ST    T1

    ; T2 = CAR(old) = T1 >> 12
    LD    T1
    LDK   #12
    SMRL
    ST    T2

    ; RD_REV_NEXT = CDR(old) = T1 - (CAR << 12)
    LD    T2
    MULS  #4096
    ST    RD_REV_TMP
    LD    T1
    SUB   RD_REV_TMP
    ST    RD_REV_NEXT

    ; mem[old] := (CAR << 12) | new      (rewrite CDR slot to point at new)
    LD    T2
    MULS  #4096
    ADD   RD_REV_NEW
    LDR   RD_REV_OLD
    ST    0,R

    ; new = old; old = next
    LD    RD_REV_OLD
    ST    RD_REV_NEW
    LD    RD_REV_NEXT
    ST    RD_REV_OLD

    J     RD_REV_LOOP

RD_REV_DONE:
    LD    RD_REV_NEW
    ST    RESULT
    J     RD_RET

RD_ATOM:
    ; Read atom name and convert to atom code.
    ;
    ; The reader tracks the first three characters (RD_ABUF/RD_ABUF2/
    ; RD_ABUF3) and the FOURTH character (RD_ABUF4), which between them
    ; suffice to disambiguate every keyword we currently support
    ; (QUOTE/CAR/CDR/CONS/COND/ATOM/EQ/NULL/LAMBDA/LABEL/LIST/CADR/
    ; CADDR/DEFUN/IF) plus the truth atoms T and NIL. We also accept
    ; lowercase input by converting to uppercase as we read, so DEFUN
    ; and defun read the same.
    ;
    ; Numbers are detected at the FIRST char so the digit-accumulation
    ; loop sees every digit (the previous design had RD_ATOM_LOOP
    ; consume the trailing digits before RD_PARSE_NUM ran, leaving
    ; RD_NUM stuck at the first digit's value).
    LD    RD_CH
    SUB   #48             ; '0'
    JN    RD_ATOM_NAME    ; first char < '0' - name path
    SUB   #10
    JNN   RD_ATOM_NAME    ; first char > '9' - name path
    ; First char is a digit - parse number directly from RD_CH onward
    J     RD_PARSE_NUM

RD_ATOM_NAME:
    LD    #0
    ST    RD_ALEN
    LD    #0
    ST    RD_ABUF2
    LD    #0
    ST    RD_ABUF3
    LD    #0
    ST    RD_ABUF4
    LD    RD_CH
    ST    RD_ABUF

RD_ATOM_LOOP:
    JFL   RDCHAR
    ; Check for delimiter
    LD    RD_CH
    JZ    RD_ATOM_END     ; EOF
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

    ; Position-specific char capture: ALEN is the number of chars
    ; read AFTER the first char, so ALEN==0 → save into ABUF2,
    ; ALEN==1 → ABUF3, ALEN==2 → ABUF4. Beyond that we just count.
    LD    RD_ALEN
    JNZ   RD_ATOM_LOOP_2  ; not first iteration → skip ABUF2 store
    LD    RD_CH
    ST    RD_ABUF2
    J     RD_ATOM_INC

RD_ATOM_LOOP_2:
    LD    RD_ALEN
    SUB   #1
    JNZ   RD_ATOM_LOOP_3
    LD    RD_CH
    ST    RD_ABUF3
    J     RD_ATOM_INC

RD_ATOM_LOOP_3:
    LD    RD_ALEN
    SUB   #2
    JNZ   RD_ATOM_INC
    LD    RD_CH
    ST    RD_ABUF4

RD_ATOM_INC:
    LD    RD_ALEN
    ADD   #1
    ST    RD_ALEN
    J     RD_ATOM_LOOP

RD_ATOM_PUSH:
    LD    RD_CH
    ST    RD_PUSHBACK
RD_ATOM_END:
    ; First char must be A-Z to be a name; otherwise dump as letter-A.
    LD    RD_ABUF
    SUB   #65             ; 'A'
    JN    RD_KW_FALLBACK
    SUB   #26
    JNN   RD_KW_FALLBACK

    ; ALEN==0 means single-character input: T → 4094, N → 4095,
    ; everything else → letter atom 3000+(L-A).
    LD    RD_ALEN
    JNZ   RD_KW_MULTI
    LD    RD_ABUF
    SUB   #84             ; 'T'
    JZ    RD_KW_T
    LD    RD_ABUF
    SUB   #78             ; 'N'
    JZ    RD_KW_NIL
    J     RD_KW_LETTER

RD_KW_MULTI:
    ; Multi-char: dispatch on first char.
    LD    RD_ABUF
    SUB   #65             ; 'A'
    JZ    RD_KW_A
    LD    RD_ABUF
    SUB   #67             ; 'C'
    JZ    RD_KW_C
    LD    RD_ABUF
    SUB   #68             ; 'D'
    JZ    RD_KW_D
    LD    RD_ABUF
    SUB   #69             ; 'E'
    JZ    RD_KW_E
    LD    RD_ABUF
    SUB   #73             ; 'I'
    JZ    RD_KW_I
    LD    RD_ABUF
    SUB   #76             ; 'L'
    JZ    RD_KW_L
    LD    RD_ABUF
    SUB   #78             ; 'N'
    JZ    RD_KW_N
    LD    RD_ABUF
    SUB   #81             ; 'Q'
    JZ    RD_KW_Q
    ; Unknown multi-char keyword: fall back to first-letter atom code.
    J     RD_KW_LETTER

RD_KW_A:
    ; A_ : A+T → ATOM (4004); else atom A
    LD    RD_ABUF2
    SUB   #84             ; 'T'
    JZ    RD_KW_ATOM
    J     RD_KW_LETTER

RD_KW_ATOM:
    LD    #4004
    ST    RESULT
    J     RD_RET

RD_KW_C:
    ; C_ : C+A → CADR (if 3rd=D) or CAR; C+D → CDR; C+O → COND/CONS
    LD    RD_ABUF2
    SUB   #65             ; 'A'
    JZ    RD_KW_CA
    LD    RD_ABUF2
    SUB   #68             ; 'D'
    JZ    RD_KW_CD
    LD    RD_ABUF2
    SUB   #79             ; 'O'
    JZ    RD_KW_CO
    J     RD_KW_LETTER

RD_KW_CA:
    ; CA_ : CAR (3rd char R or none beyond), CADR (3rd=D, 4th=R),
    ;       CADDR (3rd=D, 4th=D)
    LD    RD_ABUF3
    SUB   #68             ; 'D'
    JZ    RD_KW_CAD
    LD    #4001           ; CAR
    ST    RESULT
    J     RD_RET

RD_KW_CAD:
    ; CAD_ : 4th=R → CADR; 4th=D → CADDR
    LD    RD_ABUF4
    SUB   #68             ; 'D'
    JZ    RD_KW_CADDR
    LD    #4030           ; CADR
    ST    RESULT
    J     RD_RET

RD_KW_CADDR:
    LD    #4031
    ST    RESULT
    J     RD_RET

RD_KW_CD:
    LD    #4002           ; CDR
    ST    RESULT
    J     RD_RET

RD_KW_CO:
    ; CO_ : CON_ : 4th=D → COND, 4th=S → CONS; default COND
    LD    RD_ABUF4
    SUB   #83             ; 'S'
    JZ    RD_KW_CONS
    LD    #4006           ; COND
    ST    RESULT
    J     RD_RET

RD_KW_CONS:
    LD    #4003
    ST    RESULT
    J     RD_RET

RD_KW_D:
    ; D_ : D+E → DEFUN (4032); else atom D
    LD    RD_ABUF2
    SUB   #69             ; 'E'
    JZ    RD_KW_DEFUN
    J     RD_KW_LETTER

RD_KW_DEFUN:
    LD    #4032           ; DEFUN
    ST    RESULT
    J     RD_RET

RD_KW_E:
    ; E_ : E+Q → EQ; else atom E
    LD    RD_ABUF2
    SUB   #81             ; 'Q'
    JZ    RD_KW_EQ
    J     RD_KW_LETTER

RD_KW_EQ:
    LD    #4005
    ST    RESULT
    J     RD_RET

RD_KW_I:
    ; I_ : I+F → IF (4033); else atom I
    LD    RD_ABUF2
    SUB   #70             ; 'F'
    JZ    RD_KW_IF
    J     RD_KW_LETTER

RD_KW_IF:
    LD    #4033
    ST    RESULT
    J     RD_RET

RD_KW_L:
    ; L_ : L+A → LAMBDA/LABEL; L+I → LIST; else atom L
    LD    RD_ABUF2
    SUB   #65             ; 'A'
    JZ    RD_KW_LA
    LD    RD_ABUF2
    SUB   #73             ; 'I'
    JZ    RD_KW_LI
    J     RD_KW_LETTER

RD_KW_LA:
    ; LA_ : 3rd=M → LAMBDA; 3rd=B → LABEL; default LAMBDA
    LD    RD_ABUF3
    SUB   #66             ; 'B'
    JZ    RD_KW_LABEL
    LD    #4007           ; LAMBDA
    ST    RESULT
    J     RD_RET

RD_KW_LABEL:
    LD    #4008
    ST    RESULT
    J     RD_RET

RD_KW_LI:
    LD    #4011           ; LIST
    ST    RESULT
    J     RD_RET

RD_KW_N:
    ; N_ : N+U → NULL; else NIL
    LD    RD_ABUF2
    SUB   #85             ; 'U'
    JZ    RD_KW_NULL
    J     RD_KW_NIL

RD_KW_NULL:
    LD    #4010
    ST    RESULT
    J     RD_RET

RD_KW_Q:
    ; Q_ : any 2-char+ Q-name → QUOTE
    LD    #4000
    ST    RESULT
    J     RD_RET

RD_KW_T:
    LD    #4094
    ST    RESULT
    J     RD_RET

RD_KW_NIL:
    LD    #4095
    ST    RESULT
    J     RD_RET

RD_KW_LETTER:
    ; First char A-Z, not a recognised keyword: encode as 3000+(L-A).
    LD    RD_ABUF
    SUB   #65
    ADD   #3000
    ST    RESULT
    J     RD_RET

RD_KW_FALLBACK:
    ; Non-letter first char (and not a digit, since digits routed
    ; to RD_PARSE_NUM at entry). Treat as NIL.
    LD    #4095
    ST    RESULT
    J     RD_RET

RD_PARSE_NUM:
    ; Number parser. RD_CH already holds the first digit. We accumulate
    ; into RD_NUM as we read more digits, stop at the first non-digit
    ; (which we push back so the caller's parser sees it as a delimiter).
    LD    RD_CH
    SUB   #48             ; first digit value
    ST    RD_NUM

RD_NUM_LOOP:
    JFL   RDCHAR
    LD    RD_CH
    JZ    RD_NUM_DONE     ; EOF terminates the number
    LD    RD_CH
    SUB   #48
    JN    RD_NUM_PUSHBACK ; not a digit
    SUB   #10
    JNN   RD_NUM_PUSHBACK ; not a digit
    ; digit: RD_NUM = RD_NUM*10 + digit
    LD    RD_NUM
    MULS  #10
    ST    RD_NUM
    LD    RD_CH
    SUB   #48
    ADD   RD_NUM
    ST    RD_NUM
    J     RD_NUM_LOOP

RD_NUM_PUSHBACK:
    LD    RD_CH
    ST    RD_PUSHBACK
RD_NUM_DONE:
    LD    RD_NUM
    ADD   #5000
    ST    RESULT
    J     RD_RET

; (Lowercase folding happens inline in RDCHAR after each tape read.)

RD_RET:
    ; Unwind READ's two-word stack frame (link + RD_LIST_END).
    ; Pop RD_LIST_END first, then the link.
    LD    SP
    SUB   #1
    ST    SP
    LDR   SP
    LD    0,R              ; M = saved RD_LIST_END
    ST    RD_LIST_END
    LD    SP
    SUB   #1
    ST    SP
    LDR   SP
    LD    0,R              ; M = saved link
    ST    0                ; mem[0] = link for JIR
    JIR   0

; ============================================================================
; RDCHAR - Read one 6-bit character from paper tape (Channel 1)
; Output: RD_CH = 6-bit character read (or 0 if EOF)
; Uses IDUM instruction: F=76, Y=0, N=0o20001
; Note: Elliott 4130 uses 6-bit characters ("6-bit bytes"), not 8-bit octets
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
    ; Read one 6-bit character from paper tape reader (Channel 1)
    ; IDUM 1 reads from channel 1, result goes to M register
    ; Historically authentic: this is how Elliott 4130 read paper tape
    IDUM  1             ; Read 6-bit char from tape reader to M
    ST    RD_CH         ; Store result

    ; Fold lowercase 'a'..'z' to 'A'..'Z' so the reader accepts both
    ; DEFUN and defun, etc. (ASCII 97..122 → subtract 32.) The cli.mjs
    ; tape uses 7-bit ASCII so this is sound; non-letter codes are
    ; outside the 97..122 range and pass through unchanged.
    LD    RD_CH
    SUB   #97            ; 'a'
    JN    RDCH_RET       ; < 'a' - leave as-is
    SUB   #26
    JNN   RDCH_RET       ; > 'z' - leave as-is
    LD    RD_CH
    SUB   #32            ; convert to upper
    ST    RD_CH

RDCH_RET:
    LD    RDCH_LINK
    ST    0
    JIR   0

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
RD_ABUF2:     #0           ; second char of atom name (for CAR/CDR/QUOTE)
RD_ABUF3:     #0           ; third char (for COND/LAMBDA disambiguation)
RD_ABUF4:     #0           ; fourth char (for COND vs CONS, CADR vs CADDR)
RD_NUM:       #0
RDCH_LINK:    #0
; Reverse-list state (used by RD_LIST_DONE)
RD_REV_NEW:   #0
RD_REV_OLD:   #0
RD_REV_NEXT:  #0
RD_REV_TMP:   #0

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

; (removed stray '100: #0' directive that clobbered code at word 100)
