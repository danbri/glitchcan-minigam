/**
 * LISP REPL for Elliott 4130
 * Compiles S-expressions to working assembly code
 *
 * Memory layout:
 *   100-199: Results and temps for evaluation
 *   500-599: Scratch space for operations
 *   1000+:   Cons cells (CAR:12bits | CDR:12bits in 24-bit word)
 *
 * Atoms: NIL=4095, T=4094, A=3072, B=3073, etc.
 */

const LispREPL = {
    // Atom table: name -> code
    atoms: {
        'NIL': 4095,
        'T': 4094,
        'LAMBDA': 3081,
        'QUOTE': 3082,
        'COND': 3083,
        'CAR': 3084,
        'CDR': 3085,
        'CONS': 3086,
        'ATOM': 3087,
        'EQ': 3088,
        'PLUS': 3089,
        'TIMES': 3090,
        'MINUS': 3091,
        'LABEL': 3092,
        'SETQ': 3093,
        'DEFUN': 3094,
        // Variables A-Z
        'A': 3072, 'B': 3073, 'C': 3074, 'D': 3075,
        'E': 3076, 'F': 3077, 'G': 3078, 'H': 3079,
        'I': 3080,
        'J': 3095, 'K': 3096, 'L': 3097,
        'M': 3098, 'N': 3099, 'O': 3103, 'P': 3104,
        'Q': 3105, 'R': 3106, 'S': 3107, 'T': 4094,
        'U': 3108, 'V': 3109, 'W': 3110,
        'X': 3100, 'Y': 3101, 'Z': 3102,
    },

    nextAtom: 3200,
    nextCell: 1000,
    nextTemp: 500,
    nextLabel: 0,
    cellMap: null,  // Maps AST nodes to cell addresses

    // Get or create atom code for a symbol
    getAtom(name) {
        name = name.toUpperCase();
        if (this.atoms[name] !== undefined) {
            return this.atoms[name];
        }
        if (/^-?\d+$/.test(name)) {
            const n = parseInt(name);
            if (n >= 0 && n < 1000) {
                return n;
            }
        }
        this.atoms[name] = this.nextAtom++;
        return this.atoms[name];
    },

    // Get atom name from code
    atomName(code) {
        for (const [name, val] of Object.entries(this.atoms)) {
            if (val === code) return name;
        }
        if (code >= 0 && code < 1000) return String(code);
        return null;
    },

    // Tokenize S-expression
    tokenize(str) {
        const tokens = [];
        let i = 0;
        while (i < str.length) {
            const c = str[i];
            if (c === ' ' || c === '\n' || c === '\t') {
                i++;
            } else if (c === '(' || c === ')' || c === "'") {
                tokens.push(c);
                i++;
            } else if (c === ';') {
                while (i < str.length && str[i] !== '\n') i++;
            } else {
                let tok = '';
                while (i < str.length && !/[\s()\';]/.test(str[i])) {
                    tok += str[i++];
                }
                if (tok) tokens.push(tok);
            }
        }
        return tokens;
    },

    // Parse tokens into AST
    parse(tokens) {
        let pos = 0;
        const parseExpr = () => {
            if (pos >= tokens.length) return null;
            const tok = tokens[pos++];
            if (tok === "'") {
                return ['QUOTE', parseExpr()];
            } else if (tok === '(') {
                const list = [];
                while (pos < tokens.length && tokens[pos] !== ')') {
                    list.push(parseExpr());
                }
                pos++;
                return list;
            } else if (tok === ')') {
                throw new Error('Unexpected )');
            } else {
                return tok;
            }
        };
        return parseExpr();
    },

    // Build cell structure, return { addr, cells }
    // Cells built bottom-up: (A B C) = (A . (B . (C . NIL)))
    buildCells(ast, startAddr = 1000) {
        const cells = [];
        let nextFree = startAddr;
        const nodeToAddr = new Map();

        const build = (node) => {
            if (node === null || node === undefined) return 4095;
            if (typeof node === 'string') return this.getAtom(node);
            if (Array.isArray(node)) {
                if (node.length === 0) return 4095;
                // Build in reverse to get proper list structure
                let cdr = 4095;  // NIL
                for (let i = node.length - 1; i >= 0; i--) {
                    const car = build(node[i]);
                    const addr = nextFree++;
                    cells.push({ addr, car, cdr });
                    cdr = addr;
                }
                nodeToAddr.set(node, cdr);  // cdr is now the head of the list
                return cdr;
            }
            return 4095;
        };

        const rootAddr = build(ast);
        return { addr: rootAddr, cells, nextFree, nodeToAddr };
    },

    // Reset compiler state
    resetCompiler() {
        this.nextCell = 1000;
        this.nextTemp = 500;
        this.nextLabel = 0;
        this.cellMap = new Map();
    },

    // Generate unique label
    genLabel(prefix) {
        return `${prefix}_${this.nextLabel++}`;
    },

    // Allocate temp location
    allocTemp() {
        return this.nextTemp++;
    },

    // Main compilation entry point
    compile(expr) {
        try {
            this.resetCompiler();
            const tokens = this.tokenize(expr);
            const ast = this.parse(tokens);
            const asm = this.generateAsm(ast, expr);
            return { success: true, asm };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    // Generate complete assembly
    generateAsm(ast, exprStr) {
        let asm = `; LISP: ${exprStr.trim().substring(0, 50)}\n`;
        asm += `; Compiled to Elliott 4130 assembly\n`;
        asm += `; Result at mem[100]\n\n`;

        // First, build all data cells needed for quoted structures
        const quotedCells = [];
        this.collectQuotedData(ast, quotedCells);

        if (quotedCells.length > 0) {
            asm += `; === Data cells ===\n`;
            for (const cell of quotedCells) {
                const carName = this.atomName(cell.car) || cell.car;
                const cdrName = cell.cdr === 4095 ? 'NIL' : cell.cdr;
                asm += `; Cell ${cell.addr}: (${carName} . ${cdrName})\n`;
                asm += `  LD    #${cell.car}\n`;
                asm += `  MULS  #4096\n`;
                asm += `  ADD   #${cell.cdr}\n`;
                asm += `  ST    ${cell.addr}\n\n`;
            }
        }

        // Generate evaluation code
        asm += `; === Evaluate ===\n`;
        asm += this.compileExpr(ast, 100);

        asm += `\n  J     HALT\nHALT: J HALT\n\n`;

        // Reserve result and temp space
        asm += `; Result\n100: #0\n`;
        for (let i = 500; i < this.nextTemp; i++) {
            asm += `${i}: #0\n`;
        }

        return asm;
    },

    // Collect all quoted data structures and build cells
    collectQuotedData(ast, cells) {
        if (!Array.isArray(ast)) return;

        const [op, ...args] = ast;
        if (typeof op === 'string' && op.toUpperCase() === 'QUOTE' && args.length > 0) {
            const quoted = args[0];
            if (Array.isArray(quoted) && quoted.length > 0) {
                const { cells: builtCells, addr } = this.buildCells(quoted, this.nextCell);
                this.nextCell += builtCells.length;
                // Store mapping from this QUOTE expression to its cell address
                this.cellMap.set(ast, addr);
                cells.push(...builtCells);
            }
        }

        // Recurse into arguments
        for (const arg of args) {
            this.collectQuotedData(arg, cells);
        }
    },

    // Compile expression, result goes to destAddr
    // Returns the assembly code
    compileExpr(ast, destAddr) {
        // Atom
        if (typeof ast === 'string') {
            const code = this.getAtom(ast);
            return `  LD    #${code}        ; ${ast}\n  ST    ${destAddr}\n`;
        }

        // Empty list = NIL
        if (!Array.isArray(ast) || ast.length === 0) {
            return `  LD    #4095        ; NIL\n  ST    ${destAddr}\n`;
        }

        const [op, ...args] = ast;
        const opName = typeof op === 'string' ? op.toUpperCase() : '';

        switch (opName) {
            case 'QUOTE':
                return this.compileQuote(ast, args, destAddr);
            case 'CAR':
                return this.compileCar(args, destAddr);
            case 'CDR':
                return this.compileCdr(args, destAddr);
            case 'CONS':
                return this.compileCons(args, destAddr);
            case 'ATOM':
                return this.compileAtom(args, destAddr);
            case 'EQ':
                return this.compileEq(args, destAddr);
            case 'NULL':
                return this.compileNull(args, destAddr);
            case 'PLUS':
                return this.compilePlus(args, destAddr);
            case 'MINUS':
                return this.compileMinus(args, destAddr);
            case 'TIMES':
                return this.compileTimes(args, destAddr);
            case 'COND':
                return this.compileCond(args, destAddr);
            default:
                // Unknown function - return the expression address
                return `; Unknown: ${opName}\n  LD    #4095\n  ST    ${destAddr}\n`;
        }
    },

    // (QUOTE x) -> x unevaluated
    compileQuote(ast, args, destAddr) {
        if (args.length === 0) {
            return `  LD    #4095        ; (QUOTE) = NIL\n  ST    ${destAddr}\n`;
        }
        const quoted = args[0];
        if (typeof quoted === 'string') {
            // Quoted atom
            const code = this.getAtom(quoted);
            return `  LD    #${code}        ; '${quoted}\n  ST    ${destAddr}\n`;
        }
        if (Array.isArray(quoted)) {
            if (quoted.length === 0) {
                return `  LD    #4095        ; 'NIL\n  ST    ${destAddr}\n`;
            }
            // Return address of the pre-built cell structure
            const cellAddr = this.cellMap.get(ast);
            if (cellAddr !== undefined) {
                return `  LD    #${cellAddr}        ; quoted list\n  ST    ${destAddr}\n`;
            }
        }
        return `  LD    #4095\n  ST    ${destAddr}\n`;
    },

    // (CAR x) -> first element of x
    compileCar(args, destAddr) {
        if (args.length === 0) {
            return `; CAR of nothing\n  LD    #4095\n  ST    ${destAddr}\n`;
        }

        // Evaluate argument to a temp
        const argTemp = this.allocTemp();
        let asm = `; CAR\n`;
        asm += this.compileExpr(args[0], argTemp);

        // argTemp now holds a cell address - extract CAR
        // CAR = cell DIV 4096
        asm += `  LD    ${argTemp}        ; cell addr\n`;
        asm += `  LDR   ${argTemp}\n`;
        asm += `  LD    0,R            ; load cell\n`;
        asm += `  DIV   #4096          ; extract CAR\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (CDR x) -> rest of list x
    compileCdr(args, destAddr) {
        if (args.length === 0) {
            return `; CDR of nothing\n  LD    #4095\n  ST    ${destAddr}\n`;
        }

        const argTemp = this.allocTemp();
        const cellTemp = this.allocTemp();
        const carTemp = this.allocTemp();

        let asm = `; CDR\n`;
        asm += this.compileExpr(args[0], argTemp);

        // CDR = cell - (CAR * 4096)
        asm += `  LD    ${argTemp}\n`;
        asm += `  LDR   ${argTemp}\n`;
        asm += `  LD    0,R            ; load cell\n`;
        asm += `  ST    ${cellTemp}\n`;
        asm += `  DIV   #4096\n`;
        asm += `  MULS  #4096          ; CAR * 4096\n`;
        asm += `  ST    ${carTemp}\n`;
        asm += `  LD    ${cellTemp}\n`;
        asm += `  SUB   ${carTemp}     ; cell - CAR*4096 = CDR\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (CONS x y) -> new cell with CAR=x, CDR=y
    compileCons(args, destAddr) {
        if (args.length < 2) {
            return `; CONS needs 2 args\n  LD    #4095\n  ST    ${destAddr}\n`;
        }

        const carTemp = this.allocTemp();
        const cdrTemp = this.allocTemp();
        const cellAddr = this.nextCell++;

        let asm = `; CONS\n`;
        asm += this.compileExpr(args[0], carTemp);
        asm += this.compileExpr(args[1], cdrTemp);

        // Build cell: CAR * 4096 + CDR
        asm += `  LD    ${carTemp}\n`;
        asm += `  MULS  #4096\n`;
        asm += `  ADD   ${cdrTemp}\n`;
        asm += `  ST    ${cellAddr}    ; new cell\n`;
        asm += `  LD    #${cellAddr}\n`;
        asm += `  ST    ${destAddr}    ; return cell addr\n`;

        return asm;
    },

    // (ATOM x) -> T if x is an atom, NIL otherwise
    compileAtom(args, destAddr) {
        if (args.length === 0) {
            return `  LD    #4094        ; ATOM of nothing = T\n  ST    ${destAddr}\n`;
        }

        const argTemp = this.allocTemp();
        const labelT = this.genLabel('ATOM_T');
        const labelDone = this.genLabel('ATOM_DONE');

        let asm = `; ATOM?\n`;
        asm += this.compileExpr(args[0], argTemp);

        // Atoms have codes >= 3072 (or are small numbers < 1000)
        // Cell addresses are 1000-3071
        asm += `  LD    ${argTemp}\n`;
        asm += `  SUB   #3072\n`;
        asm += `  JN    ${labelT}      ; < 3072, check if cell\n`;
        asm += `  LD    #4094          ; >= 3072 = atom, return T\n`;
        asm += `  J     ${labelDone}\n`;
        asm += `${labelT}:\n`;
        asm += `  LD    ${argTemp}\n`;
        asm += `  SUB   #1000\n`;
        asm += `  JN    ${labelDone}2  ; < 1000 = number atom\n`;
        asm += `  LD    #4095          ; cell range = NIL\n`;
        asm += `  J     ${labelDone}\n`;
        asm += `${labelDone}2:\n`;
        asm += `  LD    #4094          ; number = T\n`;
        asm += `${labelDone}:\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (NULL x) -> T if x is NIL
    compileNull(args, destAddr) {
        if (args.length === 0) {
            return `  LD    #4094\n  ST    ${destAddr}\n`;
        }

        const argTemp = this.allocTemp();
        const labelT = this.genLabel('NULL_T');
        const labelDone = this.genLabel('NULL_DONE');

        let asm = `; NULL?\n`;
        asm += this.compileExpr(args[0], argTemp);

        asm += `  LD    ${argTemp}\n`;
        asm += `  SUB   #4095          ; compare to NIL\n`;
        asm += `  JZ    ${labelT}\n`;
        asm += `  LD    #4095          ; not NIL\n`;
        asm += `  J     ${labelDone}\n`;
        asm += `${labelT}:\n`;
        asm += `  LD    #4094          ; is NIL, return T\n`;
        asm += `${labelDone}:\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (EQ x y) -> T if x and y are the same atom
    compileEq(args, destAddr) {
        if (args.length < 2) {
            return `  LD    #4095\n  ST    ${destAddr}\n`;
        }

        const xTemp = this.allocTemp();
        const yTemp = this.allocTemp();
        const labelT = this.genLabel('EQ_T');
        const labelDone = this.genLabel('EQ_DONE');

        let asm = `; EQ\n`;
        asm += this.compileExpr(args[0], xTemp);
        asm += this.compileExpr(args[1], yTemp);

        asm += `  LD    ${xTemp}\n`;
        asm += `  SUB   ${yTemp}\n`;
        asm += `  JZ    ${labelT}\n`;
        asm += `  LD    #4095          ; not equal\n`;
        asm += `  J     ${labelDone}\n`;
        asm += `${labelT}:\n`;
        asm += `  LD    #4094          ; equal\n`;
        asm += `${labelDone}:\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (PLUS x y) -> x + y
    compilePlus(args, destAddr) {
        if (args.length < 2) {
            return `  LD    #0\n  ST    ${destAddr}\n`;
        }

        const xTemp = this.allocTemp();
        const yTemp = this.allocTemp();

        let asm = `; PLUS\n`;
        asm += this.compileExpr(args[0], xTemp);
        asm += this.compileExpr(args[1], yTemp);

        asm += `  LD    ${xTemp}\n`;
        asm += `  ADD   ${yTemp}\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (MINUS x y) -> x - y
    compileMinus(args, destAddr) {
        if (args.length < 2) {
            return `  LD    #0\n  ST    ${destAddr}\n`;
        }

        const xTemp = this.allocTemp();
        const yTemp = this.allocTemp();

        let asm = `; MINUS\n`;
        asm += this.compileExpr(args[0], xTemp);
        asm += this.compileExpr(args[1], yTemp);

        asm += `  LD    ${xTemp}\n`;
        asm += `  SUB   ${yTemp}\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (TIMES x y) -> x * y
    compileTimes(args, destAddr) {
        if (args.length < 2) {
            return `  LD    #0\n  ST    ${destAddr}\n`;
        }

        const xTemp = this.allocTemp();
        const yTemp = this.allocTemp();

        let asm = `; TIMES\n`;
        asm += this.compileExpr(args[0], xTemp);
        asm += this.compileExpr(args[1], yTemp);

        asm += `  LD    ${xTemp}\n`;
        asm += `  MULS  ${yTemp}\n`;
        asm += `  ST    ${destAddr}\n`;

        return asm;
    },

    // (COND (p1 e1) (p2 e2) ...) -> evaluate predicates, return first true result
    compileCond(args, destAddr) {
        if (args.length === 0) {
            return `  LD    #4095\n  ST    ${destAddr}\n`;
        }

        const labelDone = this.genLabel('COND_DONE');
        let asm = `; COND\n`;

        for (let i = 0; i < args.length; i++) {
            const clause = args[i];
            if (!Array.isArray(clause) || clause.length < 2) continue;

            const [pred, expr] = clause;
            const predTemp = this.allocTemp();
            const labelNext = this.genLabel('COND_NEXT');

            // Evaluate predicate
            asm += this.compileExpr(pred, predTemp);

            // Check if NIL (false)
            asm += `  LD    ${predTemp}\n`;
            asm += `  SUB   #4095          ; compare to NIL\n`;
            asm += `  JZ    ${labelNext}   ; if NIL, try next\n`;

            // Predicate true - evaluate expression and done
            asm += this.compileExpr(expr, destAddr);
            asm += `  J     ${labelDone}\n`;
            asm += `${labelNext}:\n`;
        }

        // No clause matched - return NIL
        asm += `  LD    #4095\n`;
        asm += `  ST    ${destAddr}\n`;
        asm += `${labelDone}:\n`;

        return asm;
    },

    // Pretty print AST
    prettyPrint(ast, indent = 0) {
        if (ast === null) return 'NIL';
        if (typeof ast === 'string') return ast;
        if (Array.isArray(ast)) {
            if (ast.length === 0) return 'NIL';
            return '(' + ast.map(x => this.prettyPrint(x, indent)).join(' ') + ')';
        }
        return String(ast);
    }
};

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.LispREPL = LispREPL;
}
