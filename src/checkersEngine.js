/**
 * Server-Authoritative Checkers (Shashka) Engine + Minimax Alpha-Beta AI
 * Board representation: 32 playable dark squares indexed 0..31.
 * Pieces:
 *   'w' = White man, 'W' = White king (Damka)
 *   'b' = Black man, 'B' = Black king (Damka)
 *   null = Empty square
 */

function createInitialCheckersBoard() {
  const board = new Array(32).fill(null);
  for (let i = 0; i < 12; i++) board[i] = 'b';
  for (let i = 20; i < 32; i++) board[i] = 'w';
  return board;
}

function indexToRowCol(idx) {
  const row = Math.floor(idx / 4);
  const col = (idx % 4) * 2 + (row % 2 === 0 ? 1 : 0);
  return { row, col };
}

function rowColToIndex(row, col) {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
  if ((row + col) % 2 === 0) return -1;
  return row * 4 + Math.floor(col / 2);
}

function isPlayerPiece(piece, turn) {
  if (!piece) return false;
  return turn === 'w' ? (piece === 'w' || piece === 'W') : (piece === 'b' || piece === 'B');
}

function isOpponentPiece(piece, turn) {
  if (!piece) return false;
  return turn === 'w' ? (piece === 'b' || piece === 'B') : (piece === 'w' || piece === 'W');
}

function isKing(piece) {
  return piece === 'W' || piece === 'B';
}

/**
 * Finds all capture chains starting from `idx` for `piece`.
 * Supports Russian/Uzbek Draughts "Flying King" (Uzun Damka) rules!
 */
function getCaptureChainsForPiece(board, idx, piece, turn, visitedCaptured = []) {
  const { row, col } = indexToRowCol(idx);
  const directions = [
    [-1, -1], [-1, 1],
    [1, -1], [1, 1]
  ];

  const chains = [];

  if (!isKing(piece)) {
    // Regular man ('w' or 'b'): jumps 1 opponent piece to the immediate empty square behind it
    for (const [dr, dc] of directions) {
      const midRow = row + dr;
      const midCol = col + dc;
      const landRow = row + dr * 2;
      const landCol = col + dc * 2;

      const midIdx = rowColToIndex(midRow, midCol);
      const landIdx = rowColToIndex(landRow, landCol);

      if (midIdx !== -1 && landIdx !== -1) {
        const midPiece = board[midIdx];
        const landPiece = board[landIdx];

        if (
          isOpponentPiece(midPiece, turn) &&
          !visitedCaptured.includes(midIdx) &&
          landPiece === null
        ) {
          const nextBoard = board.slice();
          nextBoard[idx] = null;
          nextBoard[midIdx] = null;

          // Russian Shashka rule: if a man reaches the promotion row during a capture, it immediately becomes a Damka!
          let nextPiece = piece;
          if (turn === 'w' && landRow === 0) nextPiece = 'W';
          if (turn === 'b' && landRow === 7) nextPiece = 'B';
          nextBoard[landIdx] = nextPiece;

          const nextVisited = [...visitedCaptured, midIdx];
          const subChains = getCaptureChainsForPiece(nextBoard, landIdx, nextPiece, turn, nextVisited);

          if (subChains.length > 0) {
            for (const sub of subChains) {
              chains.push({
                from: idx,
                to: sub.to,
                path: [idx, ...sub.path.slice(1)],
                captured: [midIdx, ...sub.captured],
                promoted: isKing(nextPiece) || sub.promoted
              });
            }
          } else {
            chains.push({
              from: idx,
              to: landIdx,
              path: [idx, landIdx],
              captured: [midIdx],
              promoted: isKing(nextPiece)
            });
          }
        }
      }
    }
  } else {
    // Flying King / Uzun Damka ('W' or 'B'): can fly across empty squares, jump an opponent piece,
    // and land on any empty square behind it along the same diagonal!
    for (const [dr, dc] of directions) {
      let step = 1;
      let midIdx = -1;
      let midRow = -1;
      let midCol = -1;

      while (true) {
        const r = row + dr * step;
        const c = col + dc * step;
        const scanIdx = rowColToIndex(r, c);
        if (scanIdx === -1) break;

        const sqPiece = board[scanIdx];
        if (sqPiece === null) {
          step++;
          continue;
        }
        if (
          isOpponentPiece(sqPiece, turn) &&
          !visitedCaptured.includes(scanIdx)
        ) {
          midIdx = scanIdx;
          midRow = r;
          midCol = c;
        }
        break; // Stop scanning further pieces on this diagonal
      }

      if (midIdx !== -1) {
        const landingSquaresWithContinuation = [];
        const simpleLandingMoves = [];

        let afterStep = 1;
        while (true) {
          const landRow = midRow + dr * afterStep;
          const landCol = midCol + dc * afterStep;
          const landIdx = rowColToIndex(landRow, landCol);
          if (landIdx === -1 || board[landIdx] !== null) break;

          const nextBoard = board.slice();
          nextBoard[idx] = null;
          nextBoard[midIdx] = null;
          nextBoard[landIdx] = piece;

          const nextVisited = [...visitedCaptured, midIdx];
          const subChains = getCaptureChainsForPiece(nextBoard, landIdx, piece, turn, nextVisited);

          if (subChains.length > 0) {
            for (const sub of subChains) {
              landingSquaresWithContinuation.push({
                from: idx,
                to: sub.to,
                path: [idx, ...sub.path.slice(1)],
                captured: [midIdx, ...sub.captured],
                promoted: true
              });
            }
          } else {
            simpleLandingMoves.push({
              from: idx,
              to: landIdx,
              path: [idx, landIdx],
              captured: [midIdx],
              promoted: true
            });
          }

          afterStep++;
        }

        if (landingSquaresWithContinuation.length > 0) {
          chains.push(...landingSquaresWithContinuation);
        } else {
          chains.push(...simpleLandingMoves);
        }
      }
    }
  }

  return chains;
}

