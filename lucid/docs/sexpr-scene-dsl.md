# S-expressions for Lucid scenes and expressions

**Status:** proof-of-fit landed (`core/sexpr.js`), verified over the whole
corpus. Canonical-vs-surface decision is open — see the fork at the end.

## The observation

Lucid's IR is already an S-expression. It just wears a JSON costume.

```json
{ "expr": "mul", "args": [ { "var": "rotationSpeed" }, { "var": "time" } ] }
```

is

```lisp
(* rotationSpeed time)
```

And the whale's `flipperWidthAbsolute` — 22 lines of nested `{expr,args}` JSON —
is:

```lisp
(* (* bodyLength flipperSpan) flipperWidth)
```

The node tree is the same story: `{ "type": "union", "children": [...] }` is
`(union ...)`. Tree-structured code-as-data is exactly what S-expressions are for,
and Lucid's expression AST, CSG tree, and driven-parameter expressions are all
tree-structured code-as-data.

## Why now

Three things converged:

1. **The rig layer.** `rig.derived` / `rig.phase` / the new `chains`/`conserved`
   are *programs* — expression trees the CPU evaluates every frame. Writing
   programs in `{expr,args}` JSON is writing Lisp with the parentheses replaced by
   fifteen characters of punctuation each.
2. **Templates (the clipclop direction).** A runtime-parameterized quadruped is a
   *function*: `(defn quadruped (leg-len girth snout) (union ...))`, with
   `(quadruped :leg-len 0.5 …)` as application. `defs`/`ref` is already `let` /
   `lambda` with call-site overrides. A homoiconic surface makes templates a
   language feature, not a bespoke JSON schema.
3. **Repo heritage.** `magpie/elliott4130` runs LISP 1.5. The house is already
   comfortable with parentheses.

## What landed: `core/sexpr.js`

A **surface syntax over the existing IR** — not a new format. A real reader
(tokenizer + recursive descent, no regex) and a printer:

| function | direction |
|---|---|
| `read(text)` / `readOne(text)` | text → forms |
| `formToExpr(form)` / `exprToSexpr(ir)` | expression sublanguage ⇄ IR |
| `formToNode(form)` / `nodeToSexpr(ir)` | scene-node subset ⇄ IR |

Because it targets the same IR, **codegen, the rig evaluator, and the clipclop
bridge are untouched.** Adopting S-expressions is additive and reversible.

### Expression sublanguage (complete)

```
(* rotationSpeed time)          → {expr:'mul', args:[{var},{var}]}
(+ 1 (* 0.01 time))             → nested add/mul
(- x)                           → neg     (one arg)
(- a b)                         → sub     (two+ args)
(clamp x 0 1)                   → clamp
[1 0 0]                         → literal vec (raw array)
time                            → {var:'time'}
```

Infix aliases `+ - * / %`; every codegen op (`sin cos pow mix smoothstep noise
fbm …`) is a pass-through head.

### Scene-node subset (common cases)

```lisp
(union
  (material [1 0.15 0] (sphere :r 0.5))
  (translate [1.2 0 0] (box :size [0.6 0.6 0.6]))
  (smoothUnion :k 0.2
    (sphere :r 0.4)
    (translate [0 0.6 0] (sphere :r 0.3))))
```

Heads: primitives (keyword params), CSG (`:k` for smooth variants),
`translate`/`rotate`/`scale` wrappers, `material`. Not yet: `ref`/`defs`,
`repeat`/`mirror`/`radial`, physics blocks, scene metadata.

## Verification (GPU-free, honest)

The surface must not change what the renderer produces. The test is codegen
equivalence, not JSON deep-equal (cosmetic shape differences don't matter; emitted
shaders do):

> For every one of the **674 expression nodes in all 119 scenes**: print to
> S-expr, read back, and the WGSL **and** GLSL codegen is byte-identical.
> **674 / 674 pass.**

(Five legacy nodes use bare-string args like `{expr:'mul',args:['time',…]}`; they
can't codegen in the synthetic test wrapper, so those fall back to structural IR
identity — also exact.) Locked in by `tests/lucid-codegen-parity.test.js`
(`s-expression surface` block). The scene-node subset is checked by authoring a
subtree in S-expr and confirming it codegens to valid WGSL.

## The open fork (your call)

`sexpr.js` proves the surface is faithful without committing to how far it goes:

- **Surface-only** — `.json` stays canonical on disk; S-expr is an author/print
  convenience and the language the node editor and docs speak. Zero risk, keeps
  every existing tool. This is what landed.
- **Canonical** — `.lisp`/`.scene` files become the source of truth; a loader
  reads them to IR; JSON becomes an export. More reach (macros, `defn` templates,
  comments, quoting) but it touches the loader, the scene catalogue, and `toc.json`.

Recommendation: **stay surface-only until the template work needs `defn`.** The
moment a quadruped template wants to be a real function with parameters, that is
the feature canonical S-expr buys that JSON can't — and the point to promote it.
Until then the costume is fine; we just gave it a zipper.

## Next steps (when promoting)

- Extend the node subset: `ref`/`defs` → `let`/`lambda`, then `repeat`/`mirror`/
  `radial`.
- `(defn name (params...) body)` for templates; same form feeds codegen (compile)
  and the clipclop compute template (parameter buffer).
- A `.scene`→IR loader path beside `loadJsonScene`, with the corpus round-tripped
  through it as the acceptance test.
