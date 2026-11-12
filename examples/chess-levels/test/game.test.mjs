import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, legalMoves, play, undo, replay, status, bestMove, boardText, index, square } from '../game.mjs';

test('squares round-trip', () => { for (let i = 0; i < 25; i++) assert.equal(index(square(i)), i); assert.equal(index('f1'), -1); });

test('the opening position', () => {
  const g = newGame();
  assert.equal(status(g), 'play');
  // 5 pawn steps + 2 knight moves (b1 → a3, c3; nothing else can move)
  assert.deepEqual(legalMoves(g).map((m) => m.from + m.to).sort(), ['a2a3', 'b1a3', 'b1c3', 'b2b3', 'c2c3', 'd2d3', 'e2e3']);
});

test('an illegal move is refused and changes nothing', () => {
  const g = newGame();
  assert.equal(play(g, 'a2', 'a4'), null);          // no double step
  assert.equal(play(g, 'a5', 'a4'), null);          // not black's turn
  assert.deepEqual(g, newGame());
});

test('a pawn on the far rank becomes a queen', () => {
  const g = { board: '.....' + 'P....' + '.....' + '.....' + 'k...K', turn: 'w', moves: [] };
  assert.equal(play(g, 'a4', 'a5').board[0], 'Q');
});

test('checkmate and stalemate', () => {
  // black king a5, white queen b4 guarded by king c3: mate
  const mate = { board: 'k....' + '.Q...' + '..K..' + '.....' + '.....', turn: 'b', moves: [] };
  assert.equal(status(mate), 'checkmate');
  assert.equal(legalMoves(mate).length, 0);
  const stale = { board: 'k....' + '..Q..' + '.K...' + '.....' + '.....', turn: 'b', moves: [] };
  assert.equal(status(stale), 'stalemate');
  assert.equal(status({ board: 'k...........K............', turn: 'w', moves: [] }), 'draw');
});

test('a move may not leave its own king in check', () => {
  // white king e1, white rook e2 pinned by black rook e5
  const g = { board: '....r' + '.....' + '.....' + '....R' + '....K', turn: 'w', moves: [] };
  assert.ok(legalMoves(g).every((m) => m.from !== 'e2' || m.to[0] === 'e'));
});

test('undo and replay give back the same game', () => {
  let g = newGame();
  for (let k = 0; k < 6; k++) g = play(g, ...Object.values(bestMove(g, 2)));
  assert.equal(g.moves.length, 6);
  assert.deepEqual(replay(g.moves), g);
  assert.deepEqual(undo(g).moves, g.moves.slice(0, -1));
  assert.equal(replay(['a2a4']), null);
});

test('the opponent takes a free queen and finds mate in one', () => {
  const free = { board: 'k....' + '.....' + '..q..' + '...P.' + '....K', turn: 'w', moves: [] };
  assert.deepEqual(bestMove(free), { from: 'd2', to: 'c3' });
  const m1 = { board: 'k....' + '.....' + '.KQ..' + '.....' + '.....', turn: 'w', moves: [] };
  const mv = bestMove(m1);
  assert.equal(status(play(m1, mv.from, mv.to)), 'checkmate');
});

test('the opponent is fast enough to wait for', () => {
  const g = play(newGame(), 'c2', 'c3');
  const t = performance.now();
  bestMove(g, 3);
  assert.ok(performance.now() - t < 500, `depth 3 took ${performance.now() - t} ms`);
});

test('boardText', () => { assert.match(boardText(newGame()), /^5 r n b q k\n4 p p p p p\n3 \. \. \. \. \.\n2 P P P P P\n1 R N B Q K\n  a b c d e$/); });