/**
 * Returns all legal moves for `turn` ('w' or 'b').
 * Mandatory capture rule: if any capture exists, only captures are legal.
 */
function getLegalCheckersMoves(board, turn) {
  const captureMoves = [];
  const normalMoves = [];

  for (let idx = 0; idx < 32; idx++) {
    const piece = board[idx];
    if (!isPlayerPiece(piece, turn)) continue;

    // 1. Check captures (men can capture both forward and backward in Russian/Uzbek shashka!)
    const captures = getCaptureChainsForPiece(board, idx, piece, turn);
    if (captures.length > 0) {
      captureMoves.push(...captures);
    }

    // 2. If no captures found yet, collect normal moves
    if (captureMoves.length === 0) {
      const { row, col } = indexToRowCol(idx);
      if (isKing(piece)) {
        // Flying Damka: can slide any number of empty squares along all 4 diagonals
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            const nextIdx = rowColToIndex(row + dr * step, col + dc * step);
            if (nextIdx === -1 || board[nextIdx] !== null) break;
            normalMoves.push({
              from: idx,
              to: nextIdx,
              path: [idx, nextIdx],
              captured: []
            });
            step++;
          }
        }
      } else {
        const dirs = turn === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          const nextIdx = rowColToIndex(row + dr, col + dc);
          if (nextIdx !== -1 && board[nextIdx] === null) {
            normalMoves.push({
              from: idx,
              to: nextIdx,
              path: [idx, nextIdx],
              captured: []
            });
          }
        }
      }
    }
  }

  return captureMoves.length > 0 ? captureMoves : normalMoves;
}

/**
 * Validates and applies a move on `board`.
 */
