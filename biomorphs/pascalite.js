// pascalite.js — minimal Pascal interpreter for running Dawkins' Monochrome
// WatchMaker Pascal source verbatim from third_party/monochrome_pascal/.
//
// Scope: just enough Pascal to execute the algorithmic procedures
// (MakeGenes, PlugIn, Tree, Develop, Reproduce, Chess, BasicTree, Insect).
// Mac toolbox / UI / file I/O calls are stubbed at the host-binding layer.
//
// NOT a complete Pascal: skipped features include pointers/dispose, real
// numbers, file I/O, OOP, sets, generics, in-line assembly. The lexer and
// parser are forgiving enough to consume the full source files (Globals,
// Biomorphs, etc.) without choking on declarations the evaluator doesn't
// actually execute — unsupported features in unused declarations are quietly
// represented as opaque nodes.

// ============================================================================
// LEXER
// ============================================================================

const KEYWORDS = new Set([
    'program', 'unit', 'interface', 'implementation', 'uses', 'begin', 'end',
    'const', 'type', 'var', 'procedure', 'function', 'forward', 'external',
    'if', 'then', 'else', 'for', 'to', 'downto', 'do', 'while', 'repeat',
    'until', 'case', 'of', 'with', 'array', 'record', 'packed', 'set',
    'and', 'or', 'not', 'div', 'mod', 'in', 'xor', 'shl', 'shr',
    'nil', 'true', 'false', 'otherwise', 'goto', 'label',
    // type names treated as keywords for parsing simplicity
    'integer', 'longint', 'boolean', 'char', 'real', 'byte', 'word',
    'string', 'shortint', 'smallint',
]);

class Lexer {
    constructor(src, sourceName = 'input') {
        this.src = src;
        this.sourceName = sourceName;
        this.pos = 0;
        this.line = 1;
    }

    peek(n = 0) { return this.src[this.pos + n]; }

    advance() {
        const c = this.src[this.pos++];
        // Treat \n, \r, and \r\n each as one line break.
        if (c === '\n') this.line++;
        else if (c === '\r') {
            this.line++;
            if (this.src[this.pos] === '\n') this.pos++;
        }
        return c;
    }

    skipWhitespaceAndComments() {
        while (this.pos < this.src.length) {
            const c = this.peek();
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
                this.advance();
            } else if (c === '{') {
                while (this.pos < this.src.length && this.peek() !== '}') this.advance();
                this.advance(); // consume }
            } else if (c === '(' && this.peek(1) === '*') {
                this.advance(); this.advance();
                while (this.pos < this.src.length &&
                       !(this.peek() === '*' && this.peek(1) === ')')) {
                    this.advance();
                }
                this.advance(); this.advance();
            } else if (c === '/' && this.peek(1) === '/') {
                while (this.pos < this.src.length && this.peek() !== '\n') this.advance();
            } else {
                break;
            }
        }
    }

    isIdentStart(c) { return /[A-Za-z_]/.test(c); }
    isIdentCont(c)  { return /[A-Za-z0-9_]/.test(c); }
    isDigit(c)      { return /[0-9]/.test(c); }

    nextToken() {
        this.skipWhitespaceAndComments();
        if (this.pos >= this.src.length) {
            return { type: 'eof', value: null, line: this.line };
        }
        const startLine = this.line;
        const c = this.peek();

        // Identifiers / keywords
        if (this.isIdentStart(c)) {
            let s = '';
            while (this.pos < this.src.length && this.isIdentCont(this.peek())) s += this.advance();
            const lower = s.toLowerCase();
            if (KEYWORDS.has(lower)) return { type: lower, value: lower, line: startLine };
            return { type: 'ident', value: lower, raw: s, line: startLine };
        }

        // Hex literal
        if (c === '$') {
            this.advance();
            let s = '';
            while (this.pos < this.src.length && /[0-9A-Fa-f]/.test(this.peek())) s += this.advance();
            return { type: 'int', value: parseInt(s, 16), line: startLine };
        }

        // Numeric literal (int or real)
        if (this.isDigit(c)) {
            let s = '';
            while (this.pos < this.src.length && this.isDigit(this.peek())) s += this.advance();
            if (this.peek() === '.' && this.peek(1) !== '.') {
                s += this.advance();
                while (this.pos < this.src.length && this.isDigit(this.peek())) s += this.advance();
                if (this.peek() === 'e' || this.peek() === 'E') {
                    s += this.advance();
                    if (this.peek() === '+' || this.peek() === '-') s += this.advance();
                    while (this.pos < this.src.length && this.isDigit(this.peek())) s += this.advance();
                }
                return { type: 'real', value: parseFloat(s), line: startLine };
            }
            return { type: 'int', value: parseInt(s, 10), line: startLine };
        }

        // String literal
        if (c === "'") {
            this.advance();
            let s = '';
            while (this.pos < this.src.length) {
                const cc = this.advance();
                if (cc === "'") {
                    if (this.peek() === "'") { s += this.advance(); continue; }
                    return { type: 'string', value: s, line: startLine };
                }
                s += cc;
            }
            throw new Error(`${this.sourceName}:${startLine}: unterminated string`);
        }

        // Multi-char operators and punctuation
        const two = c + (this.peek(1) || '');
        if (two === ':=' || two === '<=' || two === '>=' || two === '<>' || two === '..') {
            this.advance(); this.advance();
            return { type: two, value: two, line: startLine };
        }
        const ops = '+-*/=<>(),:;.[]^@';
        if (ops.includes(c)) {
            this.advance();
            return { type: c, value: c, line: startLine };
        }

        throw new Error(`${this.sourceName}:${startLine}: unexpected character '${c}'`);
    }

    tokenize() {
        const tokens = [];
        for (;;) {
            const tok = this.nextToken();
            tokens.push(tok);
            if (tok.type === 'eof') break;
        }
        return tokens;
    }
}

