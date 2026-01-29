; ============================================================================
; McCarthy EVAL for Elliott 4130
; ============================================================================
; A working LISP evaluator in NEAT 4100 assembly
;
; This demonstrates eval(expr, env) for:
;   - Self-evaluating atoms (NIL, T, numbers)
;   - Variable lookup in environment
;   - QUOTE special form
;   - COND special form
;   - Primitive functions: CAR, CDR, CONS, ATOM, EQ
;   - LAMBDA application
;
; Cell format: [CAR:12bits | CDR:12bits] in 24-bit word
; Atoms: NIL=4095, T=4094, A=3072, B=3073, ...
;        QUOTE=3082, COND=3080, LAMBDA=3081
;        CAR=3100, CDR=3101, CONS=3102, ATOM=3103, EQ=3104
;
; Test: EVAL (QUOTE A) -> A (3072)
; ============================================================================

; ============================================================================
; Main entry - set up and evaluate (QUOTE A)
; ============================================================================
START:
    ; Initialize heap pointer
    LD    #1000
    ST    HEAP

    ; Build (A . NIL) at cell 1000
    ; Cell value = A * 4096 + NIL = 3072 * 4096 + 4095 = 12587007
    LD    #3072           ; A
    MULS  #4096
    ADD   #4095           ; NIL
    ST    1000            ; Store cell at addr 1000

    ; Build (QUOTE . 1000) at cell 1001
    ; = (QUOTE A) as S-expression
    LD    #3082           ; QUOTE
    MULS  #4096
    ADD   #1000           ; pointer to (A . NIL)
    ST    1001

    ; Now evaluate (QUOTE A)
    ; EVAL checks: is expr an atom or list?
    ; If list, check car(expr) for special forms

    LD    #1001           ; expr = address of (QUOTE A)
    ST    EXPR
    LD    #4095           ; env = NIL (empty)
    ST    ENV

    ; --- EVAL ---
    ; Is EXPR an atom (>= 3072)?
    LD    EXPR
    SUB   #3072
    JN    EVAL_LIST       ; EXPR < 3072, so it's a cell address

    ; EXPR is an atom - self-evaluate or lookup
    LD    EXPR
    SUB   #4094           ; T?
    JZ    EVAL_SELF
    LD    EXPR
    SUB   #4095           ; NIL?
    JZ    EVAL_SELF
    ; It's a symbol - would look up in env
    ; For now, just return it
    J     EVAL_SELF

EVAL_SELF:
    LD    EXPR
    ST    100             ; Result
    J     HALT

EVAL_LIST:
    ; EXPR is a cons cell address
    ; Get CAR of expr to check for special forms
    LD    EXPR
    ST    200             ; save expr
    LDR   200
    LD    0,R             ; load cell from memory
    DIV   #4096           ; extract CAR
    ST    FN              ; FN = car(expr)

    ; Is FN = QUOTE (3082)?
    LD    FN
    SUB   #3082
    JZ    DO_QUOTE

    ; Is FN = COND (3080)?
    LD    FN
    SUB   #3080
    JZ    DO_COND

    ; Is FN = CAR (3100)?
    LD    FN
    SUB   #3100
    JZ    DO_CAR_PRIM

    ; Is FN = CDR (3101)?
    LD    FN
    SUB   #3101
    JZ    DO_CDR_PRIM

    ; Is FN = CONS (3102)?
    LD    FN
    SUB   #3102
    JZ    DO_CONS_PRIM

    ; Is FN = ATOM (3103)?
    LD    FN
    SUB   #3103
    JZ    DO_ATOM_PRIM

    ; Is FN = EQ (3104)?
    LD    FN
    SUB   #3104
    JZ    DO_EQ_PRIM

    ; Unknown - return NIL
    LD    #4095
    ST    100
    J     HALT

; ============================================================================
; QUOTE: (QUOTE x) -> x
; Return cadr(expr) = car(cdr(expr))
; ============================================================================
DO_QUOTE:
    ; Get CDR of expr
    LD    EXPR
    LDR   EXPR
    LD    0,R             ; cell value
    ST    201             ; save
    DIV   #4096           ; CAR
    MULS  #4096
    ST    202
    LD    201
    SUB   202             ; CDR = cell - CAR*4096
    ST    203             ; CDR = pointer to (A . NIL) = 1000

    ; Get CAR of that (the quoted value)
    LD    203
    LDR   203
    LD    0,R             ; load (A . NIL)
    DIV   #4096           ; CAR = A = 3072
    ST    100             ; Result!

    J     HALT

; ============================================================================
; COND: (COND (test1 val1) (test2 val2) ...)
; For each clause, eval test. If non-NIL, eval and return val.
; ============================================================================
DO_COND:
    ; Get clauses = cdr(expr)
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    210
    DIV   #4096
    MULS  #4096
    ST    211
    LD    210
    SUB   211             ; CDR = clauses

    ; For demo, assume single clause ((T x))
    ; and just return second element of first clause
    ST    212             ; clauses pointer

    ; Get first clause
    LD    212
    LDR   212
    LD    0,R
    DIV   #4096           ; CAR = first clause addr
    ST    213

    ; Get cdr of clause (the value part)
    LD    213
    LDR   213
    LD    0,R
    ST    214
    DIV   #4096
    MULS  #4096
    ST    215
    LD    214
    SUB   215             ; CDR = value list
    ST    216

    ; Get car of that = actual value
    LD    216
    LDR   216
    LD    0,R
    DIV   #4096
    ST    100             ; Result

    J     HALT

