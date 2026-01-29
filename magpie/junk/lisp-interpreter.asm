; ============================================================================
; LISP 1.5 Interpreter for Elliott 4130
; ============================================================================
; A McCarthy LISP interpreter in NEAT 4100 assembly language
; Uses manual return address stack (4130 has no CALL/RET instructions)
;
; Memory Map:
;   100-199  : Results and caller-visible data
;   200-399  : Work registers organized by function
;   400-499  : Return address stack (RET_STACK)
;   500-599  : Data stack (for EVLIS recursion)
;   600-699  : Environment frames
;   1000+    : Cons cell heap
;
; Cell Format: [CAR:12bits | CDR:12bits] in 24-bit word
;
; Atoms (self-quoting):
;   NIL    = 4095
;   T      = 4094
;   Numbers: 0-3071 (direct encoding)
;
; Symbols:
;   A-Z    = 3072-3097
;   QUOTE  = 3082
;   LAMBDA = 3081
;   COND   = 3080
;
; Primitives:
;   CAR    = 3100
;   CDR    = 3101
;   CONS   = 3102
;   ATOM   = 3103
;   EQ     = 3104
;   NULL   = 3105
; ============================================================================

; ============================================================================
; Example: EVAL (QUOTE A) with empty environment
; Sets up expression and calls interpreter
; ============================================================================
START:
    ; Initialize stacks
    LD    #400
    ST    RSP             ; Return stack pointer
    LD    #500
    ST    DSP             ; Data stack pointer
    LD    #1000
    ST    HEAP            ; Heap pointer

    ; Build (QUOTE A) = (3082 . cell_with_A)
    ; First: (A . NIL) at heap
    LD    #3072           ; A
    MULS  #4096
    ADD   #4095           ; NIL
    LD    HEAP
    ST    TEMP1
    LDR   TEMP1
    ST    0,R
    LD    HEAP
    ST    CELL1           ; CELL1 = address of (A . NIL)
    ADD   #1
    ST    HEAP

    ; Now: (QUOTE . CELL1) at heap
    LD    #3082           ; QUOTE
    MULS  #4096
    ADD   CELL1
    LD    HEAP
    ST    TEMP1
    LDR   TEMP1
    ST    0,R
    LD    HEAP
    ST    EXPR            ; EXPR = (QUOTE A)
    ADD   #1
    ST    HEAP

    ; Empty environment (NIL)
    LD    #4095
    ST    ENV

    ; Call EVAL(EXPR, ENV)
    LD    EXPR
    ST    EV_E
    LD    ENV
    ST    EV_A
    LD    #MAIN_RET       ; Return address
    ST    RET_ADDR
    J     EVAL

MAIN_RET:
    ; RESULT contains the answer
    LD    RESULT
    ST    100             ; Store final result at 100
    J     HALT

; ============================================================================
; EVAL(e, a) - Universal Evaluator
; Input:  EV_E (200) = expression
;         EV_A (201) = environment
;         RET_ADDR (202) = return address
; Output: RESULT (100)
; ============================================================================
EVAL:
    ; Save return address on stack
    LD    RSP
    ST    RSP_TEMP
    LDR   RSP_TEMP
    LD    RET_ADDR
    ST    0,R
    LD    RSP
    ADD   #1
    ST    RSP

    ; Check if e is an atom (>= 3072)
    LD    EV_E
    SUB   #3072
    JN    EV_LIST         ; e < 3072, it's a cons cell address

    ; e is atom - check for self-evaluating
    LD    EV_E
    SUB   #4094           ; T = 4094
    JZ    EV_SELF
    LD    EV_E
    SUB   #4095           ; NIL = 4095
    JZ    EV_SELF
    LD    EV_E
    SUB   #3072
    JN    EV_NUMBER       ; Numbers 0-3071 self-evaluate

    ; e is a symbol variable - look up in environment
    J     EV_LOOKUP

EV_NUMBER:
    ; Number (0-3071) - self-evaluating
    LD    EV_E
    ST    RESULT
    J     EV_RET

