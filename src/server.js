require('dotenv').config();
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const {
  loadDb,
  saveDb,
  withUserLock,
  getOrCreateUser,
  getTotalCoins,
  deductCoins,
  calculateEloChange,
  formatUserClientState,
  getNextTashkentTimeMs
} = require('./db');

const {
  verifyTelegramInitData,
  canMatchPlayers,
  evaluateMatchAntiCheat
} = require('./security');

const {
  createInitialCheckersBoard,
  getLegalCheckersMoves,
  applyCheckersMove,
  findBestCheckersMove
} = require('./checkersEngine');

const {
  createInitialChessFen,
  getLegalChessMoves,
  applyChessMove,
  findBestChessMove
} = require('./chessEngine');

const { pickQuestionsForZakovatRoom } = require('./zakovatEngine');
const {
  LUDO_COLORS,
  LUDO_LABELS,
  FINISH_STEP,
  createInitialLudoTokens,
  getTokenBoardCoords,
  getLegalLudoMoves,
  applyLudoMove,
  pickBestLudoBotMove
} = require('./ludoEngine');

const { TelegramBotService } = require('./bot');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const BOT_USERNAME = process.env.BOT_USERNAME || 'ChessTonArenaBot';
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || '';
const ADSGRAM_BLOCK_ID = process.env.ADSGRAM_BLOCK_ID || '58136';
const ADSGRAM_INTERSTITIAL_BLOCK_ID = process.env.ADSGRAM_INTERSTITIAL_BLOCK_ID || 'int-58970';
const ALLOW_DEV_MODE =
  process.env.ALLOW_DEV_MODE === 'true' ||
  (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE');

const MOVE_TIME_LIMIT_SEC = 60; // Default 60s for Chess, 45s for Checkers
const CHECKERS_MOVE_TIME_LIMIT_SEC = 45;
const CHESS_MOVE_TIME_LIMIT_SEC = 60;
const RAKE_PERCENT = 0.12; // 12% platform commission on PvP stakes

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Active connections & matchmaking state
const clientsByUserId = new Map();
const matchmakingQueue = []; // [{ userId, ws, game, stake, ip, queuedAt, botTimer }]
const activeMatches = new Map(); // matchId -> MatchObject
const duelRooms = new Map(); // duelId -> { duelId, chatId, messageId, hostId, hostName, game, firstUserId, status, createdAt }
const pendingGroupRoomMeta = new Map(); // roomId -> { game, roomId, chatId, messageId, hostId, hostName }

const BOT_PROFILES = [
  { id: 'bot_1', name: 'Javohir Usta', eloOffset: 25 },
  { id: 'bot_2', name: 'Dmitriy K.', eloOffset: -15 },
  { id: 'bot_3', name: 'Bekzod_99', eloOffset: 10 },
  { id: 'bot_4', name: 'Amina Chess', eloOffset: -20 },
  { id: 'bot_5', name: 'Timur_Pro', eloOffset: 35 },
  { id: 'bot_6', name: 'Lucas M.', eloOffset: 5 }
];

const SHOP_ITEMS = [
  // Taxtalar
  { id: 'board_classic', type: 'board', skinKey: 'classic', title: '🪵 Klassik Yog\'och', price: 0, desc: 'Standart tabiiy yog\'och taxta', icon: '🪵' },
  { id: 'board_ice', type: 'board', skinKey: 'ice', title: '❄️ Qishki Muz (Ice Crystal)', price: 150, desc: 'Muzdek moviy kristall taxta', icon: '❄️' },
  { id: 'board_neon', type: 'board', skinKey: 'neon', title: '⚡ Kiberpank Neon (Emerald)', price: 300, desc: 'Zumrad va kiber-neon chiroqlar', icon: '⚡' },
  { id: 'board_gold', type: 'board', skinKey: 'gold', title: '👑 Qirollik Oltini (Royal Marble)', price: 600, desc: 'Qora marmar va 24k oltin jilo', icon: '👑' },
  // Donalar
  { id: 'piece_classic', type: 'piece', skinKey: 'classic', title: '⚪ Standart Donalar', price: 0, desc: 'Klassik shaxmat va shashka toshlari', icon: '⚪' },
  { id: 'piece_neon', type: 'piece', skinKey: 'neon', title: '💎 Neon Donalar', price: 200, desc: 'Yaltiroq kiber donalar', icon: '💎' },
  { id: 'piece_gold', type: 'piece', skinKey: 'gold', title: '🥇 Oltin Donalar', price: 450, desc: 'Qirollik oltin toshlari', icon: '🥇' },
  // VIP
  { id: 'vip_7d', type: 'vip', title: '👑 VIP Status (7 kun)', price: 500, desc: '2x kunlik bonus, Oltin Toj va eksklyuziv status', icon: '👑' }
];

const REF_MILESTONES = [
  { count: 1, reward: 15, title: '1 ta do\'st', desc: '+15 G bonus' },
  { count: 3, reward: 50, title: '3 ta do\'st', desc: '+50 G bonus' },
  { count: 5, reward: 120, vipDays: 7, title: '5 ta do\'st', desc: '+120 G va 7 kunlik VIP Status 👑' },
  { count: 10, reward: 300, unlockSkin: 'board_gold', title: '10 ta do\'st', desc: '+300 G va "Qirollik Oltini" taxtasi 👑' }
];

const botService = new TelegramBotService({
  token: BOT_TOKEN,
  webappUrl: WEBAPP_URL,
  botUsername: BOT_USERNAME,
  adminId: ADMIN_TELEGRAM_ID,
  onBalanceUpdated: (userId) => {
    const ws = clientsByUserId.get(String(userId));
    if (ws) sendFullSync(ws, String(userId));
  },
  onDuelCreated: (roomData) => {
    duelRooms.set(roomData.duelId, {
      ...roomData,
      game: 'checkers',
      firstUserId: null,
      status: 'waiting',
      createdAt: Date.now()
    });
  },
  onGroupRoomCreated: (roomData) => {
    pendingGroupRoomMeta.set(roomData.roomId, roomData);
    if (roomData.game === 'zakovat') {
      const r = activeZakovatRooms.get(roomData.roomId);
      if (r) {
        r.chatId = roomData.chatId;
        r.messageId = roomData.messageId;
      }
    } else if (roomData.game === 'ludo') {
      const r = activeLudoRooms.get(roomData.roomId);
      if (r) {
        r.chatId = roomData.chatId;
        r.messageId = roomData.messageId;
      }
    }
  },
  onDuelCancelledByHost: async (duelId, userId) => {
    const room = duelRooms.get(duelId);
    if (!room) return { ok: false, message: "Duel topilmadi yoki allaqachon tugagan." };
    if (room.status !== 'waiting') return { ok: false, message: "Bu duel allaqachon boshlangan." };
    if (String(room.hostId) !== String(userId)) return { ok: false, message: "Faqat duel chaqiruvchisi bekor qilishi mumkin." };
    room.status = 'cancelled';
    duelRooms.delete(duelId);
    const db = loadDb();
    const user = db.users[String(userId)];
    await botService.updateDuelGroupMessageCancelled(room, user);
    if (room.firstUserId) {
      const ws = clientsByUserId.get(String(room.firstUserId));
      if (ws) sendPacket(ws, 'DUEL_CANCELLED', { duelId, reason: 'CANCELLED_BY_HOST' });
    }
    return { ok: true };
  }
});

function sendPacket(ws, type, data = {}) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ v: 1, t: type, d: data }));
  }
}

function getLeaderboardList(lang = 'uz', game = 'checkers') {
  const db = loadDb();
  const eloKey = game === 'chess' ? 'eloChess' : (game === 'zakovat' ? 'eloZakovat' : (game === 'ludo' ? 'eloLudo' : 'eloCheckers'));
  const winKey = game === 'chess' ? 'chessWins' : (game === 'zakovat' ? 'zakovatWins' : (game === 'ludo' ? 'ludoWins' : 'checkersWins'));
  return Object.values(db.users)
    .sort((a, b) => ((b[eloKey] ?? 1000) - (a[eloKey] ?? 1000)))
    .slice(0, 20)
    .map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      name: u.name,
      elo: u[eloKey] ?? 1000,
      wins: u[winKey] ?? (game === 'checkers' ? (u.wins || 0) : 0),
      trustScore: u.trustScore ?? 100
    }));
}

function getUserConversions(userId) {
  const db = loadDb();
  return (db.conversions || [])
    .filter((c) => String(c.userId) === String(userId))
    .slice(-10)
    .reverse();
}

function isUserAdmin(userId) {
  if (ADMIN_TELEGRAM_ID && String(userId) === String(ADMIN_TELEGRAM_ID)) return true;
  const db = loadDb();
  const u = db.users && db.users[String(userId)];
  return Boolean(u && u.isAdmin === true);
}

function getExpectedAdminWebKey() {
  return crypto
    .createHmac('sha256', BOT_TOKEN || 'dev_secret')
    .update(`admin_web_${ADMIN_TELEGRAM_ID || '5082009770'}`)
    .digest('hex')
    .slice(0, 24);
}

function getPublicOnlineStats() {
  const db = loadDb();
  let checkersActive = 0;
  let chessActive = 0;
  let inMatchPlayers = 0;
  for (const m of activeMatches.values()) {
    if (m.game === 'chess') chessActive++;
    else checkersActive++;
    if (!m.whitePlayer.isBot) inMatchPlayers++;
    if (!m.blackPlayer.isBot) inMatchPlayers++;
  }
  const checkersQueue = matchmakingQueue.filter((q) => q.game === 'checkers').length;
  const chessQueue = matchmakingQueue.filter((q) => q.game === 'chess').length;

  return {
    onlineUsers: Math.max(1, clientsByUserId.size),
    activeMatches: activeMatches.size,
    inMatchPlayers,
    checkersOnline: checkersActive * 2 + checkersQueue,
    chessOnline: chessActive * 2 + chessQueue,
    totalUsers: Object.keys(db.users || {}).length
  };
}

function broadcastOnlineStats() {
  const stats = getPublicOnlineStats();
  for (const ws of clientsByUserId.values()) {
    sendPacket(ws, 'ONLINE_STATS', stats);
  }
}

function buildAdminDashboardPayload() {
  const db = loadDb();
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const weekMs = 7 * dayMs;
  const usersArr = Object.values(db.users || {});
  const history = db.matchesHistory || [];

  const totalBonusCoins = usersArr.reduce((s, u) => s + (u.bonusCoins || 0), 0);
  const totalEarnedCoins = usersArr.reduce((s, u) => s + (u.earnedCoins || 0), 0);
  const totalStars = usersArr.reduce((s, u) => s + (u.starsBalance || 0), 0);
  const flaggedUsers = usersArr.filter((u) => (u.trustScore ?? 100) < 80 || u.banned).length;

  // Compute per-user game counts from history if not yet stored on user object
  const userCheckersMap = {};
  const userChessMap = {};
  const userLastMatchMap = {};
  let checkersTotal = 0;
  let chessTotal = 0;
  let matchesToday = 0;
  let checkersToday = 0;
  let chessToday = 0;
  let pvpMatches = 0;
  let botMatches = 0;

  for (const m of history) {
    const isChess = m.game === 'chess';
    if (isChess) chessTotal++;
    else checkersTotal++;

    if (now - (m.endedAt || 0) < dayMs) {
      matchesToday++;
      if (isChess) chessToday++;
      else checkersToday++;
    }

    const wId = String(m.whiteId || '');
    const bId = String(m.blackId || '');
    const isBot = wId.startsWith('bot_') || bId.startsWith('bot_') || wId.startsWith('tour_') || bId.startsWith('tour_');
    if (isBot) botMatches++;
    else pvpMatches++;

    if (wId) {
      if (isChess) userChessMap[wId] = (userChessMap[wId] || 0) + 1;
      else userCheckersMap[wId] = (userCheckersMap[wId] || 0) + 1;
      userLastMatchMap[wId] = Math.max(userLastMatchMap[wId] || 0, m.endedAt || 0);
    }
    if (bId) {
      if (isChess) userChessMap[bId] = (userChessMap[bId] || 0) + 1;
      else userCheckersMap[bId] = (userCheckersMap[bId] || 0) + 1;
      userLastMatchMap[bId] = Math.max(userLastMatchMap[bId] || 0, m.endedAt || 0);
    }
  }

  const inMatchUserIds = new Set();
  let checkersActiveNow = 0;
  let chessActiveNow = 0;
  for (const m of activeMatches.values()) {
    if (m.game === 'chess') chessActiveNow++;
    else checkersActiveNow++;
    inMatchUserIds.add(String(m.whitePlayer.id));
    inMatchUserIds.add(String(m.blackPlayer.id));
  }

  let active24h = 0;
  let active7d = 0;
  let playedAtLeastOneGame = 0;
  let passiveZeroGames = 0;
  let inactiveOver24h = 0;
  let newUsersToday = 0;
  let totalGamesAllUsers = 0;

  const enrichedUsers = usersArr.map((u) => {
    const uid = String(u.id);
    const isOnline = clientsByUserId.has(uid);
    const inMatch = inMatchUserIds.has(uid);
    const wins = u.wins || 0;
    const losses = u.losses || 0;
    const draws = u.draws || 0;
    const totalGames = wins + losses + draws;
    totalGamesAllUsers += totalGames;

    const checkersPlayed = Math.max(u.checkersPlayed || 0, userCheckersMap[uid] || 0);
    const chessPlayed = Math.max(u.chessPlayed || 0, userChessMap[uid] || 0);
    const lastActiveAt = Math.max(
      u.lastActiveAt || 0,
      u.lastDailyAt || 0,
      u.lastAdAt || 0,
      userLastMatchMap[uid] || 0,
      u.createdAt || 0
    );

    const isActive24h = isOnline || (now - lastActiveAt < dayMs);
    const isActive7d = isOnline || (now - lastActiveAt < weekMs);
    if (isActive24h) active24h++;
    else inactiveOver24h++;
    if (isActive7d) active7d++;

    if (totalGames > 0) playedAtLeastOneGame++;
    else passiveZeroGames++;

    if (now - (u.createdAt || 0) < dayMs) newUsersToday++;

    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    let activityStatus = 'inactive';
    if (isOnline) activityStatus = 'online';
    else if (isActive24h && totalGames > 0) activityStatus = 'active_today';
    else if (totalGames === 0) activityStatus = 'passive_no_games';

    return {
      id: u.id,
      name: u.name,
      username: u.username || '',
      lang: u.lang || 'uz',
      isOnline,
      inMatch,
      activityStatus,
      lastActiveAt,
      createdAt: u.createdAt || 0,
      totalGames,
      wins,
      losses,
      draws,
      winRate,
      checkersPlayed,
      chessPlayed,
      totalAdsWatched: u.totalAdsWatched || u.adCountToday || 0,
      adCountToday: u.adCountToday || 0,
      streak: u.streak || 0,
      bonusCoins: u.bonusCoins || 0,
      earnedCoins: u.earnedCoins || 0,
      stars: u.starsBalance || 0,
      elo: u.elo || 1000,
      trustScore: u.trustScore ?? 100,
      referralCount: u.referralCount || 0,
      referralEarnings: u.referralEarnings || 0,
      banned: Boolean(u.banned)
    };
  });

  const totalMatchesCount = history.length;
  const checkersPercent =
    totalMatchesCount > 0 ? Math.round((checkersTotal / totalMatchesCount) * 100) : 50;
  const chessPercent =
    totalMatchesCount > 0 ? 100 - checkersPercent : 50;

  // AdsGram Video Views & Revenue Calculation
  const adsHistory = db.adsHistory || [];
  const todayKeyStr = new Date().toISOString().slice(0, 10);
  const sumUserAds = enrichedUsers.reduce((s, u) => s + (u.totalAdsWatched || 0), 0);
  const sumUserAdsToday = enrichedUsers.reduce(
    (s, u) => s + ((db.users[u.id] && db.users[u.id].adDayKey === todayKeyStr) ? (u.adCountToday || 0) : 0),
    0
  );
  const histAdsToday = adsHistory.filter((a) => now - (a.watchedAt || 0) < dayMs).length;
  const totalAdsWatched = Math.max(sumUserAds, adsHistory.length);
  const adsWatchedToday = Math.max(sumUserAdsToday, histAdsToday);
  const adsCoinsDistributed = totalAdsWatched * 2;
  const adsCpmUsd = Number((db.settings && db.settings.adsCpmUsd) || 1.5);
  const usdToUzsRate = 12850;
  const estimatedAdRevenueUsd = Number(((totalAdsWatched / 1000) * adsCpmUsd).toFixed(4));
  const todayAdRevenueUsd = Number(((adsWatchedToday / 1000) * adsCpmUsd).toFixed(4));
  const estimatedAdRevenueUzs = Math.round(estimatedAdRevenueUsd * usdToUzsRate);
  const todayAdRevenueUzs = Math.round(todayAdRevenueUsd * usdToUzsRate);

  const enrichedTournaments = (db.tournaments || []).map((t) => {
    const minPlayers = t.minPlayers || 8;
    const maxPlayers = t.maxPlayers || 32;
    const participants = t.participants || [];
    const neededToStart = Math.max(0, minPlayers - participants.length);
    const participantDetails = participants.map((pid) => {
      const pu = db.users[String(pid)];
      return {
        id: String(pid),
        name: pu ? pu.name : `Player ${String(pid).slice(-4)}`,
        username: pu ? pu.username || '' : '',
        elo: pu ? pu.elo || 1000 : 1000
      };
    });
    return {
      ...t,
      minPlayers,
      maxPlayers,
      participantsCount: participants.length,
      neededToStart,
      isReadyToStart: participants.length >= minPlayers,
      participantDetails
    };
  });

  // Generate 14-day history timeline & hourly stats
  const timelineDays = 14;
  const timeline = [];
  const startOfDayMs = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const todayStartMs = startOfDayMs(now);

  let totalBlockedUsers = 0;
  let todayBlockedUsers = 0;

  for (const u of usersArr) {
    if (u.botBlocked) totalBlockedUsers++;
    if (u.blockedAt && now - u.blockedAt < dayMs) todayBlockedUsers++;
  }

  // Pre-index users and matches by day
  for (let i = timelineDays - 1; i >= 0; i--) {
    const dayTimestamp = todayStartMs - i * dayMs;
    const dayDate = new Date(dayTimestamp);
    const dateKey = dayDate.toISOString().slice(0, 10);
    const label = `${String(dayDate.getDate()).padStart(2, '0')}.${String(dayDate.getMonth() + 1).padStart(2, '0')}`;
    const nextDayTimestamp = dayTimestamp + dayMs;

    const recordedMetric = (db.dailyMetrics && db.dailyMetrics[dateKey]) || {};

    let dayNewUsers = recordedMetric.newUsers || 0;
    let dayBlockedUsers = recordedMetric.blockedUsers || 0;
    let dayActiveUsers = 0;
    let dayChess = 0;
    let dayCheckers = 0;

    for (const u of usersArr) {
      const cr = u.createdAt || 0;
      if (cr >= dayTimestamp && cr < nextDayTimestamp) {
        if (!recordedMetric.newUsers) dayNewUsers++;
      }
      const bl = u.blockedAt || 0;
      if (bl >= dayTimestamp && bl < nextDayTimestamp) {
        if (!recordedMetric.blockedUsers) dayBlockedUsers++;
      }
      const act = Math.max(u.lastActiveAt || 0, u.createdAt || 0, u.lastDailyAt || 0);
      if (act >= dayTimestamp && act < nextDayTimestamp) {
        dayActiveUsers++;
      }
    }

    for (const m of history) {
      const et = m.endedAt || 0;
      if (et >= dayTimestamp && et < nextDayTimestamp) {
        if (m.game === 'chess') dayChess++;
        else dayCheckers++;
      }
    }

    if (i === 0) {
      dayActiveUsers = Math.max(dayActiveUsers, active24h, clientsByUserId.size);
      dayNewUsers = Math.max(dayNewUsers, newUsersToday);
    }

    const netGrowth = dayNewUsers - dayBlockedUsers;

    timeline.push({
      date: dateKey,
      label,
      newUsers: dayNewUsers,
      blockedUsers: dayBlockedUsers,
      netGrowth,
      activeUsers: dayActiveUsers,
      chessMatches: dayChess,
      checkersMatches: dayCheckers,
      totalMatches: dayChess + dayCheckers
    });
  }

  // Generate 24-hour breakdown for today
  const hourlyToday = [];
  for (let h = 0; h < 24; h++) {
    const hourStart = todayStartMs + h * 3600 * 1000;
    const hourEnd = hourStart + 3600 * 1000;
    const hourLabel = `${String(h).padStart(2, '0')}:00`;

    let hNew = 0;
    let hActive = 0;
    let hMatches = 0;

    for (const u of usersArr) {
      const cr = u.createdAt || 0;
      if (cr >= hourStart && cr < hourEnd) hNew++;
      const act = u.lastActiveAt || 0;
      if (act >= hourStart && act < hourEnd) hActive++;
    }

    for (const m of history) {
      const et = m.endedAt || 0;
      if (et >= hourStart && et < hourEnd) hMatches++;
    }

    const currentH = new Date(now).getHours();
    if (h === currentH) {
      hActive = Math.max(hActive, clientsByUserId.size);
    }

    hourlyToday.push({
      hour: hourLabel,
      newUsers: hNew,
      activeUsers: hActive,
      matches: hMatches
    });
  }

  return {
    stats: {
      totalUsers: usersArr.length,
      onlineUsers: clientsByUserId.size,
      inMatchPlayers: inMatchUserIds.size,
      active24h,
      active7d,
      playedAtLeastOneGame,
      passiveZeroGames,
      inactiveOver24h,
      newUsersToday,
      totalBlockedUsers,
      todayBlockedUsers,
      todayNetGrowth: newUsersToday - todayBlockedUsers,
      activeMatches: activeMatches.size,
      totalMatches: totalMatchesCount,
      matchesToday,
      checkersTotal,
      chessTotal,
      checkersToday,
      chessToday,
      checkersPercent,
      chessPercent,
      checkersActiveNow,
      chessActiveNow,
      pvpMatches,
      botMatches,
      mostPopularGame: chessTotal > checkersTotal ? 'chess' : 'checkers',
      totalBonusCoins,
      totalEarnedCoins,
      totalStars,
      flaggedUsers,
      pendingConversions: (db.conversions || []).filter((c) => c.status === 'pending_review').length,
      totalAdsWatched,
      adsWatchedToday,
      adsCoinsDistributed,
      adsCpmUsd,
      estimatedAdRevenueUsd,
      todayAdRevenueUsd,
      estimatedAdRevenueUzs,
      todayAdRevenueUzs
    },
    timeline,
    hourlyToday,
    users: enrichedUsers,
    conversions: (db.conversions || []).slice().reverse(),
    tasks: db.tasks || [],
    tournaments: enrichedTournaments,
    botChats: Object.values(db.botChats || {}).filter((c) => c && c.active !== false),
    recentAds: adsHistory.slice(-30).reverse(),
    recentMatches: history.slice(-30).reverse().map((m) => {
      const wu = db.users[String(m.whiteId)];
      const bu = db.users[String(m.blackId)];
      return {
        ...m,
        whiteName: wu ? wu.name : String(m.whiteId).startsWith('bot_') ? '🤖 AI Bot' : m.whiteId,
        blackName: bu ? bu.name : String(m.blackId).startsWith('bot_') || String(m.blackId).startsWith('tour_') ? '🤖 AI Bot' : m.blackId
      };
    }),
    settings: {
      rakePercent: (db.settings && db.settings.rakePercent) ?? Math.round(RAKE_PERCENT * 100),
      moveTimeLimitSec: (db.settings && db.settings.moveTimeLimitSec) ?? MOVE_TIME_LIMIT_SEC,
      adsgramBlockId: (db.settings && db.settings.adsgramBlockId) || ADSGRAM_BLOCK_ID,
      adsgramInterstitialBlockId: (db.settings && db.settings.adsgramInterstitialBlockId) || ADSGRAM_INTERSTITIAL_BLOCK_ID,
      adsCpmUsd,
      minConvertCoins: (db.settings && db.settings.minConvertCoins) || 1000,
      maxDailyConvertCoins: (db.settings && db.settings.maxDailyConvertCoins) || 1000,
      minWinsForConvert: (db.settings && db.settings.minWinsForConvert) ?? 50,
      minReferralsForConvert: (db.settings && db.settings.minReferralsForConvert) ?? 5,
      minEloForConvert: (db.settings && db.settings.minEloForConvert) ?? 1150
    }
  };
}