// ============================================================================
// PARSER
// ============================================================================

class Parser {
    constructor(tokens, sourceName = 'input') {
        this.tokens = tokens;
        this.pos = 0;
        this.sourceName = sourceName;
    }

    peek(n = 0) { return this.tokens[this.pos + n]; }
    advance()   { return this.tokens[this.pos++]; }
    at(type)    { return this.peek().type === type; }
    accept(type) {
        if (this.at(type)) { this.advance(); return true; }
        return false;
    }
    expect(type, msg) {
        if (!this.at(type)) {
            const t = this.peek();
            throw new Error(`${this.sourceName}:${t.line}: expected ${msg || type}, got ${t.type}('${t.value}')`);
        }
        return this.advance();
    }

    parseUnitOrProgram() {
        const out = { kind: null, name: null, uses: [], decls: [], body: null };
        if (this.accept('unit')) {
            out.kind = 'unit';
            out.name = this.expect('ident').value;
            this.expect(';');
            this.expect('interface');
            // Interface section: just decls, optionally with uses
            if (this.accept('uses')) {
                out.uses.push(...this.parseIdentList());
                this.expect(';');
            }
            // Read interface decls (declarations only — proc/function bodies live in implementation)
            this.parseDecls(out.decls, /*interface=*/true);
            this.expect('implementation');
            if (this.accept('uses')) {
                out.uses.push(...this.parseIdentList());
                this.expect(';');
            }
            this.parseDecls(out.decls, /*interface=*/false);
            this.expect('end');
            this.expect('.');
            return out;
        }
        if (this.accept('program')) {
            out.kind = 'program';
            out.name = this.expect('ident').value;
            // Optional program parameters
            if (this.accept('(')) {
                while (!this.at(')')) { this.advance(); }
                this.expect(')');
            }
            this.expect(';');
            if (this.accept('uses')) {
                out.uses.push(...this.parseIdentList());
                this.expect(';');
            }
            this.parseDecls(out.decls, false);
            out.body = this.parseCompoundStatement();
            this.expect('.');
            return out;
        }
        throw new Error(`${this.sourceName}:${this.peek().line}: expected 'unit' or 'program'`);
    }

    parseIdentList() {
        const out = [this.expect('ident').value];
        while (this.accept(',')) out.push(this.expect('ident').value);
        return out;
    }

    parseDecls(decls, isInterface) {
        for (;;) {
            if (this.accept('const')) this.parseConstSection(decls);
            else if (this.accept('type')) this.parseTypeSection(decls);
            else if (this.accept('var')) this.parseVarSection(decls);
            else if (this.accept('label')) {
                // Skip label declarations
                while (!this.at(';')) this.advance();
                this.expect(';');
            } else if (this.at('procedure') || this.at('function')) {
                decls.push(this.parseProcOrFunc(isInterface));
            } else {
                break;
            }
        }
    }

    parseConstSection(decls) {
        // Repeatedly: ident = expr ;
        while (this.at('ident')) {
            const name = this.advance().value;
            this.expect('=');
            const value = this.parseExpression();
            this.expect(';');
            decls.push({ kind: 'const', name, value });
        }
    }

    parseTypeSection(decls) {
        while (this.at('ident')) {
            const name = this.advance().value;
            this.expect('=');
            const def = this.parseTypeDef();
            this.expect(';');
            decls.push({ kind: 'type', name, def });
        }
    }