EV_SELF:
    ; NIL or T - self-evaluating
    LD    EV_E
    ST    RESULT
    J     EV_RET

EV_LOOKUP:
    ; Look up symbol in environment
    LD    EV_E
    ST    AS_X            ; key to look up
    LD    EV_A
    ST    AS_A            ; assoc list
    J     ASSOC_INLINE
    ; RESULT now contains the value
    J     EV_RET

EV_LIST:
    ; e is a cons cell - get CAR(e)
    LD    EV_E
    ST    CAR_IN
    J     CAR_INLINE
    ; RESULT = car(e)
    LD    RESULT
    ST    EV_FN           ; function/special form

    ; Check for QUOTE (3082)
    LD    EV_FN
    SUB   #3082
    JZ    EV_QUOTE

    ; Check for COND (3080)
    LD    EV_FN
    SUB   #3080
    JZ    EV_COND

    ; Check for LAMBDA (inline application)
    LD    EV_FN
    SUB   #3072
    JN    EV_APPLY_LAMBDA ; FN is a list (LAMBDA form)

    ; FN is an atom - primitive or user function
    ; First evaluate arguments with EVLIS
    LD    EV_E
    ST    CDR_IN
    J     CDR_INLINE      ; cdr(e) = arguments
    LD    RESULT
    ST    EL_M            ; args to evaluate
    LD    EV_A
    ST    EL_A
    ; Save EV_FN on data stack
    LD    DSP
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EV_FN
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    ; Save EV_A
    LDR   DSP_TEMP
    ADD   #1
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EV_A
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    ; Call EVLIS
    LD    #EV_ARGS_RET
    ST    RET_ADDR
    J     EVLIS

EV_ARGS_RET:
    ; Restore EV_A and EV_FN from stack
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EV_A
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EV_FN
    ; RESULT = evaluated args
    LD    RESULT
    ST    EV_ARGS

    ; Dispatch on primitive
    ; CAR (3100)
    LD    EV_FN
    SUB   #3100
    JZ    EV_PRIM_CAR
    ; CDR (3101)
    LD    EV_FN
    SUB   #3101
    JZ    EV_PRIM_CDR
    ; CONS (3102)
    LD    EV_FN
    SUB   #3102
    JZ    EV_PRIM_CONS
    ; ATOM (3103)
    LD    EV_FN
    SUB   #3103
    JZ    EV_PRIM_ATOM
    ; EQ (3104)
    LD    EV_FN
    SUB   #3104
    JZ    EV_PRIM_EQ

    ; User-defined function - look up and apply
    LD    EV_FN
    ST    AS_X
    LD    EV_A
    ST    AS_A
    J     ASSOC_INLINE
    ; RESULT = function definition
    LD    RESULT
    ST    AP_FN
    LD    EV_ARGS
    ST    AP_X
    LD    EV_A
    ST    AP_A
    LD    #EV_RET
    ST    RET_ADDR
    J     APPLY

; --- Primitive: CAR ---
EV_PRIM_CAR:
    ; (CAR x) -> car(car(evaled-args))
    LD    EV_ARGS
    ST    CAR_IN
    J     CAR_INLINE      ; get first arg
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; car of that arg
    J     EV_RET

; --- Primitive: CDR ---
EV_PRIM_CDR:
    LD    EV_ARGS
    ST    CAR_IN
    J     CAR_INLINE      ; get first arg
    LD    RESULT
    ST    CDR_IN
    J     CDR_INLINE      ; cdr of that arg
    J     EV_RET

; --- Primitive: CONS ---
EV_PRIM_CONS:
    ; (CONS a b) -> build cell
    LD    EV_ARGS
    ST    CAR_IN
    J     CAR_INLINE      ; first arg
    LD    RESULT
    ST    CONS_A
    LD    EV_ARGS
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; second arg
    LD    RESULT
    ST    CONS_D
    J     CONS_INLINE
    J     EV_RET