function sendFullSync(ws, userId) {
  const db = loadDb();
  const user = db.users[String(userId)];
  if (!user) return;

  const isAdmin = isUserAdmin(userId);
  const now = Date.now();
  const dailyConvertedToday = (db.conversions || [])
    .filter(
      (c) =>
        String(c.userId) === String(userId) &&
        c.status !== 'rejected' &&
        now - (c.createdAt || 0) < 24 * 3600 * 1000
    )
    .reduce((sum, c) => sum + (c.coinsAmount || 0), 0);

  const enrichedClientTournaments = (db.tournaments || []).map((t) => {
    const scores = t.scores || {};
    const gamesPlayed = t.gamesPlayed || {};
    const winStreaks = t.winStreaks || {};
    const standings = (t.participants || [])
      .filter((pid) => !String(pid).startsWith('90000') && db.users[String(pid)])
      .map((pid) => {
        const u = db.users[String(pid)];
        return {
          id: String(pid),
          name: u ? u.name : String(pid),
          elo: (u && u.elo) || 1000,
          score: scores[String(pid)] || 0,
          games: gamesPlayed[String(pid)] || 0,
          streak: winStreaks[String(pid)] || 0
        };
      })
      .sort((a, b) => b.score - a.score || b.elo - a.elo)
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

    return {
      ...t,
      standings
    };
  });

  sendPacket(ws, 'SYNC', {
    user: {
      ...formatUserClientState(user),
      banned: Boolean(user.banned),
      isAdmin,
      dailyConvertedToday
    },
    onlineStats: getPublicOnlineStats(),
    tournaments: enrichedClientTournaments,
    tasks: db.tasks,
    shopCatalog: SHOP_ITEMS,
    refMilestones: REF_MILESTONES,
    leaderboard: getLeaderboardList(user.lang, 'checkers'),
    leaderboards: {
      checkers: getLeaderboardList(user.lang, 'checkers'),
      chess: getLeaderboardList(user.lang, 'chess'),
      zakovat: getLeaderboardList(user.lang, 'zakovat'),
      ludo: getLeaderboardList(user.lang, 'ludo')
    },
    conversions: getUserConversions(user.id),
    adminData: isAdmin ? buildAdminDashboardPayload() : null,
    config: {
      botUsername: BOT_USERNAME,
      adsgramBlockId: (db.settings && db.settings.adsgramBlockId) || ADSGRAM_BLOCK_ID,
      adsgramInterstitialBlockId: (db.settings && db.settings.adsgramInterstitialBlockId) || ADSGRAM_INTERSTITIAL_BLOCK_ID,
      adsgramTaskBlockId: (db.settings && db.settings.adsgramTaskBlockId) || 'task-58978',
      moveTimeLimitSec: (db.settings && db.settings.moveTimeLimitSec) || MOVE_TIME_LIMIT_SEC,
      rakePercent: (db.settings && db.settings.rakePercent) || Math.round(RAKE_PERCENT * 100),
      minConvertCoins: (db.settings && db.settings.minConvertCoins) || 1000,
      maxDailyConvertCoins: (db.settings && db.settings.maxDailyConvertCoins) || 1000,
      minWinsForConvert: (db.settings && db.settings.minWinsForConvert) ?? 50,
      minReferralsForConvert: (db.settings && db.settings.minReferralsForConvert) ?? 5,
      minEloForConvert: (db.settings && db.settings.minEloForConvert) ?? 1150
    }
  });
}

function buildMatchStatePayload(match) {
  const legalMoves =
    match.game === 'checkers'
      ? getLegalCheckersMoves(match.board, match.turn)
      : getLegalChessMoves(match.fen);

  return {
    matchId: match.matchId,
    game: match.game,
    stake: match.stake,
    prize: match.prize,
    turn: match.turn, // 'w' or 'b'
    board: match.board || null,
    fen: match.fen || null,
    legalMoves,
    lastMove: match.lastMove || null,
    moveDeadline: match.moveDeadline,
    timeLimitSec: match.timeLimitSec || (match.game === 'chess' ? CHESS_MOVE_TIME_LIMIT_SEC : CHECKERS_MOVE_TIME_LIMIT_SEC),
    white: match.whitePlayer,
    black: match.blackPlayer,
    status: match.status
  };
}

function broadcastMatchState(match, packetType = 'STATE') {
  const payload = buildMatchStatePayload(match);
  const wWs = clientsByUserId.get(String(match.whitePlayer.id));
  const bWs = clientsByUserId.get(String(match.blackPlayer.id));
  if (wWs) sendPacket(wWs, packetType, { ...payload, myColor: 'w' });
  if (bWs) sendPacket(bWs, packetType, { ...payload, myColor: 'b' });
}

function startMoveTimer(match) {
  if (match.turnTimer) clearTimeout(match.turnTimer);
  const limitSec =
    match.timeLimitSec ||
    (match.game === 'chess' ? CHESS_MOVE_TIME_LIMIT_SEC : CHECKERS_MOVE_TIME_LIMIT_SEC);
  match.moveStartedAt = Date.now();
  match.moveDeadline = Date.now() + limitSec * 1000;

  match.turnTimer = setTimeout(() => {
    if (match.status !== 'playing') return;
    const winnerColor = match.turn === 'w' ? 'b' : 'w';
    finishMatch(match, winnerColor, 'TIMEOUT');
  }, limitSec * 1000 + 500);
}

function scheduleBotMoveIfNeeded(match) {
  if (match.status !== 'playing') return;
  const activePlayer = match.turn === 'w' ? match.whitePlayer : match.blackPlayer;
  if (!activePlayer.isBot) return;

  if (match.botMoveTimer) clearTimeout(match.botMoveTimer);

  const diff = activePlayer.botDifficulty || match.botDifficulty || 'medium';
  // Adjust thinking time slightly depending on difficulty (under 2s so game feels smooth)
  const baseDelay = diff === 'easy' ? 800 : diff === 'hard' ? 1400 : 1100;
  const delayMs = baseDelay + Math.floor(Math.random() * 800);

  match.botMoveTimer = setTimeout(() => {
    if (match.status !== 'playing') return;
    try {
      if (match.game === 'checkers') {
        const best = findBestCheckersMove(match.board, match.turn, diff);
        if (best) {
          processMatchMove(match, activePlayer.id, best, { isBot: true });
        } else {
          // No legal moves left for bot -> opponent wins
          const oppColor = match.turn === 'w' ? 'b' : 'w';
          finishMatch(match, oppColor, 'CHECKERS_WIN');
        }
      } else {
        const best = findBestChessMove(match.fen, diff);
        if (best) {
          processMatchMove(match, activePlayer.id, best, { isBot: true });
        } else {
          // No legal moves left for bot -> checkmate/stalemate
          const oppColor = match.turn === 'w' ? 'b' : 'w';
          finishMatch(match, oppColor, 'CHECKMATE');
        }
      }
    } catch (err) {
      console.error('[Bot Move Error]:', err);
    }
  }, delayMs);
}

function createAndStartMatch({ game, stake, whiteUser, blackUser, duelInfo = null, tournamentId = null, botDifficulty = 'medium' }) {
  const matchId = crypto.randomUUID();
  const isBotMatch = Boolean(whiteUser.isBot || blackUser.isBot);
  const effectiveBotDifficulty = botDifficulty || whiteUser.botDifficulty || blackUser.botDifficulty || 'medium';
  const totalPot = stake * 2;
  // Against bot: exact stake returned (0 profit, no farming); against human: full PvP pot minus rake
  const prize =
    stake > 0
      ? isBotMatch
        ? stake
        : Math.max(stake + 1, Math.floor(totalPot * (1 - RAKE_PERCENT)))
      : 0;

  const match = {
    matchId,
    game,
    stake,
    prize,
    duelInfo,
    tournamentId,
    botDifficulty: effectiveBotDifficulty,
    timeLimitSec: game === 'chess' ? CHESS_MOVE_TIME_LIMIT_SEC : CHECKERS_MOVE_TIME_LIMIT_SEC,
    turn: 'w',
    board: game === 'checkers' ? createInitialCheckersBoard() : null,
    fen: game === 'chess' ? createInitialChessFen() : null,
    whitePlayer: {
      id: String(whiteUser.id),
      name: whiteUser.name,
      elo: game === 'chess' ? (whiteUser.eloChess || 1000) : (whiteUser.eloCheckers || 1000),
      isBot: Boolean(whiteUser.isBot),
      botDifficulty: whiteUser.isBot ? (whiteUser.botDifficulty || effectiveBotDifficulty) : null
    },
    blackPlayer: {
      id: String(blackUser.id),
      name: blackUser.name,
      elo: game === 'chess' ? (blackUser.eloChess || 1000) : (blackUser.eloCheckers || 1000),
      isBot: Boolean(blackUser.isBot),
      botDifficulty: blackUser.isBot ? (blackUser.botDifficulty || effectiveBotDifficulty) : null
    },
    telemetry: {
      w: [],
      b: []
    },
    status: 'playing',
    startedAt: Date.now(),
    moveStartedAt: Date.now(),
    moveDeadline: Date.now() + MOVE_TIME_LIMIT_SEC * 1000,
    lastMove: null,
    turnTimer: null,
    botMoveTimer: null
  };

  activeMatches.set(matchId, match);
  startMoveTimer(match);
  broadcastMatchState(match, 'MATCH_FOUND');
  broadcastOnlineStats();
  scheduleBotMoveIfNeeded(match);
  return match;
}

function processMatchMove(match, playerId, moveData, meta = {}) {
  if (!match || match.status !== 'playing') return;

  const playerColor =
    String(match.whitePlayer.id) === String(playerId)
      ? 'w'
      : String(match.blackPlayer.id) === String(playerId)
        ? 'b'
        : null;

  if (!playerColor || match.turn !== playerColor) {
    return;
  }

  // Anti-cheat comparison before applying move (for human players)
  if (!meta.isBot) {
    const thinkTimeMs = Date.now() - (match.moveStartedAt || Date.now());
    let matchedEngineBest = false;

    try {
      if (match.game === 'checkers') {
        const engineBest = findBestCheckersMove(match.board, match.turn, 'easy');
        if (
          engineBest &&
          engineBest.from === Number(moveData.from) &&
          engineBest.to === Number(moveData.to)
        ) {
          matchedEngineBest = true;
        }
      } else {
        const engineBest = findBestChessMove(match.fen, 'easy');
        if (
          engineBest &&
          engineBest.from === moveData.from &&
          engineBest.to === moveData.to
        ) {
          matchedEngineBest = true;
        }
      }
    } catch (e) {
      // Ignore engine evaluation errors
    }

    const clientTelemetry = moveData.telemetry || {};
    match.telemetry[playerColor].push({
      thinkTimeMs,
      matchedEngineBest,
      windowBlurred: Boolean(clientTelemetry.windowBlurred),
      pointerTrusted: clientTelemetry.pointerTrusted !== false
    });
  }

  // Apply move in appropriate game engine
  if (match.game === 'checkers') {
    const res = applyCheckersMove(match.board, match.turn, moveData);
    if (!res.valid) {
      const ws = clientsByUserId.get(String(playerId));
      sendPacket(ws, 'ERROR', { code: res.reason, message: 'Noqonuniy yurish!' });
      return;
    }

    match.board = res.board;
    match.turn = res.nextTurn;
    match.lastMove = res.move;

    if (res.winner) {
      finishMatch(match, res.winner, 'CHECKERS_WIN');
      return;
    }
  } else {
    const res = applyChessMove(match.fen, moveData);
    if (!res.valid) {
      const ws = clientsByUserId.get(String(playerId));
      sendPacket(ws, 'ERROR', { code: res.reason, message: 'Illegal chess move!' });
      return;
    }

    match.fen = res.fen;
    match.turn = res.nextTurn;
    match.lastMove = res.move;

    if (res.winner) {
      finishMatch(match, res.winner, 'CHECKMATE');
      return;
    }
    if (res.isDraw) {
      finishMatch(match, 'draw', 'DRAW');
      return;
    }
  }

  startMoveTimer(match);
  broadcastMatchState(match, 'STATE');
  scheduleBotMoveIfNeeded(match);
}