    parseTypeDef() {
        if (this.accept('packed')) {
            // ignore PACKED
        }
        if (this.accept('record')) {
            const fields = [];
            while (!this.at('end')) {
                if (this.at(';')) { this.advance(); continue; }
                const names = this.parseIdentList();
                this.expect(':');
                const ftype = this.parseTypeDef();
                for (const n of names) fields.push({ name: n, type: ftype });
                if (!this.accept(';')) break;
            }
            this.expect('end');
            return { kind: 'record', fields };
        }
        if (this.accept('array')) {
            this.expect('[');
            const ranges = [this.parseTypeDef()];
            while (this.accept(',')) ranges.push(this.parseTypeDef());
            this.expect(']');
            this.expect('of');
            const elem = this.parseTypeDef();
            return { kind: 'array', ranges, elem };
        }
        if (this.accept('(')) {
            const members = [this.expect('ident').value];
            while (this.accept(',')) members.push(this.expect('ident').value);
            this.expect(')');
            return { kind: 'enum', members };
        }
        if (this.accept('^')) {
            // pointer; target may be an ident or a built-in type keyword
            const tok = this.advance();
            return { kind: 'pointer', target: tok.value };
        }
        if (this.accept('set')) {
            this.expect('of');
            const elem = this.parseTypeDef();
            return { kind: 'set', elem };
        }
        // Range type or named type starting with an expression
        const startTok = this.peek();
        if (startTok.type === 'int' || startTok.type === '-' || startTok.type === 'ident') {
            // Try to parse as low..high range or just a named type
            const save = this.pos;
            try {
                const low = this.parseExpression();
                if (this.accept('..')) {
                    const high = this.parseExpression();
                    return { kind: 'range', low, high };
                }
                this.pos = save;
            } catch {
                this.pos = save;
            }
        }
        if (this.at('ident')) {
            const name = this.advance().value;
            return { kind: 'named', name };
        }
        // Built-in type names
        for (const tn of ['integer', 'longint', 'boolean', 'char', 'real',
                          'byte', 'word', 'string', 'shortint', 'smallint']) {
            if (this.accept(tn)) {
                if (tn === 'string' && this.accept('[')) {
                    this.parseExpression();
                    this.expect(']');
                }
                return { kind: 'named', name: tn };
            }
        }
        throw new Error(`${this.sourceName}:${this.peek().line}: expected type, got ${this.peek().type}`);
    }

    parseVarSection(decls) {
        while (this.at('ident')) {
            const names = this.parseIdentList();
            this.expect(':');
            const type = this.parseTypeDef();
            this.expect(';');
            for (const n of names) decls.push({ kind: 'var', name: n, type });
        }
    }

    parseProcOrFunc(isInterface) {
        const isFunc = this.accept('function');
        if (!isFunc) this.expect('procedure');
        const name = this.expect('ident').value;
        const params = [];
        if (this.accept('(')) {
            while (!this.at(')')) {
                const byRef = this.accept('var');
                const names = this.parseIdentList();
                this.expect(':');
                const type = this.parseTypeDef();
                for (const n of names) params.push({ name: n, type, byRef });
                if (!this.accept(';')) break;
            }
            this.expect(')');
        }
        let returnType = null;
        if (isFunc) {
            this.expect(':');
            returnType = this.parseTypeDef();
        }
        this.expect(';');

        // Forward / external prototype
        if (this.accept('forward')) {
            this.expect(';');
            return { kind: 'proc', name, params, returnType, body: null, locals: [], forward: true };
        }
        if (this.accept('external')) {
            // skip rest until ;
            while (!this.at(';')) this.advance();
            this.expect(';');
            return { kind: 'proc', name, params, returnType, body: null, locals: [], external: true };
        }

        if (isInterface) {
            // Just a prototype; body lives in implementation.
            return { kind: 'proc', name, params, returnType, body: null, locals: [], forward: true };
        }

        // Local declarations
        const locals = [];
        for (;;) {
            if (this.accept('const')) this.parseConstSection(locals);
            else if (this.accept('type')) this.parseTypeSection(locals);
            else if (this.accept('var')) this.parseVarSection(locals);
            else if (this.at('procedure') || this.at('function')) {
                locals.push(this.parseProcOrFunc(false));
            } else break;
        }
        const body = this.parseCompoundStatement();
        this.expect(';');
        return { kind: 'proc', name, params, returnType, body, locals };
    }

    // ---- statements ----

    parseCompoundStatement() {
        this.expect('begin');
        const stmts = [];
        while (!this.at('end')) {
            stmts.push(this.parseStatement());
            if (!this.accept(';')) break;
        }
        this.expect('end');
        return { kind: 'compound', stmts };
    }

    parseStatement() {
        if (this.at('begin')) return this.parseCompoundStatement();
        if (this.accept('if')) {
            const cond = this.parseExpression();
            this.expect('then');
            const thenS = this.parseStatement();
            let elseS = null;
            if (this.accept('else')) elseS = this.parseStatement();
            return { kind: 'if', cond, then: thenS, else: elseS };
        }
        if (this.accept('for')) {
            const v = this.expect('ident').value;
            this.expect(':=');
            const start = this.parseExpression();
            const dir = this.accept('downto') ? 'downto' : (this.expect('to'), 'to');
            const end = this.parseExpression();
            this.expect('do');
            const body = this.parseStatement();
            return { kind: 'for', var: v, start, end, dir, body };
        }
        if (this.accept('while')) {
            const cond = this.parseExpression();
            this.expect('do');
            const body = this.parseStatement();
            return { kind: 'while', cond, body };
        }
        if (this.accept('repeat')) {
            const stmts = [];
            while (!this.at('until')) {
                stmts.push(this.parseStatement());
                if (!this.accept(';')) break;
            }
            this.expect('until');
            const cond = this.parseExpression();
            return { kind: 'repeat', stmts, cond };
        }
        if (this.accept('case')) {
            const expr = this.parseExpression();
            this.expect('of');
            const branches = [];
            let otherwise = null;
            while (!this.at('end') && !this.at('otherwise')) {
                const labels = [this.parseCaseLabel()];
                while (this.accept(',')) labels.push(this.parseCaseLabel());
                this.expect(':');
                const body = this.parseStatement();
                branches.push({ labels, body });
                if (!this.accept(';')) break;
            }
            if (this.accept('otherwise')) {
                // optional ; after otherwise
                this.accept(':');
                const body = this.parseStatement();
                otherwise = body;
                this.accept(';');
            }
            this.expect('end');
            return { kind: 'case', expr, branches, otherwise };
        }
        if (this.accept('with')) {
            const targets = [this.parseLvalue()];
            while (this.accept(',')) targets.push(this.parseLvalue());
            this.expect('do');
            const body = this.parseStatement();
            return { kind: 'with', targets, body };
        }
        if (this.at(';') || this.at('end') || this.at('until') || this.at('else')) {
            return { kind: 'empty' };
        }
        // Assignment or procedure call
        const lv = this.parseLvalue();
        if (this.accept(':=')) {
            const value = this.parseExpression();
            return { kind: 'assign', target: lv, value };
        }
        // Otherwise it's a procedure-call expression with no return value
        return { kind: 'callstmt', call: lv };
    }

