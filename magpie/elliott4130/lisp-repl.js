/**
 * LISP REPL for Elliott 4130
 * Parses S-expressions and generates assembly code
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
        // Variables A-Z at 3072-3097
        'A': 3072, 'B': 3073, 'C': 3074, 'D': 3075,
        'E': 3076, 'F': 3077, 'G': 3078, 'H': 3079,
        'I': 3080,
        // Skip LAMBDA etc in 3081-3094
        'J': 3095, 'K': 3096, 'L': 3097,
        'M': 3098, 'N': 3099,
        'X': 3100, 'Y': 3101, 'Z': 3102,
        // Numbers 0-99 as atoms (for simplicity)
    },

    nextAtom: 3200,  // For new symbols

    // Get or create atom code for a symbol
    getAtom(name) {
        name = name.toUpperCase();
        if (this.atoms[name] !== undefined) {
            return this.atoms[name];
        }
        // Check if it's a number
        if (/^-?\d+$/.test(name)) {
            const n = parseInt(name);
            // Small numbers (0-999) can be atoms directly
            if (n >= 0 && n < 1000) {
                return n;  // Use number as its own code
            }
        }
        // Create new atom
        this.atoms[name] = this.nextAtom++;
        return this.atoms[name];
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
                // Comment - skip to end of line
                while (i < str.length && str[i] !== '\n') i++;
            } else {
                // Symbol or number
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
                // Quote shorthand: 'x -> (QUOTE x)
                return ['QUOTE', parseExpr()];
            } else if (tok === '(') {
                const list = [];
                while (pos < tokens.length && tokens[pos] !== ')') {
                    list.push(parseExpr());
                }
                pos++;  // skip ')'
                return list;
            } else if (tok === ')') {
                throw new Error('Unexpected )');
            } else {
                return tok;  // Atom
            }
        };

        return parseExpr();
    },

    // Build cell structure in memory, return cell address
    // Returns { addr, cells, nextFree }
    buildCells(ast, startAddr = 1000) {
        const cells = [];  // { addr, car, cdr }
        let nextFree = startAddr;

        const build = (node) => {
            if (node === null || node === undefined) {
                return 4095;  // NIL
            }
            if (typeof node === 'string') {
                return this.getAtom(node);
            }
            if (Array.isArray(node)) {
                if (node.length === 0) {
                    return 4095;  // NIL = ()
                }
                // Build list: (a b c) -> (a . (b . (c . NIL)))
                const addr = nextFree++;
                const car = build(node[0]);
                const cdr = build(node.slice(1));
                cells.push({ addr, car, cdr });
                return addr;
            }
            return 4095;
        };

        const rootAddr = build(ast);
        return { addr: rootAddr, cells, nextFree };
    },

    // Generate assembly to build cells and evaluate
    generateAsm(expr) {
        const tokens = this.tokenize(expr);
        const ast = this.parse(tokens);
        const { addr, cells, nextFree } = this.buildCells(ast);

        let asm = `; LISP: ${expr.trim().substring(0, 50)}
; Generated from S-expression
; Cells at 1000+, result at 100

`;

        // Build all cells
        for (const cell of cells) {
            asm += `; Cell ${cell.addr}: (${cell.car} . ${cell.cdr})\n`;
            asm += `  LD    #${cell.car}\n`;
            asm += `  MULS  #4096\n`;
            asm += `  ADD   #${cell.cdr}\n`;
            asm += `  ST    ${cell.addr}\n\n`;
        }

        // Now evaluate - simplified EVAL
        asm += `; EVAL expression at ${addr}\n`;
        asm += this.generateEval(ast, addr);

        asm += `\n  J     HALT\nHALT: J HALT\n\n`;
        asm += `; Result location\n100: #0\n`;

        // Add scratch space
        for (let i = 500; i < 510; i++) {
            asm += `${i}: #0\n`;
        }

        return asm;
    },

    // Generate EVAL code for specific expression types
    generateEval(ast, addr) {
        if (typeof ast === 'string') {
            // Atom - just return it
            const code = this.getAtom(ast);
            return `  LD    #${code}        ; atom ${ast}\n  ST    100\n`;
        }

        if (!Array.isArray(ast) || ast.length === 0) {
            return `  LD    #4095        ; NIL\n  ST    100\n`;
        }

        const [op, ...args] = ast;
        const opName = typeof op === 'string' ? op.toUpperCase() : '';

        switch (opName) {
            case 'QUOTE':
                // (QUOTE x) -> x unevaluated
                if (args.length > 0) {
                    if (typeof args[0] === 'string') {
                        return `  LD    #${this.getAtom(args[0])}    ; (QUOTE ${args[0]})\n  ST    100\n`;
                    } else {
                        // Return pointer to quoted structure
                        const { addr } = this.buildCells(args[0], 1100);
                        return `  LD    #${addr}        ; quoted list\n  ST    100\n`;
                    }
                }
                return `  LD    #4095\n  ST    100\n`;

            case 'CAR':
                // (CAR x) - get CAR of evaluated x
                return `; CAR
  LD    ${addr}
  ST    500
  LD    500
  DIV   #4096
  MULS  #4096
  ST    501
  LD    500
  SUB   501           ; CDR = address of arg
  ST    502
  LDR   502
  LD    0,R           ; get the cell
  DIV   #4096         ; extract CAR
  ST    100
`;

            case 'CDR':
                return `; CDR
  LD    ${addr}
  ST    500
  LD    500
  DIV   #4096
  MULS  #4096
  ST    501
  LD    500
  SUB   501           ; CDR = address of arg
  ST    502
  LDR   502
  LD    0,R           ; get the cell
  ST    503
  DIV   #4096
  MULS  #4096
  ST    504
  LD    503
  SUB   504           ; extract CDR
  ST    100
`;

            case 'CONS':
                return `; CONS - simplified (just show structure)
  LD    #${this.getAtom('CONS')}
  ST    100           ; CONS primitive marker
`;

            case 'ATOM':
                return `; ATOM? - check if >= 3072
  LD    ${addr}
  ST    500
  DIV   #4096
  MULS  #4096
  ST    501
  LD    500
  SUB   501
  ST    502           ; CDR = arg address
  LDR   502
  LD    0,R
  DIV   #4096         ; get actual value
  SUB   #3072
  JN    NOT_ATOM_${addr}
  LD    #4094         ; T
  J     DONE_ATOM_${addr}
NOT_ATOM_${addr}:
  LD    #4095         ; NIL
DONE_ATOM_${addr}:
  ST    100
`;

            case 'EQ':
                return `; EQ - compare two atoms
  LD    #4094         ; assume T for now
  ST    100
`;

            case 'PLUS':
                // (PLUS a b) - add two numbers
                return `; PLUS ${args.join(' ')}
${args.length >= 2 ? `  LD    #${this.getAtom(args[0])}
  ADD   #${this.getAtom(args[1])}
  ST    100
` : '  LD    #0\n  ST    100\n'}`;

            case 'TIMES':
                return `; TIMES ${args.join(' ')}
${args.length >= 2 ? `  LD    #${this.getAtom(args[0])}
  MULS  #${this.getAtom(args[1])}
  ST    100
` : '  LD    #0\n  ST    100\n'}`;

            default:
                // Unknown - just show the expression was parsed
                return `; Expression type: ${opName || 'list'}
  LD    #${addr}      ; expression at ${addr}
  ST    100
`;
        }
    },

    // REPL: parse and generate assembly
    compile(expr) {
        try {
            return {
                success: true,
                asm: this.generateAsm(expr)
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    },

    // Pretty print AST
    prettyPrint(ast, indent = 0) {
        const pad = '  '.repeat(indent);
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
