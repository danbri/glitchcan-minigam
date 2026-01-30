; Basic LISP Tests - Tape 1
; Elementary operations from McCarthy 1960

; Test QUOTE - returns its argument unevaluated
(QUOTE A)              ; => A
(QUOTE (A B C))        ; => (A B C)

; Test ATOM - true if argument is atomic
(ATOM A)               ; => T
(ATOM (QUOTE (A B)))   ; => NIL

; Test EQ - true if two atoms are equal
(EQ (QUOTE A) (QUOTE A))  ; => T
(EQ (QUOTE A) (QUOTE B))  ; => NIL

; Test CAR - first element of a list
(CAR (QUOTE (A B C)))     ; => A

; Test CDR - rest of list after first
(CDR (QUOTE (A B C)))     ; => (B C)

; Test CONS - construct a new list
(CONS (QUOTE A) (QUOTE (B C)))  ; => (A B C)