; --- Primitive: ATOM ---
EV_PRIM_ATOM:
    LD    EV_ARGS
    ST    CAR_IN
    J     CAR_INLINE      ; get arg
    LD    RESULT
    SUB   #3072
    JN    EV_ATOM_NO
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
EV_ATOM_NO:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

; --- Primitive: EQ ---
EV_PRIM_EQ:
    LD    EV_ARGS
    ST    CAR_IN
    J     CAR_INLINE      ; first arg
    LD    RESULT
    ST    EQ_X
    LD    EV_ARGS
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; second arg
    LD    RESULT
    SUB   EQ_X
    JNZ   EV_EQ_NO
    LD    #4094           ; T
    ST    RESULT
    J     EV_RET
EV_EQ_NO:
    LD    #4095           ; NIL
    ST    RESULT
    J     EV_RET

; --- QUOTE ---
EV_QUOTE:
    ; (QUOTE x) -> cadr(e)
    LD    EV_E
    ST    CDR_IN
    J     CDR_INLINE      ; cdr(e)
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; car(cdr(e))
    J     EV_RET

; --- COND ---
EV_COND:
    ; (COND clauses...) -> evcon(cdr(e), a)
    LD    EV_E
    ST    CDR_IN
    J     CDR_INLINE      ; clauses
    LD    RESULT
    ST    EC_C
    LD    EV_A
    ST    EC_A
    LD    #EV_RET
    ST    RET_ADDR
    J     EVCON

; --- Inline LAMBDA ---
EV_APPLY_LAMBDA:
    ; ((LAMBDA params body) args)
    ; FN = (LAMBDA params body), still in EV_FN area
    ; First eval args
    LD    EV_E
    ST    CDR_IN
    J     CDR_INLINE      ; args
    LD    RESULT
    ST    EL_M
    LD    EV_A
    ST    EL_A
    ; Save (LAMBDA ...) on stack
    LD    DSP
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EV_E
    ST    CAR_IN
    J     CAR_INLINE_SAVE ; Get lambda form
EV_LAM_SAVE:
    LD    RESULT          ; lambda form
    LDR   DSP_TEMP
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    ; Save env
    LDR   DSP_TEMP
    ADD   #1
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EV_A
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    ; Call EVLIS for args
    LD    #EV_LAM_RET
    ST    RET_ADDR
    J     EVLIS

EV_LAM_RET:
    ; Pop saved values
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    AP_A            ; env
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    AP_FN           ; lambda form
    LD    RESULT
    ST    AP_X            ; evaled args
    LD    #EV_RET
    ST    RET_ADDR
    J     APPLY

CAR_INLINE_SAVE:
    ; Car but continue to EV_LAM_SAVE
    LD    CAR_IN
    LDR   CAR_IN
    LD    0,R
    DIV   #4096
    ST    RESULT
    J     EV_LAM_SAVE