    parseCaseLabel() {
        // CASE labels can be a single value or a range (low..high).
        const e = this.parseExpression();
        if (this.accept('..')) {
            const hi = this.parseExpression();
            return { kind: 'range', low: e, high: hi };
        }
        return e;
    }

    // ---- expressions ----
    // Pascal precedence (low -> high):
    //   = <> < <= > >= IN
    //   + - OR XOR
    //   * / DIV MOD AND SHL SHR
    //   unary NOT - +
    //   primary

    parseExpression() {
        let left = this.parseSimpleExpr();
        while (this.at('=') || this.at('<>') || this.at('<') || this.at('<=') ||
               this.at('>') || this.at('>=') || this.at('in')) {
            const op = this.advance().type;
            const right = this.parseSimpleExpr();
            left = { kind: 'binary', op, left, right };
        }
        return left;
    }
    parseSimpleExpr() {
        let left;
        if (this.accept('+')) { left = this.parseTerm(); }
        else if (this.accept('-')) { left = { kind: 'unary', op: '-', operand: this.parseTerm() }; }
        else { left = this.parseTerm(); }
        while (this.at('+') || this.at('-') || this.at('or') || this.at('xor')) {
            const op = this.advance().type;
            const right = this.parseTerm();
            left = { kind: 'binary', op, left, right };
        }
        return left;
    }
    parseTerm() {
        let left = this.parseFactor();
        while (this.at('*') || this.at('/') || this.at('div') || this.at('mod') ||
               this.at('and') || this.at('shl') || this.at('shr')) {
            const op = this.advance().type;
            const right = this.parseFactor();
            left = { kind: 'binary', op, left, right };
        }
        return left;
    }
    parseFactor() {
        if (this.accept('not')) return { kind: 'unary', op: 'not', operand: this.parseFactor() };
        if (this.accept('@'))   return { kind: 'unary', op: '@',   operand: this.parseFactor() };
        if (this.accept('(')) {
            const e = this.parseExpression();
            this.expect(')');
            return this.parsePostfix(e);
        }
        const tok = this.peek();
        if (tok.type === 'int')    { this.advance(); return { kind: 'lit', value: tok.value }; }
        if (tok.type === 'real')   { this.advance(); return { kind: 'lit', value: tok.value }; }
        if (tok.type === 'string') { this.advance(); return { kind: 'lit', value: tok.value }; }
        if (tok.type === 'true')   { this.advance(); return { kind: 'lit', value: true }; }
        if (tok.type === 'false')  { this.advance(); return { kind: 'lit', value: false }; }
        if (tok.type === 'nil')    { this.advance(); return { kind: 'lit', value: null }; }
        return this.parseLvalue();
    }
    parseLvalue() {
        const tok = this.expect('ident');
        let node = { kind: 'ident', name: tok.value };
        return this.parsePostfix(node);
    }
    parsePostfix(node) {
        for (;;) {
            if (this.accept('[')) {
                const idx = [this.parseExpression()];
                while (this.accept(',')) idx.push(this.parseExpression());
                this.expect(']');
                node = { kind: 'index', target: node, indices: idx };
            } else if (this.accept('.')) {
                const f = this.expect('ident').value;
                node = { kind: 'field', target: node, field: f };
            } else if (this.accept('^')) {
                node = { kind: 'deref', target: node };
            } else if (this.accept('(')) {
                const args = [];
                if (!this.at(')')) {
                    args.push(this.parseExpression());
                    while (this.accept(',')) args.push(this.parseExpression());
                }
                this.expect(')');
                node = { kind: 'call', target: node, args };
            } else break;
        }
        return node;
    }
}

// ============================================================================
// EVALUATOR
// ============================================================================

class PascalError extends Error {}

// Environment with prototype-based scope chain.
class Env {
    constructor(parent = null) {
        this.bindings = Object.create(parent ? parent.bindings : null);
        this.parent = parent;
    }
    get(name) {
        const lower = name.toLowerCase();
        if (!(lower in this.bindings)) throw new PascalError(`undefined: ${name}`);
        return this.bindings[lower];
    }
    has(name) { return name.toLowerCase() in this.bindings; }
    define(name, slot) { this.bindings[name.toLowerCase()] = slot; }
}