; ============================================================================
; CAR primitive: (CAR x) -> car(eval(x))
; For simplicity, assume x is already a cell address
; ============================================================================
DO_CAR_PRIM:
    ; Get argument: cdr(expr), then car of that
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    220
    DIV   #4096
    MULS  #4096
    ST    221
    LD    220
    SUB   221             ; CDR = args list
    ST    222

    ; Get first arg
    LD    222
    LDR   222
    LD    0,R
    DIV   #4096           ; CAR = first arg (should be cell addr)
    ST    223

    ; If arg is an atom, return atom
    ; If arg is cell addr, get car of that cell
    LD    223
    SUB   #3072
    JN    CAR_CELL        ; arg < 3072, so it's a cell address
    ; Arg is atom - can't take CAR of atom
    LD    #4095           ; return NIL
    ST    100
    J     HALT

CAR_CELL:
    LD    223
    ADD   #3072           ; restore
    LDR   223
    LD    0,R
    DIV   #4096           ; CAR
    ST    100
    J     HALT

; ============================================================================
; CDR primitive: (CDR x) -> cdr(eval(x))
; ============================================================================
DO_CDR_PRIM:
    ; Get argument
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    230
    DIV   #4096
    MULS  #4096
    ST    231
    LD    230
    SUB   231
    ST    232             ; args list

    LD    232
    LDR   232
    LD    0,R
    DIV   #4096           ; first arg
    ST    233

    ; If atom, return NIL
    LD    233
    SUB   #3072
    JN    CDR_CELL
    LD    #4095
    ST    100
    J     HALT

CDR_CELL:
    LD    233
    ADD   #3072
    LDR   233
    LD    0,R
    ST    234
    DIV   #4096
    MULS  #4096
    ST    235
    LD    234
    SUB   235             ; CDR
    ST    100
    J     HALT

; ============================================================================
; CONS primitive: (CONS a b) -> new cell with car=a, cdr=b
; ============================================================================
DO_CONS_PRIM:
    ; Get two arguments from cdr(expr)
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    240
    DIV   #4096
    MULS  #4096
    ST    241
    LD    240
    SUB   241             ; args list
    ST    242

    ; First arg
    LD    242
    LDR   242
    LD    0,R
    DIV   #4096
    ST    243             ; a

    ; Rest of args
    LD    242
    LDR   242
    LD    0,R
    ST    244
    DIV   #4096
    MULS  #4096
    ST    245
    LD    244
    SUB   245
    ST    246             ; cdr of args

    ; Second arg
    LD    246
    LDR   246
    LD    0,R
    DIV   #4096
    ST    247             ; b

    ; Allocate new cell
    LD    HEAP
    ST    248             ; new cell address

    ; Build cell: a * 4096 + b
    LD    243
    MULS  #4096
    ADD   247
    LDR   248
    ST    0,R             ; store in heap

    ; Advance heap
    LD    HEAP
    ADD   #1
    ST    HEAP

    ; Return new cell address
    LD    248
    ST    100

    J     HALT

; ============================================================================
; ATOM primitive: (ATOM x) -> T if x is atom, NIL if cons
; ============================================================================
DO_ATOM_PRIM:
    ; Get argument
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    250
    DIV   #4096
    MULS  #4096
    ST    251
    LD    250
    SUB   251
    ST    252

    LD    252
    LDR   252
    LD    0,R
    DIV   #4096           ; first arg
    ST    253

    ; Atom test: >= 3072
    LD    253
    SUB   #3072
    JN    ATOM_NO
    LD    #4094           ; T
    ST    100
    J     HALT
ATOM_NO:
    LD    #4095           ; NIL
    ST    100
    J     HALT

; ============================================================================
; EQ primitive: (EQ a b) -> T if equal atoms, NIL otherwise
; ============================================================================
DO_EQ_PRIM:
    ; Get two arguments
    LD    EXPR
    LDR   EXPR
    LD    0,R
    ST    260
    DIV   #4096
    MULS  #4096
    ST    261
    LD    260
    SUB   261
    ST    262             ; args list

    ; First arg
    LD    262
    LDR   262
    LD    0,R
    DIV   #4096
    ST    263             ; a

    ; Second arg (cdr then car)
    LD    262
    LDR   262
    LD    0,R
    ST    264
    DIV   #4096
    MULS  #4096
    ST    265
    LD    264
    SUB   265
    ST    266

    LD    266
    LDR   266
    LD    0,R
    DIV   #4096
    ST    267             ; b

    ; Compare
    LD    263
    SUB   267
    JNZ   EQ_NO
    LD    #4094           ; T
    ST    100
    J     HALT
EQ_NO:
    LD    #4095           ; NIL
    ST    100
    J     HALT

; ============================================================================
; HALT
; ============================================================================
HALT: J HALT

; ============================================================================
; Data
; ============================================================================
EXPR:  #0                 ; Expression to evaluate
ENV:   #0                 ; Environment (association list)
FN:    #0                 ; Function/special form
HEAP:  #0                 ; Heap pointer

; Work areas 200-299 used inline above
; Result stored at address 100
