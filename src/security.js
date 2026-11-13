const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData cryptographic signature (HMAC-SHA256)
 * and prevents Replay Attacks using auth_date freshness check.
 */
function verifyTelegramInitData(initDataRaw, botToken, allowDevMode = true) {
  if (!initDataRaw || typeof initDataRaw !== 'string' || initDataRaw.startsWith('dev_')) {
    if (allowDevMode) {
      // Parse optional dev user id e.g. "dev_5082009770_Temur_uz"
      const parts = (initDataRaw || 'dev_5082009770_Temur_uz').split('_');
      return {
        ok: true,
        isDev: true,
        user: {
          id: parts[1] || '5082009770',
          first_name: parts[2] || 'Temur',
          username: 'temur_player',
          language_code: parts[3] || 'uz'
        },
        startParam: parts[4] || null
      };
    }
    return { ok: false, reason: 'MISSING_INIT_DATA' };
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      return { ok: false, reason: 'MISSING_HASH' };
    }

    // If BOT_TOKEN is not configured yet, allow fallback in dev mode
    if (!botToken || botToken === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      if (allowDevMode) {
        const userStr = params.get('user');
        const userObj = userStr ? JSON.parse(userStr) : { id: '5082009770', first_name: 'Temur' };
        return {
          ok: true,
          isDev: true,
          user: userObj,
          startParam: params.get('start_param') || null
        };
      }
      return { ok: false, reason: 'BOT_TOKEN_NOT_SET' };
    }

    // Check auth_date freshness (max 2 hours to prevent stolen initData scripts)
    const authDate = Number(params.get('auth_date') || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (authDate > 0 && nowSec - authDate > 7200) {
      return { ok: false, reason: 'EXPIRED_INIT_DATA' };
    }

    // Build data-check-string sorted alphabetically
    const pairs = [];
    for (const [key, value] of params.entries()) {
      if (key !== 'hash') {
        pairs.push(`${key}=${value}`);
      }
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { ok: false, reason: 'INVALID_SIGNATURE' };
    }

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user || !user.id) {
      return { ok: false, reason: 'INVALID_USER_PAYLOAD' };
    }

    return {
      ok: true,
      isDev: false,
      queryId: params.get('query_id') || null,
      user,
      startParam: params.get('start_param') || null
    };
  } catch (err) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }
}

/**
 * Anti-Collusion / Anti-Chip-Dumping check:
 * Prevents two accounts from repeatedly matching to transfer coins.
 */
function canMatchPlayers(playerA, playerB, matchesHistory = [], adminId = null) {
  if (!playerA || !playerB) return false;
  if (String(playerA.userId) === String(playerB.userId)) return false;

  const aId = String(playerA.userId);
  const bId = String(playerB.userId);
  const isAdminTesting = adminId && (aId === String(adminId) || bId === String(adminId));

  // If admin is testing or playing, always allow matching
  if (isAdminTesting) {
    return true;
  }

  // Prevent repeated coin farming between the exact same pair (max 4 matches in 1 hour)
  const oneHourAgo = Date.now() - 3600000;
  const recentPairMatches = matchesHistory.filter((m) => {
    if (m.endedAt < oneHourAgo) return false;
    const ids = [String(m.whiteId), String(m.blackId)];
    return ids.includes(aId) && ids.includes(bId);
  });

  if (recentPairMatches.length >= 4) {
    return false;
  }

  return true;
}

/**
 * Analyzes player moves in a match for AI/Engine assistance and script automation.
 */
function evaluateMatchAntiCheat(telemetryLog = []) {
  if (!telemetryLog || telemetryLog.length < 5) {
    return {
      engineMatchRate: 0,
      stdDevTimeMs: 1000,
      blurCount: 0,
      untrustedCount: 0,
      suspicious: false,
      reason: null,
      trustPenalty: 0
    };
  }

  const totalMoves = telemetryLog.length;
  let engineMatches = 0;
  let blurCount = 0;
  let untrustedCount = 0;
  const times = [];

  for (const item of telemetryLog) {
    if (item.matchedEngineBest) engineMatches++;
    if (item.windowBlurred) blurCount++;
    if (!item.pointerTrusted) untrustedCount++;
    if (typeof item.thinkTimeMs === 'number') times.push(item.thinkTimeMs);
  }

  const engineMatchRate = Math.round((engineMatches / totalMoves) * 100);

  // Calculate timing standard deviation
  const mean = times.reduce((a, b) => a + b, 0) / (times.length || 1);
  const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / (times.length || 1);
  const stdDevTimeMs = Math.round(Math.sqrt(variance));

  let suspicious = false;
  let reason = null;
  let trustPenalty = 0;

  // Rule 1: Untrusted pointer telemetry (WebSocket Bridge / Automated console injection)
  if (untrustedCount >= 3) {
    suspicious = true;
    reason = 'WEBSOCKET_SCRIPT_DETECTED';
    trustPenalty += 20;
  }

  // Rule 2: High engine correlation + constant robotic timing
  if (totalMoves >= 7 && engineMatchRate >= 90 && stdDevTimeMs < 220) {
    suspicious = true;
    reason = 'ENGINE_BOT_TIMING';
    trustPenalty += 25;
  }

  // Rule 3: Frequent window switching (2nd window AI copying) + very high accuracy
  if (totalMoves >= 6 && blurCount >= Math.ceil(totalMoves * 0.6) && engineMatchRate >= 85) {
    suspicious = true;
    reason = 'SECOND_SCREEN_AI_ASSIST';
    trustPenalty += 15;
  }

  return {
    engineMatchRate,
    stdDevTimeMs,
    blurCount,
    untrustedCount,
    suspicious,
    reason,
    trustPenalty
  };
}

module.exports = {
  verifyTelegramInitData,
  canMatchPlayers,
  evaluateMatchAntiCheat
};