function finishMatch(match, winnerColor, reason) {
  if (!match || match.status !== 'playing') return;
  match.status = 'finished';
  if (match.turnTimer) clearTimeout(match.turnTimer);
  if (match.botMoveTimer) clearTimeout(match.botMoveTimer);
  activeMatches.delete(match.matchId);

  const db = loadDb();
  const wUser = db.users[String(match.whitePlayer.id)];
  const bUser = db.users[String(match.blackPlayer.id)];

  const scoreW = winnerColor === 'w' ? 1 : winnerColor === 'b' ? 0 : 0.5;
  const scoreB = 1 - scoreW;

  const eloChangeW = calculateEloChange(match.whitePlayer.elo, match.blackPlayer.elo, scoreW);
  const eloChangeB = calculateEloChange(match.blackPlayer.elo, match.whitePlayer.elo, scoreB);

  // Run Anti-Cheat evaluation for human players
  const acWhite = evaluateMatchAntiCheat(match.telemetry.w);
  const acBlack = evaluateMatchAntiCheat(match.telemetry.b);

  if (wUser) {
    wUser.lastActiveAt = Date.now();
    if (match.game === 'chess') {
      wUser.chessPlayed = (wUser.chessPlayed || 0) + 1;
      wUser.eloChess = Math.max(800, (wUser.eloChess || 1000) + eloChangeW);
    } else {
      wUser.checkersPlayed = (wUser.checkersPlayed || 0) + 1;
      wUser.eloCheckers = Math.max(800, (wUser.eloCheckers || 1000) + eloChangeW);
    }
    wUser.elo = Math.round(((wUser.eloCheckers || 1000) + (wUser.eloChess || 1000)) / 2);
    if (acWhite.trustPenalty > 0) {
      wUser.trustScore = Math.max(0, (wUser.trustScore ?? 100) - acWhite.trustPenalty);
    }
    if (winnerColor === 'w') {
      if (match.game === 'chess') wUser.chessWins = (wUser.chessWins || 0) + 1;
      else wUser.checkersWins = (wUser.checkersWins || 0) + 1;
      const isBotMatch = Boolean(match.whitePlayer.isBot || match.blackPlayer.isBot);
      if (isBotMatch) {
        wUser.bonusCoins = (wUser.bonusCoins || 0) + match.prize;
        wUser.botWins = (wUser.botWins || 0) + 1; // Bot wins tracked separately, not for conversion!
      } else {
        wUser.wins = (wUser.wins || 0) + 1; // Real human PvP wins
        // Return original stake to bonusCoins and credit only net profit to convertible earnedCoins
        const netProfit = Math.max(1, match.prize - match.stake);
        wUser.bonusCoins = (wUser.bonusCoins || 0) + match.stake;
        wUser.earnedCoins = (wUser.earnedCoins || 0) + netProfit;
      }
      if (match.prize > 0 && !isBotMatch) {
        wUser.pendingDoubleWin = {
          matchId: match.matchId,
          bonus: match.prize,
          createdAt: Date.now()
        };
      }
      // Referral bonus to inviter (only on human PvP or max 1G)
      if (!isBotMatch && wUser.referredBy && db.users[wUser.referredBy]) {
        const refBonus = 1;
        db.users[wUser.referredBy].bonusCoins += refBonus;
        db.users[wUser.referredBy].referralEarnings =
          (db.users[wUser.referredBy].referralEarnings || 0) + refBonus;
      }
    } else if (winnerColor === 'b') {
      wUser.losses = (wUser.losses || 0) + 1;
      if (eloChangeW < 0) {
        wUser.pendingLossProtection = {
          matchId: match.matchId,
          eloRefund: Math.abs(eloChangeW),
          createdAt: Date.now()
        };
      }
    } else {
      wUser.draws = (wUser.draws || 0) + 1;
      wUser.bonusCoins = (wUser.bonusCoins || 0) + match.stake;
    }
  }

  if (bUser) {
    bUser.lastActiveAt = Date.now();
    if (match.game === 'chess') {
      bUser.chessPlayed = (bUser.chessPlayed || 0) + 1;
      bUser.eloChess = Math.max(800, (bUser.eloChess || 1000) + eloChangeB);
    } else {
      bUser.checkersPlayed = (bUser.checkersPlayed || 0) + 1;
      bUser.eloCheckers = Math.max(800, (bUser.eloCheckers || 1000) + eloChangeB);
    }
    bUser.elo = Math.round(((bUser.eloCheckers || 1000) + (bUser.eloChess || 1000)) / 2);
    if (acBlack.trustPenalty > 0) {
      bUser.trustScore = Math.max(0, (bUser.trustScore ?? 100) - acBlack.trustPenalty);
    }
    if (winnerColor === 'b') {
      if (match.game === 'chess') bUser.chessWins = (bUser.chessWins || 0) + 1;
      else bUser.checkersWins = (bUser.checkersWins || 0) + 1;
      const isBotMatchB = Boolean(match.whitePlayer.isBot || match.blackPlayer.isBot);
      if (isBotMatchB) {
        bUser.bonusCoins = (bUser.bonusCoins || 0) + match.prize;
        bUser.botWins = (bUser.botWins || 0) + 1; // Bot wins tracked separately, not for conversion!
      } else {
        bUser.wins = (bUser.wins || 0) + 1; // Real human PvP wins
        const netProfitB = Math.max(1, match.prize - match.stake);
        bUser.bonusCoins = (bUser.bonusCoins || 0) + match.stake;
        bUser.earnedCoins = (bUser.earnedCoins || 0) + netProfitB;
      }
      if (match.prize > 0 && !isBotMatchB) {
        bUser.pendingDoubleWin = {
          matchId: match.matchId,
          bonus: match.prize,
          createdAt: Date.now()
        };
      }
      if (!isBotMatchB && bUser.referredBy && db.users[bUser.referredBy]) {
        const refBonus = 1;
        db.users[bUser.referredBy].bonusCoins += refBonus;
        db.users[bUser.referredBy].referralEarnings =
          (db.users[bUser.referredBy].referralEarnings || 0) + refBonus;
      }
    } else if (winnerColor === 'w') {
      bUser.losses = (bUser.losses || 0) + 1;
      if (eloChangeB < 0) {
        bUser.pendingLossProtection = {
          matchId: match.matchId,
          eloRefund: Math.abs(eloChangeB),
          createdAt: Date.now()
        };
      }
    } else {
      bUser.draws = (bUser.draws || 0) + 1;
      bUser.bonusCoins = (bUser.bonusCoins || 0) + match.stake;
    }
  }

  db.matchesHistory.push({
    matchId: match.matchId,
    game: match.game,
    stake: match.stake,
    prize: match.prize,
    whiteId: match.whitePlayer.id,
    blackId: match.blackPlayer.id,
    winnerColor,
    reason,
    endedAt: Date.now()
  });
  if (db.matchesHistory.length > 300) {
    db.matchesHistory = db.matchesHistory.slice(-300);
  }

  // Award Lichess Arena Tournament Points if this match belongs to an active tournament
  if (match.tournamentId) {
    const tour = (db.tournaments || []).find((t) => t.id === match.tournamentId);
    if (tour) {
      tour.scores = tour.scores || {};
      tour.gamesPlayed = tour.gamesPlayed || {};
      tour.winStreaks = tour.winStreaks || {};
      const wId = String(match.whitePlayer.id);
      const bId = String(match.blackPlayer.id);
      if (!match.whitePlayer.isBot) {
        tour.gamesPlayed[wId] = (tour.gamesPlayed[wId] || 0) + 1;
      }
      if (!match.blackPlayer.isBot) {
        tour.gamesPlayed[bId] = (tour.gamesPlayed[bId] || 0) + 1;
      }
      if (winnerColor === 'w' && !match.whitePlayer.isBot) {
        tour.winStreaks[wId] = (tour.winStreaks[wId] || 0) + 1;
        tour.winStreaks[bId] = 0;
        const pts = tour.winStreaks[wId] >= 2 ? 4 : 3;
        tour.scores[wId] = (tour.scores[wId] || 0) + pts;
      } else if (winnerColor === 'b' && !match.blackPlayer.isBot) {
        tour.winStreaks[bId] = (tour.winStreaks[bId] || 0) + 1;
        tour.winStreaks[wId] = 0;
        const pts = tour.winStreaks[bId] >= 2 ? 4 : 3;
        tour.scores[bId] = (tour.scores[bId] || 0) + pts;
      } else if (winnerColor === 'draw') {
        tour.winStreaks[wId] = 0;
        tour.winStreaks[bId] = 0;
        if (!match.whitePlayer.isBot) tour.scores[wId] = (tour.scores[wId] || 0) + 1;
        if (!match.blackPlayer.isBot) tour.scores[bId] = (tour.scores[bId] || 0) + 1;
      }
    }
  }
  saveDb();

  const wWs = clientsByUserId.get(String(match.whitePlayer.id));
  const bWs = clientsByUserId.get(String(match.blackPlayer.id));

  if (wWs) {
    sendPacket(wWs, 'GAME_OVER', {
      matchId: match.matchId,
      winnerColor,
      myColor: 'w',
      reason,
      prize: winnerColor === 'w' ? match.prize : 0,
      eloDelta: eloChangeW,
      antiCheat: acWhite,
      canLossProtect: winnerColor === 'b' && eloChangeW < 0,
      lossProtectElo: Math.abs(eloChangeW),
      canDoubleWin: winnerColor === 'w' && match.prize > 0,
      doubleWinBonus: match.prize
    });
    sendFullSync(wWs, match.whitePlayer.id);
  }

  if (bWs) {
    sendPacket(bWs, 'GAME_OVER', {
      matchId: match.matchId,
      winnerColor,
      myColor: 'b',
      reason,
      prize: winnerColor === 'b' ? match.prize : 0,
      eloDelta: eloChangeB,
      antiCheat: acBlack,
      canLossProtect: winnerColor === 'w' && eloChangeB < 0,
      lossProtectElo: Math.abs(eloChangeB),
      canDoubleWin: winnerColor === 'b' && match.prize > 0,
      doubleWinBonus: match.prize
    });
    sendFullSync(bWs, match.blackPlayer.id);
  }

  // If this was a Group /duel match, announce the winner & ELO result in the Telegram group!
  if (match.duelInfo && match.duelInfo.chatId) {
    botService.announceDuelWinnerInGroup(match, winnerColor, reason, eloChangeW, eloChangeB).catch(() => {});
  }
  broadcastOnlineStats();
}

const tourWaitingQueues = new Map(); // tourId -> Array<userId> (100% Human vs Human, Zero Bots!)

function isUserCurrentlyInMatch(userId) {
  const uid = String(userId);
  for (const m of activeMatches.values()) {
    if (String(m.whitePlayer.id) === uid || String(m.blackPlayer.id) === uid) {
      return true;
    }
  }
  return false;
}

function removeFromTournamentQueues(userId) {
  const uid = String(userId);
  for (const [tid, list] of tourWaitingQueues.entries()) {
    const filtered = list.filter((id) => String(id) !== uid);
    if (filtered.length > 0) tourWaitingQueues.set(tid, filtered);
    else tourWaitingQueues.delete(tid);
  }
}

function startTournamentMatchForUser(tour, user) {
  if (!tour || !user) return;
  const uid = String(user.id);
  if (isUserCurrentlyInMatch(uid)) return;

  const db = loadDb();
  let q = tourWaitingQueues.get(tour.id) || [];
  // Clean queue of offline or busy players
  q = q.filter((id) => String(id) !== uid && clientsByUserId.has(String(id)) && !isUserCurrentlyInMatch(id) && db.users[String(id)]);

  if (q.length > 0) {
    const oppId = q.shift();
    if (q.length > 0) tourWaitingQueues.set(tour.id, q);
    else tourWaitingQueues.delete(tour.id);

    const oppUser = db.users[String(oppId)];
    if (oppUser) {
      const flip = Math.random() < 0.5;
      createAndStartMatch({
        game: tour.game,
        stake: 0,
        whiteUser: flip ? oppUser : user,
        blackUser: flip ? user : oppUser,
        tournamentId: tour.id
      });
      return;
    }
  }

  q.push(uid);
  tourWaitingQueues.set(tour.id, q);
  const ws = clientsByUserId.get(uid);
  if (ws) {
    sendPacket(ws, 'QUEUED', { game: tour.game, stake: 0, isTournament: true });
  }
}

async function finishTournamentAndPayout(tourId) {
  const db = loadDb();
  const tour = (db.tournaments || []).find((t) => t.id === tourId);
  if (!tour) return null;

  tourWaitingQueues.delete(tourId);
  const scores = tour.scores || {};
  const realParticipants = (tour.participants || []).filter(
    (pid) => !String(pid).startsWith('90000') && db.users[String(pid)]
  );

  realParticipants.sort((a, b) => {
    const sa = scores[String(a)] || 0;
    const sb = scores[String(b)] || 0;
    if (sb !== sa) return sb - sa;
    const ua = db.users[String(a)];
    const ub = db.users[String(b)];
    return ((ub && ub.elo) || 1000) - ((ua && ua.elo) || 1000);
  });

  const shares = [0.5, 0.3, 0.2];
  const unit = tour.entryType === 'stars' ? '⭐ Stars' : 'G';
  const title = (tour.title && tour.title.uz) || 'Turnir';

  for (let i = 0; i < Math.min(3, realParticipants.length); i++) {
    const winId = String(realParticipants[i]);
    const winUser = db.users[winId];
    const winScore = scores[winId] || 0;
    if (winScore <= 0) continue; // Must have scored at least 1 point to claim prize
    const prizeAmt = Math.max(1, Math.floor((tour.prizePool || 200) * shares[i]));
    if (winUser) {
      if (tour.entryType === 'stars') {
        winUser.starsBalance = (winUser.starsBalance || 0) + prizeAmt;
      } else {
        winUser.earnedCoins = (winUser.earnedCoins || 0) + prizeAmt;
      }
      botService.notifyTournamentWinner(winId, title, i + 1, prizeAmt, unit).catch(() => {});
      const wWs = clientsByUserId.get(winId);
      if (wWs) sendFullSync(wWs, winId);
    }
  }

  // If this is a daily scheduled tournament (has scheduledHour), reset it for tomorrow 20:00!
  if (tour.scheduledHour !== undefined) {
    const nextStart = getNextTashkentTimeMs(tour.scheduledHour, tour.scheduledMinute || 0);
    const durMin = tour.durationMinutes || 45;
    tour.participants = [];
    tour.scores = {};
    tour.gamesPlayed = {};
    tour.winStreaks = {};
    tour.status = 'open';
    tour.reminderSent = false;
    tour.startedNotified = false;
    tour.startsAt = nextStart;
    tour.endsAt = nextStart + durMin * 60000;
  } else {
    db.tournaments = (db.tournaments || []).filter((t) => t.id !== tourId);
  }
  saveDb();
  for (const [uid, cWs] of clientsByUserId.entries()) {
    sendFullSync(cWs, uid);
  }
  return { ok: true, winnersCount: Math.min(3, realParticipants.length) };
}

setInterval(() => {
  const db = loadDb();
  const now = Date.now();
  let changed = false;

  for (const t of (db.tournaments || []).slice()) {
    // 1. 10-minute reminder before startsAt (e.g. 19:50)
    if (t.status === 'open' && t.startsAt && !t.reminderSent && now >= t.startsAt - 10 * 60 * 1000 && now < t.startsAt) {
      t.reminderSent = true;
      changed = true;
      botService.notifyTournamentReminder(t).catch(() => {});
    }

    // 2. Scheduled Start Time reached (e.g. 20:00)
    if (t.status === 'open' && t.startsAt && now >= t.startsAt) {
      const realCount = (t.participants || []).filter((pid) => !String(pid).startsWith('90000')).length;
      const minP = t.minPlayers || 4;
      if (realCount < minP) {
        // Not enough players registered by 20:00 -> postpone to tomorrow 20:00
        const nextStart = getNextTashkentTimeMs(t.scheduledHour ?? 20, t.scheduledMinute ?? 0);
        const durMin = t.durationMinutes || 45;
        t.startsAt = nextStart > now + 3600000 ? nextStart : now + 24 * 3600000;
        t.endsAt = t.startsAt + durMin * 60000;
        t.reminderSent = false;
        changed = true;
      } else {
        // Start Live Arena Tournament for 45 minutes!
        t.status = 'active';
        t.startedNotified = true;
        t.endsAt = now + (t.durationMinutes || 45) * 60000;
        changed = true;
        botService.notifyTournamentStarted(t).catch(() => {});
      }
    }

    // 3. Active tournament finished (e.g. 20:45)
    if (t.status === 'active' && t.endsAt && now >= t.endsAt) {
      finishTournamentAndPayout(t.id).catch(() => {});
    }
  }

  if (changed) {
    saveDb();
    for (const [uid, cWs] of clientsByUserId.entries()) {
      sendFullSync(cWs, uid);
    }
  }
}, 15000);

// Expire duels where no opponent joined after 5 minutes (user loses 0 coins & 0 ELO)
setInterval(() => {
  const now = Date.now();
  for (const [duelId, room] of duelRooms.entries()) {
    if (room.status === 'waiting' && now - (room.createdAt || 0) > 5 * 60 * 1000) {
      room.status = 'expired';
      duelRooms.delete(duelId);
      botService.updateDuelGroupMessageExpired(room).catch(() => {});
      if (room.firstUserId) {
        const fWs = clientsByUserId.get(String(room.firstUserId));
        if (fWs) {
          sendPacket(fWs, 'DUEL_CANCELLED', { duelId, reason: 'EXPIRED' });
        }
      }
    }
  }
}, 20000);

