const { Chess } = require('chess.js');

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Positional bonus for controlling central squares
const CENTER_BONUS = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [5, 10, 20, 25, 25, 20, 10,  5],
  [5, 15, 25, 35, 35, 25, 15,  5],
  [5, 15, 25, 35, 35, 25, 15,  5],
  [5, 10, 20, 25, 25, 20, 10,  5],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

function createInitialChessFen() {
  const chess = new Chess();
  return chess.fen();
}

function getLegalChessMoves(fen) {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).map((m) => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion || 'q',
    san: m.san,
    flags: m.flags
  }));
}

function applyChessMove(fen, moveReq) {
  const chess = new Chess(fen);
  try {
    const moveObj = chess.move({
      from: moveReq.from,
      to: moveReq.to,
      promotion: moveReq.promotion || 'q'
    });

    if (!moveObj) {
      return { valid: false, reason: 'ILLEGAL_MOVE' };
    }

    let winner = null;
    let isDraw = false;
    if (chess.isCheckmate()) {
      winner = moveObj.color; // 'w' or 'b'
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
      isDraw = true;
    }

    return {
      valid: true,
      move: {
        from: moveObj.from,
        to: moveObj.to,
        san: moveObj.san,
        promotion: moveObj.promotion
      },
      fen: chess.fen(),
      nextTurn: chess.turn(),
      inCheck: chess.inCheck(),
      winner,
      isDraw
    };
  } catch (err) {
    return { valid: false, reason: 'ILLEGAL_MOVE' };
  }
}

function evaluateChessBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const val = (PIECE_VALUES[cell.type] || 0) + CENTER_BONUS[r][c];
      if (cell.color === 'w') {
        score += val;
      } else {
        score -= val;
      }
    }
  }
  return score;
}

/**
 * Fast Alpha-Beta Minimax with Strict Node Search Cap (Prevents CPU Event Loop Freezing)
 */
function minimaxChess(chess, depth, alpha, beta, maximizing, state = { nodes: 0, maxNodes: 1200 }) {
  state.nodes++;
  if (depth === 0 || chess.isGameOver() || state.nodes >= state.maxNodes) {
    return { score: evaluateChessBoard(chess), move: null };
  }

  const moves = chess.moves({ verbose: true });
  if (!moves || moves.length === 0) {
    return { score: evaluateChessBoard(chess), move: null };
  }

  // Sort captures first for faster alpha-beta pruning
  moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

  let bestMove = moves[0] || null;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const evaluation = minimaxChess(chess, depth - 1, alpha, beta, false, state).score;
      chess.undo();
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = m;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha || state.nodes >= state.maxNodes) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      chess.move(m);
      const evaluation = minimaxChess(chess, depth - 1, alpha, beta, true, state).score;
      chess.undo();
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = m;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha || state.nodes >= state.maxNodes) break;
    }
    return { score: minEval, move: bestMove };
  }
}

function findBestChessMove(fen, depthOrDifficulty = 'medium') {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const allMoves = chess.moves({ verbose: true });
  if (!allMoves || allMoves.length === 0) return null;

  let depth = 2;
  let difficulty = 'medium';

  if (typeof depthOrDifficulty === 'number') {
    depth = depthOrDifficulty;
    difficulty = depth <= 1 ? 'easy' : depth <= 2 ? 'medium' : 'hard';
  } else if (typeof depthOrDifficulty === 'string') {
    difficulty = depthOrDifficulty.toLowerCase();
    if (difficulty === 'easy') depth = 1;
    else if (difficulty === 'hard') depth = 3;
    else depth = 2;
  }

  // Easy mode: 35% chance to make a random legal move (blunder / beginner simulation)
  if (difficulty === 'easy' && Math.random() < 0.35) {
    const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    return {
      from: randomMove.from,
      to: randomMove.to,
      promotion: randomMove.promotion || 'q',
      san: randomMove.san
    };
  }

  const maxNodes = difficulty === 'hard' ? 1400 : 700;
  const res = minimaxChess(chess, depth, -Infinity, Infinity, turn === 'w', { nodes: 0, maxNodes });
  const chosenMove = res.move || allMoves[0];
  return {
    from: chosenMove.from,
    to: chosenMove.to,
    promotion: chosenMove.promotion || 'q',
    san: chosenMove.san
  };
}

module.exports = {
  createInitialChessFen,
  getLegalChessMoves,
  applyChessMove,
  findBestChessMove
};