// A "slot" is { type: typeDef, ref: { value } }. Cell-style boxing lets VAR
// parameters share storage with the caller.
function makeSlot(type, value) { return { type, ref: { value } }; }
function cellFromValue(v) { return { ref: { value: v } }; }

// Default value for a type definition (recursively). `env` is passed through
// so array ranges can resolve named-CONST endpoints (e.g. `ARRAY[1..MaxAlbum]
// OF person` — MaxAlbum is a CONST in the surrounding env).
function defaultValue(typeDef, types, env) {
    if (!typeDef) return 0;
    switch (typeDef.kind) {
        case 'named': {
            const n = typeDef.name;
            if (n === 'integer' || n === 'longint' || n === 'byte' ||
                n === 'word' || n === 'shortint' || n === 'smallint') return 0;
            if (n === 'real') return 0.0;
            if (n === 'boolean') return false;
            if (n === 'char') return '\0';
            if (n === 'string') return '';
            if (types && types[n]) return defaultValue(types[n], types, env);
            return 0;
        }
        case 'range':  return 0;
        case 'enum':   return 0;
        case 'pointer':return null;
        case 'set':    return new Set();
        case 'record': {
            const o = {};
            for (const f of typeDef.fields) o[f.name.toLowerCase()] = defaultValue(f.type, types, env);
            return o;
        }
        case 'array': {
            const buildOne = (i) => {
                if (i >= typeDef.ranges.length) return defaultValue(typeDef.elem, types, env);
                const r = typeDef.ranges[i];
                const lo = evalConstRange(r, 'low', env);
                const hi = evalConstRange(r, 'high', env);
                const arr = { __isArray: true, lo, hi, items: [] };
                for (let k = lo; k <= hi; k++) arr.items[k - lo] = buildOne(i + 1);
                return arr;
            };
            return buildOne(0);
        }
    }
    return 0;
}

// Evaluate the literal endpoints of an array range / explicit range type.
function evalConstRange(r, end, env) {
    if (r.kind === 'range') return end === 'low' ? evalConst(r.low, env) : evalConst(r.high, env);
    if (r.kind === 'named') {
        // Integer subrange or named range type — caller should resolve before us
        return end === 'low' ? 1 : 8;
    }
    return 0;
}

function evalConst(node, env) {
    if (!node) return 0;
    if (node.kind === 'lit') return node.value;
    if (node.kind === 'unary' && node.op === '-') return -evalConst(node.operand, env);
    if (node.kind === 'binary') {
        const l = evalConst(node.left, env), r = evalConst(node.right, env);
        switch (node.op) {
            case '+': return l + r;
            case '-': return l - r;
            case '*': return l * r;
            case 'div': return Math.trunc(l / r);
        }
    }
    if (node.kind === 'ident' && env && env.has(node.name)) {
        const v = env.get(node.name).ref.value;
        if (typeof v === 'number') return v;
    }
    return 0;
}

class Interpreter {
    constructor(host) {
        this.host = host;
        this.global = new Env();
        this.types = {};        // name -> typeDef (lower-cased)
        this.procs = {};        // name -> proc node (lower-cased)
        this.enumValues = {};   // member name -> { type, ordinal }
        this.installBuiltins();
    }