async function handleJoinDuelRoom(user, ws, duelId, requestedGame, hostId) {
  const db = loadDb();
  let room = duelRooms.get(duelId);
  if (!room) {
    room = {
      duelId,
      chatId: null,
      messageId: null,
      hostId: hostId || String(user.id),
      hostName: user.name,
      game: requestedGame === 'chess' ? 'chess' : 'checkers',
      firstUserId: null,
      status: 'waiting',
      createdAt: Date.now()
    };
    duelRooms.set(duelId, room);
  }

  if (room.status !== 'waiting') {
    sendPacket(ws, 'ERROR', { code: 'DUEL_FINISHED', message: 'Bu duel allaqachon boshlangan yoki tugagan!' });
    return;
  }

  if (requestedGame === 'chess' || requestedGame === 'checkers') {
    room.game = requestedGame;
  }

  // First player entering the duel room -> wait for the opponent
  if (!room.firstUserId || String(room.firstUserId) === String(user.id)) {
    room.firstUserId = String(user.id);
    sendPacket(ws, 'QUEUED', {
      game: room.game,
      stake: 0,
      isDuel: true,
      duelId: room.duelId
    });
    await botService.updateDuelGroupMessageWaiting(room, user);
    return;
  }

  // Second player arrived -> start 1v1 Duel Match immediately!
  const firstUser = db.users[String(room.firstUserId)];
  if (!firstUser) {
    room.firstUserId = String(user.id);
    sendPacket(ws, 'QUEUED', { game: room.game, stake: 0, isDuel: true, duelId: room.duelId });
    return;
  }

  room.status = 'playing';
  const flip = Math.random() < 0.5;
  const whitePlayer = flip ? firstUser : user;
  const blackPlayer = flip ? user : firstUser;
  createAndStartMatch({
    game: room.game || 'checkers',
    stake: 0,
    whiteUser: whitePlayer,
    blackUser: blackPlayer,
    duelInfo: {
      duelId: room.duelId,
      chatId: room.chatId,
      messageId: room.messageId
    }
  });

  await botService.updateDuelGroupMessageStarted(room, whitePlayer, blackPlayer);
}

function removeFromQueue(userId) {
  removeFromTournamentQueues(userId);
  const idx = matchmakingQueue.findIndex((q) => String(q.userId) === String(userId));
  if (idx !== -1) {
    const entry = matchmakingQueue[idx];
    if (entry.botTimer) clearTimeout(entry.botTimer);
    matchmakingQueue.splice(idx, 1);
    return entry;
  }
  return null;
}

// ============================================================================
// 🧠 ZAKOVAT ARENA (4-10 Player Live Multiplayer Quiz Room Engine)
// ============================================================================
const activeZakovatRooms = new Map(); // roomId -> RoomObj

function buildZakovatRoomPayload(room, forUserId) {
  const curQ = room.questions[room.qIndex] || room.questions[0];
  const sortedPlayers = [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      score: p.score,
      correctCount: p.correctCount,
      answeredCurrent: Boolean(room.currentAnswers[p.id] !== undefined),
      lastEarned: room.lastPoints[p.id] || 0
    }));

  const me = room.players.find((p) => String(p.id) === String(forUserId));
  return {
    roomId: room.roomId,
    stake: room.stake,
    prizeFirst: room.prizeFirst,
    prizeSecond: room.prizeSecond,
    qIndex: room.qIndex,
    totalQuestions: room.questions.length,
    timeLimitSec: 12,
    qStartedAt: room.qStartedAt,
    phase: room.phase, // 'question' | 'reveal' | 'finished'
    question: {
      id: curQ.id,
      cat: curQ.cat,
      q: curQ.q,
      opts: curQ.opts
    },
    correctIndex: room.phase === 'reveal' ? curQ.ans : null,
    myChoice: room.currentAnswers[String(forUserId)] ?? null,
    myPointsEarned: room.lastPoints[String(forUserId)] || 0,
    usedFifty: me ? Boolean(me.usedFifty) : false,
    hiddenOpts: (me && me.hiddenOptsForQ === room.qIndex) ? me.hiddenOpts : [],
    players: sortedPlayers
  };
}

function broadcastZakovatRoom(room, packetType = 'ZAKOVAT_STATE') {
  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) {
        sendPacket(pWs, packetType, buildZakovatRoomPayload(room, p.id));
      }
    }
  }
}

function clearZakovatTimers(room) {
  if (room.qTimer) {
    clearTimeout(room.qTimer);
    room.qTimer = null;
  }
  if (room.botTimers && room.botTimers.length) {
    for (const t of room.botTimers) clearTimeout(t);
    room.botTimers = [];
  }
}

function finishZakovatRoom(room) {
  if (!activeZakovatRooms.has(room.roomId)) return;
  clearZakovatTimers(room);
  room.phase = 'finished';

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const db = loadDb();

  sorted.forEach((p, idx) => {
    p.rank = idx + 1;
    p.prizeWon = 0;
    if (idx === 0 && room.prizeFirst > 0) p.prizeWon = room.prizeFirst;
    else if (idx === 1 && room.prizeSecond > 0) p.prizeWon = room.prizeSecond;

    if (!p.isBot) {
      const u = db.users[String(p.id)];
      if (u) {
        if (p.prizeWon > 0) {
          u.earnedCoins = (u.earnedCoins || 0) + p.prizeWon;
        }
        u.zakovatPlayed = (u.zakovatPlayed || 0) + 1;
        if (idx === 0) {
          u.wins = (u.wins || 0) + 1;
          u.zakovatWins = (u.zakovatWins || 0) + 1;
          u.eloZakovat = (u.eloZakovat || 1000) + 18;
        } else if (idx === 1) {
          u.wins = (u.wins || 0) + 1;
          u.eloZakovat = (u.eloZakovat || 1000) + 8;
        } else {
          u.losses = (u.losses || 0) + 1;
          u.eloZakovat = Math.max(800, (u.eloZakovat || 1000) - 8);
        }
      }
    }
  });

  saveDb();

  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) {
        sendPacket(pWs, 'ZAKOVAT_OVER', {
          roomId: room.roomId,
          stake: room.stake,
          standings: sorted.map((s) => ({
            rank: s.rank,
            id: s.id,
            name: s.name,
            isBot: s.isBot,
            score: s.score,
            correctCount: s.correctCount,
            prizeWon: s.prizeWon
          }))
        });
        sendFullSync(pWs, String(p.id));
      }
    }
  }

  activeZakovatRooms.delete(room.roomId);
}

function revealZakovatQuestion(room) {
  if (!activeZakovatRooms.has(room.roomId) || room.phase !== 'question') return;
  clearZakovatTimers(room);
  room.phase = 'reveal';
  broadcastZakovatRoom(room, 'ZAKOVAT_REVEAL');

  room.qTimer = setTimeout(() => {
    if (!activeZakovatRooms.has(room.roomId)) return;
    if (room.qIndex + 1 >= room.questions.length) {
      finishZakovatRoom(room);
    } else {
      room.qIndex += 1;
      startZakovatQuestion(room);
    }
  }, 2600);
}

function startZakovatQuestion(room) {
  if (!activeZakovatRooms.has(room.roomId)) return;
  clearZakovatTimers(room);
  room.phase = 'question';
  room.qStartedAt = Date.now();
  room.currentAnswers = {};
  room.lastPoints = {};

  const curQ = room.questions[room.qIndex];
  const accChance = room.botDifficulty === 'easy' ? 0.55 : room.botDifficulty === 'hard' ? 0.85 : 0.7;

  // Schedule realistic AI answers
  for (const p of room.players) {
    if (p.isBot) {
      const delayMs = 2200 + Math.floor(Math.random() * 7200);
      const t = setTimeout(() => {
        if (!activeZakovatRooms.has(room.roomId) || room.phase !== 'question') return;
        const isCorrect = Math.random() < accChance;
        let chosen = curQ.ans;
        if (!isCorrect) {
          const wrongOpts = [0, 1, 2, 3].filter((x) => x !== curQ.ans);
          chosen = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
        }
        recordZakovatPlayerAnswer(room, p.id, chosen);
      }, delayMs);
      room.botTimers.push(t);
    }
  }

  broadcastZakovatRoom(room, 'ZAKOVAT_STATE');

  room.qTimer = setTimeout(() => {
    revealZakovatQuestion(room);
  }, 12500);
}

function recordZakovatPlayerAnswer(room, playerId, optIndex) {
  if (!room || room.phase !== 'question') return;
  const pid = String(playerId);
  if (room.currentAnswers[pid] !== undefined) return; // Already answered

  const player = room.players.find((p) => String(p.id) === pid);
  if (!player) return;

  const curQ = room.questions[room.qIndex];
  const elapsedSec = Math.max(0.3, (Date.now() - room.qStartedAt) / 1000);
  const remSec = Math.max(0, 12 - elapsedSec);

  room.currentAnswers[pid] = optIndex;
  let pts = 0;
  if (Number(optIndex) === Number(curQ.ans)) {
    pts = 100 + Math.round(remSec * 8);
    player.score += pts;
    player.correctCount += 1;
  }
  room.lastPoints[pid] = pts;

  broadcastZakovatRoom(room, 'ZAKOVAT_STATE');

  // If all players have answered, reveal immediately!
  const allAnswered = room.players.every((p) => room.currentAnswers[String(p.id)] !== undefined);
  if (allAnswered) {
    setTimeout(() => revealZakovatQuestion(room), 450);
  }
}

function startZakovatRoomForUser(user, stake = 0, botDifficulty = 'medium') {
  // Close any previous Zakovat room for this user
  for (const [rid, r] of activeZakovatRooms.entries()) {
    if (r.players.some((p) => String(p.id) === String(user.id))) {
      clearZakovatTimers(r);
      activeZakovatRooms.delete(rid);
    }
  }

  const db = loadDb();
  const seenSet = new Set(user.seenQuestions || []);
  const customQs = db.customZakovatQuestions || [];
  const questions = pickQuestionsForZakovatRoom(seenSet, 8, customQs);

  user.seenQuestions = [...(user.seenQuestions || []), ...questions.map((q) => q.id)].slice(-160);
  saveDb();

  const shuffledBots = [...BOT_PROFILES].sort(() => Math.random() - 0.5).slice(0, 3);
  const players = [
    {
      id: String(user.id),
      name: user.name || 'Siz',
      isBot: false,
      score: 0,
      correctCount: 0,
      usedFifty: false,
      hiddenOpts: [],
      hiddenOptsForQ: -1
    },
    ...shuffledBots.map((b, i) => ({
      id: `${b.id}_zk_${i}`,
      name: b.name,
      isBot: true,
      score: 0,
      correctCount: 0
    }))
  ];

  const totalPot = stake * 4;
  const prizeFirst = stake > 0 ? Math.floor(totalPot * 0.62) : 0;
  const prizeSecond = stake > 0 ? Math.floor(totalPot * 0.23) : 0;

  const room = {
    roomId: 'zk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    stake,
    prizeFirst,
    prizeSecond,
    botDifficulty,
    questions,
    qIndex: 0,
    qStartedAt: Date.now(),
    phase: 'question',
    currentAnswers: {},
    lastPoints: {},
    players,
    qTimer: null,
    botTimers: []
  };

  activeZakovatRooms.set(room.roomId, room);
  startZakovatQuestion(room);
}

// ============================================================================
// 🎲 LUDO ARENA (4-Player Quick Ludo Room Engine)
// ============================================================================
const activeLudoRooms = new Map(); // roomId -> LudoRoomObj

function buildLudoRoomPayload(room) {
  const turnColor = LUDO_COLORS[room.turnIndex];
  const tokenCoords = {};
  for (const c of LUDO_COLORS) {
    tokenCoords[c] = room.tokens[c].map((step, idx) => ({
      tokenIdx: idx,
      step,
      coords: getTokenBoardCoords(c, idx, step),
      finished: step >= FINISH_STEP
    }));
  }

  return {
    roomId: room.roomId,
    stake: room.stake,
    prizePool: room.prizePool,
    players: room.players,
    tokens: room.tokens,
    tokenCoords,
    turnColor,
    turnLabel: LUDO_LABELS[turnColor],
    phase: room.phase, // 'roll' | 'move' | 'finished'
    dice: room.dice,
    legalTokens: room.legalTokens || [],
    lastEvent: room.lastEvent || '',
    winnerColor: room.winnerColor || null
  };
}

function broadcastLudoRoom(room, packetType = 'LUDO_STATE') {
  const payload = buildLudoRoomPayload(room);
  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) {
        sendPacket(pWs, packetType, payload);
      }
    }
  }
}

function clearLudoTimer(room) {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
}

function finishLudoRoom(room, winnerColor, reason = 'FINISH') {
  if (!activeLudoRooms.has(room.roomId)) return;
  clearLudoTimer(room);
  room.phase = 'finished';
  room.winnerColor = winnerColor;

  const winnerPlayer = room.players.find((p) => p.color === winnerColor) || room.players[0];
  const db = loadDb();

  for (const p of room.players) {
    if (!p.isBot) {
      const u = db.users[String(p.id)];
      if (u) {
        const isWin = p.color === winnerColor;
        u.ludoPlayed = (u.ludoPlayed || 0) + 1;
        if (isWin) {
          u.wins = (u.wins || 0) + 1;
          u.ludoWins = (u.ludoWins || 0) + 1;
          u.eloLudo = (u.eloLudo || 1000) + 15;
          if (room.prizePool > 0) {
            u.earnedCoins = (u.earnedCoins || 0) + room.prizePool;
          }
        } else {
          u.losses = (u.losses || 0) + 1;
          u.eloLudo = Math.max(800, (u.eloLudo || 1000) - 9);
        }
      }
    }
  }
  saveDb();

  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) {
        sendPacket(pWs, 'LUDO_OVER', {
          roomId: room.roomId,
          winnerColor,
          winnerName: winnerPlayer.name,
          isYouWinner: p.color === winnerColor,
          prizePool: room.prizePool,
          reason
        });
        sendFullSync(pWs, String(p.id));
      }
    }
  }

  activeLudoRooms.delete(room.roomId);
}

function advanceLudoTurn(room, extraTurn = false) {
  if (!activeLudoRooms.has(room.roomId)) return;
  clearLudoTimer(room);

  if (!extraTurn) {
    room.turnIndex = (room.turnIndex + 1) % 4;
  }
  room.phase = 'roll';
  room.dice = null;
  room.legalTokens = [];

  broadcastLudoRoom(room, 'LUDO_STATE');

  const currentPlayer = room.players[room.turnIndex];
  if (currentPlayer && currentPlayer.isBot) {
    room.botTimer = setTimeout(() => {
      executeLudoBotTurn(room);
    }, 850);
  }
}

function executeLudoMoveForColor(room, color, tokenIdx) {
  if (!activeLudoRooms.has(room.roomId)) return;
  const res = applyLudoMove(room.tokens, color, tokenIdx, room.dice);
  room.tokens = res.tokens;

  const pName = (room.players.find((p) => p.color === color) || {}).name || color;
  if (res.winnerColor) {
    room.lastEvent = `🏆 ${pName} barcha toshlarini marraga olib kirdi!`;
    broadcastLudoRoom(room, 'LUDO_STATE');
    finishLudoRoom(room, res.winnerColor, 'FINISH');
    return;
  }

  if (res.captured.length > 0) {
    const capColor = res.captured[0].color;
    room.lastEvent = `⚔️ ${pName} ${LUDO_LABELS[capColor]} toshini urib qaytardi! (+Bonus Zar)`;
  } else if (res.finishedToken) {
    room.lastEvent = `🎯 ${pName} 1 ta toshni marraga olib kirdi! (+Bonus Zar)`;
  } else if (room.dice === 6) {
    room.lastEvent = `🎲 ${pName} 6 tashladi! (+Bonus Zar)`;
  } else {
    room.lastEvent = `${LUDO_LABELS[color]} ${room.dice} qadam yurdi`;
  }

  advanceLudoTurn(room, res.extraTurn);
}

function performLudoDiceRoll(room, color) {
  if (!activeLudoRooms.has(room.roomId)) return;
  const curTurnColor = LUDO_COLORS[room.turnIndex];
  if (curTurnColor !== color || room.phase !== 'roll') return;

  // Roll 1..6 (if both tokens are in yard at -1, give 35% chance of 6 so players aren't stuck)
  let dice = Math.floor(Math.random() * 6) + 1;
  if (room.tokens[color].every((s) => s === -1) && Math.random() < 0.35) {
    dice = 6;
  }

  room.dice = dice;
  const legal = getLegalLudoMoves(room.tokens, color, dice);
  room.legalTokens = legal;

  const pName = (room.players.find((p) => p.color === color) || {}).name || color;

  if (legal.length === 0) {
    room.phase = 'move';
    room.lastEvent = `🎲 ${pName}: ${dice} tushdi (Yurish yo'q)`;
    broadcastLudoRoom(room, 'LUDO_STATE');
    clearLudoTimer(room);
    room.botTimer = setTimeout(() => {
      advanceLudoTurn(room, false);
    }, 950);
    return;
  }

  const currentPlayer = room.players[room.turnIndex];
  if (currentPlayer.isBot) {
    room.phase = 'move';
    broadcastLudoRoom(room, 'LUDO_STATE');
    clearLudoTimer(room);
    room.botTimer = setTimeout(() => {
      const chosenIdx = pickBestLudoBotMove(room.tokens, color, dice);
      executeLudoMoveForColor(room, color, chosenIdx ?? legal[0]);
    }, 650);
    return;
  }

  // Human player: if only 1 token can move, auto-move after short visual pause for smooth UX, or let user tap if 2 tokens
  if (legal.length === 1) {
    room.phase = 'move';
    broadcastLudoRoom(room, 'LUDO_STATE');
    clearLudoTimer(room);
    room.botTimer = setTimeout(() => {
      if (room.phase === 'move' && LUDO_COLORS[room.turnIndex] === color) {
        executeLudoMoveForColor(room, color, legal[0]);
      }
    }, 550);
  } else {
    room.phase = 'move';
    room.lastEvent = `🎲 Sizga ${dice} tushdi! Qaysi toshni yuritasiz?`;
    broadcastLudoRoom(room, 'LUDO_STATE');
  }
}

function executeLudoBotTurn(room) {
  if (!activeLudoRooms.has(room.roomId)) return;
  const color = LUDO_COLORS[room.turnIndex];
  performLudoDiceRoll(room, color);
}

function startLudoRoomForUser(user, stake = 0, botDifficulty = 'medium') {
  for (const [rid, r] of activeLudoRooms.entries()) {
    if (r.players.some((p) => String(p.id) === String(user.id))) {
      clearLudoTimer(r);
      activeLudoRooms.delete(rid);
    }
  }

  const shuffledBots = [...BOT_PROFILES].sort(() => Math.random() - 0.5).slice(0, 3);
  const players = [
    { id: String(user.id), name: user.name || 'Siz', color: 'red', isBot: false },
    { id: `${shuffledBots[0].id}_ludo_1`, name: shuffledBots[0].name, color: 'green', isBot: true },
    { id: `${shuffledBots[1].id}_ludo_2`, name: shuffledBots[1].name, color: 'yellow', isBot: true },
    { id: `${shuffledBots[2].id}_ludo_3`, name: shuffledBots[2].name, color: 'blue', isBot: true }
  ];

  const prizePool = stake > 0 ? Math.floor(stake * 4 * 0.85) : 0;

  const room = {
    roomId: 'ludo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    stake,
    prizePool,
    botDifficulty,
    players,
    tokens: createInitialLudoTokens(),
    turnIndex: 0, // Red (Human) starts!
    phase: 'roll',
    dice: null,
    legalTokens: [],
    lastEvent: '🎲 O\'yin boshlandi! Zarni bosing!',
    winnerColor: null,
    botTimer: null
  };

  activeLudoRooms.set(room.roomId, room);
  broadcastLudoRoom(room, 'LUDO_STATE');
}

