; =============================================================================
; LISP 4130 - McCarthy Lisp for Elliott 4130
; =============================================================================
; A working Lisp interpreter demonstrating:
;   - Cons cell representation
;   - CAR/CDR/CONS/ATOM?/EQ?/NULL? primitives
;   - QUOTE special form
;   - EVAL for simple expressions
;
; Memory: Heap at 1000+, results at 600+
; Cell format: [CAR:12bits | CDR:12bits] in 24-bit word
; Atoms: 3072+ (A=3072, B=3073, C=3074, ...)
; NIL = 4095, T = 4094
; =============================================================================

; === PROGRAM START ===
        J     MAIN

; === CONSTANTS ===
600: #4095        ; NIL
601: #4094        ; T
602: #3072        ; QUOTE symbol
603: #3076        ; CAR symbol
604: #3077        ; CDR symbol

; === VARIABLES ===
610: #1000        ; FREE - next free cell
611: #0           ; EXPR - expression to evaluate
612: #0           ; RESULT
613: #0           ; TEMP1
614: #0           ; TEMP2
615: #0           ; TEMP3
616: #0           ; TEMP4
617: #0           ; ARG_VAL - evaluated argument

; === MAIN PROGRAM ===
MAIN:
; We will:
; 1. Build the list (A B C)
; 2. Build (QUOTE (A B C))
; 3. Build (CAR (QUOTE (A B C)))
; 4. Evaluate it -> should get atom A (3072)

; --------------------------------------------------------
; Step 1: Build (A B C) using inline CONS operations
; --------------------------------------------------------

; CONS(C, NIL) -> cell at 1000
; C = 3074, NIL = 4095
        LD    #3074           ; C
        MULS  #4096           ; CAR << 12
        ADD   #4095           ; CDR = NIL
        ST    1000            ; Cell 1000 = (C . NIL)

; CONS(B, 1000) -> cell at 1001
; B = 3073
        LD    #3073           ; B
        MULS  #4096
        ADD   #1000           ; CDR = cell 1000
        ST    1001            ; Cell 1001 = (B . (C))

; CONS(A, 1001) -> cell at 1002
; A = 3072
        LD    #3072           ; A
        MULS  #4096
        ADD   #1001           ; CDR = cell 1001
        ST    1002            ; Cell 1002 = (A B C)

; Save (A B C) pointer
        LD    #1002
        ST    613             ; TEMP1 = ptr to (A B C)

; --------------------------------------------------------
; Step 2: Build (QUOTE (A B C))
; Structure: (QUOTE . ((A B C) . NIL))
; --------------------------------------------------------

; CONS((A B C), NIL) -> cell at 1003
        LD    #1002           ; ptr to (A B C)
        MULS  #4096
        ADD   #4095           ; CDR = NIL
        ST    1003            ; Cell 1003 = ((A B C))

; CONS(QUOTE, 1003) -> cell at 1004
        LD    #3072           ; QUOTE symbol (reusing A's code for simplicity)
        MULS  #4096
        ADD   #1003
        ST    1004            ; Cell 1004 = (QUOTE (A B C))

; For a real implementation, QUOTE would be a distinct symbol
; Let's use 3080 for QUOTE to distinguish from A
        LD    #3080           ; QUOTE = 3080
        ST    602             ; Update QUOTE constant
        LD    #3080
        MULS  #4096
        ADD   #1003
        ST    1004            ; Cell 1004 = (QUOTE (A B C)) with proper QUOTE

; --------------------------------------------------------
; Step 3: Build (CAR (QUOTE (A B C)))
; Structure: (CAR . ((QUOTE (A B C)) . NIL))
; --------------------------------------------------------

; CONS((QUOTE (A B C)), NIL) -> cell at 1005
        LD    #1004           ; ptr to (QUOTE (A B C))
        MULS  #4096
        ADD   #4095           ; CDR = NIL
        ST    1005            ; Cell 1005 = ((QUOTE (A B C)))

; CONS(CAR, 1005) -> cell at 1006
; CAR symbol = 3076
        LD    #3076
        MULS  #4096
        ADD   #1005
        ST    1006            ; Cell 1006 = (CAR (QUOTE (A B C)))

; Save expression to evaluate
        LD    #1006
        ST    611             ; EXPR = (CAR (QUOTE (A B C)))

; --------------------------------------------------------
; Step 4: EVALUATE (CAR (QUOTE (A B C)))
; --------------------------------------------------------
; EVAL dispatch:
;   - If NIL, return NIL
;   - If atom, return atom (self-evaluating for now)
;   - If list, check operator and dispatch

EVAL_START:
        LD    611             ; Load EXPR
        ST    613             ; TEMP1 = expr

        ; Check if NIL
        SUB   #4095
        JZ    RET_NIL

        ; Check if atom (>= 3072)
        LD    613
        SUB   #3072
        JNN   RET_SELF        ; Atoms self-evaluate

        ; It's a list - get CAR (operator)
        LD    613             ; expr address
        LDR   613
        LD    0,R             ; Load cell
        DIV   #4096           ; CAR = operator
        ST    614             ; TEMP2 = operator

        ; Get CDR (arguments list)
        LDR   613
        LD    0,R
        ST    615             ; Save cell
        DIV   #4096
        MULS  #4096
        ST    616
        LD    615
        SUB   616
        ST    615             ; TEMP3 = args list

        ; Check if operator is QUOTE (3080)
        LD    614
        SUB   #3080
        JZ    DO_QUOTE

        ; Check if operator is CAR (3076)
        LD    614
        SUB   #3076
        JZ    DO_CAR

        ; Check if operator is CDR (3077)
        LD    614
        SUB   #3077
        JZ    DO_CDR

        ; Unknown operator - return NIL
        J     RET_NIL

