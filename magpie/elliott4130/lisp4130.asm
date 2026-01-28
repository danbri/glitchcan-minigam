; =============================================================================
; LISP 4130 - McCarthy Lisp for Elliott 4130
; =============================================================================
;
; Cell Format (24 bits):
;   Bits 23-12: CAR (12 bits) - 4096 possible values
;   Bits 11-0:  CDR (12 bits) - 4096 possible values
;
; Value Encoding:
;   0-2047:     Heap cell addresses (cons cells)
;   2048-3071:  Small integers (0-1023)
;   3072-4094:  Atom indices (symbols)
;   4095:       NIL
;
; Memory Layout:
;   0-99:       Code
;   100-199:    Data/Results
;   200-299:    Stack
;   1000-2000:  Heap (cons cells)
;
; =============================================================================

; === BUILD LIST (A B C) ===
; Atoms: A=3073, B=3074, C=3075
; NIL = 4095

; Cell 1000: (C . NIL)
        LD    #3075          ; C = 3075
        MULS  #4096          ; CAR << 12
        ADD   #4095          ; CDR = NIL
        ST    1000

; Cell 1001: (B . 1000) = (B C)
        LD    #3074          ; B = 3074
        MULS  #4096
        ADD   #1000          ; CDR = cell 1000
        ST    1001

; Cell 1002: (A . 1001) = (A B C)
        LD    #3073          ; A = 3073
        MULS  #4096
        ADD   #1001          ; CDR = cell 1001
        ST    1002

; === CAR[(A B C)] = A ===
        LD    1002           ; Load cell
        DIV   #4096          ; Extract CAR
        ST    100            ; Result: 3073 (atom A)

; === CDR[(A B C)] = (B C) ===
        LD    1002           ; Load cell
        ST    103            ; Save original
        DIV   #4096          ; Get CAR
        MULS  #4096          ; Shift back
        ST    104            ; CAR << 12
        LD    103            ; Original
        SUB   104            ; Original - (CAR<<12) = CDR
        ST    101            ; Result: 1001 (pointer to B C)

; === CADR[(A B C)] = B ===
; First get CDR (already in 101)
        LD    101            ; CDR = 1001
        ST    103            ; Address of (B C)
        ; Load cell at address 1001
        LD    1001           ; Load (B C)
        DIV   #4096          ; CAR = B
        ST    102            ; Result: 3074 (atom B)

; === CONS[X, (A B C)] where X=3076 ===
; Build cell 1003: (X . 1002)
        LD    #3076          ; X = 3076
        MULS  #4096          ; CAR << 12
        ADD   #1002          ; CDR = (A B C)
        ST    1003

; Verify: CAR of new cell
        LD    1003
        DIV   #4096
        ST    105            ; Should be 3076

; === ATOM? test ===
; Atom if value >= 3072
        LD    100            ; CAR result = 3073
        SUB   #3072
        ST    106            ; >= 0 means atom (result: 1)

; === NULL? test ===
; NULL if value == 4095
        LD    #4095          ; NIL
        SUB   #4095
        ST    107            ; == 0 means NIL (result: 0)

; === EQ? test ===
; A == A?
        LD    #3073          ; Atom A
        SUB   #3073          ; A - A
        ST    108            ; == 0 means equal (result: 0)

; A == B?
        LD    #3073          ; Atom A
        SUB   #3074          ; A - B
        ST    109            ; != 0 means not equal (result: -1)

        J     #0             ; Done

; === RESULTS at addresses 100-109 ===
; 100: CAR[(A B C)] = 3073 (atom A)
; 101: CDR[(A B C)] = 1001 (ptr to (B C))
; 102: CADR[(A B C)] = 3074 (atom B)
; 103: temp
; 104: temp
; 105: CAR[cons X (A B C)] = 3076 (atom X)
; 106: atom?(A) = 1 (positive = true)
; 107: null?(NIL) = 0 (zero = true)
; 108: eq?(A,A) = 0 (zero = true)
; 109: eq?(A,B) = -1 (non-zero = false)

; === DATA ===
100: #0
101: #0
102: #0
103: #0
104: #0
105: #0
106: #0
107: #0
108: #0
109: #0
