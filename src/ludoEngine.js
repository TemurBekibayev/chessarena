// ============================================================================
// 4-PLAYER LUDO KING ENGINE (Authentic 15x15 Board — 52-cell track + Home Lanes)
// ============================================================================

const LUDO_COLORS = ['red', 'green', 'yellow', 'blue'];
const LUDO_LABELS = {
  red: '🔴 Qizil',
  green: '🟢 Yashil',
  yellow: '🟡 Sariq',
  blue: "🔵 Ko'k"
};

// 52-cell clockwise outer track on the 15x15 Ludo King board
// Starting at Red's start square [13, 6]
const TRACK_COORDS = [
  // Bottom arm left col going UP (0..4)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Left arm bottom row going LEFT (5..10)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // Left turn going UP (11..12)
  [7, 0], [6, 0],
  // Left arm top row going RIGHT (13..17) — 13 is Green Start [6,1]
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Top arm left col going UP (18..23)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // Top turn going RIGHT (24..25)
  [0, 7], [0, 8],
  // Top arm right col going DOWN (26..30) — 26 is Yellow Start [1,8]
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Right arm top row going RIGHT (31..36)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // Right turn going DOWN (37..38)
  [7, 14], [8, 14],
  // Right arm bottom row going LEFT (39..43) — 39 is Blue Start [8,13]
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Bottom arm right col going DOWN (44..49)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // Bottom turn going LEFT (50..51)
  [14, 7], [14, 6]
];

const START_TRACK_INDEX = {
  red: 0,     // [13, 6]
  green: 13,  // [6, 1]
  yellow: 26, // [1, 8]
  blue: 39    // [8, 13]
};

// 8 Safe squares (4 Start squares + 4 Star squares)
const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// 5-cell colored Home Stretch lanes (steps 51..55)
const HOME_LANE_COORDS = {
  red: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  yellow: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
};

// Finish pocket inside the 3x3 Center Home Triangle (step 56)
const FINISH_COORDS = {
  red: [8, 7],
  green: [7, 6],
  yellow: [6, 7],
  blue: [7, 8]
};

const FINISH_STEP = 56; // 0..50 on outer track (51 steps), 51..55 on home lane (5 steps), 56 = Home Goal!

/**
 * Each player has 4 tokens (`0, 1, 2, 3`):
 * Token 0 starts at `0` (on their colored Start square) and Tokens 1, 2, 3 sit in their 4 Base Circles (`-1`).
 */
function createInitialLudoTokens() {
  return {
    red: [0, -1, -1, -1],
    green: [0, -1, -1, -1],
    yellow: [0, -1, -1, -1],
    blue: [0, -1, -1, -1]
  };
}

function getAbsoluteTrackIndex(color, step) {
  if (step < 0 || step > 50) return null;
  const offset = START_TRACK_INDEX[color] || 0;
  return (offset + step) % 52;
}

function getTokenBoardCoords(color, tokenIdx, step) {
  if (step < 0) {
    return null; // Rendered inside the 4 Base Yard circles!
  }
  if (step >= FINISH_STEP) {
    return FINISH_COORDS[color];
  }
  if (step >= 51) {
    const laneIdx = step - 51; // 0..4
    return HOME_LANE_COORDS[color][laneIdx];
  }
  const absIdx = getAbsoluteTrackIndex(color, step);
  return TRACK_COORDS[absIdx];
}

function getLegalLudoMoves(tokens, color, dice) {
  const myTokens = tokens[color] || [-1, -1, -1, -1];
  const legal = [];

  for (let idx = 0; idx < myTokens.length; idx++) {
    const step = myTokens[idx];
    if (step >= FINISH_STEP) continue;
    if (step === -1) {
      if (dice === 6) {
        legal.push(idx);
      }
    } else if (step + dice <= FINISH_STEP) {
      legal.push(idx);
    }
  }
  return legal;
}

function applyLudoMove(tokensState, color, tokenIdx, dice) {
  const nextTokens = {
    red: [...tokensState.red],
    green: [...tokensState.green],
    yellow: [...tokensState.yellow],
    blue: [...tokensState.blue]
  };

  const curStep = nextTokens[color][tokenIdx];
  const newStep = curStep === -1 ? 0 : curStep + dice;
  nextTokens[color][tokenIdx] = newStep;

  const captured = [];
  const finishedToken = newStep === FINISH_STEP;

  // Check capture on outer track (0..50) if not on a safe square
  if (newStep >= 0 && newStep <= 50) {
    const myAbs = getAbsoluteTrackIndex(color, newStep);
    if (myAbs !== null && !SAFE_TRACK_INDICES.has(myAbs)) {
      for (const otherColor of LUDO_COLORS) {
        if (otherColor === color) continue;
        const otherArr = nextTokens[otherColor];
        for (let oIdx = 0; oIdx < otherArr.length; oIdx++) {
          const oStep = otherArr[oIdx];
          if (oStep >= 0 && oStep <= 50) {
            const oAbs = getAbsoluteTrackIndex(otherColor, oStep);
            if (oAbs === myAbs) {
              nextTokens[otherColor][oIdx] = -1;
              captured.push({ color: otherColor, tokenIdx: oIdx });
            }
          }
        }
      }
    }
  }

  // Win condition: all 4 tokens home (or 2 tokens in Quick mode)
  const finishedCount = nextTokens[color].filter((s) => s >= FINISH_STEP).length;
  const allFinished = finishedCount >= 4;
  const extraTurn = !allFinished && (dice === 6 || captured.length > 0 || finishedToken);

  return {
    tokens: nextTokens,
    captured,
    finishedToken,
    extraTurn,
    winnerColor: allFinished ? color : null
  };
}

function pickBestLudoBotMove(tokens, color, dice) {
  const legal = getLegalLudoMoves(tokens, color, dice);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  let bestIdx = legal[0];
  let bestScore = -999;

  for (const idx of legal) {
    const sim = applyLudoMove(tokens, color, idx, dice);
    let score = 0;
    if (sim.captured.length > 0) score += 120;
    if (sim.finishedToken) score += 90;
    if (tokens[color][idx] === -1) score += 60;
    const newStep = sim.tokens[color][idx];
    const abs = getAbsoluteTrackIndex(color, newStep);
    if (abs !== null && SAFE_TRACK_INDICES.has(abs)) score += 35;
    score += newStep;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

module.exports = {
  LUDO_COLORS,
  LUDO_LABELS,
  TRACK_COORDS,
  START_TRACK_INDEX,
  SAFE_TRACK_INDICES,
  HOME_LANE_COORDS,
  FINISH_COORDS,
  FINISH_STEP,
  createInitialLudoTokens,
  getAbsoluteTrackIndex,
  getTokenBoardCoords,
  getLegalLudoMoves,
  applyLudoMove,
  pickBestLudoBotMove
};