    installBuiltins() {
        // Predefine Mac toolbox / classic Pascal types referenced by the
        // Dawkins source (Globals declares vars of these types, so the
        // interpreter needs to know how to default-initialise them).
        const recT = (...fields) => ({
            kind: 'record',
            fields: fields.map(([n, t]) => ({ name: n, type: { kind: 'named', name: t } })),
        });
        const opaque = { kind: 'named', name: 'integer' };
        const macTypes = {
            point: recT(['v', 'integer'], ['h', 'integer']),
            rect:  recT(['top', 'integer'], ['left', 'integer'],
                       ['bottom', 'integer'], ['right', 'integer']),
            // Anything we don't render: opaque integer placeholder.
            handle: opaque, ptr: opaque, longint: opaque,
            menuhandle: opaque, windowptr: opaque, windowrecord: opaque,
            controlhandle: opaque, grafptr: opaque, eventrecord: opaque,
            cursor: opaque, curshandle: opaque, cursorlist: opaque,
            bitmap: opaque, rgnhandle: opaque, pichandle: opaque,
            picturehandle: opaque, picture: opaque, str255: opaque, str63: opaque,
            oserr: opaque, size: opaque, osstatus: opaque, fileinfo: opaque,
        };
        for (const [n, t] of Object.entries(macTypes)) this.types[n] = t;

        // Scalar built-in types are recognised by name in defaultValue;
        // we install procedures here.
        const h = this.host;
        const def = (name, fn) => { this.procs[name.toLowerCase()] = { kind: 'native', fn }; };
        def('abs',     (x) => Math.abs(x));
        def('odd',     (x) => (x & 1) === 1);
        def('sqr',     (x) => x * x);
        def('trunc',   (x) => Math.trunc(x));
        def('round',   (x) => Math.round(x));
        def('chr',     (x) => String.fromCharCode(x));
        def('ord',     (x) => typeof x === 'string' ? x.charCodeAt(0) : (x|0));
        def('succ',    (x) => x + 1);
        def('pred',    (x) => x - 1);
        // Helpers used by Dawkins source:
        def('randint', (n) => h.randint(n));
        def('twotothe',(n) => 1 << n);
        def('sgn',     (x) => x > 0 ? 1 : x < 0 ? -1 : 0);
        // Drawing / toolbox shim — see host.js
        def('picline', (...a) => h.picline(...a));
        // No-op stubs covering Mac toolbox calls Dawkins source touches in
        // procedures we don't actually execute. They're present for completeness
        // in case a stray reachable call shows up; the unused-procedure parser
        // doesn't run their bodies regardless.
        for (const noop of [
            'pensize', 'penmode', 'moveto', 'lineto', 'eraserect', 'fillrect',
            'cliprect', 'getport', 'setport', 'setportbits', 'copybits',
            'killpicture', 'openpicture', 'closepicture', 'drawcontrols',
            'drawgrowicon', 'showwindow', 'selectwindow', 'invalrect',
            'newrgn', 'killregion', 'setemptyrgn', 'setrectrgn', 'unionrgn',
            'globaltolocal', 'findcontrol', 'trackcontrol', 'getctlvalue',
            'setctlvalue', 'setctlmin', 'setctlmax',
            'reset', 'rewrite', 'read', 'write', 'writeln', 'iseof',
            'fsread', 'fswrite', 'flushevents',
            'pause', 'sysbeep', 'inittoolbox', 'initgraf', 'initfonts',
            'initwindows', 'initmenus', 'teinit', 'initdialogs', 'initcursor',
            'maxapplzone',
            'showgenebox', 'makegenebox', 'snapshot', 'drawpic', 'zeropic',
            'setupboxes',
            'showchangedgene', 'doshowboxes', 'sendtoclipboard', 'dohighlight',
            'dorowmore', 'dorowless', 'docolmore', 'docolless', 'targetevolve',
            'evolve', 'genebbox', 'getmouse', 'flushevents',
            'randswell', // returns input toggled randomly if needed (host)
        ]) {
            def(noop, (...a) => h.toolboxStub(noop, ...a));
        }
        // Special host: RandSwell expects current swell-state -> random different
        def('randswell', (cur) => h.randswell(cur));
    }

    // Compile a parsed unit/program into the global environment.
    load(parsed) {
        this.processDecls(parsed.decls, this.global);
        // For a program, run its body. For units, body is null.
        if (parsed.kind === 'program' && parsed.body) {
            this.exec(parsed.body, this.global);
        }
    }

    processDecls(decls, env) {
        for (const d of decls) {
            switch (d.kind) {
                case 'const': {
                    const v = this.eval(d.value, env);
                    env.define(d.name, makeSlot({ kind: 'named', name: 'integer' }, v));
                    break;
                }
                case 'type': {
                    this.types[d.name.toLowerCase()] = d.def;
                    if (d.def.kind === 'enum') {
                        d.def.members.forEach((m, i) => {
                            this.enumValues[m.toLowerCase()] = { type: d.name, ordinal: i, name: m };
                        });
                    }
                    break;
                }
                case 'var': {
                    const v = defaultValue(d.type, this.types, env);
                    env.define(d.name, makeSlot(d.type, v));
                    break;
                }
                case 'proc': {
                    const lname = d.name.toLowerCase();
                    // Host bindings (PicLine, randint, toolbox stubs) take
                    // precedence — don't let Pascal-source bodies override
                    // them. This is how Tree's PicLine call routes to our
                    // canvas-emitting host instead of the original Mac-Pic
                    // buffer-append body, without us having to edit the
                    // Pascal source.
                    if (this.procs[lname] && this.procs[lname].kind === 'native') break;
                    if (env !== this.global) d.enclosingEnv = env;
                    if (!d.body && (this.procs[lname] && this.procs[lname].body)) {
                        // already have a body
                    } else if (d.body || !this.procs[lname]) {
                        this.procs[lname] = d;
                    }
                    break;
                }
            }
        }
    }

    // Resolve a named type lazily through this.types.
    resolveType(t) {
        if (!t) return null;
        if (t.kind === 'named' && this.types[t.name]) return this.resolveType(this.types[t.name]);
        return t;
    }

    // ---- statement execution ----

