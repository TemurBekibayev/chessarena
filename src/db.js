const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Compute next occurrence of HH:MM in Tashkent time (UTC+5)
function getNextTashkentTimeMs(hour = 20, minute = 0) {
  const now = Date.now();
  const tashkentOffsetMs = 5 * 3600 * 1000;
  const tashkentNow = new Date(now + tashkentOffsetMs);
  const targetTashkent = new Date(tashkentNow);
  targetTashkent.setUTCHours(hour, minute, 0, 0);
  let targetUtcMs = targetTashkent.getTime() - tashkentOffsetMs;
  if (targetUtcMs <= now + 5 * 60 * 1000) {
    targetUtcMs += 24 * 3600 * 1000;
  }
  return targetUtcMs;
}

// Default database state with seeded leaderboard and tournaments
const DEFAULT_DB = {
  users: {
    "900001": {
      id: "900001",
      name: "Sardor GM",
      username: "sardor_chess",
      lang: "uz",
      bonusCoins: 20,
      earnedCoins: 840,
      starsBalance: 45,
      elo: 1480,
      wins: 42,
      losses: 8,
      draws: 3,
      trustScore: 99,
      streak: 5,
      lastDailyAt: 0,
      referredBy: null,
      referralCount: 14,
      referralEarnings: 280,
      completedTasks: ["sub_main_channel"],
      createdAt: Date.now() - 86400000 * 10
    },
    "900002": {
      id: "900002",
      name: "Alexey K.",
      username: "alex_master",
      lang: "ru",
      bonusCoins: 15,
      earnedCoins: 620,
      starsBalance: 30,
      elo: 1395,
      wins: 31,
      losses: 11,
      draws: 2,
      trustScore: 98,
      streak: 3,
      lastDailyAt: 0,
      referredBy: null,
      referralCount: 9,
      referralEarnings: 180,
      completedTasks: [],
      createdAt: Date.now() - 86400000 * 8
    },
    "900003": {
      id: "900003",
      name: "Jasur Shashka",
      username: "jasur_draughts",
      lang: "uz",
      bonusCoins: 30,
      earnedCoins: 510,
      starsBalance: 20,
      elo: 1340,
      wins: 27,
      losses: 9,
      draws: 1,
      trustScore: 97,
      streak: 4,
      lastDailyAt: 0,
      referredBy: null,
      referralCount: 6,
      referralEarnings: 120,
      completedTasks: [],
      createdAt: Date.now() - 86400000 * 6
    },
    "900004": {
      id: "900004",
      name: "Liam Carter",
      username: "liam_c",
      lang: "en",
      bonusCoins: 10,
      earnedCoins: 390,
      starsBalance: 15,
      elo: 1265,
      wins: 19,
      losses: 10,
      draws: 2,
      trustScore: 100,
      streak: 2,
      lastDailyAt: 0,
      referredBy: null,
      referralCount: 4,
      referralEarnings: 80,
      completedTasks: [],
      createdAt: Date.now() - 86400000 * 4
    }
  },
  tournaments: [
    {
      id: "tour_checkers_2000",
      game: "checkers",
      title: {
        uz: "🏆 Kechki Shashka Arena (20:00)",
        ru: "🏆 Вечерняя Арена Шашек (20:00)",
        en: "🏆 Evening Checkers Arena (20:00)"
      },
      entryType: "coins",
      entryFee: 0,
      minReferrals: 2,
      requireSub: true,
      prizePool: 200,
      minPlayers: 4,
      maxPlayers: 64,
      scheduledHour: 20,
      scheduledMinute: 0,
      durationMinutes: 45,
      participants: [],
      scores: {},
      gamesPlayed: {},
      winStreaks: {},
      status: "open",
      startsAt: getNextTashkentTimeMs(20, 0),
      endsAt: getNextTashkentTimeMs(20, 0) + 45 * 60000
    },
    {
      id: "tour_chess_2000",
      game: "chess",
      title: {
        uz: "♔ Kechki Shaxmat Arena (20:00)",
        ru: "♔ Вечерняя Арена Шахмат (20:00)",
        en: "♔ Evening Chess Arena (20:00)"
      },
      entryType: "coins",
      entryFee: 0,
      minReferrals: 2,
      requireSub: true,
      prizePool: 200,
      minPlayers: 4,
      maxPlayers: 64,
      scheduledHour: 20,
      scheduledMinute: 0,
      durationMinutes: 45,
      participants: [],
      scores: {},
      gamesPlayed: {},
      winStreaks: {},
      status: "open",
      startsAt: getNextTashkentTimeMs(20, 0),
      endsAt: getNextTashkentTimeMs(20, 0) + 45 * 60000
    }
  ],
  tasks: [
    {
      id: "sub_main_channel",
      type: "channel",
      channelUsername: "@ChessTonArena",
      rewardCoins: 5,
      title: {
        uz: "Rasmiy kanalga obuna bo'ling (@ChessTonArena)",
        ru: "Подпишитесь на официальный канал (@ChessTonArena)",
        en: "Subscribe to Official Channel (@ChessTonArena)"
      }
    },
    {
      id: "sub_community_group",
      type: "channel",
      channelUsername: "@ChessTonArenaChat",
      rewardCoins: 5,
      title: {
        uz: "Turnir va Duel guruhiga qo'shiling (@ChessTonArenaChat)",
        ru: "Вступите в чат и группу дуэлей (@ChessTonArenaChat)",
        en: "Join Duel & Community Chat (@ChessTonArenaChat)"
      }
    },
    {
      id: "watch_adsgram_video",
      type: "ad",
      rewardCoins: 2,
      repeatableCooldownMs: 180000, // every 3 minutes
      title: {
        uz: "15 soniya video ko'ring (AdsGram)",
        ru: "Посмотрите 15 сек видео (AdsGram)",
        en: "Watch 15s Video Ad (AdsGram)"
      }
    }
  ],
  conversions: [],
  matchesHistory: [],
  usedQueryIds: {},
  botChats: {
    "@ChessTonArena": {
      id: "@ChessTonArena",
      title: "Chess & Checkers Rasmiy Kanali",
      username: "@ChessTonArena",
      type: "channel",
      active: true,
      updatedAt: Date.now()
    },
    "@ChessTonArenaChat": {
      id: "@ChessTonArenaChat",
      title: "Turnir va Duel Guruhi",
      username: "@ChessTonArenaChat",
      type: "supergroup",
      active: true,
      updatedAt: Date.now()
    }
  },
  settings: {
    rakePercent: 15,
    moveTimeLimitSec: 60,
    adsgramBlockId: "58136",
    welcomeBonus: 15,
    refBonus: 5,
    minConvertCoins: 1000,
    maxDailyConvertCoins: 1000,
    minWinsForConvert: 50,
    minReferralsForConvert: 5,
    minEloForConvert: 1150
  }
};

