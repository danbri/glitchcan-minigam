; McCarthy's Meta-Circular Evaluator - Tape 3
; The famous "half-pager" - LISP written in LISP
; From "Recursive Functions of Symbolic Expressions" (1960)

; ASSOC - look up in association list
(LABEL ASSOC
  (LAMBDA (X A)
    (COND ((NULL A) NIL)
          ((EQ X (CAR (CAR A))) (CDR (CAR A)))
          (T (ASSOC X (CDR A))))))

; EVLIS - evaluate a list of expressions
(LABEL EVLIS
  (LAMBDA (M A)
    (COND ((NULL M) NIL)
          (T (CONS (EVAL (CAR M) A) (EVLIS (CDR M) A))))))

; PAIRLIS - zip parameters with values
(LABEL PAIRLIS
  (LAMBDA (X Y A)
    (COND ((NULL X) A)
          (T (CONS (CONS (CAR X) (CAR Y))
                   (PAIRLIS (CDR X) (CDR Y) A))))))

; EVCON - evaluate conditional clauses
(LABEL EVCON
  (LAMBDA (C A)
    (COND ((EVAL (CAR (CAR C)) A) (EVAL (CAR (CDR (CAR C))) A))
          (T (EVCON (CDR C) A)))))

; EVAL - the universal function
(LABEL EVAL
  (LAMBDA (E A)
    (COND
      ; Self-evaluating atoms
      ((ATOM E) (ASSOC E A))
      ; QUOTE
      ((EQ (CAR E) (QUOTE QUOTE)) (CAR (CDR E)))
      ; ATOM test
      ((EQ (CAR E) (QUOTE ATOM)) (ATOM (EVAL (CAR (CDR E)) A)))
      ; EQ test
      ((EQ (CAR E) (QUOTE EQ))
        (EQ (EVAL (CAR (CDR E)) A) (EVAL (CAR (CDR (CDR E))) A)))
      ; CAR
      ((EQ (CAR E) (QUOTE CAR)) (CAR (EVAL (CAR (CDR E)) A)))
      ; CDR
      ((EQ (CAR E) (QUOTE CDR)) (CDR (EVAL (CAR (CDR E)) A)))
      ; CONS
      ((EQ (CAR E) (QUOTE CONS))
        (CONS (EVAL (CAR (CDR E)) A) (EVAL (CAR (CDR (CDR E))) A)))
      ; COND
      ((EQ (CAR E) (QUOTE COND)) (EVCON (CDR E) A))
      ; LAMBDA application
      ((EQ (CAR (CAR E)) (QUOTE LAMBDA))
        (EVAL (CAR (CDR (CDR (CAR E))))
              (PAIRLIS (CAR (CDR (CAR E))) (EVLIS (CDR E) A) A)))
      ; Function lookup
      (T (EVAL (CONS (ASSOC (CAR E) A) (CDR E)) A)))))