    exec(stmt, env) {
        if (!stmt) return;
        switch (stmt.kind) {
            case 'compound':
                for (const s of stmt.stmts) this.exec(s, env);
                return;
            case 'empty': return;
            case 'assign': {
                const slot = this.evalLvalue(stmt.target, env);
                slot.set(this.eval(stmt.value, env));
                return;
            }
            case 'if': {
                if (this.eval(stmt.cond, env)) this.exec(stmt.then, env);
                else if (stmt.else) this.exec(stmt.else, env);
                return;
            }
            case 'for': {
                const start = this.eval(stmt.start, env);
                const end   = this.eval(stmt.end, env);
                const step = stmt.dir === 'downto' ? -1 : 1;
                let i = start;
                const slot = env.get(stmt.var);
                if (step === 1) {
                    while (i <= end) {
                        slot.ref.value = i;
                        this.exec(stmt.body, env);
                        i += step;
                    }
                } else {
                    while (i >= end) {
                        slot.ref.value = i;
                        this.exec(stmt.body, env);
                        i += step;
                    }
                }
                return;
            }
            case 'while': {
                while (this.eval(stmt.cond, env)) this.exec(stmt.body, env);
                return;
            }
            case 'repeat': {
                do { for (const s of stmt.stmts) this.exec(s, env); }
                while (!this.eval(stmt.cond, env));
                return;
            }
            case 'case': {
                const v = this.eval(stmt.expr, env);
                for (const br of stmt.branches) {
                    for (const lab of br.labels) {
                        if (lab && lab.kind === 'range') {
                            const lo = this.eval(lab.low, env);
                            const hi = this.eval(lab.high, env);
                            if (v >= lo && v <= hi) { this.exec(br.body, env); return; }
                        } else if (this.eval(lab, env) === v) {
                            this.exec(br.body, env);
                            return;
                        }
                    }
                }
                if (stmt.otherwise) this.exec(stmt.otherwise, env);
                return;
            }
            case 'with': {
                // Push each target's record fields into a fresh sub-env.
                let cur = env;
                for (const tgt of stmt.targets) {
                    const slot = this.evalLvalue(tgt, cur);
                    const rec = slot.get();
                    const sub = new Env(cur);
                    for (const fname of Object.keys(rec)) {
                        sub.define(fname, {
                            type: null,
                            ref: { get value() { return rec[fname]; }, set value(v) { rec[fname] = v; } },
                        });
                    }
                    cur = sub;
                }
                this.exec(stmt.body, cur);
                return;
            }
            case 'callstmt': {
                this.callExpr(stmt.call, env, /*asStatement=*/true);
                return;
            }
        }
        throw new PascalError(`unknown stmt kind: ${stmt.kind}`);
    }

    // ---- expression evaluation ----

    eval(node, env) {
        if (!node) return undefined;
        switch (node.kind) {
            case 'lit': return node.value;
            case 'ident': {
                const lname = node.name.toLowerCase();
                if (env.has(lname)) return env.get(lname).ref.value;
                if (this.enumValues[lname]) return this.enumValues[lname].ordinal;
                if (this.procs[lname]) {
                    // 0-arg call
                    return this.invoke(lname, [], env);
                }
                throw new PascalError(`undefined identifier: ${node.name}`);
            }
            case 'unary': {
                const v = this.eval(node.operand, env);
                if (node.op === '-')   return -v;
                if (node.op === 'not') return typeof v === 'boolean' ? !v : ~v;
                if (node.op === '@')   return v;
                throw new PascalError(`bad unary: ${node.op}`);
            }
            case 'binary': {
                const l = this.eval(node.left, env);
                const r = this.eval(node.right, env);
                switch (node.op) {
                    case '+': return l + r;
                    case '-': return l - r;
                    case '*': return l * r;
                    case '/': return l / r;
                    case 'div': return Math.trunc(l / r);
                    case 'mod': return ((l % r) + r) % r;
                    case '=':   return l === r;
                    case '<>':  return l !== r;
                    case '<':   return l < r;
                    case '>':   return l > r;
                    case '<=':  return l <= r;
                    case '>=':  return l >= r;
                    case 'and': return (typeof l === 'boolean') ? (l && r) : (l & r);
                    case 'or':  return (typeof l === 'boolean') ? (l || r) : (l | r);
                    case 'xor': return l ^ r;
                    case 'shl': return l << r;
                    case 'shr': return l >> r;
                }
                throw new PascalError(`bad binary: ${node.op}`);
            }
            case 'index':
            case 'field':
            case 'deref':
                return this.evalLvalue(node, env).get();
            case 'call':
                return this.callExpr(node, env, /*asStatement=*/false);
        }
        throw new PascalError(`unknown expr: ${node.kind}`);
    }

    // Treat a node as a settable location and return { get, set, type }.
    evalLvalue(node, env) {
        switch (node.kind) {
            case 'ident': {
                const lname = node.name.toLowerCase();
                if (env.has(lname)) {
                    const slot = env.get(lname);
                    return {
                        get: () => slot.ref.value,
                        set: (v) => { slot.ref.value = v; },
                        slot,
                    };
                }
                throw new PascalError(`undefined: ${node.name}`);
            }
            case 'field': {
                const lv = this.evalLvalue(node.target, env);
                const rec = lv.get();
                const f = node.field.toLowerCase();
                return {
                    get: () => rec[f],
                    set: (v) => { rec[f] = v; },
                };
            }
            case 'index': {
                const lv = this.evalLvalue(node.target, env);
                let cur = lv.get();
                for (let i = 0; i < node.indices.length - 1; i++) {
                    const idx = this.eval(node.indices[i], env);
                    cur = cur.items[idx - cur.lo];
                }
                const lastIdx = this.eval(node.indices[node.indices.length - 1], env);
                const arr = cur;
                return {
                    get: () => arr.items[lastIdx - arr.lo],
                    set: (v) => { arr.items[lastIdx - arr.lo] = v; },
                };
            }
            case 'deref': return this.evalLvalue(node.target, env); // no-op for our subset
        }
        throw new PascalError(`not an lvalue: ${node.kind}`);
    }

