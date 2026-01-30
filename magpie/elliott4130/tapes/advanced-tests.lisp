; Advanced LISP Tests - Tape 2
; Recursive functions and LAMBDA from McCarthy 1960

; Test NULL - true if argument is NIL
(NULL NIL)              ; => T
(NULL (QUOTE A))        ; => NIL

; Test COND - conditional expression
(COND ((ATOM (QUOTE A)) (QUOTE YES))
      (T (QUOTE NO)))   ; => YES

(COND ((NULL NIL) (QUOTE EMPTY))
      (T (QUOTE FULL))) ; => EMPTY

; Test LAMBDA - anonymous function
((LAMBDA (X) (CAR X)) (QUOTE (A B C)))  ; => A

((LAMBDA (X Y) (CONS X Y))
 (QUOTE A)
 (QUOTE (B C)))         ; => (A B C)

; Nested CAR/CDR - CADR (second element)
(CAR (CDR (QUOTE (A B C))))  ; => B

; Nested CAR/CDR - CADDR (third element)
(CAR (CDR (CDR (QUOTE (A B C D)))))  ; => C