; --- EVAL return ---
EV_RET:
    ; Pop return address and jump
    LD    RSP
    SUB   #1
    ST    RSP
    LDR   RSP
    LD    0,R
    ST    JUMP_ADDR
    ; Jump indirect through JUMP_ADDR
    ; (4130 doesn't have indirect jump, so we use a switch)
    LD    JUMP_ADDR
    SUB   #MAIN_RET
    JZ    JMP_MAIN_RET
    LD    JUMP_ADDR
    SUB   #EV_ARGS_RET
    JZ    JMP_EV_ARGS_RET
    LD    JUMP_ADDR
    SUB   #EV_RET
    JZ    JMP_EV_RET2
    LD    JUMP_ADDR
    SUB   #EV_LAM_RET
    JZ    JMP_EV_LAM_RET
    LD    JUMP_ADDR
    SUB   #EL_REC_RET
    JZ    JMP_EL_REC_RET
    LD    JUMP_ADDR
    SUB   #EC_RET
    JZ    JMP_EC_RET
    ; Unknown return - halt
    J     HALT

JMP_MAIN_RET:    J MAIN_RET
JMP_EV_ARGS_RET: J EV_ARGS_RET
JMP_EV_RET2:     J EV_RET
JMP_EV_LAM_RET:  J EV_LAM_RET
JMP_EL_REC_RET:  J EL_REC_RET
JMP_EC_RET:      J EC_RET

; ============================================================================
; APPLY(fn, x, a) - Apply function to arguments
; Input:  AP_FN (230) = function (LAMBDA params body)
;         AP_X  (231) = evaluated argument values
;         AP_A  (232) = environment
; ============================================================================
APPLY:
    ; Push return addr
    LD    RSP
    ST    RSP_TEMP
    LDR   RSP_TEMP
    LD    RET_ADDR
    ST    0,R
    LD    RSP
    ADD   #1
    ST    RSP

    ; fn should be (LAMBDA params body)
    ; Get params = cadr(fn)
    LD    AP_FN
    ST    CDR_IN
    J     CDR_INLINE      ; (params body)
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; params
    LD    RESULT
    ST    AP_PARAMS

    ; Get body = caddr(fn)
    LD    AP_FN
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    CDR_IN
    J     CDR_INLINE      ; (body)
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; body
    LD    RESULT
    ST    AP_BODY

    ; Build new environment: pairlis(params, x) prepended to a
    ; For simplicity, just bind first param to first arg
    ; Full pairlis would be recursive
    LD    AP_PARAMS
    SUB   #4095           ; NIL?
    JZ    AP_NO_PARAMS

    ; Get first param
    LD    AP_PARAMS
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    ST    AP_P1           ; first param name

    ; Get first arg value
    LD    AP_X
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    ST    AP_V1           ; first arg value

    ; Build binding (param . value)
    LD    AP_P1
    ST    CONS_A
    LD    AP_V1
    ST    CONS_D
    J     CONS_INLINE     ; (p1 . v1)
    LD    RESULT
    ST    AP_BIND

    ; Prepend to env: ((p1.v1) . old-env)
    LD    AP_BIND
    ST    CONS_A
    LD    AP_A
    ST    CONS_D
    J     CONS_INLINE
    LD    RESULT
    ST    AP_NEWENV

    J     AP_EVAL_BODY

AP_NO_PARAMS:
    LD    AP_A
    ST    AP_NEWENV

AP_EVAL_BODY:
    ; EVAL(body, new-env)
    LD    AP_BODY
    ST    EV_E
    LD    AP_NEWENV
    ST    EV_A
    J     EVAL            ; Tail call - uses our return addr

; ============================================================================
; EVLIS(m, a) - Evaluate list of arguments
; Input:  EL_M (250) = list of expressions
;         EL_A (251) = environment
; Output: RESULT = list of values
; ============================================================================
EVLIS:
    ; Push return addr
    LD    RSP
    ST    RSP_TEMP
    LDR   RSP_TEMP
    LD    RET_ADDR
    ST    0,R
    LD    RSP
    ADD   #1
    ST    RSP

    ; Base case: m = NIL
    LD    EL_M
    SUB   #4095
    JZ    EL_NIL

    ; Save m, a on data stack
    LD    DSP
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EL_M
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    LDR   DSP_TEMP
    ADD   #1
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EL_A
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP

    ; Eval first: eval(car(m), a)
    LD    EL_M
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    ST    EV_E
    LD    EL_A
    ST    EV_A
    LD    #EL_REC_RET
    ST    RET_ADDR
    J     EVAL

EL_REC_RET:
    ; RESULT = value of car(m)
    LD    RESULT
    ST    EL_FIRST

    ; Pop m, a
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EL_A
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EL_M

    ; Save first value
    LD    DSP
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EL_FIRST
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP

    ; Recurse: evlis(cdr(m), a)
    LD    EL_M
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    EL_M
    LD    #EL_CONS_RET
    ST    RET_ADDR
    J     EVLIS

EL_CONS_RET:
    ; Pop first value
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EL_FIRST

    ; cons(first, rest)
    LD    EL_FIRST
    ST    CONS_A
    LD    RESULT
    ST    CONS_D
    J     CONS_INLINE
    J     EL_RET

EL_NIL:
    LD    #4095
    ST    RESULT

EL_RET:
    ; Pop return and jump
    LD    RSP
    SUB   #1
    ST    RSP
    LDR   RSP
    LD    0,R
    ST    JUMP_ADDR
    ; Dispatch
    LD    JUMP_ADDR
    SUB   #EV_ARGS_RET
    JZ    JMP_EV_ARGS_RET
    LD    JUMP_ADDR
    SUB   #EV_LAM_RET
    JZ    JMP_EV_LAM_RET
    LD    JUMP_ADDR
    SUB   #EL_CONS_RET
    JZ    JMP_EL_CONS_RET
    J     HALT

JMP_EL_CONS_RET: J EL_CONS_RET

; ============================================================================
; EVCON(c, a) - Evaluate conditional clauses
; Input:  EC_C (260) = ((test1 val1) (test2 val2) ...)
;         EC_A (261) = environment
; ============================================================================
EVCON:
    ; Push return
    LD    RSP
    ST    RSP_TEMP
    LDR   RSP_TEMP
    LD    RET_ADDR
    ST    0,R
    LD    RSP
    ADD   #1
    ST    RSP

    ; Base: c = NIL
    LD    EC_C
    SUB   #4095
    JZ    EC_NIL

    ; Get first clause
    LD    EC_C
    ST    CAR_IN
    J     CAR_INLINE      ; (test val)
    LD    RESULT
    ST    EC_CL

    ; Save c, a, clause on stack
    LD    DSP
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EC_C
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    LDR   DSP_TEMP
    ADD   #1
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EC_A
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP
    LDR   DSP_TEMP
    ADD   #1
    ST    DSP_TEMP
    LDR   DSP_TEMP
    LD    EC_CL
    ST    0,R
    LD    DSP
    ADD   #1
    ST    DSP

    ; Eval test = car(clause)
    LD    EC_CL
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    ST    EV_E
    LD    EC_A
    ST    EV_A
    LD    #EC_TEST_RET
    ST    RET_ADDR
    J     EVAL

EC_TEST_RET:
    ; Pop clause, a, c
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EC_CL
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EC_A
    LD    DSP
    SUB   #1
    ST    DSP
    LDR   DSP
    LD    0,R
    ST    EC_C

    ; Check test result
    LD    RESULT
    SUB   #4095           ; NIL?
    JZ    EC_NEXT

    ; Test passed - eval cadr(clause)
    LD    EC_CL
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    CAR_IN
    J     CAR_INLINE      ; value expr
    LD    RESULT
    ST    EV_E
    LD    EC_A
    ST    EV_A
    J     EVAL            ; Tail call

EC_NEXT:
    ; Try next clause
    LD    EC_C
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    EC_C
    J     EVCON           ; Tail call

EC_NIL:
    LD    #4095
    ST    RESULT

EC_RET:
    ; Pop and return
    LD    RSP
    SUB   #1
    ST    RSP
    LDR   RSP
    LD    0,R
    ST    JUMP_ADDR
    LD    JUMP_ADDR
    SUB   #EV_RET
    JZ    JMP_EV_RET3
    J     HALT

JMP_EV_RET3: J EV_RET

; ============================================================================
; ASSOC inline - look up key in a-list
; Input:  AS_X (270) = key
;         AS_A (271) = ((k1.v1) (k2.v2) ...)
; Output: RESULT = value or NIL
; ============================================================================
ASSOC_INLINE:
    ; Base: a = NIL
    LD    AS_A
    SUB   #4095
    JZ    AS_NIL

    ; Get first pair
    LD    AS_A
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    ST    AS_P            ; (key . value)

    ; Compare car(pair) with x
    LD    AS_P
    ST    CAR_IN
    J     CAR_INLINE
    LD    RESULT
    SUB   AS_X
    JZ    AS_FOUND

    ; Try rest
    LD    AS_A
    ST    CDR_IN
    J     CDR_INLINE
    LD    RESULT
    ST    AS_A
    J     ASSOC_INLINE

AS_FOUND:
    ; Return cdr(pair)
    LD    AS_P
    ST    CDR_IN
    J     CDR_INLINE
    J     EV_LOOKUP_RET

AS_NIL:
    LD    #4095
    ST    RESULT

EV_LOOKUP_RET:
    J     EV_RET

; ============================================================================
; CAR/CDR/CONS inline operations
; ============================================================================

; CAR: M = car(CAR_IN)
CAR_INLINE:
    LD    CAR_IN
    LDR   CAR_IN
    LD    0,R             ; Load cell
    DIV   #4096           ; Extract CAR
    ST    RESULT
    ; Return based on context (caller handles)
    J     CAR_RET

CAR_RET:
    ; Context-dependent return (set by caller before jumping here)
    ; For now, just continue after CAR_INLINE call
    J     HALT            ; Should not reach

; CDR: M = cdr(CDR_IN)
CDR_INLINE:
    LD    CDR_IN
    LDR   CDR_IN
    LD    0,R             ; Load cell
    ST    CDR_TEMP
    DIV   #4096           ; CAR
    MULS  #4096           ; CAR * 4096
    ST    CDR_TEMP2
    LD    CDR_TEMP
    SUB   CDR_TEMP2       ; cell - CAR*4096 = CDR
    ST    RESULT
    J     CDR_RET

CDR_RET:
    J     HALT

; CONS: allocate (CONS_A . CONS_D)
CONS_INLINE:
    LD    HEAP
    ST    NEW_CELL
    LD    CONS_A
    MULS  #4096
    ADD   CONS_D
    LDR   NEW_CELL
    ST    0,R
    LD    HEAP
    ADD   #1
    ST    HEAP
    LD    NEW_CELL
    ST    RESULT
    J     CONS_RET

CONS_RET:
    J     HALT

; ============================================================================
; HALT
; ============================================================================
HALT: J HALT

; ============================================================================
; Data Section - all variables with reserved addresses
; ============================================================================

; Results
RESULT:   #0             ; 100 - Final result

; General temps
TEMP1:    #0             ; 101
CELL1:    #0             ; 102

; Input expression and environment
EXPR:     #0             ; 110
ENV:      #0             ; 111

; EVAL variables (200-229)
EV_E:     #0             ; 200 - expression
EV_A:     #0             ; 201 - environment
RET_ADDR: #0             ; 202 - return address
EV_FN:    #0             ; 203 - car(e)
EV_ARGS:  #0             ; 204 - evaluated args
EQ_X:     #0             ; 205

; APPLY variables (230-249)
AP_FN:    #0             ; 230
AP_X:     #0             ; 231
AP_A:     #0             ; 232
AP_PARAMS: #0            ; 233
AP_BODY:  #0             ; 234
AP_P1:    #0             ; 235
AP_V1:    #0             ; 236
AP_BIND:  #0             ; 237
AP_NEWENV: #0            ; 238

; EVLIS variables (250-259)
EL_M:     #0             ; 250
EL_A:     #0             ; 251
EL_FIRST: #0             ; 252

; EVCON variables (260-269)
EC_C:     #0             ; 260
EC_A:     #0             ; 261
EC_CL:    #0             ; 262

; ASSOC variables (270-279)
AS_X:     #0             ; 270
AS_A:     #0             ; 271
AS_P:     #0             ; 272

; CAR/CDR/CONS work (280-289)
CAR_IN:   #0             ; 280
CDR_IN:   #0             ; 281
CDR_TEMP: #0             ; 282
CDR_TEMP2: #0            ; 283
CONS_A:   #0             ; 284
CONS_D:   #0             ; 285
NEW_CELL: #0             ; 286

; Stack pointers
RSP:      #0             ; 290 - Return stack pointer
RSP_TEMP: #0             ; 291
DSP:      #0             ; 292 - Data stack pointer
DSP_TEMP: #0             ; 293
HEAP:     #0             ; 294 - Heap pointer

; Jump dispatch
JUMP_ADDR: #0            ; 295

; Return address stack at 400-499
; Data stack at 500-599
; Heap starts at 1000