    // Resolve a call-shaped node — `target(args)` — and invoke.
    callExpr(node, env, asStatement) {
        let name;
        if (node.kind === 'call') {
            const t = node.target;
            if (t.kind !== 'ident') throw new PascalError('only ident calls supported');
            name = t.name.toLowerCase();
            const args = node.args;
            return this.invoke(name, args, env);
        }
        // Bare ident as a callstmt = 0-arg call
        if (node.kind === 'ident') return this.invoke(node.name.toLowerCase(), [], env);
        // Could also be a `with`-resolved field name; we don't support that yet
        throw new PascalError(`bad call: ${node.kind}`);
    }

    invoke(name, argExprs, env) {
        const proc = this.procs[name];
        if (!proc) throw new PascalError(`unknown procedure: ${name}`);
        if (proc.kind === 'native') {
            const args = argExprs.map(a => this.eval(a, env));
            return proc.fn(...args);
        }
        // Pascal procedure. Nested procedures chain their call env to the
        // enclosing call's env (captured when its locals were processed),
        // so they inherit lexical scope. Top-level procs chain to global.
        const callEnv = new Env(proc.enclosingEnv || this.global);
        // Bind params: VAR -> share slot; non-VAR -> new slot with copied value.
        const params = proc.params || [];
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            const a = argExprs[i];
            if (p.byRef) {
                const lv = this.evalLvalue(a, env);
                callEnv.define(p.name, {
                    type: p.type,
                    ref: { get value() { return lv.get(); }, set value(v) { lv.set(v); } },
                });
            } else {
                let v = this.eval(a, env);
                if (v && v.__isArray) v = cloneValue(v);
                callEnv.define(p.name, makeSlot(p.type, v));
            }
        }
        // Locals
        if (proc.locals) this.processDecls(proc.locals, callEnv);
        // Function return value: a slot named after the function in callEnv.
        if (proc.returnType) {
            callEnv.define(proc.name, makeSlot(proc.returnType, defaultValue(proc.returnType, this.types, callEnv)));
        }
        if (proc.body) this.exec(proc.body, callEnv);
        if (proc.returnType) return callEnv.get(proc.name).ref.value;
        return undefined;
    }
}

function cloneValue(v) {
    if (v && v.__isArray) return { __isArray: true, lo: v.lo, hi: v.hi, items: v.items.map(cloneValue) };
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = {};
        for (const k of Object.keys(v)) o[k] = cloneValue(v[k]);
        return o;
    }
    return v;
}

// ============================================================================
// Public API
// ============================================================================

export function parse(src, sourceName) {
    const lex = new Lexer(src, sourceName);
    const tokens = lex.tokenize();
    const par = new Parser(tokens, sourceName);
    return par.parseUnitOrProgram();
}

export function makeInterpreter(host) {
    return new Interpreter(host);
}

// Default host: drawing routes to a 2D canvas context, RandInt to Math.random.
//
// `opts.margin` is the bbox tracker. If you don't supply one, the default uses
// +/-Infinity sentinels so the recovered bbox actually reflects the drawn
// segments rather than the canvas origin. Callers that want to *seed* the
// bbox at a known starting point (the way the Pascal's `IF zeromargin` block
// initialises `margin` to the seed point) should pass their own margin object
// and pre-set its fields.
export function defaultHost(ctx, opts = {}) {
    const inkStyle = opts.inkStyle ?? '#f6f1d6';
    const margin = opts.margin ?? {
        left:    Infinity,
        right:  -Infinity,
        top:     Infinity,
        bottom: -Infinity,
    };
    const segs = [];
    return {
        randint(n) { return Math.floor(Math.random() * n) + 1; },     // Pascal RandInt: 1..n
        randswell(cur) {
            // Swell/Same/Shrink ordinals: 0=swell, 1=same, 2=shrink (TYPE order in Globals).
            // The original picks a different one with some probability; we just rotate.
            return (cur + 1 + Math.floor(Math.random() * 2)) % 3;
        },
        picline(_pic, x0, y0, x1, y1, thick) {
            if (ctx) {
                ctx.lineWidth = Math.max(1, thick | 0);
                ctx.strokeStyle = inkStyle;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x0 + 0.5, y0 + 0.5);
                ctx.lineTo(x1 + 0.5, y1 + 0.5);
                ctx.stroke();
            }
            segs.push({ x0, y0, x1, y1, thick });
            margin.left   = Math.min(margin.left,   x0, x1);
            margin.right  = Math.max(margin.right,  x0, x1);
            margin.top    = Math.min(margin.top,    y0, y1);
            margin.bottom = Math.max(margin.bottom, y0, y1);
        },
        toolboxStub(name /*, ...args*/) { /* swallowed */ },
        getSegs:   () => segs,
        getMargin: () => ({ ...margin }),
    };
}