// ============================================================================
// 👥 GROUP MULTIPLAYER WAITING LOBBY (ZAKOVAT & LUDO)
// ============================================================================

function broadcastZakovatLobby(room) {
  const payload = {
    game: 'zakovat',
    roomId: room.roomId,
    hostId: String(room.hostId),
    phase: room.phase,
    maxPlayers: 4,
    count: room.players.length,
    players: room.players.map((p) => ({
      id: String(p.id),
      name: p.name,
      isHost: String(p.id) === String(room.hostId),
      isBot: Boolean(p.isBot)
    }))
  };
  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) sendPacket(pWs, 'ZAKOVAT_LOBBY', payload);
    }
  }
}

async function handleJoinGroupZakovat(user, ws, roomId, hostId) {
  let room = activeZakovatRooms.get(roomId);
  const meta = pendingGroupRoomMeta.get(roomId) || {};

  if (!room) {
    const db = loadDb();
    const seenSet = new Set(user.seenQuestions || []);
    const customQs = db.customZakovatQuestions || [];
    const questions = pickQuestionsForZakovatRoom(seenSet, 8, customQs);

    user.seenQuestions = [...(user.seenQuestions || []), ...questions.map((q) => q.id)].slice(-160);
    saveDb();

    room = {
      roomId,
      game: 'zakovat',
      hostId: hostId || String(user.id),
      chatId: meta.chatId || null,
      messageId: meta.messageId || null,
      phase: 'lobby',
      stake: 0,
      prizeFirst: 0,
      prizeSecond: 0,
      botDifficulty: 'medium',
      questions,
      qIndex: 0,
      qStartedAt: null,
      players: [
        {
          id: String(user.id),
          name: user.name || 'Boshlovchi',
          isBot: false,
          score: 0,
          correctCount: 0,
          usedFifty: false,
          hiddenOpts: [],
          hiddenOptsForQ: -1
        }
      ],
      currentAnswers: {},
      lastPoints: {},
      qTimer: null,
      botTimers: []
    };
    activeZakovatRooms.set(roomId, room);
    broadcastZakovatLobby(room);
    return;
  }

  if (room.phase === 'finished') {
    sendPacket(ws, 'ERROR', { code: 'ROOM_FINISHED', message: "Ushbu Zakovat o'yini allaqachon yakunlangan!" });
    return;
  }

  if (room.phase === 'question' || room.phase === 'reveal') {
    const existing = room.players.find((p) => String(p.id) === String(user.id));
    if (existing) {
      sendPacket(ws, 'ZAKOVAT_STATE', buildZakovatRoomPayload(room, user.id));
    } else {
      sendPacket(ws, 'ERROR', { code: 'GAME_STARTED', message: "Ushbu Zakovat o'yini allaqachon boshlanib ketgan!" });
    }
    return;
  }

  const alreadyIn = room.players.find((p) => String(p.id) === String(user.id));
  if (!alreadyIn) {
    if (room.players.length >= 4) {
      sendPacket(ws, 'ERROR', { code: 'ROOM_FULL', message: "Zakovat xonasi to'lgan (4/4)!" });
      return;
    }
    room.players.push({
      id: String(user.id),
      name: user.name || 'Ishtirokchi',
      isBot: false,
      score: 0,
      correctCount: 0,
      usedFifty: false,
      hiddenOpts: [],
      hiddenOptsForQ: -1
    });
  }

  if (meta.chatId && !room.chatId) room.chatId = meta.chatId;
  if (meta.messageId && !room.messageId) room.messageId = meta.messageId;

  if (room.chatId && room.messageId && botService) {
    botService.updateGroupRoomProgress({
      game: 'zakovat',
      roomId: room.roomId,
      chatId: room.chatId,
      messageId: room.messageId,
      hostId: room.hostId,
      hostName: (room.players[0] || {}).name,
      count: room.players.length,
      players: room.players,
      status: 'lobby'
    }).catch(() => {});
  }

  broadcastZakovatLobby(room);

  if (room.players.length === 4) {
    setTimeout(() => {
      if (activeZakovatRooms.has(roomId) && room.phase === 'lobby') {
        startZakovatMatchFromLobby(room);
      }
    }, 1500);
  }
}

function startZakovatMatchFromLobby(room) {
  if (!activeZakovatRooms.has(room.roomId) || room.phase !== 'lobby') return;

  const neededBots = 4 - room.players.length;
  if (neededBots > 0) {
    const shuffledBots = [...BOT_PROFILES].sort(() => Math.random() - 0.5).slice(0, neededBots);
    for (let i = 0; i < neededBots; i++) {
      const b = shuffledBots[i];
      room.players.push({
        id: `${b.id}_zk_${Date.now()}_${i}`,
        name: b.name,
        isBot: true,
        score: 0,
        correctCount: 0,
        usedFifty: false,
        hiddenOpts: [],
        hiddenOptsForQ: -1
      });
    }
  }

  room.phase = 'question';

  if (room.chatId && room.messageId && botService) {
    botService.updateGroupRoomProgress({
      game: 'zakovat',
      roomId: room.roomId,
      chatId: room.chatId,
      messageId: room.messageId,
      hostId: room.hostId,
      count: room.players.length,
      players: room.players,
      status: 'playing'
    }).catch(() => {});
  }

  startZakovatQuestion(room);
}

function broadcastLudoLobby(room) {
  const payload = {
    game: 'ludo',
    roomId: room.roomId,
    hostId: String(room.hostId),
    phase: room.phase,
    maxPlayers: 4,
    count: room.players.length,
    players: room.players.map((p, idx) => ({
      id: String(p.id),
      name: p.name,
      color: p.color || LUDO_COLORS[idx] || 'red',
      isHost: String(p.id) === String(room.hostId),
      isBot: Boolean(p.isBot)
    }))
  };
  for (const p of room.players) {
    if (!p.isBot) {
      const pWs = clientsByUserId.get(String(p.id));
      if (pWs) sendPacket(pWs, 'LUDO_LOBBY', payload);
    }
  }
}

async function handleJoinGroupLudo(user, ws, roomId, hostId) {
  let room = activeLudoRooms.get(roomId);
  const meta = pendingGroupRoomMeta.get(roomId) || {};

  if (!room) {
    room = {
      roomId,
      game: 'ludo',
      hostId: hostId || String(user.id),
      chatId: meta.chatId || null,
      messageId: meta.messageId || null,
      phase: 'lobby',
      stake: 0,
      prizePool: 0,
      botDifficulty: 'medium',
      players: [
        { id: String(user.id), name: user.name || 'Stol egasi', color: 'red', isBot: false }
      ],
      tokens: createInitialLudoTokens(),
      turnIndex: 0,
      dice: null,
      legalTokens: [],
      lastEvent: "🎲 O'yin kutish xonasida",
      winnerColor: null,
      botTimer: null
    };
    activeLudoRooms.set(roomId, room);
    broadcastLudoLobby(room);
    return;
  }

  if (room.phase === 'finished') {
    sendPacket(ws, 'ERROR', { code: 'ROOM_FINISHED', message: "Ushbu Ludo o'yini allaqachon yakunlangan!" });
    return;
  }

  if (room.phase !== 'lobby') {
    const existing = room.players.find((p) => String(p.id) === String(user.id));
    if (existing) {
      sendPacket(ws, 'LUDO_STATE', buildLudoRoomPayload(room));
    } else {
      sendPacket(ws, 'ERROR', { code: 'GAME_STARTED', message: "Ushbu Ludo stoli allaqachon boshlanib ketgan!" });
    }
    return;
  }

  const alreadyIn = room.players.find((p) => String(p.id) === String(user.id));
  if (!alreadyIn) {
    if (room.players.length >= 4) {
      sendPacket(ws, 'ERROR', { code: 'ROOM_FULL', message: "Ludo stoli to'lgan (4/4)!" });
      return;
    }
    const color = LUDO_COLORS[room.players.length] || 'blue';
    room.players.push({
      id: String(user.id),
      name: user.name || 'Ishtirokchi',
      color,
      isBot: false
    });
  }

  if (meta.chatId && !room.chatId) room.chatId = meta.chatId;
  if (meta.messageId && !room.messageId) room.messageId = meta.messageId;

  if (room.chatId && room.messageId && botService) {
    botService.updateGroupRoomProgress({
      game: 'ludo',
      roomId: room.roomId,
      chatId: room.chatId,
      messageId: room.messageId,
      hostId: room.hostId,
      hostName: (room.players[0] || {}).name,
      count: room.players.length,
      players: room.players,
      status: 'lobby'
    }).catch(() => {});
  }

  broadcastLudoLobby(room);

  if (room.players.length === 4) {
    setTimeout(() => {
      if (activeLudoRooms.has(roomId) && room.phase === 'lobby') {
        startLudoMatchFromLobby(room);
      }
    }, 1500);
  }
}

function startLudoMatchFromLobby(room) {
  if (!activeLudoRooms.has(room.roomId) || room.phase !== 'lobby') return;

  room.players.forEach((p, idx) => {
    p.color = LUDO_COLORS[idx];
  });

  const neededBots = 4 - room.players.length;
  if (neededBots > 0) {
    const shuffledBots = [...BOT_PROFILES].sort(() => Math.random() - 0.5).slice(0, neededBots);
    for (let i = 0; i < neededBots; i++) {
      const b = shuffledBots[i];
      const botColor = LUDO_COLORS[room.players.length];
      room.players.push({
        id: `${b.id}_ludo_${Date.now()}_${i}`,
        name: b.name,
        color: botColor,
        isBot: true
      });
    }
  }

  room.phase = 'roll';
  room.turnIndex = 0;
  room.tokens = createInitialLudoTokens();
  room.dice = null;
  room.legalTokens = [];
  room.lastEvent = "🎲 O'yin boshlandi! Qizil rang boshlaydi!";

  if (room.chatId && room.messageId && botService) {
    botService.updateGroupRoomProgress({
      game: 'ludo',
      roomId: room.roomId,
      chatId: room.chatId,
      messageId: room.messageId,
      hostId: room.hostId,
      count: room.players.length,
      players: room.players,
      status: 'playing'
    }).catch(() => {});
  }

  broadcastLudoRoom(room, 'LUDO_STATE');
}