let state = null;
const userLocks = new Map();

function loadDb() {
  if (state) return state;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      state = JSON.parse(raw);
      // Ensure all default collections exist
      state.users = state.users || DEFAULT_DB.users;
      state.tournaments = state.tournaments || DEFAULT_DB.tournaments;
      state.tasks = state.tasks || DEFAULT_DB.tasks;
      state.conversions = state.conversions || [];
      state.matchesHistory = state.matchesHistory || [];
      state.usedQueryIds = state.usedQueryIds || {};
      state.botChats = { ...DEFAULT_DB.botChats, ...(state.botChats || {}) };
      state.settings = { ...DEFAULT_DB.settings, ...(state.settings || {}) };
      if (!state.settings.economyV2Migrated) {
        state.settings.minConvertCoins = 1000;
        state.settings.maxDailyConvertCoins = 1000;
        state.settings.minWinsForConvert = 50;
        state.settings.minReferralsForConvert = 5;
        state.settings.minEloForConvert = 1150;
        state.settings.welcomeBonus = 15;
        state.settings.refBonus = 5;
        state.settings.economyV2Migrated = true;
        // Migrate default task rewards
        for (const tk of state.tasks || []) {
          if (tk.id === 'sub_main_channel') tk.rewardCoins = 5;
          if (tk.id === 'sub_community_group') tk.rewardCoins = 5;
          if (tk.id === 'watch_adsgram_video') tk.rewardCoins = 2;
        }
        saveDb();
      }
      if (state.settings.adsgramBlockId === '48571' || !state.settings.adsgramBlockId) {
        state.settings.adsgramBlockId = '58136';
        saveDb();
      }
      if (!state.settings.moveTimeLimitSec || state.settings.moveTimeLimitSec <= 25) {
        state.settings.moveTimeLimitSec = 60;
        saveDb();
      }
      if (!state.settings.channelsV2Migrated) {
        for (const tk of state.tasks || []) {
          if (tk.id === 'sub_main_channel' || tk.channelUsername === '@GrandArenaNews') {
            tk.channelUsername = '@ChessTonArena';
            tk.rewardCoins = 5;
            tk.title = {
              uz: "Rasmiy kanalga obuna bo'ling (@ChessTonArena)",
              ru: "Подпишитесь на официальный канал (@ChessTonArena)",
              en: "Subscribe to Official Channel (@ChessTonArena)"
            };
          }
          if (tk.id === 'sub_community_group' || tk.channelUsername === '@GrandArenaChat') {
            tk.channelUsername = '@ChessTonArenaChat';
            tk.rewardCoins = 5;
            tk.title = {
              uz: "Turnir va Duel guruhiga qo'shiling (@ChessTonArenaChat)",
              ru: "Вступите в чат и группу дуэлей (@ChessTonArenaChat)",
              en: "Join Duel & Community Chat (@ChessTonArenaChat)"
            };
          }
        }
        // Reset old sample task completions so users can test @ChessTonArena and @ChessTonArenaChat
        for (const u of Object.values(state.users || {})) {
          if (Array.isArray(u.completedTasks)) {
            u.completedTasks = u.completedTasks.filter(
              (id) => id !== 'sub_main_channel' && id !== 'sub_community_group'
            );
          }
        }
        state.settings.channelsV2Migrated = true;
        saveDb();
      }
      if (!state.settings.tournamentsV5Migrated) {
        state.tournaments = JSON.parse(JSON.stringify(DEFAULT_DB.tournaments));
        state.settings.tournamentsV5Migrated = true;
        saveDb();
      }
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_DB));
      saveDb();
    }
  } catch (err) {
    console.error('[DB] Load error, initializing default DB:', err.message);
    state = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  return state;
}

