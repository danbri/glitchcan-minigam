// The rules of 5×5 chess (Gardner's minichess), and a small opponent. No DOM, no I/O: the page,
// the tests and (from level 3) the app's tools all use these same functions.
//
// The board is 25 squares, a5 at index 0 and e1 at index 24. A square holds '.', or a piece:
// upper case white (KQRBNP), lower case black. No castling, no double pawn step, no en passant;
// a pawn that reaches the far rank becomes a queen. Checkmate wins; stalemate, or kings alone,
// is a draw.

const START = 'rnbqk' + 'ppppp' + '.....' + 'PPPPP' + 'RNBQK';
const N = 5;
const DIRS = { R: [[1, 0], [-1, 0], [0, 1], [0, -1]], B: [[1, 1], [1, -1], [-1, 1], [-1, -1]] };
DIRS.Q = DIRS.K = [...DIRS.R, ...DIRS.B];
const JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export const square = (i) => 'abcde'[i % N] + (N - Math.floor(i / N));
export const index = (sq) => (/^[a-e][1-5]$/.test(sq) ? (N - +sq[1]) * N + 'abcde'.indexOf(sq[0]) : -1);
const colour = (p) => (p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');

export function newGame() { return { board: START, turn: 'w', moves: [] }; }

/** Moves that follow how the pieces move, ignoring whether the mover's king is left in check. */
function pseudo(board, turn) {
  const out = [];
  for (let i = 0; i < 25; i++) {
    const p = board[i];
    if (colour(p) !== turn) continue;
    const r = Math.floor(i / N), c = i % N, t = p.toUpperCase();
    const add = (rr, cc, { capture = true, quiet = true } = {}) => {
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) return false;
      const j = rr * N + cc, q = board[j];
      if (q === '.') { if (quiet) out.push([i, j]); return true; }
      if (capture && colour(q) !== turn) out.push([i, j]);
      return false;
    };
    if (t === 'P') {
      const f = turn === 'w' ? -1 : 1;
      add(r + f, c, { capture: false });
      for (const dc of [-1, 1]) add(r + f, c + dc, { quiet: false });
    } else if (t === 'N') for (const [dr, dc] of JUMPS) add(r + dr, c + dc);
    else for (const [dr, dc] of DIRS[t]) {
      let rr = r + dr, cc = c + dc;
      while (add(rr, cc) && t !== 'K') { rr += dr; cc += dc; }
    }
  }
  return out;
}

function apply(board, [i, j]) {
  let p = board[i];
  if (p === 'P' && j < N) p = 'Q';
  if (p === 'p' && j >= 20) p = 'q';
  const b = board.split('');
  b[j] = p; b[i] = '.';
  return b.join('');
}

function inCheck(board, who) {
  const k = board.indexOf(who === 'w' ? 'K' : 'k');
  return pseudo(board, who === 'w' ? 'b' : 'w').some(([, j]) => j === k);
}

function legal(board, turn) { return pseudo(board, turn).filter((m) => !inCheck(apply(board, m), turn)); }

/** Every legal move for the side to move, as { from, to } in square names. */
export function legalMoves(g) { return legal(g.board, g.turn).map(([i, j]) => ({ from: square(i), to: square(j) })); }

/** 'play', 'check', 'checkmate', 'stalemate' or 'draw' (kings alone). */
export function status(g) {
  if (!/[^.Kk]/.test(g.board)) return 'draw';
  const any = legal(g.board, g.turn).length > 0;
  const check = inCheck(g.board, g.turn);
  return any ? (check ? 'check' : 'play') : (check ? 'checkmate' : 'stalemate');
}
export const over = (g) => ['checkmate', 'stalemate', 'draw'].includes(status(g));

/** Play from → to. Returns the new game, or null if the move is not legal. */
export function play(g, from, to) {
  const i = index(from), j = index(to);
  if (over(g) || !legal(g.board, g.turn).some(([a, b]) => a === i && b === j)) return null;
  return { board: apply(g.board, [i, j]), turn: g.turn === 'w' ? 'b' : 'w', moves: [...g.moves, from + to] };
}

/** Take back the last move. */
export function undo(g) {
  return g.moves.slice(0, -1).reduce((s, m) => play(s, m.slice(0, 2), m.slice(2)), newGame());
}

/** The game from its list of moves, or null if one is not legal. */
export function replay(moves) {
  let g = newGame();
  for (const m of moves) { g = /^[a-e][1-5][a-e][1-5]$/.test(m) && play(g, m.slice(0, 2), m.slice(2)); if (!g) return null; }
  return g;
}

function score(board) {   // material, from white's side
  let s = 0;
  for (const p of board) if (p !== '.') s += (colour(p) === 'w' ? 1 : -1) * VALUE[p.toUpperCase()];
  return s;
}

function search(board, turn, depth, alpha, beta) {
  const moves = legal(board, turn);
  const sign = turn === 'w' ? 1 : -1;
  if (!moves.length) return inCheck(board, turn) ? -1000 - depth : 0;
  if (depth === 0) return sign * score(board);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(apply(board, m), turn === 'w' ? 'b' : 'w', depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The opponent's choice: the best move by material, `depth` plies ahead; the first of equals. */
export function bestMove(g, depth = 3) {
  let best = null, bestV = -Infinity;
  for (const [i, j] of legal(g.board, g.turn)) {
    const v = -search(apply(g.board, [i, j]), g.turn === 'w' ? 'b' : 'w', depth - 1, -Infinity, -bestV);
    if (v > bestV) { bestV = v; best = { from: square(i), to: square(j) }; }
  }
  return best;
}

/** The board as five lines of text, rank 5 first: for tests, screen readers and tools. */
export function boardText(g) {
  return Array.from({ length: N }, (_, r) => `${N - r} ${g.board.slice(r * N, r * N + N).split('').join(' ')}`).join('\n') + '\n  a b c d e';
}
