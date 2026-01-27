// μLisp Test Suite
import { run, stringify } from './lisp.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b) => assert(stringify(a) === b, `Expected ${b}, got ${stringify(a)}`);

// Arithmetic
test('addition', () => eq(run('(+ 1 2 3)'), '6'));
test('subtraction', () => eq(run('(- 10 3)'), '7'));
test('multiplication', () => eq(run('(* 2 3 4)'), '24'));
test('division', () => eq(run('(/ 10 2)'), '5'));
test('nested math', () => eq(run('(+ (* 2 3) (- 10 5))'), '11'));

// Comparisons
test('less than', () => eq(run('(< 1 2)'), 'true'));
test('greater than', () => eq(run('(> 1 2)'), 'false'));
test('equality', () => eq(run('(= 5 5)'), 'true'));

// Lists
test('cons', () => eq(run('(cons 1 (cons 2 nil))'), '(1 2)'));
test('car', () => eq(run('(car (list 1 2 3))'), '1'));
test('cdr', () => eq(run('(cdr (list 1 2 3))'), '(2 3)'));
test('list', () => eq(run('(list 1 2 3)'), '(1 2 3)'));
test('length', () => eq(run('(length (list 1 2 3 4 5))'), '5'));
test('append', () => eq(run('(append (list 1 2) (list 3 4))'), '(1 2 3 4)'));
test('reverse', () => eq(run('(reverse (list 1 2 3))'), '(3 2 1)'));
test('map', () => eq(run('(map (lambda (x) (* x 2)) (list 1 2 3))'), '(2 4 6)'));
test('filter', () => eq(run('(filter (lambda (x) (> x 2)) (list 1 2 3 4))'), '(3 4)'));
test('reduce', () => eq(run('(reduce + 0 (list 1 2 3 4))'), '10'));

// Conditionals
test('if true', () => eq(run('(if (> 5 3) 1 2)'), '1'));
test('if false', () => eq(run('(if (< 5 3) 1 2)'), '2'));
test('and', () => eq(run('(and #t #t #t)'), 'true'));
test('and short-circuit', () => eq(run('(and #t #f #t)'), 'false'));
test('or', () => eq(run('(or #f #f #t)'), 'true'));
test('or short-circuit', () => eq(run('(or #f 5 #t)'), '5'));

// Lambda
test('lambda call', () => eq(run('((lambda (x) (* x x)) 5)'), '25'));
test('lambda closure', () => eq(run('(((lambda (x) (lambda (y) (+ x y))) 3) 4)'), '7'));
test('multi-body lambda', () => eq(run('((lambda (x) (+ x 1) (* x 2)) 5)'), '10'));

// Define
test('define variable', () => eq(run('(define x 10) x'), '10'));
test('define function', () => eq(run('(define (square x) (* x x)) (square 7)'), '49'));
test('recursive define', () => eq(run(`
  (define (fact n)
    (if (<= n 1) 1 (* n (fact (- n 1)))))
  (fact 5)
`), '120'));

// Let
test('let', () => eq(run('(let ((x 5) (y 3)) (+ x y))'), '8'));
test('let*', () => eq(run('(let* ((x 5) (y (* x 2))) y)'), '10'));
test('letrec', () => eq(run(`
  (letrec ((even? (lambda (n) (if (= n 0) #t (odd? (- n 1)))))
           (odd? (lambda (n) (if (= n 0) #f (even? (- n 1))))))
    (even? 10))
`), 'true'));

// Quote
test('quote', () => eq(run("'(1 2 3)"), '(1 2 3)'));
test('quote symbol', () => eq(run("'foo"), 'foo'));
test('quasiquote', () => eq(run('(let ((x 5)) `(a ,x c))'), '(a 5 c)'));
test('unquote-splicing', () => eq(run('(let ((xs (list 2 3))) `(1 ,@xs 4))'), '(1 2 3 4)'));

// Begin
test('begin', () => eq(run('(begin 1 2 3)'), '3'));

// Predicates
test('null?', () => eq(run('(null? nil)'), 'true'));
test('pair?', () => eq(run('(pair? (cons 1 2))'), 'true'));
test('symbol?', () => eq(run("(symbol? 'foo)"), 'true'));
test('number?', () => eq(run('(number? 42)'), 'true'));

// TCO (Tail Call Optimization)
test('TCO no stack overflow', () => {
  const result = run(`
    (define (loop n acc)
      (if (= n 0) acc (loop (- n 1) (+ acc 1))))
    (loop 10000 0)
  `);
  eq(result, '10000');
});

// Macros
test('defmacro', () => eq(run(`
  (defmacro unless (cond then else)
    \`(if ,cond ,else ,then))
  (unless #f 1 2)
`), '1'));

// Higher-order
test('compose', () => eq(run(`
  (define (compose f g) (lambda (x) (f (g x))))
  (define add1 (lambda (x) (+ x 1)))
  (define double (lambda (x) (* x 2)))
  ((compose add1 double) 5)
`), '11'));

// Fibonacci
test('fibonacci', () => eq(run(`
  (define (fib n)
    (if (<= n 1) n (+ (fib (- n 1)) (fib (- n 2)))))
  (fib 10)
`), '55'));

// Y combinator
test('Y combinator', () => eq(run(`
  (define Y
    (lambda (f)
      ((lambda (x) (f (lambda (y) ((x x) y))))
       (lambda (x) (f (lambda (y) ((x x) y)))))))
  (define fact-gen
    (lambda (f)
      (lambda (n)
        (if (<= n 1) 1 (* n (f (- n 1)))))))
  ((Y fact-gen) 5)
`), '120'));

// Run tests
console.log('\x1b[1m=== μLisp Test Suite ===\x1b[0m\n');
let passed = 0, failed = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n\x1b[1m=== Summary ===\x1b[0m`);
console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
if (failed) console.log(`  \x1b[31mFailed: ${failed}\x1b[0m`);
console.log(`\n${failed === 0 ? '\x1b[32m✓ All tests passed!\x1b[0m' : '\x1b[31m✗ Some tests failed\x1b[0m'}`);
process.exit(failed ? 1 : 0);