let saveTimer = null;
function saveDb() {
  if (!state) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmpFile = DB_FILE + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Save error:', err.message);
    }
  }, 150);
}

/**
 * Prevents Race Condition attacks by serializing all balance/task operations per userId.
 */
async function withUserLock(userId, fn) {
  const key = String(userId);
  while (userLocks.get(key)) {
    await userLocks.get(key);
  }
  let resolveLock;
  const promise = new Promise((res) => {
    resolveLock = res;
  });
  userLocks.set(key, promise);
  try {
    const result = await fn();
    saveDb();
    return result;
  } finally {
    userLocks.delete(key);
    resolveLock();
  }
}

function getOrCreateUser({ id, name, username, lang = 'uz', referredBy = null, clientIp = null }) {
  const db = loadDb();
  const uid = String(id);
  const todayStr = new Date().toISOString().slice(0, 10);
  db.dailyMetrics = db.dailyMetrics || {};
  db.dailyMetrics[todayStr] = db.dailyMetrics[todayStr] || {
    date: todayStr,
    newUsers: 0,
    blockedUsers: 0,
    activeUsers: 0,
    chessPlayed: 0,
    checkersPlayed: 0,
    adsWatched: 0
  };

  if (!db.users[uid]) {
    db.dailyMetrics[todayStr].newUsers = (db.dailyMetrics[todayStr].newUsers || 0) + 1;

    db.users[uid] = {
      id: uid,
      name: name || `Player ${uid.slice(-4)}`,
      username: username || '',
      lang: ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz',
      bonusCoins: 15, // Initial welcome bonus (cannot be withdrawn directly without winning!)
      earnedCoins: 0, // Won in human PvP matches (eligible for Convert)
      starsBalance: 0, // Telegram Stars balance
      elo: 1000,
      eloCheckers: 1000,
      eloChess: 1000,
      eloZakovat: 1000,
      eloLudo: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      checkersPlayed: 0,
      chessPlayed: 0,
      totalAdsWatched: 0,
      trustScore: 100, // Anti-cheat score (0..100)
      suspicionFlags: 0,
      streak: 0,
      lastDailyAt: 0,
      lastAdAt: 0,
      botBlocked: false,
      blockedAt: null,
      unblockedAt: null,
      referredBy: null,
      referralCount: 0,
      referralEarnings: 0,
      completedTasks: [],
      ownedSkins: ['board_classic', 'piece_classic'],
      equippedBoardSkin: 'classic',
      equippedPieceSkin: 'classic',
      claimedRefMilestones: [],
      vipUntil: 0,
      lastStoryShareAt: 0,
      lastIp: clientIp || null,
      lastActiveAt: Date.now(),
      createdAt: Date.now()
    };

    // Process referral reward if valid, not self-referral, and not from the exact same IP address
    if (referredBy && String(referredBy) !== uid && db.users[String(referredBy)]) {
      const refUser = db.users[String(referredBy)];
      const isSameIp =
        clientIp &&
        refUser.lastIp &&
        clientIp !== '127.0.0.1' &&
        clientIp === refUser.lastIp;

      if (!isSameIp) {
        db.users[uid].referredBy = String(referredBy);
        db.users[uid].bonusCoins += 5; // Extra +5G for joining via referral link
        refUser.bonusCoins += 5; // +5G to inviter
        refUser.referralCount = (refUser.referralCount || 0) + 1;
        refUser.referralEarnings = (refUser.referralEarnings || 0) + 5;
      }
    }
    saveDb();
  } else {
    if (name) db.users[uid].name = name;
    if (username) db.users[uid].username = username;
    if (clientIp) db.users[uid].lastIp = clientIp;
    if (db.users[uid].botBlocked) {
      db.users[uid].botBlocked = false;
      db.users[uid].unblockedAt = Date.now();
    }
    db.users[uid].lastActiveAt = Date.now();
  }
  return db.users[uid];
}