wss.on('connection', (ws, req) => {
  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  let currentUserId = null;

  sendPacket(ws, 'WELCOME', { needHello: true, serverTs: Date.now() });

  ws.on('message', async (rawBuf) => {
    let packet;
    try {
      packet = JSON.parse(rawBuf.toString());
    } catch (e) {
      return;
    }

    const type = packet.t;
    const data = packet.d || {};

    if (type === 'PING') {
      sendPacket(ws, 'PONG', { ts: Date.now() });
      return;
    }

    // 1. Handshake & Authentication
    if (type === 'HELLO') {
      const auth = verifyTelegramInitData(data.initData, BOT_TOKEN, ALLOW_DEV_MODE);
      if (!auth.ok) {
        sendPacket(ws, 'ERROR', { code: auth.reason, message: 'Avtorizatsiya xatosi!' });
        return;
      }

      const tgUser = auth.user;
      const rawStartParam = String(data.startParam || auth.startParam || '');
      let duelParsed = null;
      let groupRoomParsed = null;
      if (rawStartParam.startsWith('duel_')) {
        // Format: duel_<duelId>_<game>_<hostId>
        const p = rawStartParam.split('_');
        duelParsed = {
          duelId: p[1] || '',
          game: p[2] === 'chess' ? 'chess' : 'checkers',
          hostId: p[3] || null
        };
      } else if (rawStartParam.startsWith('zroom_')) {
        // Format: zroom_<roomId>_<hostId>
        const p = rawStartParam.split('_');
        groupRoomParsed = {
          game: 'zakovat',
          roomId: p[1] || '',
          hostId: p[2] || null
        };
      } else if (rawStartParam.startsWith('lroom_')) {
        // Format: lroom_<roomId>_<hostId>
        const p = rawStartParam.split('_');
        groupRoomParsed = {
          game: 'ludo',
          roomId: p[1] || '',
          hostId: p[2] || null
        };
      }

      const referredBy =
        data.referredBy ||
        (rawStartParam.startsWith('ref_')
          ? rawStartParam.replace('ref_', '')
          : (duelParsed && duelParsed.hostId) || (groupRoomParsed && groupRoomParsed.hostId) || null);

      const user = getOrCreateUser({
        id: tgUser.id,
        name: tgUser.first_name || tgUser.name || 'Player',
        username: tgUser.username || '',
        lang: data.lang || tgUser.language_code || 'uz',
        referredBy,
        clientIp
      });

      if (data.lang && ['uz', 'ru', 'en'].includes(data.lang)) {
        user.lang = data.lang;
        saveDb();
      }

      currentUserId = String(user.id);
      clientsByUserId.set(currentUserId, ws);

      sendPacket(ws, 'AUTH_OK', { user: formatUserClientState(user) });
      sendFullSync(ws, currentUserId);
      broadcastOnlineStats();

      // Instantly restore match state upon reconnect so player never gets frozen
      for (const m of activeMatches.values()) {
        if (
          m.status === 'playing' &&
          (String(m.whitePlayer.id) === currentUserId || String(m.blackPlayer.id) === currentUserId)
        ) {
          const myColor = String(m.whitePlayer.id) === currentUserId ? 'w' : 'b';
          const payload = buildMatchStatePayload(m);
          sendPacket(ws, 'STATE', { ...payload, myColor });
          break;
        }
      }

      // Restore active Zakovat / Ludo room upon reconnect
      for (const r of activeZakovatRooms.values()) {
        if (r.players.some((p) => String(p.id) === currentUserId)) {
          if (r.phase === 'lobby') {
            broadcastZakovatLobby(r);
          } else if (r.phase === 'question' || r.phase === 'reveal') {
            sendPacket(ws, 'ZAKOVAT_STATE', buildZakovatRoomPayload(r, currentUserId));
          }
          break;
        }
      }
      for (const r of activeLudoRooms.values()) {
        if (r.players.some((p) => String(p.id) === currentUserId)) {
          if (r.phase === 'lobby') {
            broadcastLudoLobby(r);
          } else if (r.phase !== 'finished') {
            sendPacket(ws, 'LUDO_STATE', buildLudoRoomPayload(r));
          }
          break;
        }
      }

      if (duelParsed && duelParsed.duelId) {
        await handleJoinDuelRoom(user, ws, duelParsed.duelId, duelParsed.game, duelParsed.hostId);
      } else if (groupRoomParsed && groupRoomParsed.roomId) {
        if (groupRoomParsed.game === 'zakovat') {
          await handleJoinGroupZakovat(user, ws, groupRoomParsed.roomId, groupRoomParsed.hostId);
        } else if (groupRoomParsed.game === 'ludo') {
          await handleJoinGroupLudo(user, ws, groupRoomParsed.roomId, groupRoomParsed.hostId);
        }
      }
      return;
    }

    if (!currentUserId) {
      sendPacket(ws, 'ERROR', { code: 'UNAUTHORIZED', message: 'Avval HELLO yuboring' });
      return;
    }

    const db = loadDb();
    const user = db.users[currentUserId];
    if (!user) return;
    user.lastActiveAt = Date.now();

    // Re-sync match request (sent on app focus / visibility recovery)
    if (type === 'MATCH_RESYNC') {
      for (const m of activeMatches.values()) {
        if (
          m.status === 'playing' &&
          (String(m.whitePlayer.id) === currentUserId || String(m.blackPlayer.id) === currentUserId)
        ) {
          const myColor = String(m.whitePlayer.id) === currentUserId ? 'w' : 'b';
          const payload = buildMatchStatePayload(m);
          sendPacket(ws, 'STATE', { ...payload, myColor });
          break;
        }
      }
      return;
    }

    // Cancel Duel from WebApp modal
    if (type === 'DUEL_CANCEL') {
      const duelId = data.duelId;
      if (duelId && duelRooms.has(duelId)) {
        const room = duelRooms.get(duelId);
        if (room.status === 'waiting' && (String(room.hostId) === currentUserId || String(room.firstUserId) === currentUserId)) {
          room.status = 'cancelled';
          duelRooms.delete(duelId);
          botService.updateDuelGroupMessageCancelled(room, user).catch(() => {});
          sendPacket(ws, 'DUEL_CANCELLED', { duelId });
        }
      }
      return;
    }

    // Start Lobby Room Now (Host pressed Start Now button)
    if (type === 'GROUP_LOBBY_START') {
      const { game, roomId } = data;
      if (game === 'zakovat') {
        const room = activeZakovatRooms.get(roomId);
        if (room && room.phase === 'lobby' && String(room.hostId) === currentUserId) {
          startZakovatMatchFromLobby(room);
        }
      } else if (game === 'ludo') {
        const room = activeLudoRooms.get(roomId);
        if (room && room.phase === 'lobby' && String(room.hostId) === currentUserId) {
          startLudoMatchFromLobby(room);
        }
      }
      return;
    }

    // Leave Lobby Room
    if (type === 'GROUP_LOBBY_LEAVE') {
      const { game, roomId } = data;
      if (game === 'zakovat') {
        const room = activeZakovatRooms.get(roomId);
        if (room && room.phase === 'lobby') {
          room.players = room.players.filter((p) => String(p.id) !== currentUserId);
          if (room.players.length === 0) {
            activeZakovatRooms.delete(roomId);
          } else {
            if (String(room.hostId) === currentUserId) {
              room.hostId = room.players[0].id;
            }
            broadcastZakovatLobby(room);
          }
        }
      } else if (game === 'ludo') {
        const room = activeLudoRooms.get(roomId);
        if (room && room.phase === 'lobby') {
          room.players = room.players.filter((p) => String(p.id) !== currentUserId);
          if (room.players.length === 0) {
            activeLudoRooms.delete(roomId);
          } else {
            if (String(room.hostId) === currentUserId) {
              room.hostId = room.players[0].id;
            }
            room.players.forEach((p, idx) => { p.color = LUDO_COLORS[idx]; });
            broadcastLudoLobby(room);
          }
        }
      }
      sendPacket(ws, 'GROUP_LOBBY_LEFT', {});
      return;
    }
    if (type === 'CLAIM_LOSS_PROTECTION') {
      await withUserLock(currentUserId, async () => {
        const p = user.pendingLossProtection;
        if (!p || p.matchId !== data.matchId) {
          sendPacket(ws, 'ERROR', { code: 'INVALID_PROTECTION', message: 'Ushbu o\'yin uchun ELO qalqoni mavjud emas!' });
          return;
        }
        const refund = p.eloRefund || 0;
        user.elo = (user.elo || 1000) + refund;
        delete user.pendingLossProtection;

        const now = Date.now();
        user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;
        user.adCountToday = (user.adCountToday || 0) + 1;
        user.lastAdAt = now;
        db.adsHistory = db.adsHistory || [];
        db.adsHistory.push({
          id: 'ad_' + now.toString(36),
          userId: user.id,
          userName: user.name,
          lang: user.lang || 'uz',
          action: 'loss_protection',
          rewardCoins: 0,
          watchedAt: now
        });
        if (db.adsHistory.length > 500) db.adsHistory = db.adsHistory.slice(-500);

        saveDb();
        sendPacket(ws, 'LOSS_PROTECTION_SUCCESS', { matchId: data.matchId, eloRefund: refund, newElo: user.elo });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Claim 2x Double Win (Double match winnings via Rewarded Ad)
    if (type === 'CLAIM_DOUBLE_WIN') {
      await withUserLock(currentUserId, async () => {
        const d = user.pendingDoubleWin;
        if (!d || d.matchId !== data.matchId) {
          sendPacket(ws, 'ERROR', { code: 'INVALID_DOUBLE_WIN', message: 'Ushbu g\'alaba allaqachon ko\'paytirilgan yoki mavjud emas!' });
          return;
        }
        const bonus = d.bonus || 0;
        user.bonusCoins = (user.bonusCoins || 0) + bonus;
        delete user.pendingDoubleWin;

        const now = Date.now();
        user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;
        user.adCountToday = (user.adCountToday || 0) + 1;
        user.lastAdAt = now;
        db.adsHistory = db.adsHistory || [];
        db.adsHistory.push({
          id: 'ad_' + now.toString(36),
          userId: user.id,
          userName: user.name,
          lang: user.lang || 'uz',
          action: 'double_win',
          rewardCoins: bonus,
          watchedAt: now
        });
        if (db.adsHistory.length > 500) db.adsHistory = db.adsHistory.slice(-500);

        saveDb();
        sendPacket(ws, 'DOUBLE_WIN_SUCCESS', { matchId: data.matchId, bonus, newCoins: getTotalCoins(user) });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Request Match Hint (Rewarded move suggestion by Grandmaster AI)
    if (type === 'REQUEST_MATCH_HINT') {
      const match = activeMatches.get(data.matchId);
      if (!match || match.status !== 'playing') {
        sendPacket(ws, 'ERROR', { code: 'MATCH_NOT_ACTIVE', message: 'O\'yin faol emas!' });
        return;
      }
      const myColor = String(match.whitePlayer.id) === currentUserId ? 'w' : 'b';
      if (match.turn !== myColor) {
        sendPacket(ws, 'ERROR', { code: 'NOT_YOUR_TURN', message: 'Hozir sizning navbatingiz emas!' });
        return;
      }

      let bestMove = null;
      if (match.game === 'chess') {
        bestMove = findBestChessMove(match.fen, 'hard');
      } else {
        bestMove = findBestCheckersMove(match.board, match.turn, 'hard');
      }

      if (!bestMove) {
        sendPacket(ws, 'ERROR', { code: 'NO_MOVE', message: 'Mumkin bo\'lgan yurish topilmadi!' });
        return;
      }

      const now = Date.now();
      user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;
      user.adCountToday = (user.adCountToday || 0) + 1;
      user.lastAdAt = now;
      db.adsHistory = db.adsHistory || [];
      db.adsHistory.push({
        id: 'ad_' + now.toString(36),
        userId: user.id,
        userName: user.name,
        lang: user.lang || 'uz',
        action: 'game_hint',
        rewardCoins: 0,
        watchedAt: now
      });
      if (db.adsHistory.length > 500) db.adsHistory = db.adsHistory.slice(-500);
      saveDb();

      sendPacket(ws, 'HINT_RESULT', { matchId: match.matchId, move: bestMove, game: match.game });
      sendFullSync(ws, currentUserId);
      return;
    }

    // Shop Purchase (Boards, Pieces, VIP)
    if (type === 'SHOP_BUY') {
      const itemId = String(data.itemId || '');
      await withUserLock(currentUserId, async () => {
        const item = SHOP_ITEMS.find((s) => s.id === itemId);
        if (!item) {
          sendPacket(ws, 'ERROR', { code: 'ITEM_NOT_FOUND', message: 'Bunday mahsulot topilmadi!' });
          return;
        }

        user.ownedSkins = user.ownedSkins || ['board_classic', 'piece_classic'];
        if (item.type !== 'vip' && user.ownedSkins.includes(item.id)) {
          sendPacket(ws, 'ERROR', { code: 'ALREADY_OWNED', message: 'Bu skin allaqachon sotib olingan!' });
          return;
        }

        if (getTotalCoins(user) < item.price) {
          sendPacket(ws, 'ERROR', { code: 'INSUFFICIENT_BALANCE', message: 'Tangalar yetarli emas!' });
          return;
        }

        if (item.price > 0) {
          deductCoins(user, item.price);
        }

        if (item.type === 'vip') {
          user.vipUntil = Math.max(Date.now(), user.vipUntil || 0) + 7 * 86400000;
        } else {
          if (!user.ownedSkins.includes(item.id)) {
            user.ownedSkins.push(item.id);
          }
          if (item.type === 'board') user.equippedBoardSkin = item.skinKey;
          if (item.type === 'piece') user.equippedPieceSkin = item.skinKey;
        }

        saveDb();
        sendPacket(ws, 'SHOP_BUY_SUCCESS', {
          itemId: item.id,
          type: item.type,
          boardSkin: user.equippedBoardSkin,
          pieceSkin: user.equippedPieceSkin,
          isVip: Boolean(user.vipUntil && user.vipUntil > Date.now())
        });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Shop Equip Skin
    if (type === 'SHOP_EQUIP') {
      const itemId = String(data.itemId || '');
      await withUserLock(currentUserId, async () => {
        const item = SHOP_ITEMS.find((s) => s.id === itemId);
        if (!item) return;

        user.ownedSkins = user.ownedSkins || ['board_classic', 'piece_classic'];
        if (!user.ownedSkins.includes(item.id)) {
          sendPacket(ws, 'ERROR', { code: 'NOT_OWNED', message: 'Avval ushbu skinni sotib oling!' });
          return;
        }

        if (item.type === 'board') {
          user.equippedBoardSkin = item.skinKey;
        } else if (item.type === 'piece') {
          user.equippedPieceSkin = item.skinKey;
        }

        saveDb();
        sendPacket(ws, 'SHOP_EQUIP_SUCCESS', {
          itemId: item.id,
          boardSkin: user.equippedBoardSkin,
          pieceSkin: user.equippedPieceSkin
        });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Claim Referral Milestone
    if (type === 'CLAIM_REF_MILESTONE') {
      const count = Number(data.milestoneCount || 0);
      await withUserLock(currentUserId, async () => {
        const milestone = REF_MILESTONES.find((m) => m.count === count);
        if (!milestone) return;

        const refCount = user.referralCount || 0;
        if (refCount < milestone.count) {
          sendPacket(ws, 'ERROR', { code: 'NOT_REACHED', message: `Yana ${milestone.count - refCount} ta do'st taklif qilishingiz kerak!` });
          return;
        }

        user.claimedRefMilestones = user.claimedRefMilestones || [];
        if (user.claimedRefMilestones.includes(milestone.count)) {
          sendPacket(ws, 'ERROR', { code: 'ALREADY_CLAIMED', message: 'Ushbu mukofot allaqachon olingan!' });
          return;
        }

        user.claimedRefMilestones.push(milestone.count);
        user.bonusCoins = (user.bonusCoins || 0) + milestone.reward;

        if (milestone.vipDays) {
          user.vipUntil = Math.max(Date.now(), user.vipUntil || 0) + milestone.vipDays * 86400000;
        }
        if (milestone.unlockSkin) {
          user.ownedSkins = user.ownedSkins || ['board_classic', 'piece_classic'];
          if (!user.ownedSkins.includes(milestone.unlockSkin)) {
            user.ownedSkins.push(milestone.unlockSkin);
          }
        }

        saveDb();
        sendPacket(ws, 'REF_MILESTONE_SUCCESS', {
          count: milestone.count,
          reward: milestone.reward,
          vipDays: milestone.vipDays,
          unlockSkin: milestone.unlockSkin
        });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Claim Telegram Story Share Reward
    if (type === 'CLAIM_STORY_SHARE') {
      await withUserLock(currentUserId, async () => {
        const now = Date.now();
        const cooldown = 20 * 3600 * 1000; // 20 hours
        if (now - (user.lastStoryShareAt || 0) < cooldown) {
          sendPacket(ws, 'ERROR', { code: 'STORY_COOLDOWN', message: 'Story mukofoti 24 soatda 1 marta beriladi!' });
          return;
        }
        const bonus = 25;
        user.bonusCoins = (user.bonusCoins || 0) + bonus;
        user.lastStoryShareAt = now;
        saveDb();
        sendPacket(ws, 'STORY_SHARE_SUCCESS', { bonus });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // 2. Language Change
    if (type === 'CHANGE_LANG') {
      if (['uz', 'ru', 'en'].includes(data.lang)) {
        user.lang = data.lang;
        saveDb();
        sendFullSync(ws, currentUserId);
      }
      return;
    }

    // 3. Join Matchmaking Queue
    if (type === 'QUEUE_JOIN') {
      const rawGame = String(data.game || 'checkers');
      const game = ['chess', 'checkers', 'zakovat', 'ludo'].includes(rawGame) ? rawGame : 'checkers';
      const stake = Math.max(0, Math.floor(Number(data.stake) || 5));
      const botDifficulty = ['easy', 'medium', 'hard'].includes(data.botDifficulty) ? data.botDifficulty : 'medium';

      await withUserLock(currentUserId, async () => {
        removeFromQueue(currentUserId);

        if (getTotalCoins(user) < stake) {
          sendPacket(ws, 'ERROR', { code: 'INSUFFICIENT_BALANCE', message: 'Tangalar yetarli emas!' });
          return;
        }

        if (game === 'zakovat') {
          if (stake > 0) deductCoins(user, stake);
          saveDb();
          sendFullSync(ws, currentUserId);
          startZakovatRoomForUser(user, stake, botDifficulty);
          return;
        }

        if (game === 'ludo') {
          if (stake > 0) deductCoins(user, stake);
          saveDb();
          sendFullSync(ws, currentUserId);
          startLudoRoomForUser(user, stake, botDifficulty);
          return;
        }

        const newEntry = {
          userId: currentUserId,
          ws,
          game,
          stake,
          botDifficulty,
          ip: clientIp,
          elo: user.elo || 1000,
          queuedAt: Date.now(),
          botTimer: null
        };

        // Try finding a valid human opponent in queue (with Anti-Collusion check!)
        const opponentIdx = matchmakingQueue.findIndex(
          (q) =>
            q.game === game &&
            q.stake === stake &&
            canMatchPlayers(newEntry, q, db.matchesHistory, ADMIN_TELEGRAM_ID)
        );

        if (opponentIdx !== -1) {
          const opponentEntry = matchmakingQueue.splice(opponentIdx, 1)[0];
          if (opponentEntry.botTimer) clearTimeout(opponentEntry.botTimer);

          const oppUser = db.users[opponentEntry.userId];
          if (oppUser && getTotalCoins(oppUser) >= stake) {
            if (stake > 0) {
              deductCoins(user, stake);
              deductCoins(oppUser, stake);
            }
            const flip = Math.random() < 0.5;
            createAndStartMatch({
              game,
              stake,
              whiteUser: flip ? user : oppUser,
              blackUser: flip ? oppUser : user
            });
            return;
          }
        }

        // Otherwise add to queue and search for real human opponent for 10s before fallback to bot
        newEntry.botTimer = setTimeout(async () => {
          await withUserLock(currentUserId, async () => {
            const removed = removeFromQueue(currentUserId);
            if (!removed) return;
            if (getTotalCoins(user) < stake) return;
            if (stake > 0) deductCoins(user, stake);

            const diff = newEntry.botDifficulty || 'medium';
            const botTemplate = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
            const eloDelta = diff === 'easy' ? -80 : diff === 'hard' ? 90 : 15;
            const userGameElo = game === 'chess' ? (user.eloChess || 1000) : (user.eloCheckers || 1000);
            const botUser = {
              id: `${botTemplate.id}_${Date.now()}`,
              name: botTemplate.name,
              elo: Math.max(850, userGameElo + eloDelta),
              isBot: true,
              botDifficulty: diff
            };

            const userIsWhite = Math.random() < 0.5;
            createAndStartMatch({
              game,
              stake,
              whiteUser: userIsWhite ? user : botUser,
              blackUser: userIsWhite ? botUser : user,
              botDifficulty: diff
            });
          });
        }, 10000);

        matchmakingQueue.push(newEntry);
        sendPacket(ws, 'QUEUED', { game, stake, botDifficulty });
      });
      return;
    }

    // Direct Instant Practice vs Bot
    if (type === 'PLAY_BOT_DIRECT') {
      const rawGame = String(data.game || 'checkers');
      const game = ['chess', 'checkers', 'zakovat', 'ludo'].includes(rawGame) ? rawGame : 'checkers';
      const diff = ['easy', 'medium', 'hard'].includes(data.botDifficulty) ? data.botDifficulty : 'medium';

      await withUserLock(currentUserId, async () => {
        removeFromQueue(currentUserId);

        if (game === 'zakovat') {
          startZakovatRoomForUser(user, 0, diff);
          return;
        }
        if (game === 'ludo') {
          startLudoRoomForUser(user, 0, diff);
          return;
        }

        const botTemplate = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
        const eloDelta = diff === 'easy' ? -80 : diff === 'hard' ? 90 : 15;
        const userGameElo = game === 'chess' ? (user.eloChess || 1000) : (user.eloCheckers || 1000);
        const botUser = {
          id: `direct_${botTemplate.id}_${Date.now()}`,
          name: botTemplate.name,
          elo: Math.max(850, userGameElo + eloDelta),
          isBot: true,
          botDifficulty: diff
        };

        const userIsWhite = Math.random() < 0.5;
        createAndStartMatch({
          game,
          stake: 0,
          whiteUser: userIsWhite ? user : botUser,
          blackUser: userIsWhite ? botUser : user,
          botDifficulty: diff
        });
      });
      return;
    }

    if (type === 'GET_LEADERBOARD') {
      const g = ['chess', 'checkers', 'zakovat', 'ludo'].includes(data.game) ? data.game : 'checkers';
      sendPacket(ws, 'LEADERBOARD_DATA', {
        game: g,
        list: getLeaderboardList(user.lang, g)
      });
      return;
    }

    // Zakovat Actions
    if (type === 'ZAKOVAT_ANSWER') {
      const room = activeZakovatRooms.get(String(data.roomId || ''));
      if (room) {
        recordZakovatPlayerAnswer(room, currentUserId, Number(data.optIndex));
      }
      return;
    }

    if (type === 'ZAKOVAT_FIFTY') {
      const room = activeZakovatRooms.get(String(data.roomId || ''));
      if (room && room.phase === 'question') {
        const me = room.players.find((p) => String(p.id) === String(currentUserId));
        if (me && !me.usedFifty) {
          me.usedFifty = true;
          const curQ = room.questions[room.qIndex];
          const wrongIndices = [0, 1, 2, 3].filter((i) => i !== curQ.ans);
          wrongIndices.sort(() => Math.random() - 0.5);
          me.hiddenOpts = wrongIndices.slice(0, 2);
          me.hiddenOptsForQ = room.qIndex;
          sendPacket(ws, 'ZAKOVAT_STATE', buildZakovatRoomPayload(room, currentUserId));
        }
      }
      return;
    }

    if (type === 'ZAKOVAT_LEAVE') {
      const room = activeZakovatRooms.get(String(data.roomId || ''));
      if (room) {
        clearZakovatTimers(room);
        activeZakovatRooms.delete(room.roomId);
      }
      return;
    }

    // Ludo Actions
    if (type === 'LUDO_ROLL') {
      const room = activeLudoRooms.get(String(data.roomId || ''));
      if (room && room.phase === 'roll') {
        const me = room.players.find((p) => String(p.id) === String(currentUserId));
        if (me && LUDO_COLORS[room.turnIndex] === me.color) {
          performLudoDiceRoll(room, me.color);
        }
      }
      return;
    }

    if (type === 'LUDO_MOVE') {
      const room = activeLudoRooms.get(String(data.roomId || ''));
      if (room && room.phase === 'move') {
        const me = room.players.find((p) => String(p.id) === String(currentUserId));
        const tokenIdx = Number(data.tokenIdx);
        if (
          me &&
          LUDO_COLORS[room.turnIndex] === me.color &&
          (room.legalTokens || []).includes(tokenIdx)
        ) {
          clearLudoTimer(room);
          executeLudoMoveForColor(room, me.color, tokenIdx);
        }
      }
      return;
    }

    if (type === 'LUDO_LEAVE') {
      const room = activeLudoRooms.get(String(data.roomId || ''));
      if (room) {
        clearLudoTimer(room);
        activeLudoRooms.delete(room.roomId);
      }
      return;
    }

    if (type === 'QUEUE_CANCEL') {
      removeFromQueue(currentUserId);
      for (const rm of duelRooms.values()) {
        if (rm.status === 'waiting' && String(rm.firstUserId) === currentUserId) {
          rm.firstUserId = null;
        }
      }
      sendPacket(ws, 'QUEUE_CANCELLED', {});
      return;
    }

    // 4. In-Game Move
    if (type === 'MOVE') {
      const match = activeMatches.get(data.matchId);
      if (match) {
        processMatchMove(match, currentUserId, data, { isBot: false });
      }
      return;
    }

    // 5. Resign / Surrender
    if (type === 'RESIGN') {
      const match = activeMatches.get(data.matchId);
      if (match && match.status === 'playing') {
        const myColor = String(match.whitePlayer.id) === currentUserId ? 'w' : 'b';
        const winnerColor = myColor === 'w' ? 'b' : 'w';
        finishMatch(match, winnerColor, 'RESIGN');
      }
      return;
    }

    // 6. Quick Emoji Reaction
    if (type === 'EMOJI') {
      const match = activeMatches.get(data.matchId);
      if (match) {
        const wWs = clientsByUserId.get(String(match.whitePlayer.id));
        const bWs = clientsByUserId.get(String(match.blackPlayer.id));
        const payload = { fromId: currentUserId, emoji: String(data.emoji || '🔥').slice(0, 4) };
        if (wWs) sendPacket(wWs, 'EMOJI', payload);
        if (bWs) sendPacket(bWs, 'EMOJI', payload);
      }
      return;
    }

    // 7. Claim Daily Streak Bonus
    if (type === 'CLAIM_DAILY') {
      await withUserLock(currentUserId, async () => {
        const now = Date.now();
        const cooldown = 20 * 3600 * 1000; // 20h
        if (now - (user.lastDailyAt || 0) < cooldown) {
          sendPacket(ws, 'ERROR', { code: 'DAILY_COOLDOWN', message: 'Kunlik bonus allaqachon olingan!' });
          return;
        }
        user.streak = ((user.streak || 0) % 7) + 1;
        const isVip = Boolean(user.vipUntil && user.vipUntil > now);
        const baseReward = 1 + user.streak; // 1-kun: +2 G ... 7-kun: +8 G
        const reward = isVip ? baseReward * 2 : baseReward;
        user.bonusCoins = (user.bonusCoins || 0) + reward;
        user.lastDailyAt = now;
        saveDb();
        sendPacket(ws, 'REWARD_CLAIMED', { kind: 'daily', amount: reward, streak: user.streak, isVip });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // Record ad impression / views (e.g. post-match interstitial)
    if (type === 'AD_IMPRESSION') {
      const now = Date.now();
      user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;
      user.adCountToday = (user.adCountToday || 0) + 1;
      user.lastAdAt = now;
      db.adsHistory = db.adsHistory || [];
      db.adsHistory.push({
        id: 'ad_' + now.toString(36),
        userId: user.id,
        userName: user.name,
        lang: user.lang || 'uz',
        action: data.action || 'post_match_interstitial',
        rewardCoins: 0,
        watchedAt: now
      });
      if (db.adsHistory.length > 500) db.adsHistory = db.adsHistory.slice(-500);
      saveDb();
      return;
    }

    // 8. Claim Task (Sponsor Channel or AdsGram Video)
    if (type === 'CLAIM_TASK') {
      const taskId = String(data.taskId || '');
      await withUserLock(currentUserId, async () => {
        const task = db.tasks.find((t) => t.id === taskId);
        if (!task) return;

        if (task.type === 'channel') {
          if (user.completedTasks.includes(taskId)) {
            sendPacket(ws, 'ERROR', { code: 'TASK_ALREADY_DONE', message: 'Bu vazifa bajarilgan!' });
            return;
          }
          const isSubscribed = await botService.verifyChannelSubscription(user.id, task.channelUsername);
          if (!isSubscribed) {
            sendPacket(ws, 'ERROR', { code: 'NOT_SUBSCRIBED', message: 'Avval kanalga obuna bo\'ling!' });
            return;
          }
          user.completedTasks.push(taskId);
          user.bonusCoins = (user.bonusCoins || 0) + task.rewardCoins;
        } else if (task.type === 'ad') {
          const now = Date.now();
          if (now - (user.lastAdAt || 0) < 180000) {
            sendPacket(ws, 'ERROR', { code: 'AD_COOLDOWN', message: 'Keyingi reklama uchun 3 daqiqa kuting!' });
            return;
          }
          const todayKey = new Date().toISOString().slice(0, 10);
          if (user.adDayKey !== todayKey) {
            user.adDayKey = todayKey;
            user.adCountToday = 0;
          }
          if ((user.adCountToday || 0) >= 5) {
            sendPacket(ws, 'ERROR', { code: 'AD_DAILY_LIMIT', message: 'Kunlik reklama limiti (5/5) tugadi!' });
            return;
          }
          user.adCountToday = (user.adCountToday || 0) + 1;
          user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;
          user.lastAdAt = now;
          user.bonusCoins = (user.bonusCoins || 0) + task.rewardCoins;
          db.adsHistory = db.adsHistory || [];
          db.adsHistory.push({
            id: 'ad_' + now.toString(36),
            userId: user.id,
            userName: user.name,
            lang: user.lang || 'uz',
            rewardCoins: task.rewardCoins,
            watchedAt: now
          });
          if (db.adsHistory.length > 500) {
            db.adsHistory = db.adsHistory.slice(-500);
          }
        }

        saveDb();
        sendPacket(ws, 'REWARD_CLAIMED', { kind: 'task', taskId, amount: task.rewardCoins });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // 9. Join Tournament
    if (type === 'TOURNAMENT_JOIN') {
      const tourId = String(data.tournamentId || '');
      await withUserLock(currentUserId, async () => {
        const tour = db.tournaments.find((t) => t.id === tourId);
        if (!tour) return;

        const minPlayers = tour.minPlayers || 8;
        const maxPlayers = tour.maxPlayers || 32;

        if (tour.participants.includes(currentUserId)) {
          if (tour.status !== 'active') {
            sendPacket(ws, 'ERROR', {
              code: 'TOUR_NOT_STARTED_YET',
              message: `⏰ Siz turnir ro'yxatidasiz! Turnir soat 20:00 da boshlanadi (boshlanishidan 10 daqiqa oldin bot xabar yuboradi).`
            });
            return;
          }

          // Tournament is LIVE right now! Pair with another online human participant (0% bots!)
          startTournamentMatchForUser(tour, user);
          return;
        }

        if (tour.participants.length >= maxPlayers) {
          sendPacket(ws, 'ERROR', { code: 'TOUR_FULL', message: 'Turnirda joylar to\'lgan!' });
          return;
        }

        // Shart 1: Rasmiy kanal va guruhga obuna tekshiruvi
        if (tour.requireSub !== false) {
          const subChannel = await botService.verifyChannelSubscription(user.id, '@ChessTonArena');
          const subGroup = await botService.verifyChannelSubscription(user.id, '@ChessTonArenaChat');
          if (!subChannel || !subGroup) {
            sendPacket(ws, 'ERROR', {
              code: 'TOUR_SUB_REQUIRED',
              message: '🔒 Turnir sharti: Avval @ChessTonArena kanali va @ChessTonArenaChat guruhiga obuna bo\'ling!'
            });
            return;
          }
        }

        // Shart 2: Minimal taklif qilingan do'stlar soni (masalan 2 ta do'st)
        const minRefs = tour.minReferrals ?? 2;
        if (minRefs > 0 && (user.referralCount || 0) < minRefs) {
          sendPacket(ws, 'ERROR', {
            code: 'TOUR_REF_REQUIRED',
            message: `🔒 Turnir sharti: Kamida ${minRefs} ta do'st taklif qilishingiz kerak! (Sizda: ${user.referralCount || 0}/${minRefs})`
          });
          return;
        }

        const fee = Math.max(0, Number(tour.entryFee) || 0);
        if (fee > 0) {
          if (tour.entryType === 'stars') {
            if ((user.starsBalance || 0) < fee) {
              sendPacket(ws, 'ERROR', { code: 'INSUFFICIENT_STARS', message: 'Stars yetarli emas!' });
              return;
            }
            user.starsBalance -= fee;
          } else {
            if (getTotalCoins(user) < fee) {
              sendPacket(ws, 'ERROR', { code: 'INSUFFICIENT_BALANCE', message: 'Tangalar yetarli emas!' });
              return;
            }
            deductCoins(user, fee);
          }
        }

        tour.participants.push(currentUserId);
        tour.scores = tour.scores || {};
        tour.gamesPlayed = tour.gamesPlayed || {};
        tour.winStreaks = tour.winStreaks || {};
        tour.scores[currentUserId] = tour.scores[currentUserId] || 0;
        tour.gamesPlayed[currentUserId] = tour.gamesPlayed[currentUserId] || 0;
        tour.winStreaks[currentUserId] = tour.winStreaks[currentUserId] || 0;
        if (fee > 0) {
          tour.prizePool += Math.floor(fee * 0.9);
        }
        saveDb();

        sendPacket(ws, 'TOURNAMENT_JOINED', {
          tournamentId: tourId,
          entryFee: fee,
          entryType: tour.entryType,
          startedNow: tour.status === 'active'
        });
        for (const [uid, cWs] of clientsByUserId.entries()) {
          sendFullSync(cWs, uid);
        }
      });
      return;
    }

    // 10. Create Telegram Stars Invoice / Top-up
    if (type === 'BUY_STARS_INVOICE') {
      const starsAmount = Math.max(1, Math.floor(Number(data.stars) || 10));
      const inv = await botService.createStarsInvoiceLink(currentUserId, starsAmount);
      if (inv.ok && inv.isDemo) {
        // In local demo mode without live bot token, credit stars for testing
        await withUserLock(currentUserId, async () => {
          user.starsBalance = (user.starsBalance || 0) + starsAmount;
          saveDb();
          sendPacket(ws, 'REWARD_CLAIMED', { kind: 'stars_demo', amount: starsAmount });
          sendFullSync(ws, currentUserId);
        });
      } else if (inv.ok && inv.invoiceUrl) {
        sendPacket(ws, 'INVOICE_CREATED', { invoiceUrl: inv.invoiceUrl, stars: starsAmount });
      } else {
        sendPacket(ws, 'ERROR', { code: 'INVOICE_ERR', message: inv.error || 'Invoice error' });
      }
      return;
    }

    // 11. Convert Section (Stars <-> Coins & Earned Coins -> Stars / TON Payout)
    if (type === 'CONVERT_REQUEST') {
      await withUserLock(currentUserId, async () => {
        const direction = String(data.direction || 'earned_to_payout');

        // Direction A: Convert Telegram Stars -> Game Coins (1 ⭐ = 15 G)
        if (direction === 'stars_to_coins') {
          const starsAmt = Math.floor(Number(data.amount) || 0);
          if (starsAmt <= 0 || (user.starsBalance || 0) < starsAmt) {
            sendPacket(ws, 'ERROR', { code: 'INSUFFICIENT_STARS', message: 'Stars balansingiz yetarli emas!' });
            return;
          }
          const gainedCoins = starsAmt * 15;
          user.starsBalance -= starsAmt;
          user.earnedCoins = (user.earnedCoins || 0) + gainedCoins;
          saveDb();

          sendPacket(ws, 'CONVERT_SUCCESS', {
            direction,
            starsSpent: starsAmt,
            coinsGained: gainedCoins
          });
          sendFullSync(ws, currentUserId);
          return;
        }

        // Direction B: Convert Earned Coins -> Payout (Stars ⭐ or TON 💎)
        const coinsAmount = Math.floor(Number(data.amount) || 0);
        const targetType = data.targetType === 'ton' ? 'ton' : 'stars';
        const destination = String(data.destination || '').trim();

        const minConvertCoins = (db.settings && db.settings.minConvertCoins) || 1000;
        const maxDailyConvertCoins = (db.settings && db.settings.maxDailyConvertCoins) || 1000;
        const minWins = (db.settings && db.settings.minWinsForConvert) ?? 50;
        const minRefs = (db.settings && db.settings.minReferralsForConvert) ?? 5;
        const minElo = (db.settings && db.settings.minEloForConvert) ?? 1150;

        if ((user.wins || 0) < minWins) {
          sendPacket(ws, 'ERROR', {
            code: 'MIN_WINS_LOCK',
            message: `🔒 Convert uchun kamida ${minWins} ta g'alaba kerak! (Sizda: ${user.wins || 0}/${minWins})`
          });
          return;
        }

        if ((user.referralCount || 0) < minRefs) {
          sendPacket(ws, 'ERROR', {
            code: 'MIN_REFS_LOCK',
            message: `🔒 Convert uchun kamida ${minRefs} ta do'st taklif qilishingiz kerak! (Sizda: ${user.referralCount || 0}/${minRefs})`
          });
          return;
        }

        if ((user.elo || 1000) < minElo) {
          sendPacket(ws, 'ERROR', {
            code: 'MIN_ELO_LOCK',
            message: `🔒 Convert uchun ELO reytingingiz kamida ${minElo} bo'lishi kerak! (Sizda: ${user.elo || 1000})`
          });
          return;
        }

        if (coinsAmount < minConvertCoins) {
          sendPacket(ws, 'ERROR', {
            code: 'MIN_CONVERT_LIMIT',
            message: `Minimal konvertatsiya miqdori: ${minConvertCoins} G`
          });
          return;
        }

        if (coinsAmount > maxDailyConvertCoins) {
          sendPacket(ws, 'ERROR', {
            code: 'MAX_CONVERT_LIMIT',
            message: `Bir martalik va kunlik maksimal limit: ${maxDailyConvertCoins} G`
          });
          return;
        }

        // Check 24h daily limit
        const now = Date.now();
        const recent24hConvs = (db.conversions || []).filter(
          (c) =>
            String(c.userId) === String(user.id) &&
            c.status !== 'rejected' &&
            now - (c.createdAt || 0) < 24 * 3600 * 1000
        );
        const usedToday = recent24hConvs.reduce((s, c) => s + (c.coinsAmount || 0), 0);
        if (recent24hConvs.length >= 1 || usedToday + coinsAmount > maxDailyConvertCoins) {
          sendPacket(ws, 'ERROR', {
            code: 'DAILY_CONVERT_LIMIT',
            message: `⏳ Kunlik limit: 24 soatda faqat 1 marta (maks. ${maxDailyConvertCoins} G) convert qilish mumkin!`
          });
          return;
        }

        if ((user.earnedCoins || 0) < coinsAmount) {
          sendPacket(ws, 'ERROR', {
            code: 'INSUFFICIENT_EARNED',
            message: 'Faqat haqiqiy o\'yinda yutib olingan (Earned) tangalarni konvertatsiya qilish mumkin!'
          });
          return;
        }

        if ((user.trustScore ?? 100) < 80) {
          sendPacket(ws, 'ERROR', {
            code: 'ANTI_CHEAT_HOLD',
            message: 'Anti-Cheat tizimi shubhali harakat aniqladi (Trust < 80%). Hisobingiz tekshiruvda.'
          });
          return;
        }

        if (!destination || destination.length < 3) {
          sendPacket(ws, 'ERROR', {
            code: 'INVALID_DEST',
            message: targetType === 'stars' ? 'Telegram @username kiriting!' : 'TON hamyon manzilini (UQ.../EQ...) kiriting!'
          });
          return;
        }

        user.earnedCoins -= coinsAmount;

        // Sustainable conversion rate: 100 G = 1 ⭐ Star (1000 G = 10 ⭐), 20000 G = 1 TON (1000 G = 0.050 TON)
        let payoutValue = '';
        const starsOut = Math.floor(coinsAmount / 100);
        if (targetType === 'stars') {
          payoutValue = `${starsOut} ⭐ Stars`;
        } else {
          const tonOut = (coinsAmount / 20000).toFixed(3);
          payoutValue = `${tonOut} TON`;
        }

        const record = {
          id: 'CONV-' + Date.now().toString(36).toUpperCase(),
          userId: user.id,
          coinsAmount,
          targetType,
          starsAmount: starsOut,
          payoutValue,
          destination,
          trustScore: user.trustScore ?? 100,
          status: 'pending_review',
          createdAt: Date.now()
        };

        db.conversions.push(record);
        saveDb();

        await botService.notifyAdminConversion(record, user);

        sendPacket(ws, 'CONVERT_SUCCESS', { record });
        sendFullSync(ws, currentUserId);
      });
      return;
    }

    // 12. ADMIN PANEL COMMANDS
    if (type.startsWith('ADMIN_')) {
      if (!isUserAdmin(currentUserId)) {
        sendPacket(ws, 'ERROR', { code: 'FORBIDDEN', message: 'Admin huquqi yo\'q!' });
        return;
      }

      if (type === 'ADMIN_GET_STATE') {
        sendFullSync(ws, currentUserId);
        return;
      }

      // Approve or Reject Conversion Request
      if (type === 'ADMIN_CONV_DECISION') {
        const convId = String(data.convId || '');
        const decision = data.decision === 'approve' ? 'completed' : 'rejected';
        const conv = (db.conversions || []).find((c) => c.id === convId);
        if (conv && conv.status === 'pending_review') {
          conv.status = decision;
          const u = db.users[String(conv.userId)];
          if (decision === 'completed' && conv.targetType === 'stars' && u) {
            u.starsBalance = (u.starsBalance || 0) + (conv.starsAmount || Math.floor(conv.coinsAmount / 100));
          } else if (decision === 'rejected' && u) {
            u.earnedCoins = (u.earnedCoins || 0) + conv.coinsAmount;
          }
          saveDb();
          const targetWs = clientsByUserId.get(String(conv.userId));
          if (targetWs) sendFullSync(targetWs, conv.userId);
        }
        sendFullSync(ws, currentUserId);
        return;
      }

      // Update User (Balance, ELO, TrustScore, Ban/Unban)
      if (type === 'ADMIN_USER_UPDATE') {
        const targetId = String(data.userId || '');
        const targetUser = db.users[targetId];
        if (targetUser) {
          if (data.addBonus !== undefined) {
            targetUser.bonusCoins = Math.max(0, (targetUser.bonusCoins || 0) + Number(data.addBonus));
          }
          if (data.addEarned !== undefined) {
            targetUser.earnedCoins = Math.max(0, (targetUser.earnedCoins || 0) + Number(data.addEarned));
          }
          if (data.addStars !== undefined) {
            targetUser.starsBalance = Math.max(0, (targetUser.starsBalance || 0) + Number(data.addStars));
          }
          if (data.setTrust !== undefined) {
            targetUser.trustScore = Math.max(0, Math.min(100, Number(data.setTrust)));
          }
          if (data.toggleBan) {
            targetUser.banned = !targetUser.banned;
          }
          saveDb();
          const targetWs = clientsByUserId.get(targetId);
          if (targetWs) sendFullSync(targetWs, targetId);
        }
        sendFullSync(ws, currentUserId);
        return;
      }

      // Add New Task / Sponsor Channel
      if (type === 'ADMIN_TASK_ADD') {
        const channelUsername = String(data.channelUsername || '').trim();
        const titleText = String(data.title || channelUsername || 'Homiy kanal').trim();
        const rewardCoins = Math.max(1, Math.floor(Number(data.rewardCoins) || 20));
        if (channelUsername) {
          db.tasks.push({
            id: 'task_' + Date.now().toString(36),
            type: 'channel',
            channelUsername: channelUsername.startsWith('@') ? channelUsername : '@' + channelUsername,
            rewardCoins,
            title: { uz: titleText, ru: titleText, en: titleText }
          });
          saveDb();
        }
        sendFullSync(ws, currentUserId);
        return;
      }

      // Delete Task
      if (type === 'ADMIN_TASK_DELETE') {
        const taskId = String(data.taskId || '');
        db.tasks = (db.tasks || []).filter((t) => t.id !== taskId);
        saveDb();
        sendFullSync(ws, currentUserId);
        return;
      }

      // Create New Tournament
      if (type === 'ADMIN_TOUR_ADD') {
        const titleText = String(data.title || '🏆 Kechki Arena (20:00)').trim();
        const game = data.game === 'chess' ? 'chess' : 'checkers';
        const entryType = data.entryType === 'stars' ? 'stars' : 'coins';
        const entryFee = Math.max(0, Math.floor(Number(data.entryFee ?? 0)));
        const minReferrals = Math.max(0, Math.floor(Number(data.minReferrals ?? 2)));
        const requireSub = data.requireSub !== false;
        const prizePool = Math.max(10, Math.floor(Number(data.prizePool) || 200));
        const minPlayers = Math.max(2, Math.floor(Number(data.minPlayers) || 4));
        const maxPlayers = Math.max(minPlayers, Math.floor(Number(data.maxPlayers) || 64));
        const scheduledHour = Math.max(0, Math.min(23, Math.floor(Number(data.scheduledHour ?? 20))));
        const scheduledMinute = Math.max(0, Math.min(59, Math.floor(Number(data.scheduledMinute ?? 0))));
        const durationMinutes = Math.max(10, Math.floor(Number(data.durationMinutes) || 45));
        const startsAt = getNextTashkentTimeMs(scheduledHour, scheduledMinute);
        db.tournaments.push({
          id: 'tour_' + Date.now().toString(36),
          game,
          title: { uz: titleText, ru: titleText, en: titleText },
          entryType,
          entryFee,
          minReferrals,
          requireSub,
          prizePool,
          minPlayers,
          maxPlayers,
          scheduledHour,
          scheduledMinute,
          durationMinutes,
          participants: [],
          scores: {},
          gamesPlayed: {},
          winStreaks: {},
          status: 'open',
          startsAt,
          endsAt: startsAt + durationMinutes * 60000
        });
        saveDb();
        for (const [uid, cWs] of clientsByUserId.entries()) {
          sendFullSync(cWs, uid);
        }
        return;
      }

      // Delete Tournament
      if (type === 'ADMIN_TOUR_DELETE') {
        const tourId = String(data.tourId || '');
        db.tournaments = (db.tournaments || []).filter((t) => t.id !== tourId);
        saveDb();
        sendFullSync(ws, currentUserId);
        return;
      }

      // Update Platform Settings
      if (type === 'ADMIN_SETTINGS_UPDATE') {
        db.settings = db.settings || {};
        if (data.rakePercent !== undefined) {
          db.settings.rakePercent = Math.max(0, Math.min(35, Number(data.rakePercent)));
        }
        if (data.moveTimeLimitSec !== undefined) {
          db.settings.moveTimeLimitSec = Math.max(10, Math.min(90, Number(data.moveTimeLimitSec)));
        }
        if (data.adsgramBlockId !== undefined) {
          db.settings.adsgramBlockId = String(data.adsgramBlockId).trim();
        }
        if (data.adsgramInterstitialBlockId !== undefined) {
          db.settings.adsgramInterstitialBlockId = String(data.adsgramInterstitialBlockId).trim();
        }
        if (data.adsgramTaskBlockId !== undefined) {
          db.settings.adsgramTaskBlockId = String(data.adsgramTaskBlockId).trim();
        }
        if (data.minConvertCoins !== undefined) {
          db.settings.minConvertCoins = Math.max(100, Number(data.minConvertCoins));
        }
        if (data.maxDailyConvertCoins !== undefined) {
          db.settings.maxDailyConvertCoins = Math.max(100, Number(data.maxDailyConvertCoins));
        }
        if (data.minWinsForConvert !== undefined) {
          db.settings.minWinsForConvert = Math.max(0, Number(data.minWinsForConvert));
        }
        if (data.minReferralsForConvert !== undefined) {
          db.settings.minReferralsForConvert = Math.max(0, Number(data.minReferralsForConvert));
        }
        if (data.minEloForConvert !== undefined) {
          db.settings.minEloForConvert = Math.max(800, Number(data.minEloForConvert));
        }
        saveDb();
        sendPacket(ws, 'ADMIN_TOAST', { message: '⚙️ Sozlamalar va Limitlar saqlandi!' });
        sendFullSync(ws, currentUserId);
        return;
      }

      // Add / Remove Group or Channel for Broadcasts
      if (type === 'ADMIN_CHAT_ADD') {
        const rawTarget = String(data.target || '').trim();
        const chatType = data.chatType === 'channel' ? 'channel' : 'supergroup';
        const title = String(data.title || rawTarget).trim();
        if (rawTarget) {
          const key = rawTarget.startsWith('-') || rawTarget.startsWith('@') ? rawTarget : '@' + rawTarget;
          db.botChats = db.botChats || {};
          db.botChats[key] = {
            id: key,
            chatId: key,
            title: title || key,
            username: key.startsWith('@') ? key : null,
            type: chatType,
            active: true,
            updatedAt: Date.now()
          };
          saveDb();
          sendPacket(ws, 'ADMIN_TOAST', { message: `✅ ${key} ro'yxatga qo'shildi!` });
          sendFullSync(ws, currentUserId);
        }
        return;
      }

      if (type === 'ADMIN_CHAT_DELETE') {
        const key = String(data.id || '').trim();
        if (db.botChats && db.botChats[key]) {
          delete db.botChats[key];
          saveDb();
          sendFullSync(ws, currentUserId);
        }
        return;
      }

      // Send Broadcast Message to Users, Groups, and Channels
      if (type === 'ADMIN_BROADCAST') {
        const text = String(data.text || '').trim();
        if (text) {
          const res = await botService.broadcastToAllUsers(text, {
            toUsers: data.toUsers !== false,
            toGroups: data.toGroups !== false,
            toChannels: data.toChannels !== false,
            withButton: data.withButton !== false,
            buttonText: data.buttonText || '🎮 Arenaga Kirish'
          });
          sendPacket(ws, 'ADMIN_TOAST', { message: res.summaryText || `📨 Xabar ${res.sent} ta manzilga yuborildi!` });
        }
        return;
      }
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      removeFromQueue(currentUserId);
      // Remove from any waiting lobbies
      for (const [rid, r] of activeZakovatRooms.entries()) {
        if (r.phase === 'lobby') {
          r.players = r.players.filter((p) => String(p.id) !== currentUserId);
          if (r.players.length === 0) {
            activeZakovatRooms.delete(rid);
          } else {
            if (String(r.hostId) === currentUserId) r.hostId = r.players[0].id;
            broadcastZakovatLobby(r);
          }
        }
      }
      for (const [rid, r] of activeLudoRooms.entries()) {
        if (r.phase === 'lobby') {
          r.players = r.players.filter((p) => String(p.id) !== currentUserId);
          if (r.players.length === 0) {
            activeLudoRooms.delete(rid);
          } else {
            if (String(r.hostId) === currentUserId) r.hostId = r.players[0].id;
            r.players.forEach((p, idx) => { p.color = LUDO_COLORS[idx]; });
            broadcastLudoLobby(r);
          }
        }
      }
      if (clientsByUserId.get(currentUserId) === ws) {
        clientsByUserId.delete(currentUserId);
      }
      broadcastOnlineStats();
    }
  });
});

function verifyAdminHttpAuth(req) {
  const key = String(req.headers['x-admin-key'] || req.query.key || (req.body && req.body.key) || '').trim();
  const expectedKey = getExpectedAdminWebKey();
  if (key && (key === expectedKey || (ADMIN_TELEGRAM_ID && key === String(ADMIN_TELEGRAM_ID)))) {
    return true;
  }
  const initData = String(req.headers['x-init-data'] || (req.body && req.body.initData) || '').trim();
  if (initData) {
    const auth = verifyTelegramInitData(initData, BOT_TOKEN, ALLOW_DEV_MODE);
    if (auth.ok && auth.user && isUserAdmin(auth.user.id)) {
      return true;
    }
  }
  return false;
}

// AdsGram Task completion webhook / callback
app.all('/api/adsgram/reward', (req, res) => {
  const userId = req.query.userId || req.body?.userId || req.query.userid || req.body?.userid;
  if (!userId) return res.status(400).json({ ok: false, error: 'NO_USER_ID' });
  const db = loadDb();
  const user = db.users[String(userId)];
  if (user) {
    user.earnedCoins = (user.earnedCoins || 0) + 20;
    saveDb();
    console.log(`[Adsgram Task] Reward given to user ${userId}`);
    if (botService) {
      botService.onBalanceUpdated(user.id);
    }
  }
  return res.json({ ok: true, reward: 20 });
});

app.get('/admin', (req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/admin.html${qs}`);
});

app.get('/api/admin/dashboard', (req, res) => {
  if (!verifyAdminHttpAuth(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
  return res.json({ ok: true, data: buildAdminDashboardPayload() });
});

app.post('/api/admin/action', async (req, res) => {
  if (!verifyAdminHttpAuth(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }
  const { action, payload = {} } = req.body || {};
  const db = loadDb();

  if (action === 'send_daily_broadcast') {
    const postRes = await botService.sendDailyChannelAndGroupPost();
    return res.json({
      ok: true,
      message: postRes.ok ? "📢 Kunlik xabar kanal (@ChessTonArena) va guruhga (@ChessTonArenaChat) yuborildi!" : "Xatolik yuz berdi",
      data: buildAdminDashboardPayload()
    });
  }

  if (action === 'conv_decision') {
    const convId = String(payload.convId || '');
    const decision = payload.decision === 'approve' ? 'completed' : 'rejected';
    const conv = (db.conversions || []).find((c) => c.id === convId);
    if (conv && conv.status === 'pending_review') {
      conv.status = decision;
      const u = db.users[String(conv.userId)];
      if (decision === 'completed' && conv.targetType === 'stars' && u) {
        u.starsBalance = (u.starsBalance || 0) + (conv.starsAmount || Math.floor(conv.coinsAmount / 100));
      } else if (decision === 'rejected' && u) {
        u.earnedCoins = (u.earnedCoins || 0) + conv.coinsAmount;
      }
      saveDb();
      const targetWs = clientsByUserId.get(String(conv.userId));
      if (targetWs) sendFullSync(targetWs, conv.userId);
    }
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'user_update') {
    const targetId = String(payload.userId || '');
    const targetUser = db.users[targetId];
    if (targetUser) {
      if (payload.addBonus !== undefined) {
        targetUser.bonusCoins = Math.max(0, (targetUser.bonusCoins || 0) + Number(payload.addBonus));
      }
      if (payload.addEarned !== undefined) {
        targetUser.earnedCoins = Math.max(0, (targetUser.earnedCoins || 0) + Number(payload.addEarned));
      }
      if (payload.addStars !== undefined) {
        targetUser.starsBalance = Math.max(0, (targetUser.starsBalance || 0) + Number(payload.addStars));
      }
      if (payload.setTrust !== undefined) {
        targetUser.trustScore = Math.max(0, Math.min(100, Number(payload.setTrust)));
      }
      if (payload.toggleBan) {
        targetUser.banned = !targetUser.banned;
      }
      saveDb();
      const targetWs = clientsByUserId.get(targetId);
      if (targetWs) sendFullSync(targetWs, targetId);
    }
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'task_add') {
    const channelUsername = String(payload.channelUsername || '').trim();
    const titleText = String(payload.title || channelUsername || 'Homiy kanal').trim();
    const rewardCoins = Math.max(1, Math.floor(Number(payload.rewardCoins) || 5));
    if (channelUsername) {
      db.tasks.push({
        id: 'task_' + Date.now().toString(36),
        type: 'channel',
        channelUsername: channelUsername.startsWith('@') ? channelUsername : '@' + channelUsername,
        rewardCoins,
        title: { uz: titleText, ru: titleText, en: titleText }
      });
      saveDb();
    }
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'task_delete') {
    const taskId = String(payload.taskId || '');
    db.tasks = (db.tasks || []).filter((t) => t.id !== taskId);
    saveDb();
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'tour_add') {
    const titleText = String(payload.title || '🏆 Maxsus Turnir').trim();
    const game = payload.game === 'chess' ? 'chess' : 'checkers';
    const entryType = payload.entryType === 'stars' ? 'stars' : 'coins';
    const entryFee = Math.max(1, Math.floor(Number(payload.entryFee) || 25));
    const prizePool = Math.max(10, Math.floor(Number(payload.prizePool) || 500));
    const minPlayers = Math.max(2, Math.floor(Number(payload.minPlayers) || 8));
    const maxPlayers = Math.max(minPlayers, Math.floor(Number(payload.maxPlayers) || 32));
    const durationHours = Math.max(1, Math.floor(Number(payload.durationHours) || 24));
    db.tournaments.push({
      id: 'tour_' + Date.now().toString(36),
      game,
      title: { uz: titleText, ru: titleText, en: titleText },
      entryType,
      entryFee,
      prizePool,
      minPlayers,
      maxPlayers,
      participants: [],
      status: 'open',
      endsAt: Date.now() + 3600000 * durationHours
    });
    saveDb();
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'tour_delete') {
    const tourId = String(payload.tourId || '');
    db.tournaments = (db.tournaments || []).filter((t) => t.id !== tourId);
    saveDb();
    return res.json({ ok: true, data: buildAdminDashboardPayload() });
  }

  if (action === 'tour_finish') {
    const tourId = String(payload.tourId || '');
    await finishTournamentAndPayout(tourId);
    return res.json({ ok: true, message: '🏆 Turnir yakunlandi va sovrinlar (1, 2, 3-o\'rin) tarqatildi!', data: buildAdminDashboardPayload() });
  }

  if (action === 'settings_update') {
    db.settings = db.settings || {};
    if (payload.rakePercent !== undefined) {
      db.settings.rakePercent = Math.max(0, Math.min(35, Number(payload.rakePercent)));
    }
    if (payload.moveTimeLimitSec !== undefined) {
      db.settings.moveTimeLimitSec = Math.max(10, Math.min(90, Number(payload.moveTimeLimitSec)));
    }
    if (payload.adsgramBlockId !== undefined) {
      db.settings.adsgramBlockId = String(payload.adsgramBlockId).trim();
    }
    if (payload.adsgramInterstitialBlockId !== undefined) {
      db.settings.adsgramInterstitialBlockId = String(payload.adsgramInterstitialBlockId).trim();
    }
    if (payload.adsCpmUsd !== undefined) {
      db.settings.adsCpmUsd = Math.max(0.1, Math.min(25, Number(payload.adsCpmUsd) || 1.5));
    }
    if (payload.minConvertCoins !== undefined) {
      db.settings.minConvertCoins = Math.max(100, Number(payload.minConvertCoins));
    }
    if (payload.maxDailyConvertCoins !== undefined) {
      db.settings.maxDailyConvertCoins = Math.max(100, Number(payload.maxDailyConvertCoins));
    }
    if (payload.minWinsForConvert !== undefined) {
      db.settings.minWinsForConvert = Math.max(0, Number(payload.minWinsForConvert));
    }
    if (payload.minReferralsForConvert !== undefined) {
      db.settings.minReferralsForConvert = Math.max(0, Number(payload.minReferralsForConvert));
    }
    if (payload.minEloForConvert !== undefined) {
      db.settings.minEloForConvert = Math.max(800, Number(payload.minEloForConvert));
    }
    saveDb();
    return res.json({ ok: true, message: '⚙️ Sozlamalar saqlandi!', data: buildAdminDashboardPayload() });
  }

  if (action === 'chat_add') {
    const rawTarget = String(payload.target || '').trim();
    const chatType = payload.chatType === 'channel' ? 'channel' : 'supergroup';
    const title = String(payload.title || rawTarget).trim();
    if (rawTarget) {
      const key = rawTarget.startsWith('-') || rawTarget.startsWith('@') ? rawTarget : '@' + rawTarget;
      db.botChats = db.botChats || {};
      db.botChats[key] = {
        id: key,
        chatId: key,
        title: title || key,
        username: key.startsWith('@') ? key : null,
        type: chatType,
        active: true,
        updatedAt: Date.now()
      };
      saveDb();
    }
    return res.json({ ok: true, message: '✅ Guruh/Kanal ro\'yxatga qo\'shildi!', data: buildAdminDashboardPayload() });
  }

  if (action === 'chat_delete') {
    const key = String(payload.id || '').trim();
    if (db.botChats && db.botChats[key]) {
      delete db.botChats[key];
      saveDb();
    }
    return res.json({ ok: true, message: '🗑 O\'chirildi!', data: buildAdminDashboardPayload() });
  }

  if (action === 'broadcast') {
    const text = String(payload.text || '').trim();
    if (text) {
      const bRes = await botService.broadcastToAllUsers(text, {
        toUsers: payload.toUsers !== false,
        toGroups: payload.toGroups !== false,
        toChannels: payload.toChannels !== false,
        withButton: payload.withButton !== false,
        buttonText: payload.buttonText || '🎮 Arenaga Kirish'
      });
      return res.json({ ok: true, message: bRes.summaryText || `📨 Xabar ${bRes.sent} ta manzilga yuborildi!`, data: buildAdminDashboardPayload() });
    }
  }

  return res.json({ ok: true, data: buildAdminDashboardPayload() });
});

server.listen(PORT, () => {
  console.log(`🚀 [Grand Arena Server] Ishga tushdi: http://localhost:${PORT}`);
  botService.startPolling();
});
