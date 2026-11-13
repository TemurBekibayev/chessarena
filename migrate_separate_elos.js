const fs = require('fs');

function calculateEloChange(ratingA, ratingB, scoreA) {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(K * (scoreA - expectedA));
}

function runEloMigration(dbPath) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const users = db.users || {};

  // 1. Reset all users to baseline 1000 for each game
  for (const uid of Object.keys(users)) {
    const u = users[uid];
    u.eloCheckers = 1000;
    u.eloChess = 1000;
    u.eloZakovat = u.eloZakovat || 1000;
    u.eloLudo = u.eloLudo || 1000;
  }

  // 2. Sort matches by endedAt
  const matches = (db.matchesHistory || []).slice().sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));

  for (const m of matches) {
    const game = m.game === 'chess' ? 'chess' : 'checkers';
    const wId = String(m.whiteId || '');
    const bId = String(m.blackId || '');

    const wIsBot = wId.startsWith('bot_') || wId.startsWith('tour_');
    const bIsBot = bId.startsWith('bot_') || bId.startsWith('tour_');

    const wUser = !wIsBot ? users[wId] : null;
    const bUser = !bIsBot ? users[bId] : null;

    const wElo = wUser ? (game === 'chess' ? wUser.eloChess : wUser.eloCheckers) : 1000;
    const bElo = bUser ? (game === 'chess' ? bUser.eloChess : bUser.eloCheckers) : 1000;

    const scoreW = m.winnerColor === 'w' ? 1 : m.winnerColor === 'b' ? 0 : 0.5;
    const scoreB = 1 - scoreW;

    const deltaW = calculateEloChange(wElo, bElo, scoreW);
    const deltaB = calculateEloChange(bElo, wElo, scoreB);

    if (wUser) {
      if (game === 'chess') {
        wUser.eloChess = Math.max(800, (wUser.eloChess || 1000) + deltaW);
      } else {
        wUser.eloCheckers = Math.max(800, (wUser.eloCheckers || 1000) + deltaW);
      }
    }

    if (bUser) {
      if (game === 'chess') {
        bUser.eloChess = Math.max(800, (bUser.eloChess || 1000) + deltaB);
      } else {
        bUser.eloCheckers = Math.max(800, (bUser.eloCheckers || 1000) + deltaB);
      }
    }
  }

  // 3. Update overall display ELO (weighted / primary)
  for (const uid of Object.keys(users)) {
    const u = users[uid];
    const chk = u.checkersPlayed || 0;
    const chs = u.chessPlayed || 0;
    if (chk > 0 && chs === 0) {
      u.elo = u.eloCheckers;
    } else if (chs > 0 && chk === 0) {
      u.elo = u.eloChess;
    } else if (chk > 0 && chs > 0) {
      u.elo = Math.round((u.eloCheckers * chk + u.eloChess * chs) / (chk + chs));
    } else {
      u.elo = 1000;
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Migration completed successfully for:', dbPath);
}

runEloMigration('data/database.json');