function getTotalCoins(user) {
  return (user.bonusCoins || 0) + (user.earnedCoins || 0);
}

/**
 * Deducts stake from bonusCoins first, then earnedCoins.
 * Ensures positive integer amounts to prevent negative number exploits.
 */
function deductCoins(user, amount) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (getTotalCoins(user) < amt) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  const fromBonus = Math.min(user.bonusCoins, amt);
  user.bonusCoins -= fromBonus;
  const remaining = amt - fromBonus;
  if (remaining > 0) {
    user.earnedCoins -= remaining;
  }
  saveDb();
}

/**
 * Calculates ELO change using standard FIDE/Lichess formula (K = 32)
 */
function calculateEloChange(ratingA, ratingB, scoreA) {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(K * (scoreA - expectedA));
}

function getRankTitle(elo, lang = 'uz') {
  const titles = {
    uz: [
      { min: 1600, name: "👑 Grossmeyster" },
      { min: 1350, name: "💎 Xalqaro Usta" },
      { min: 1150, name: "⚔️ Tajribali" },
      { min: 0, name: "🛡️ Havaskor" }
    ],
    ru: [
      { min: 1600, name: "👑 Гроссмейстер" },
      { min: 1350, name: "💎 Мастер" },
      { min: 1150, name: "⚔️ Опытный" },
      { min: 0, name: "🛡️ Любитель" }
    ],
    en: [
      { min: 1600, name: "👑 Grandmaster" },
      { min: 1350, name: "💎 Master" },
      { min: 1150, name: "⚔️ Skilled" },
      { min: 0, name: "🛡️ Novice" }
    ]
  };
  const list = titles[lang] || titles.uz;
  return list.find((r) => elo >= r.min).name;
}

function formatUserClientState(user) {
  const isVip = Boolean(user.vipUntil && user.vipUntil > Date.now());
  const rank = getRankTitle(user.elo || 1000, user.lang || 'uz');
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    lang: user.lang || 'uz',
    coins: getTotalCoins(user),
    bonusCoins: user.bonusCoins || 0,
    earnedCoins: user.earnedCoins || 0,
    stars: user.starsBalance || 0,
    elo: user.elo || 1000,
    eloCheckers: user.eloCheckers || 1000,
    eloChess: user.eloChess || 1000,
    eloZakovat: user.eloZakovat || 1000,
    eloLudo: user.eloLudo || 1000,
    rankTitle: isVip ? `👑 VIP • ${rank}` : rank,
    rankTitleCheckers: getRankTitle(user.eloCheckers || 1000, user.lang || 'uz'),
    rankTitleChess: getRankTitle(user.eloChess || 1000, user.lang || 'uz'),
    wins: user.wins || 0,
    losses: user.losses || 0,
    draws: user.draws || 0,
    trustScore: user.trustScore ?? 100,
    streak: user.streak || 0,
    lastDailyAt: user.lastDailyAt || 0,
    referralCount: user.referralCount || 0,
    referralEarnings: user.referralEarnings || 0,
    completedTasks: user.completedTasks || [],
    ownedSkins: user.ownedSkins || ['board_classic', 'piece_classic'],
    equippedBoardSkin: user.equippedBoardSkin || 'classic',
    equippedPieceSkin: user.equippedPieceSkin || 'classic',
    isVip,
    vipUntil: user.vipUntil || 0,
    claimedRefMilestones: user.claimedRefMilestones || [],
    lastStoryShareAt: user.lastStoryShareAt || 0
  };
}

module.exports = {
  loadDb,
  saveDb,
  withUserLock,
  getOrCreateUser,
  getTotalCoins,
  deductCoins,
  calculateEloChange,
  getRankTitle,
  formatUserClientState,
  getNextTashkentTimeMs
};