function applyCheckersMove(board, turn, moveReq) {
  const legalMoves = getLegalCheckersMoves(board, turn);
  const matched = legalMoves.find((m) => {
    if (m.from !== Number(moveReq.from) || m.to !== Number(moveReq.to)) return false;
    if (Array.isArray(moveReq.path) && moveReq.path.length > 2) {
      return JSON.stringify(m.path) === JSON.stringify(moveReq.path.map(Number));
    }
    return true;
  });

  if (!matched) {
    return { valid: false, reason: 'ILLEGAL_MOVE' };
  }

  const nextBoard = board.slice();
  let piece = nextBoard[matched.from];
  nextBoard[matched.from] = null;

  for (const capIdx of matched.captured) {
    nextBoard[capIdx] = null;
  }

  const { row: destRow } = indexToRowCol(matched.to);
  if (turn === 'w' && (destRow === 0 || matched.promoted)) piece = 'W';
  if (turn === 'b' && (destRow === 7 || matched.promoted)) piece = 'B';
  nextBoard[matched.to] = piece;

  const nextTurn = turn === 'w' ? 'b' : 'w';
  const opponentMoves = getLegalCheckersMoves(nextBoard, nextTurn);
  const winner = opponentMoves.length === 0 ? turn : null;

  return {
    valid: true,
    move: matched,
    board: nextBoard,
    nextTurn,
    winner
  };
}

/**
 * Evaluates board position from White's perspective.
 */
function evaluateCheckersBoard(board) {
  let score = 0;
  for (let i = 0; i < 32; i++) {
    const p = board[i];
    if (!p) continue;
    const { row, col } = indexToRowCol(i);
    const centerBonus = (col >= 2 && col <= 5 && row >= 2 && row <= 5) ? 12 : 0;

    if (p === 'w') {
      score += 100 + (7 - row) * 6 + centerBonus;
    } else if (p === 'W') {
      score += 280 + centerBonus * 2;
    } else if (p === 'b') {
      score -= 100 + row * 6 + centerBonus;
    } else if (p === 'B') {
      score -= 280 + centerBonus * 2;
    }
  }
  return score;
}

/**
 * Minimax with Alpha-Beta Pruning and Strict Node Cap (Prevents Event Loop Lag/Freezing)
 */
function minimaxCheckers(board, depth, alpha, beta, maximizingPlayer, state = { nodes: 0, maxNodes: 2500 }) {
  state.nodes++;
  const turn = maximizingPlayer ? 'w' : 'b';
  const moves = getLegalCheckersMoves(board, turn);

  if (moves.length === 0) {
    return { score: maximizingPlayer ? -10000 - depth : 10000 + depth, move: null };
  }
  if (depth === 0 || state.nodes >= state.maxNodes) {
    return { score: evaluateCheckersBoard(board), move: moves[0] };
  }

  // Sort captures first for maximum alpha-beta cutoff efficiency
  moves.sort((a, b) => (b.captured?.length || 0) - (a.captured?.length || 0));

  let bestMove = moves[0];

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const res = applyCheckersMove(board, 'w', move);
      const evaluation = minimaxCheckers(res.board, depth - 1, alpha, beta, false, state).score;
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha || state.nodes >= state.maxNodes) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const res = applyCheckersMove(board, 'b', move);
      const evaluation = minimaxCheckers(res.board, depth - 1, alpha, beta, true, state).score;
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha || state.nodes >= state.maxNodes) break;
    }
    return { score: minEval, move: bestMove };
  }
}

function findBestCheckersMove(board, turn, depthOrDifficulty = 'medium') {
  let depth = 3;
  let difficulty = 'medium';

  if (typeof depthOrDifficulty === 'number') {
    depth = depthOrDifficulty;
    difficulty = depth <= 2 ? 'easy' : depth <= 3 ? 'medium' : 'hard';
  } else if (typeof depthOrDifficulty === 'string') {
    difficulty = depthOrDifficulty.toLowerCase();
    if (difficulty === 'easy') depth = 1;
    else if (difficulty === 'hard') depth = 4;
    else depth = 2;
  }

  const moves = getLegalCheckersMoves(board, turn);
  if (!moves || moves.length === 0) return null;

  // Easy mode: 35% chance to make a random legal move (blunder / beginner simulation)
  if (difficulty === 'easy' && Math.random() < 0.35) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const maxNodes = difficulty === 'hard' ? 3000 : 1500;
  const result = minimaxCheckers(board, depth, -Infinity, Infinity, turn === 'w', { nodes: 0, maxNodes });
  return result.move || moves[0];
}

module.exports = {
  createInitialCheckersBoard,
  indexToRowCol,
  rowColToIndex,
  getLegalCheckersMoves,
  applyCheckersMove,
  findBestCheckersMove
};