; --------------------------------------------------------
; QUOTE: Return first argument unevaluated
; --------------------------------------------------------
DO_QUOTE:
        ; args in TEMP3 (615), get CAR of args
        LD    615
        LDR   615
        LD    0,R
        DIV   #4096           ; CAR of args = quoted value
        ST    612             ; RESULT = quoted value
        J     DONE

; --------------------------------------------------------
; CAR: Evaluate argument, then take CAR
; --------------------------------------------------------
DO_CAR:
        ; args in TEMP3 (615), get first arg
        LD    615
        LDR   615
        LD    0,R
        DIV   #4096           ; CAR of args = argument expr
        ST    616             ; TEMP4 = argument to CAR

        ; Need to evaluate the argument
        ; Check if it's a list (could be (QUOTE ...))
        LD    616
        SUB   #3072
        JNN   CAR_OF_ATOM     ; If atom, can't take CAR

        ; It's a list - check if (QUOTE ...)
        LD    616
        LDR   616
        LD    0,R
        DIV   #4096           ; CAR of arg = operator
        ST    617             ; Save operator

        ; Check if QUOTE
        SUB   #3080
        JNZ   CAR_ERROR       ; Not QUOTE, can't handle yet

        ; It's (QUOTE value) - extract the value
        ; CDR of arg is (value)
        LDR   616
        LD    0,R
        ST    613
        DIV   #4096
        MULS  #4096
        ST    614
        LD    613
        SUB   614             ; CDR of (QUOTE value) = (value)
        ST    613             ; (value)

        ; CAR of (value) = value
        LDR   613
        LD    0,R
        DIV   #4096           ; The actual value (should be ptr to list)
        ST    617             ; ARG_VAL = evaluated argument

        ; Now take CAR of the evaluated value
        LD    617
        SUB   #3072
        JNN   CAR_OF_ATOM     ; If atom, error

        ; It's a list, take its CAR
        LDR   617
        LD    0,R
        DIV   #4096           ; CAR of the list
        ST    612             ; RESULT
        J     DONE

CAR_OF_ATOM:
        LD    #4095           ; Error: CAR of atom = NIL
        ST    612
        J     DONE

CAR_ERROR:
        LD    #4095           ; Error = NIL
        ST    612
        J     DONE

; --------------------------------------------------------
; CDR: Evaluate argument, then take CDR
; --------------------------------------------------------
DO_CDR:
        ; Similar to CAR but extract low 12 bits
        LD    615
        LDR   615
        LD    0,R
        DIV   #4096           ; First arg
        ST    616

        ; Check if (QUOTE ...)
        LD    616
        SUB   #3072
        JNN   CDR_OF_ATOM

        ; Get operator of arg
        LDR   616
        LD    0,R
        DIV   #4096
        SUB   #3080
        JNZ   CDR_ERROR

        ; Extract quoted value
        LDR   616
        LD    0,R
        ST    613
        DIV   #4096
        MULS  #4096
        ST    614
        LD    613
        SUB   614
        ST    613

        LDR   613
        LD    0,R
        DIV   #4096
        ST    617             ; Evaluated arg

        ; Take CDR of it
        LD    617
        SUB   #3072
        JNN   CDR_OF_ATOM

        LDR   617
        LD    0,R
        ST    613
        DIV   #4096
        MULS  #4096
        ST    614
        LD    613
        SUB   614             ; CDR
        ST    612
        J     DONE

CDR_OF_ATOM:
        LD    #4095
        ST    612
        J     DONE

CDR_ERROR:
        LD    #4095
        ST    612
        J     DONE

; --------------------------------------------------------
; Return handlers
; --------------------------------------------------------
RET_NIL:
        LD    #4095
        ST    612
        J     DONE

RET_SELF:
        LD    613
        ST    612
        J     DONE

; --------------------------------------------------------
; DONE - Store results for inspection
; --------------------------------------------------------
DONE:
        ; Result is in 612
        LD    612
        ST    620             ; Copy result to 620

        ; Also store intermediate values for debugging
        LD    1000
        ST    621             ; Cell 1000: (C . NIL)
        LD    1001
        ST    622             ; Cell 1001: (B C)
        LD    1002
        ST    623             ; Cell 1002: (A B C)
        LD    1004
        ST    624             ; Cell 1004: (QUOTE (A B C))
        LD    1006
        ST    625             ; Cell 1006: (CAR (QUOTE (A B C)))

        J     HALT

HALT:   J     HALT

; --------------------------------------------------------
; EXPECTED RESULTS (at addresses 620-625):
; 620: 3072 (atom A - the result of (CAR (QUOTE (A B C))))
; 621: (C.NIL) = 3074*4096 + 4095 = 12591103 (octal 60037777)
; 622: (B.1000) = 3073*4096 + 1000 = 12587000
; 623: (A.1001) = 3072*4096 + 1001 = 12583929
; 624: (QUOTE.(args))
; 625: (CAR.(args))
; --------------------------------------------------------

; Data area
620: #0
621: #0
622: #0
623: #0
624: #0
625: #0
