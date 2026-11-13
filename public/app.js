(() => {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  // App State
  let currentLang = localStorage.getItem('arena_lang') || '';
  let selectedGame = 'checkers';
  let selectedStake = 2;
  let selectedBotDifficulty = localStorage.getItem('arena_bot_diff') || 'medium';
  let selectedConvertTarget = 'stars';
  let currentDuelId = null;
  let wsReconnectTimer = null;
  let ws = null;
  let userState = null;
  let appConfig = {
    botUsername: 'ChessTonArenaBot',
    adsgramBlockId: '58136',
    adsgramInterstitialBlockId: 'int-58970',
    adsgramTaskBlockId: 'task-58978',
    moveTimeLimitSec: 60,
    minConvertCoins: 1000,
    maxDailyConvertCoins: 1000,
    minWinsForConvert: 50,
    minReferralsForConvert: 5,
    minEloForConvert: 1150
  };

  // Shop & Milestones State
  let shopCatalog = [];
  let refMilestones = [];
  let activeShopTab = 'board';

  // Match State
  let currentMatch = null;
  let currentHint = null;
  let lastGameOverData = null;
  let selectedFrom = null;
  let timerInterval = null;
  let windowBlurredDuringTurn = false;
  let lastPointerTrusted = true;

  const CHESS_SVG_PATHS = {
    p: '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>',
    r: '<g><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM14 29.5v-13h17v13H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z"/></g>',
    n: '<g><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/></g>',
    b: '<g><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><circle cx="22.5" cy="8" r="2.5"/></g>',
    q: '<g><path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/></g>',
    k: '<g><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7z"/></g>'
  };

  function getChessPieceSvg(pieceCode, pieceSkin = 'classic') {
    if (!pieceCode || pieceCode.length < 2) return '';
    const isWhite = pieceCode[0] === 'w';
    const type = pieceCode[1];
    const body = CHESS_SVG_PATHS[type] || CHESS_SVG_PATHS.p;
    let fill = isWhite ? '#fffef7' : '#111827';
    let stroke = isWhite ? '#1e293b' : '#cbd5e1';
    let strokeW = isWhite ? '2.2' : '1.6';

    if (pieceSkin === 'neon') {
      fill = isWhite ? '#a7f3d0' : '#0369a1';
      stroke = isWhite ? '#059669' : '#38bdf8';
      strokeW = '2.4';
    } else if (pieceSkin === 'gold') {
      fill = isWhite ? '#fef08a' : '#18181b';
      stroke = isWhite ? '#b45309' : '#eab308';
      strokeW = '2.4';
    }

    return `<svg viewBox="0 0 45 45" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  // ==========================================================================
  // 🎵 PROCEDURAL AUDIO & SOUND FX ENGINE (Web Audio API)
  // ==========================================================================
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('arena_sound_enabled') !== 'false';
  let ambientOscillators = [];
  let ambientGain = null;
  let ambientRunning = false;

  function getAudioCtx() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.addEventListener('click', () => {
    if (soundEnabled) {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (!ambientRunning) startAmbientMusic();
    }
  }, { once: false });

  function playMoveSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.055);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
    } catch (_) {}
  }

  function playCaptureSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(320, t);
      osc2.frequency.exponentialRampToValueAtTime(80, t + 0.08);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.09);
      osc2.stop(t + 0.09);
    } catch (_) {}
  }

  function playDiceSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      [0, 0.045, 0.095, 0.15, 0.21].forEach((delay, idx) => {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        const freq = 380 + Math.random() * 220;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.035);
        gain.gain.setValueAtTime(0.28 - idx * 0.03, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      });
    } catch (_) {}
  }

  function playLudoPawnSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(680, t + 0.06);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.075);
    } catch (_) {}
  }

  function playLudoHomeSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const t = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch (_) {}
  }

  function playCorrectSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      [1318.51, 1661.22].forEach((freq, idx) => {
        const t = ctx.currentTime + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch (_) {}
  }

  function playWrongSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.2);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    } catch (_) {}
  }

  function playTickSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    } catch (_) {}
  }

  function playWinSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const t = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === notes.length - 1 ? 0.6 : 0.25));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + (idx === notes.length - 1 ? 0.65 : 0.28));
      });
    } catch (_) {}
  }

  function playGameOverSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = [392.00, 329.63, 261.63];
      notes.forEach((freq, idx) => {
        const t = ctx.currentTime + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch (_) {}
  }

  function startAmbientMusic() {
    if (!soundEnabled || ambientRunning) return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      ambientGain = ctx.createGain();
      ambientGain.gain.setValueAtTime(0.028, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, ctx.currentTime);

      ambientGain.connect(filter);
      filter.connect(ctx.destination);

      const chordFreqs = [146.83, 220.00, 293.66, 369.99];
      chordFreqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.connect(ambientGain);
        osc.start();
        ambientOscillators.push(osc);
      });

      ambientRunning = true;
    } catch (_) {}
  }

  function stopAmbientMusic() {
    ambientOscillators.forEach((osc) => {
      try { osc.stop(); osc.disconnect(); } catch (_) {}
    });
    ambientOscillators = [];
    ambientRunning = false;
  }

  window.toggleSoundFx = () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('arena_sound_enabled', soundEnabled ? 'true' : 'false');
    const btn = document.getElementById('gramoraSoundBtn');
    if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) {
      showToast('🔊 Ovozlar yoqildi!');
      startAmbientMusic();
      playMoveSound();
    } else {
      showToast('🔇 Ovozlar o\'chirildi');
      stopAmbientMusic();
    }
  };

  // Track window blur / visibility changes for Anti-Cheat
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentMatch && currentMatch.status === 'playing') {
      windowBlurredDuringTurn = true;
    }
  });
  window.addEventListener('blur', () => {
    if (currentMatch && currentMatch.status === 'playing') {
      windowBlurredDuringTurn = true;
    }
  });

  function t(key) {
    const langObj = window.I18N[currentLang || 'uz'] || window.I18N.uz;
    return langObj[key] || window.I18N.uz[key] || key;
  }

  function showToast(msg) {
    const el = document.getElementById('toastMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.display = 'none';
    }, 2600);
  }

  function applyTranslations() {
    const lang = currentLang || 'uz';
    const dict = window.I18N[lang] || window.I18N.uz;
    document.getElementById('langBtn').textContent = dict.langName;
    const gLangBtn = document.getElementById('gramoraLangBtn');
    if (gLangBtn) gLangBtn.textContent = dict.langName;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (dict[k]) el.textContent = dict[k];
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (dict[k]) el.setAttribute('placeholder', dict[k]);
    });

    if (typeof window.updateConvertPreview === 'function') window.updateConvertPreview();
    if (typeof window.updateStarsToCoinsPreview === 'function') window.updateStarsToCoinsPreview();
  }

  // Check initial language
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && ['uz', 'ru', 'en'].includes(urlLang)) {
    currentLang = urlLang;
    localStorage.setItem('arena_lang', currentLang);
  }

  if (!currentLang) {
    currentLang = 'uz';
    document.getElementById('langModal').classList.add('active');
  }

  // WebSocket Connection & Native Prototype Integrity Check
  function connectWebSocket() {
    const isNativeSend = WebSocket.prototype.send.toString().includes('[native code]');
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onopen = () => {
      const initData = (tg && tg.initData) ? tg.initData : `dev_5082009770_Temur_${currentLang}`;
      const refParam = urlParams.get('ref') || null;
      const startParam =
        (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) ||
        urlParams.get('tgWebAppStartParam') ||
        urlParams.get('startapp') ||
        null;
      sendWs('HELLO', {
        initData,
        lang: currentLang,
        referredBy: refParam,
        startParam,
        wsIntegrity: isNativeSend
      });
    };

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        handleServerPacket(packet.t, packet.d || {});
      } catch (err) {
        console.error('Packet parse err:', err);
      }
    };

    ws.onerror = () => {
      try { ws.close(); } catch (e) {}
    };

    ws.onclose = () => {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(connectWebSocket, 1500);
    };
  }

  function sendWs(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ v: 1, t: type, d: data }));
    }
  }

  setInterval(() => sendWs('PING'), 20000);

  function handleServerPacket(type, data) {
    if (type === 'AUTH_OK') {
      userState = data.user;
      renderHeaderUser();
    } else if (type === 'SYNC') {
      userState = data.user;
      if (data.config) appConfig = { ...appConfig, ...data.config };
      if (data.onlineStats) renderOnlineStats(data.onlineStats);
      if (data.shopCatalog) shopCatalog = data.shopCatalog;
      if (data.refMilestones) refMilestones = data.refMilestones;
      renderHeaderUser();
      renderTournaments(data.tournaments || []);
      renderTasks(data.tasks || []);
      if (data.leaderboards) cachedLeaderboards = data.leaderboards;
      if (data.leaderboard && !cachedLeaderboards['checkers']) cachedLeaderboards['checkers'] = data.leaderboard;
      window.setLeaderboardTab(selectedGame || 'checkers');
      renderConversions(data.conversions || []);
      renderShopItems();
      renderReferralMilestones();

      // Auto-launch game if started via group button (Zakovat / Ludo / Chess / Checkers)
      const groupStartParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || '';
      if (groupStartParam && !window._groupStartHandled) {
        window._groupStartHandled = true;
        if (groupStartParam.startsWith('zroom_')) {
          window.selectGameMode('zakovat');
        } else if (groupStartParam.startsWith('lroom_')) {
          window.selectGameMode('ludo');
        } else if (groupStartParam.includes('zakovat')) {
          window.selectGameMode('zakovat');
          setTimeout(() => {
            window.startPracticeVsBot();
          }, 800);
        } else if (groupStartParam.includes('ludo')) {
          window.selectGameMode('ludo');
          setTimeout(() => {
            window.startPracticeVsBot();
          }, 800);
        } else if (groupStartParam.includes('chess')) {
          window.selectGameMode('chess');
        } else if (groupStartParam.includes('checkers')) {
          window.selectGameMode('checkers');
        }
      }
      if (data.adminData) {
        window._adminData = data.adminData;
        renderAdminDashboard(data.adminData);
        if (urlParams.get('admin') === '1' && !window._adminAutoOpened) {
          window._adminAutoOpened = true;
          window.switchNav('admin');
        }
      }
    } else if (type === 'LEADERBOARD_DATA') {
      if (data.game && data.list) {
        cachedLeaderboards[data.game] = data.list;
        if (currentLeaderboardGame === data.game) {
          renderLeaderboard(data.list);
        }
      }
    } else if (type === 'ONLINE_STATS') {
      renderOnlineStats(data);
    } else if (type === 'ADMIN_TOAST') {
      showToast(data.message || '✅ Bajarildi');
    } else if (type === 'QUEUED') {
      if (data.isDuel && data.duelId) currentDuelId = data.duelId;
      document.getElementById('queueModal').classList.add('active');
    } else if (type === 'QUEUE_CANCELLED' || type === 'DUEL_CANCELLED') {
      currentDuelId = null;
      document.getElementById('queueModal').classList.remove('active');
      if (type === 'DUEL_CANCELLED') {
        showToast(data.reason === 'EXPIRED' ? "⌛ Duel muddati tugadi (raqib topilmadi)" : "❌ Duel bekor qilindi (0 G yo'qotildi)");
      }
    } else if (type === 'MATCH_FOUND' || type === 'STATE') {
      currentDuelId = null;
      currentHint = null;
      document.getElementById('queueModal').classList.remove('active');
      const prevMove = currentMatch ? currentMatch.lastMove : null;
      currentMatch = data;
      selectedFrom = null;
      windowBlurredDuringTurn = false;
      renderMatchScreen();
      if (currentMatch && currentMatch.lastMove && prevMove !== currentMatch.lastMove) {
        playMoveSound();
      }
    } else if (type === 'EMOJI') {
      showMatchEmoji(data.fromId, data.emoji);
    } else if (type === 'HINT_RESULT') {
      currentHint = data.move;
      if (currentMatch) {
        if (currentMatch.game === 'checkers') renderCheckersBoard();
        else renderChessBoard();
      }
      showToast(data.game === 'chess' && data.move ? `💡 Maslahat: ${data.move.from.toUpperCase()} ➔ ${data.move.to.toUpperCase()}` : `💡 Maslahat: Tavsiya qilingan yurish taxtada ko'rsatildi!`);
    } else if (type === 'LOSS_PROTECTION_SUCCESS') {
      if (lastGameOverData) lastGameOverData.canLossProtect = false;
      const box = document.getElementById('goLossProtectBox');
      if (box) {
        box.innerHTML = `<div style="background:rgba(16,185,129,0.2); border:1px solid #10b981; border-radius:12px; padding:10px; color:#6ee7b7; font-weight:700; font-size:13px;">🛡️ ELO Qalqoni faollashtirildi (+${data.eloRefund} ELO tiklandi) ✓</div>`;
      }
      showToast(`🛡️ ELO Qalqoni faol! +${data.eloRefund} ELO qaytarildi!`);
    } else if (type === 'DOUBLE_WIN_SUCCESS') {
      if (lastGameOverData) lastGameOverData.canDoubleWin = false;
      const box = document.getElementById('goDoubleWinBox');
      if (box) {
        box.innerHTML = `<div style="background:rgba(245,158,11,0.2); border:1px solid #f59e0b; border-radius:12px; padding:10px; color:#fde047; font-weight:700; font-size:13px;">🔥 G'alaba 2x qilindi (+${data.bonus} G) ✓</div>`;
      }
      showToast(`🔥 G'alaba 2x qilindi! +${data.bonus} G balansingizga qo'shildi!`);
    } else if (type === 'GAME_OVER') {
      stopMatchTimer();
      showGameOver(data);
    } else if (type === 'REWARD_CLAIMED') {
      showToast(`+${data.amount} ${data.kind === 'stars_demo' ? '⭐ Stars' : 'G 🪙'}!`);
    } else if (type === 'TOURNAMENT_JOINED') {
      const feeTxt = data.entryFee ? ` (-${data.entryFee} ${data.entryType === 'stars' ? '⭐' : 'G'})` : '';
      if (data.startedNow) {
        showToast(`🔥 Turnir to'ldi va avtomatik boshlandi!${feeTxt}`);
      } else {
        showToast(`🏆 Turnirga qo'shildingiz!${feeTxt}`);
      }
    } else if (type === 'INVOICE_CREATED') {
      if (tg && tg.openInvoice && data.invoiceUrl) {
        tg.openInvoice(data.invoiceUrl);
      } else {
        window.open(data.invoiceUrl, '_blank');
      }
    } else if (type === 'CONVERT_SUCCESS') {
      showToast('✅ Konvertatsiya muvaffaqiyatli bajarildi!');
    } else if (type === 'SHOP_BUY_SUCCESS') {
      showToast("✅ Xarid qilindi va taxtaga o'rnatildi!");
      renderShopItems();
    } else if (type === 'SHOP_EQUIP_SUCCESS') {
      showToast("✅ Yangi skin o'rnatildi!");
      renderShopItems();
    } else if (type === 'REF_MILESTONE_SUCCESS') {
      showToast(`🎉 Sovg'a olindi! +${data.reward} G${data.vipDays ? ' • VIP faollashdi!' : ''}`);
      renderReferralMilestones();
    } else if (type === 'STORY_SHARE_SUCCESS') {
      showToast(`🎉 Story bonusi olindi! +${data.bonus} G`);
      const b = document.getElementById('goStoryShareBox');
      if (b) b.style.display = 'none';
    } else if (type === 'ZAKOVAT_LOBBY' || type === 'LUDO_LOBBY') {
      document.getElementById('queueModal').classList.remove('active');
      window.renderGroupLobby(data);
    } else if (type === 'GROUP_LOBBY_LEFT') {
      window.closeGroupLobby();
    } else if (type === 'ZAKOVAT_STATE' || type === 'ZAKOVAT_REVEAL') {
      document.getElementById('queueModal').classList.remove('active');
      window.closeGroupLobby();
      renderZakovatScreen(data);
    } else if (type === 'ZAKOVAT_OVER') {
      window.closeGroupLobby();
      showZakovatOver(data);
    } else if (type === 'LUDO_STATE') {
      document.getElementById('queueModal').classList.remove('active');
      window.closeGroupLobby();
      renderLudoScreen(data);
    } else if (type === 'LUDO_OVER') {
      window.closeGroupLobby();
      showLudoOver(data);
    } else if (type === 'ERROR') {
      document.getElementById('queueModal').classList.remove('active');
      showToast(`⚠️ ${data.message || data.code}`);
    }
  }

  function getCurrentGameElo() {
    if (!userState) return 1000;
    if (selectedGame === 'chess') return userState.eloChess || 1000;
    if (selectedGame === 'zakovat') return userState.eloZakovat || 1000;
    if (selectedGame === 'ludo') return userState.eloLudo || 1000;
    return userState.eloCheckers || userState.elo || 1000;
  }

  function getCurrentGameRankTitle() {
    if (!userState) return 'Havaskor';
    if (selectedGame === 'chess') return userState.rankTitleChess || 'Havaskor';
    return userState.rankTitleCheckers || userState.rankTitle || 'Havaskor';
  }

  function renderHeaderUser() {
    if (!userState) return;
    const curElo = getCurrentGameElo();
    const curRank = getCurrentGameRankTitle();
    document.getElementById('userName').textContent = userState.name;
    document.getElementById('userAvatar').textContent = (userState.name || 'P')[0].toUpperCase();
    document.getElementById('userElo').textContent = `${curRank || '🛡️'} • ${curElo} ELO`;
    document.getElementById('userCoins').textContent = userState.coins;
    document.getElementById('userStars').textContent = userState.stars;

    // Update Gramora Scenic Lobby HUD
    const gName = document.getElementById('gramoraName');
    const gAvatar = document.getElementById('gramoraAvatar');
    const gRank = document.getElementById('gramoraRank');
    const gCoins = document.getElementById('gramoraCoins');
    const gStars = document.getElementById('gramoraStars');
    if (gName) gName.textContent = (userState.name || 'O\'yinchi').toUpperCase();
    if (gAvatar) gAvatar.textContent = (userState.name || 'P')[0].toUpperCase();
    if (gRank) gRank.textContent = `${curRank || 'Havaskor'} • ${curElo} ELO`;
    if (gCoins) gCoins.textContent = userState.coins;
    if (gStars) gStars.textContent = userState.stars;
    document.querySelectorAll('.user-coins-sync').forEach((el) => {
      el.textContent = userState.coins;
    });

    // Daily button status (1-kun: +2G ... 7-kun: +8G)
    const canClaimDaily = Date.now() - (userState.lastDailyAt || 0) >= 20 * 3600 * 1000;
    const dailyBtn = document.getElementById('claimDailyBtn');
    if (dailyBtn) {
      dailyBtn.disabled = !canClaimDaily;
      const nextStreak = ((userState.streak || 0) % 7) + 1;
      dailyBtn.textContent = canClaimDaily ? `${t('claimBtn')} (+${1 + nextStreak}G)` : t('claimedBtn');
    }
    const giftDot = document.getElementById('giftBadgeDot');
    if (giftDot) giftDot.style.display = canClaimDaily ? 'block' : 'none';

    // Referral & Convert boxes
    document.getElementById('refCountVal').textContent = userState.referralCount || 0;
    document.getElementById('refEarnedVal').textContent = `${userState.referralEarnings || 0} G`;
    document.getElementById('convBonusVal').textContent = `${userState.bonusCoins || 0} G`;
    document.getElementById('convEarnedVal').textContent = `${userState.earnedCoins || 0} G`;

    const trustEl = document.getElementById('convTrustVal');
    const ts = userState.trustScore ?? 100;
    trustEl.textContent = `${ts}% ${ts >= 80 ? '✅' : '⚠️'}`;
    trustEl.style.color = ts >= 80 ? '#10b981' : '#f59e0b';

    // Convert Qualification & Limits checklist
    const reqBox = document.getElementById('convRequirementsBox');
    if (reqBox) {
      const minW = appConfig.minWinsForConvert ?? 50;
      const minR = appConfig.minReferralsForConvert ?? 5;
      const minE = appConfig.minEloForConvert ?? 1150;
      const minC = appConfig.minConvertCoins || 1000;
      const maxD = appConfig.maxDailyConvertCoins || 1000;

      const curW = userState.wins || 0;
      const curR = userState.referralCount || 0;
      const curE = userState.elo || 1000;
      const curC = userState.earnedCoins || 0;
      const usedD = userState.dailyConvertedToday || 0;

      const okW = curW >= minW;
      const okR = curR >= minR;
      const okE = curE >= minE;
      const okC = curC >= minC;

      reqBox.innerHTML = `
        <div style="font-weight:800; color:var(--gold-bright); margin-bottom:6px;">
          🔒 Convert Shartlari va Kunlik Limit (24s: ${usedD}/${maxD} G)
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; color:var(--text-muted);">
          <div>${okW ? '✅' : '🔒'} G'alaba: <b style="color:${okW ? '#10b981' : '#fff'}">${curW}/${minW}</b></div>
          <div>${okR ? '✅' : '🔒'} Do'stlar: <b style="color:${okR ? '#10b981' : '#fff'}">${curR}/${minR}</b></div>
          <div>${okE ? '✅' : '🔒'} Reyting: <b style="color:${okE ? '#10b981' : '#fff'}">${curE}/${minE} ELO</b></div>
          <div>${okC ? '✅' : '🔒'} Earned: <b style="color:${okC ? '#10b981' : '#fff'}">${curC}/${minC} G</b></div>
        </div>
      `;
    }

    const admBtn = document.getElementById('adminHeaderBtn');
    const gAdmBtn = document.getElementById('gramoraAdminBtn');
    const showAdm = Boolean(userState.isAdmin && urlParams.get('admin') === '1');
    if (admBtn) admBtn.style.display = showAdm ? 'inline-block' : 'none';
    if (gAdmBtn) gAdmBtn.style.display = showAdm ? 'inline-block' : 'none';

    // Show Shop, Challenge, and Referral Milestones to all users
    const navShop = document.getElementById('navShopBtn');
    if (navShop) navShop.style.display = 'flex';

    const lobbyShop = document.getElementById('lobbyTileShop');
    if (lobbyShop) lobbyShop.style.display = 'flex';

    const btnCh = document.getElementById('btnLobbyChallenge');
    if (btnCh) btnCh.style.display = 'flex';

    const msBlock = document.getElementById('refMilestonesBlock');
    if (msBlock) msBlock.style.display = 'block';

    const shopVipBadge = document.getElementById('shopVipStatusBadge');
    if (shopVipBadge) {
      shopVipBadge.style.display = userState.isVip ? 'inline-flex' : 'none';
    }

    // Make Zakovat & Ludo visible and playable for all players!
    const cZk = document.getElementById('cardZakovat');
    const cLu = document.getElementById('cardLudo');
    const cKb = document.getElementById('cardKubok');
    const mZk = document.getElementById('modalBtnZakovat');
    const mLu = document.getElementById('modalBtnLudo');
    if (cZk) cZk.style.display = 'flex';
    if (cLu) cLu.style.display = 'flex';
    if (cKb) cKb.style.display = 'none';
    if (mZk) mZk.style.display = 'inline-block';
    if (mLu) mLu.style.display = 'inline-block';
  }

  // Board Rendering (Checkers & Chess)
  function renderMatchScreen() {
    if (!currentMatch) return;
    switchNav('arena');
    document.body.classList.remove('in-lobby-hud');
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('matchPanel').classList.add('active');

    // Hide bottom navigation during active match for full screen view
    const bNav = document.querySelector('.bottom-nav');
    if (bNav) bNav.style.display = 'none';

    // Apply equipped board skin
    const boardFrame = document.querySelector('.board-frame');
    if (boardFrame) {
      const bSkin = (userState && userState.equippedBoardSkin) || 'classic';
      boardFrame.className = `board-frame skin-${bSkin}`;
    }

    const myColor = currentMatch.myColor || 'w';
    const me = myColor === 'w' ? currentMatch.white : currentMatch.black;
    const opp = myColor === 'w' ? currentMatch.black : currentMatch.white;

    document.getElementById('matchPrizeLabel').textContent =
      currentMatch.prize > 0
        ? `${t('winnerGets').toUpperCase()}: +${currentMatch.prize} G 🪙`
        : `🏆 TURNIR O'YINI`;

    const myColorDot = myColor === 'w' ? '⚪' : '⚫';
    const oppColorDot = myColor === 'w' ? '⚫' : '⚪';

    document.getElementById('myMatchName').textContent = `${myColorDot} ${me.name}`;
    document.getElementById('myMatchAvatar').textContent = (me.name || 'S')[0].toUpperCase();
    document.getElementById('myMatchElo').textContent = `${me.elo} ELO`;

    const myBadgeEl = document.getElementById('myTypeBadge');
    if (myBadgeEl) {
      myBadgeEl.className = 'player-type-badge badge-human';
      myBadgeEl.textContent = t('badgeYou');
    }

    document.getElementById('oppName').textContent = `${oppColorDot} ${opp.name}`;
    document.getElementById('oppElo').textContent = `${opp.elo} ELO`;

    const oppBadgeEl = document.getElementById('oppTypeBadge');
    if (oppBadgeEl) {
      if (opp.isBot) {
        const diff = opp.botDifficulty || currentMatch.botDifficulty || 'medium';
        oppBadgeEl.className = `player-type-badge badge-bot-${diff}`;
        if (diff === 'easy') oppBadgeEl.textContent = t('badgeBotEasy');
        else if (diff === 'hard') oppBadgeEl.textContent = t('badgeBotHard');
        else oppBadgeEl.textContent = t('badgeBotMedium');
        document.getElementById('oppAvatar').textContent = '🤖';
      } else {
        oppBadgeEl.className = 'player-type-badge badge-human';
        oppBadgeEl.textContent = t('badgeHuman');
        document.getElementById('oppAvatar').textContent = (opp.name || 'R')[0].toUpperCase();
      }
    }

    const isMyTurn = currentMatch.turn === myColor;
    document.getElementById('myBar').classList.toggle('active-turn', isMyTurn);
    document.getElementById('oppBar').classList.toggle('active-turn', !isMyTurn);

    const badge = document.getElementById('turnStatusBadge');
    badge.textContent = isMyTurn ? t('yourTurn') : t('oppTurn');
    badge.style.borderColor = isMyTurn ? '#10b981' : '#f5c451';
    badge.style.color = isMyTurn ? '#6ee7b7' : '#fde08d';

    if (currentMatch.game === 'checkers') {
      renderCheckersBoard();
    } else {
      renderChessBoard();
    }

    startClientMoveCountdown();
  }

  function rowColToCheckersIndex(row, col) {
    if ((row + col) % 2 === 0) return -1;
    return row * 4 + Math.floor(col / 2);
  }

  function renderCheckersBoard() {
    const grid = document.getElementById('boardGrid');
    grid.innerHTML = '';
    const myColor = currentMatch.myColor || 'w';
    const isMyTurn = currentMatch.turn === myColor;
    const board = currentMatch.board || [];
    const legalMoves = currentMatch.legalMoves || [];
    const pSkin = (userState && userState.equippedPieceSkin) || 'classic';
    grid.className = `board-grid skin-pieces-${pSkin}`;

    const destMovesForSelected =
      selectedFrom !== null
        ? legalMoves.filter((m) => Number(m.from) === Number(selectedFrom))
        : [];

    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        // Flip board if player is black
        const row = myColor === 'w' ? vRow : 7 - vRow;
        const col = myColor === 'w' ? vCol : 7 - vCol;

        const cell = document.createElement('div');
        const isDark = (row + col) % 2 === 1;
        cell.className = `board-cell ${isDark ? 'dark' : 'light'}`;

        if (isDark) {
          const idx = rowColToCheckersIndex(row, col);
          const piece = board[idx];

          if (selectedFrom === idx) {
            cell.classList.add('selected');
          }
          if (
            currentMatch.lastMove &&
            (currentMatch.lastMove.from === idx || currentMatch.lastMove.to === idx)
          ) {
            cell.classList.add('last-move');
          }
          if (currentHint && Number(currentHint.from) === idx) {
            cell.classList.add('hint-source');
          }
          if (currentHint && Number(currentHint.to) === idx) {
            cell.classList.add('hint-target');
          }

          if (piece) {
            const pEl = document.createElement('div');
            const isWhitePiece = piece === 'w' || piece === 'W';
            const isKing = piece === 'W' || piece === 'B';
            pEl.className = `checker-piece ${isWhitePiece ? 'white' : 'black'}`;
            if (isKing) pEl.textContent = '👑';
            cell.appendChild(pEl);
          }

          const targetMove = destMovesForSelected.find((m) => Number(m.to) === idx);
          if (targetMove) {
            const dot = document.createElement('div');
            dot.className = 'legal-dot';
            cell.appendChild(dot);
          }

          cell.addEventListener('pointerdown', (ev) => {
            lastPointerTrusted = Boolean(ev.isTrusted);
            if (!isMyTurn) return;

            if (targetMove) {
              if (targetMove.path && targetMove.path.length > 2) playCaptureSound();
              else playMoveSound();
              sendWs('MOVE', {
                matchId: currentMatch.matchId,
                from: targetMove.from,
                to: targetMove.to,
                path: targetMove.path,
                telemetry: {
                  pointerTrusted: lastPointerTrusted,
                  windowBlurred: windowBlurredDuringTurn
                }
              });
              selectedFrom = null;
              currentHint = null;
              return;
            }

            const hasMoveFromHere = legalMoves.some((m) => Number(m.from) === idx);
            if (hasMoveFromHere) {
              selectedFrom = idx;
              renderCheckersBoard();
            }
          });
        }

        grid.appendChild(cell);
      }
    }
  }

  function parseFenToMatrix(fen) {
    const rows = (fen || '').split(' ')[0].split('/');
    const matrix = [];
    for (const r of rows) {
      const rowArr = [];
      for (const ch of r) {
        if (/[1-8]/.test(ch)) {
          const emptyCount = Number(ch);
          for (let i = 0; i < emptyCount; i++) rowArr.push(null);
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          rowArr.push(color + ch.toLowerCase());
        }
      }
      matrix.push(rowArr);
    }
    return matrix;
  }

  function renderChessBoard() {
    const grid = document.getElementById('boardGrid');
    grid.innerHTML = '';
    grid.className = 'board-grid';
    const myColor = currentMatch.myColor || 'w';
    const isMyTurn = currentMatch.turn === myColor;
    const matrix = parseFenToMatrix(currentMatch.fen);
    const legalMoves = currentMatch.legalMoves || [];
    const pSkin = (userState && userState.equippedPieceSkin) || 'classic';

    const destMovesForSelected =
      selectedFrom !== null
        ? legalMoves.filter((m) => m.from === selectedFrom)
        : [];

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        const row = myColor === 'w' ? vRow : 7 - vRow;
        const col = myColor === 'w' ? vCol : 7 - vCol;
        const sq = `${files[col]}${8 - row}`;

        const cell = document.createElement('div');
        const isDark = (row + col) % 2 === 1;
        cell.className = `board-cell ${isDark ? 'dark' : 'light'}`;

        if (selectedFrom === sq) {
          cell.classList.add('selected');
        }
        if (
          currentMatch.lastMove &&
          (currentMatch.lastMove.from === sq || currentMatch.lastMove.to === sq)
        ) {
          cell.classList.add('last-move');
        }
        if (currentHint && currentHint.from === sq) {
          cell.classList.add('hint-source');
        }
        if (currentHint && currentHint.to === sq) {
          cell.classList.add('hint-target');
        }

        const pieceCode = matrix[row] && matrix[row][col];
        if (pieceCode) {
          const pEl = document.createElement('div');
          pEl.className = `chess-piece ${pieceCode[0] === 'w' ? 'white' : 'black'}`;
          pEl.innerHTML = getChessPieceSvg(pieceCode, pSkin);
          cell.appendChild(pEl);
        }

        const targetMove = destMovesForSelected.find((m) => m.to === sq);
        if (targetMove) {
          const dot = document.createElement('div');
          dot.className = 'legal-dot';
          cell.appendChild(dot);
        }

        cell.addEventListener('pointerdown', (ev) => {
          lastPointerTrusted = Boolean(ev.isTrusted);
          if (!isMyTurn) return;

          if (targetMove) {
            playMoveSound();
            sendWs('MOVE', {
              matchId: currentMatch.matchId,
              from: targetMove.from,
              to: targetMove.to,
              promotion: 'q',
              telemetry: {
                pointerTrusted: lastPointerTrusted,
                windowBlurred: windowBlurredDuringTurn
              }
            });
            selectedFrom = null;
            currentHint = null;
            return;
          }

          const hasMoveFromHere = legalMoves.some((m) => m.from === sq);
          if (hasMoveFromHere) {
            selectedFrom = sq;
            renderChessBoard();
          }
        });

        grid.appendChild(cell);
      }
    }
  }

  function formatTimerSec(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }

  function startClientMoveCountdown() {
    stopMatchTimer();
    const updateClock = () => {
      if (!currentMatch || currentMatch.status !== 'playing') return;
      const defaultLimit =
        currentMatch.timeLimitSec || (currentMatch.game === 'chess' ? 60 : 45);
      const remSec = Math.max(0, Math.ceil((currentMatch.moveDeadline - Date.now()) / 1000));
      const formatted = formatTimerSec(remSec);
      const defaultFormatted = formatTimerSec(defaultLimit);
      const isMyTurn = currentMatch.turn === currentMatch.myColor;
      document.getElementById('myTimer').textContent = isMyTurn ? formatted : defaultFormatted;
      document.getElementById('oppTimer').textContent = !isMyTurn ? formatted : defaultFormatted;
    };
    updateClock();
    timerInterval = setInterval(updateClock, 400);
  }

  function stopMatchTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function showMatchEmoji(fromId, emoji) {
    const isMe = userState && String(fromId) === String(userState.id);
    const slot = document.getElementById(isMe ? 'myEmojiSlot' : 'oppEmojiSlot');
    if (!slot) return;
    slot.textContent = emoji;
    clearTimeout(slot._timer);
    slot._timer = setTimeout(() => {
      slot.textContent = '';
    }, 2200);
  }

  function showGameOver(data) {
    currentMatch = null;
    currentHint = null;
    lastGameOverData = data;
    const modal = document.getElementById('gameOverModal');
    const icon = document.getElementById('goIcon');
    const title = document.getElementById('goTitle');
    const sub = document.getElementById('goSub');

    if (data.winnerColor === 'draw') {
      icon.textContent = '🤝';
      title.textContent = t('drawMatch');
      playGameOverSound();
    } else if (data.winnerColor === data.myColor) {
      icon.textContent = '🏆';
      title.textContent = t('youWon');
      playWinSound();
    } else {
      icon.textContent = '😔';
      title.textContent = t('youLost');
      playGameOverSound();
    }

    const sign = data.eloDelta >= 0 ? `+${data.eloDelta}` : `${data.eloDelta}`;
    sub.textContent = `${data.prize > 0 ? `+${data.prize} G • ` : ''}${sign} ELO`;

    // 2x Double Win button configuration
    const doubleWinBox = document.getElementById('goDoubleWinBox');
    const btnDoubleWin = document.getElementById('btnDoubleWin');
    const btnDoubleWinText = document.getElementById('btnDoubleWinText');
    if (doubleWinBox && btnDoubleWin) {
      if (data.canDoubleWin && (data.doubleWinBonus || data.prize) > 0) {
        doubleWinBox.style.display = 'block';
        btnDoubleWin.disabled = false;
        btnDoubleWin.style.opacity = '1';
        if (btnDoubleWinText) {
          btnDoubleWinText.textContent = `G'alabani 2x Qilish (+${data.doubleWinBonus || data.prize} G)`;
        }
      } else {
        doubleWinBox.style.display = 'none';
      }
    }

    // Loss Protection button configuration
    const lossProtectBox = document.getElementById('goLossProtectBox');
    const btnLossProtect = document.getElementById('btnLossProtect');
    const btnLossProtectText = document.getElementById('btnLossProtectText');
    if (lossProtectBox && btnLossProtect) {
      if (data.canLossProtect && (data.lossProtectElo || Math.abs(data.eloDelta)) > 0) {
        lossProtectBox.style.display = 'block';
        btnLossProtect.disabled = false;
        btnLossProtect.style.opacity = '1';
        if (btnLossProtectText) {
          btnLossProtectText.textContent = `ELO Qalqoni (+${data.lossProtectElo || Math.abs(data.eloDelta)} ELO ni saqlash)`;
        }
      } else {
        lossProtectBox.style.display = 'none';
      }
    }

    // Telegram Story Share button configuration (Available to all users when won)
    const storyBox = document.getElementById('goStoryShareBox');
    if (storyBox) {
      const won = data.winnerColor === data.myColor;
      const canStory = won && (Date.now() - (userState.lastStoryShareAt || 0) >= 20 * 3600 * 1000);
      storyBox.style.display = canStory ? 'block' : 'none';
    }

    modal.classList.add('active');
  }

  function renderOnlineStats(st) {
    if (!st) return;
    const onlineEl = document.getElementById('liveOnlineCountText');
    const matchEl = document.getElementById('liveInMatchText');
    const totalEl = document.getElementById('liveTotalUsersText');
    if (onlineEl) {
      onlineEl.textContent = `${st.onlineUsers || 1} online`;
    }
    if (matchEl) {
      const mLbl = currentLang === 'ru' ? 'В игре' : currentLang === 'en' ? 'In Match' : "O'yinda";
      matchEl.textContent = `⚔️ ${st.inMatchPlayers || 0} ${mLbl}`;
    }
    if (totalEl) {
      const tLbl = currentLang === 'ru' ? 'Игроков' : currentLang === 'en' ? 'Players' : "Jami o'yinchi";
      totalEl.textContent = `👥 ${st.totalUsers || 0} ${tLbl}`;
    }
  }

  function formatTourCountdown(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.tour-countdown-val').forEach((el) => {
      const status = el.getAttribute('data-status');
      const startsAt = Number(el.getAttribute('data-starts') || 0);
      const endsAt = Number(el.getAttribute('data-ends') || 0);
      if (status === 'active' && endsAt > now) {
        el.textContent = `🔥 Jonli Arena! Tugashiga: ${formatTourCountdown(endsAt - now)}`;
      } else if (startsAt > now) {
        el.textContent = `⏳ Boshlanishiga: ${formatTourCountdown(startsAt - now)} (Soat 20:00)`;
      } else {
        el.textContent = `⚡ Boshlanmoqda...`;
      }
    });
  }, 1000);

  // Render Tournaments, Tasks, Leaderboard, Conversions
  function renderTournaments(list) {
    const container = document.getElementById('tournamentsList');
    if (!container) return;
    const now = Date.now();
    container.innerHTML = list
      .map((tour) => {
        const title = (tour.title && tour.title[currentLang]) || tour.title.uz;
        const isJoined = userState && tour.participants.includes(String(userState.id));
        const unit = tour.entryType === 'stars' ? '⭐' : 'G 🪙';
        const fee = Number(tour.entryFee || 0);
        const feeLabel = fee > 0 ? `${fee} ${unit}` : 'BEPUL (0 G)';
        const minRefs = tour.minReferrals ?? 2;
        const myRefs = (userState && userState.referralCount) || 0;
        const refsOk = myRefs >= minRefs;
        const minP = tour.minPlayers || 4;
        const maxP = tour.maxPlayers || 64;
        const standings = tour.standings || [];
        const curP = standings.length;
        const pct = Math.min(100, Math.round((curP / minP) * 100));
        const myScore = (tour.scores && userState && tour.scores[String(userState.id)]) || 0;
        const myPlayed = (tour.gamesPlayed && userState && tour.gamesPlayed[String(userState.id)]) || 0;
        const durMin = tour.durationMinutes || 45;
        const isActive = tour.status === 'active';
        const startsAt = tour.startsAt || 0;
        const endsAt = tour.endsAt || 0;

        const countdownInitial =
          isActive && endsAt > now
            ? `🔥 Jonli Arena! Tugashiga: ${formatTourCountdown(endsAt - now)}`
            : startsAt > now
              ? `⏳ Boshlanishiga: ${formatTourCountdown(startsAt - now)} (Soat 20:00)`
              : `⏰ Har kuni soat 20:00 da (${durMin} daqiqa)`;

        const standingsHtml =
          standings.length > 0
            ? `
            <div style="background:rgba(20,11,4,0.72); border:1px solid rgba(168,118,66,0.38); border-radius:11px; padding:8px 10px; margin:8px 0; font-size:11px;">
              <div style="display:flex; justify-content:space-between; font-weight:800; color:#fde047; margin-bottom:5px;">
                <span>📊 Jonli Turnir Jadvali (${standings.length} ishtirokchi)</span>
                <span>O'yin • Ball</span>
              </div>
              ${standings
                .slice(0, 6)
                .map((row) => {
                  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`;
                  const isMe = userState && String(row.id) === String(userState.id);
                  return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-top:1px solid rgba(255,255,255,0.06); color:${isMe ? '#4ade80' : '#fff8e7'}; font-weight:${isMe ? '800' : '600'};">
                    <span>${medal} ${row.name} ${row.streak >= 2 ? '🔥' : ''}</span>
                    <span>${row.games} o'yin • <b style="color:#fde047;">${row.score} ball</b></span>
                  </div>
                `;
                })
                .join('')}
            </div>`
            : '';

        return `
          <div class="glass-card gold-border">
            <div class="tour-header">
              <div style="flex:1; min-width:0;">
                <div class="tour-title">${title}</div>
                <span style="font-size:11px; color:var(--text-muted)">
                  ${tour.game === 'chess' ? '♔ Shaxmat' : '⚫ Shashka'} • ${t('entryFee')}: <b style="color:#fde047;">${feeLabel}</b> • ⏱ ${durMin} daqiqa
                </span>
              </div>
              <div class="tour-prize" style="flex-shrink:0;">🏆 ${tour.prizePool} ${unit}</div>
            </div>

            <div style="background:rgba(28,16,6,0.65); border:1px solid rgba(168,118,66,0.35); border-radius:11px; padding:8px 10px; margin:8px 0; font-size:11px; color:#e7cfa1;">
              <div style="font-weight:800; color:#fde047; margin-bottom:4px;">📋 Qatnashish shartlari (Lichess Arena • 100% Jonli):</div>
              <div>1️⃣ 📢 Rasmiy kanal va guruhga obuna (@ChessTonArena)</div>
              <div>
                2️⃣ ${refsOk ? '✅' : '🔒'} Kamida <b>${minRefs} ta do'st</b> taklif qilish
                <span style="color:${refsOk ? '#4ade80' : '#fca5a5'}; font-weight:800;">(Sizda: ${myRefs}/${minRefs})</span>
              </div>
              <div style="margin-top:3px; color:#fde047;">🎯 G'alaba = <b>+3 ball</b> • 🔥 Ketma-ket g'alaba = <b>+4 ball</b> • Durang = <b>+1 ball</b></div>
            </div>

            <div style="margin: 8px 0 6px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; color:#fde047; font-weight:800; margin-bottom:4px; gap:6px;">
                <span class="tour-countdown-val" data-status="${tour.status || 'open'}" data-starts="${startsAt}" data-ends="${endsAt}">${countdownInitial}</span>
                <span style="color:#f5c451; flex-shrink:0;">Min: ${curP}/${minP}</span>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#10b981,#f5c451);"></div>
              </div>
            </div>

            ${standingsHtml}

            <div class="tour-meta">
              <span>👥 ${curP}/${maxP} ${isJoined ? `• 🎮 ${myPlayed} o'yin • 🏅 <b style="color:#fde047;">${myScore} ball</b>` : ''}</span>
              <button class="btn-gold-sm" onclick="joinTournament('${tour.id}')">
                ${
                  !isJoined
                    ? "🏆 Ro'yxatdan o'tish"
                    : !isActive
                      ? "✅ Ro'yxatdasiz (20:00 da)"
                      : "⚔️ Keyingi Raqib Bilan O'ynash"
                }
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function syncAdsgramTaskVisibility() {
    const taskEl = document.getElementById('adsgramTaskEl');
    const container = document.getElementById('adsgramTaskContainer');
    if (!taskEl || !container) return;

    const shadow = taskEl.shadowRoot;
    if (!shadow) {
      container.style.display = 'none';
      return;
    }

    const skeleton = shadow.querySelector('[class*="skeleton"]');
    const titleP = shadow.querySelector('p') || shadow.querySelector('[class*="title"]');
    const hasLoadedTitle = Boolean(titleP && titleP.textContent && titleP.textContent.trim().length > 0);

    if (hasLoadedTitle && !skeleton) {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  function initAdsgramTaskComponent() {
    const taskEl = document.getElementById('adsgramTaskEl');
    const container = document.getElementById('adsgramTaskContainer');
    if (!taskEl || !container) return;

    const blockId = String(appConfig.adsgramTaskBlockId || 'task-58978');
    if (taskEl.getAttribute('data-block-id') !== blockId) {
      taskEl.setAttribute('data-block-id', blockId);
    }

    if (!taskEl._hasEventListener) {
      taskEl._hasEventListener = true;

      taskEl.addEventListener('reward', () => {
        sendWs('CLAIM_TASK', { taskId: 'adsgram_official_task' });
        showToast('🎁 AdsGram topshirig\'i uchun +10 G mukofot berildi!');
        setTimeout(syncAdsgramTaskVisibility, 300);
      });

      ['onError', 'onBannerNotFound', 'onTooLongSession'].forEach((evt) => {
        taskEl.addEventListener(evt, () => {
          setTimeout(syncAdsgramTaskVisibility, 50);
        });
      });

      const attachObserver = () => {
        if (taskEl.shadowRoot && !taskEl._shadowObserver) {
          taskEl._shadowObserver = new MutationObserver(() => {
            syncAdsgramTaskVisibility();
          });
          taskEl._shadowObserver.observe(taskEl.shadowRoot, {
            childList: true,
            subtree: true,
            characterData: true
          });
          syncAdsgramTaskVisibility();
          return true;
        }
        return Boolean(taskEl._shadowObserver);
      };

      if (!attachObserver()) {
        let tries = 0;
        const waitShadow = setInterval(() => {
          tries++;
          if (attachObserver() || tries >= 20) {
            clearInterval(waitShadow);
          }
        }, 300);
      }
    }

    syncAdsgramTaskVisibility();
  }

  function renderTasks(tasks) {
    initAdsgramTaskComponent();
    const container = document.getElementById('tasksList');
    if (!container) return;
    const doneList = (userState && userState.completedTasks) || [];

    const visibleTasks = tasks.filter((t) => t.id !== 'adsgram_official_task');
    container.innerHTML = visibleTasks
      .map((task) => {
        const rawTitle = (task.title && task.title[currentLang]) || task.title.uz || '';
        const cleanTitle = rawTitle
          .replace(/^[^\w\u0400-\u04FF]+/, '')
          .replace(/\s*\(@[^)]+\)/g, '')
          .replace(/\s*\(ADSGRAM\)/gi, '')
          .trim()
          .toUpperCase();
        const isDone = task.type === 'channel' && doneList.includes(task.id);
        const ico = task.type === 'ad' ? '📺' : (task.type === 'adsgram_task' ? '🎯' : '🔗');
        const subExtra =
          task.type === 'ad'
            ? '• video reklama'
            : task.type === 'adsgram_task'
              ? '• hamkor vazifasi'
              : task.channelUsername
                ? `• ${task.channelUsername}`
                : '• kanalga obuna';
        return `
          <div class="gramora-task-card">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <div class="gramora-task-ico">${ico}</div>
              <div style="flex:1; min-width:0;">
                <div class="gramora-task-title">${cleanTitle || rawTitle}</div>
                <div class="gramora-task-sub">
                  <span>+${task.rewardCoins}</span>
                  <span class="gsh-coin-3d sm">G</span>
                  <span>${subExtra}</span>
                </div>
              </div>
            </div>
            <button
              class="gramora-parchment-btn"
              ${isDone ? 'disabled' : ''}
              onclick="handleTaskAction('${task.id}', '${task.type}', '${task.channelUsername || ''}')"
            >
              ${isDone ? t('completedBadge') : 'BOSHLASH'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  let currentLeaderboardGame = 'checkers';
  let cachedLeaderboards = {};

  window.setLeaderboardTab = (game) => {
    currentLeaderboardGame = game;
    ['checkers', 'chess', 'zakovat', 'ludo'].forEach((g) => {
      const btn = document.getElementById(`lbTab-${g}`);
      if (btn) {
        if (g === game) {
          btn.style.background = 'linear-gradient(180deg, #d4af37 0%, #aa820a 100%)';
          btn.style.color = '#1f160b';
          btn.style.borderColor = '#ffe57f';
          btn.style.boxShadow = '0 0 10px rgba(212,175,55,0.4)';
        } else {
          btn.style.background = 'rgba(23, 16, 11, 0.7)';
          btn.style.color = '#e7cfa1';
          btn.style.borderColor = 'rgba(212, 175, 55, 0.25)';
          btn.style.boxShadow = 'none';
        }
      }
    });
    if (cachedLeaderboards[game]) {
      renderLeaderboard(cachedLeaderboards[game]);
    } else {
      sendWs('GET_LEADERBOARD', { game });
    }
  };

  function renderLeaderboard(list) {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    if (!list || !list.length) {
      container.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); font-size:12px; padding:20px;">Hali hech kim o'ynamagan</div>`;
      return;
    }
    container.innerHTML = list
      .map((item) => {
        const badge = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`;
        return `
          <div class="gramora-task-card" style="padding:11px 14px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
              <div class="gramora-task-ico" style="font-size:18px; font-weight:900; color:#fde047;">${badge}</div>
              <div style="flex:1; min-width:0;">
                <div class="gramora-task-title">${item.name}</div>
                <div class="gramora-task-sub">🛡 Trust: ${item.trustScore}% • 🏆 ${item.wins} g'alaba</div>
              </div>
            </div>
            <div class="gramora-parchment-btn" style="padding:7px 12px; font-size:12px; pointer-events:none; flex-shrink:0;">${item.elo} ELO</div>
          </div>
        `;
      })
      .join('');
  }

  function renderConversions(list) {
    const container = document.getElementById('conversionsHistoryList');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); font-size:12px;">${t('noHistory')}</div>`;
      return;
    }
    container.innerHTML = list
      .map(
        (c) => `
        <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px;">
          <div>
            <div style="font-weight:700; font-size:13px;">-${c.coinsAmount} G → ${c.payoutValue}</div>
            <div style="font-size:11px; color:var(--text-muted);">${c.destination}</div>
          </div>
          <span style="font-size:11px; font-weight:700; color:${c.status === 'completed' ? '#10b981' : '#f5c451'}">
            ${c.status === 'completed' ? '✅ Completed' : '⏳ Tekshiruvda'}
          </span>
        </div>
      `
      )
      .join('');
  }

  function renderReferralMilestones() {
    const listEl = document.getElementById('milestonesList');
    const countLbl = document.getElementById('refMilestoneCountLabel');
    if (!listEl || !userState) return;

    const myRefs = userState.referralCount || 0;
    if (countLbl) countLbl.textContent = `${myRefs} Do'st taklif qilindi`;

    const claimed = userState.claimedRefMilestones || [];
    const milestones = refMilestones && refMilestones.length ? refMilestones : [
      { count: 1, reward: 15, title: "1 ta do'st", desc: "+15 G bonus" },
      { count: 3, reward: 50, title: "3 ta do'st", desc: "+50 G bonus" },
      { count: 5, reward: 120, vipDays: 7, title: "5 ta do'st", desc: "+120 G va 7 kunlik VIP Status 👑" },
      { count: 10, reward: 300, unlockSkin: 'board_gold', title: "10 ta do'st", desc: '+300 G va "Qirollik Oltini" taxtasi 👑' }
    ];

    listEl.innerHTML = milestones.map((m) => {
      const isClaimed = claimed.includes(m.count);
      const isUnlocked = myRefs >= m.count;

      let actionBtn = '';
      if (isClaimed) {
        actionBtn = `<button class="shop-btn btn-equipped" style="width:auto; padding:6px 12px;" disabled>Olingan ✓</button>`;
      } else if (isUnlocked) {
        actionBtn = `<button class="btn-gold-sm" style="padding:6px 14px;" onclick="claimRefMilestone(${m.count})">🎁 Olish</button>`;
      } else {
        actionBtn = `<span style="font-size:11px; color:var(--text-muted); font-weight:700;">${myRefs}/${m.count}</span>`;
      }

      return `
        <div class="milestone-card ${isClaimed ? 'claimed' : isUnlocked ? 'unlocked' : ''}">
          <div>
            <div style="font-size:13px; font-weight:800; color:${isUnlocked ? 'var(--gold-bright)' : '#fff'};">${m.title}</div>
            <div style="font-size:11px; color:var(--text-muted);">${m.desc}</div>
          </div>
          <div>${actionBtn}</div>
        </div>
      `;
    }).join('');
  }

  function renderShopItems() {
    const grid = document.getElementById('shopItemsGrid');
    if (!grid || !userState) return;

    const catalog = shopCatalog && shopCatalog.length ? shopCatalog : [
      { id: 'board_classic', type: 'board', skinKey: 'classic', title: '🪵 Klassik Yog\'och', price: 0, desc: 'Standart tabiiy yog\'och taxta' },
      { id: 'board_ice', type: 'board', skinKey: 'ice', title: '❄️ Qishki Muz', price: 150, desc: 'Muzdek moviy kristall taxta' },
      { id: 'board_neon', type: 'board', skinKey: 'neon', title: '⚡ Kiberpank Neon', price: 300, desc: 'Zumrad va kiber-neon chiroqlar' },
      { id: 'board_gold', type: 'board', skinKey: 'gold', title: '👑 Qirollik Oltini', price: 600, desc: 'Qora marmar va 24k oltin jilo' },
      { id: 'piece_classic', type: 'piece', skinKey: 'classic', title: '⚪ Standart Donalar', price: 0, desc: 'Klassik shaxmat va shashka toshlari' },
      { id: 'piece_neon', type: 'piece', skinKey: 'neon', title: '💎 Neon Donalar', price: 200, desc: 'Yaltiroq kiber donalar' },
      { id: 'piece_gold', type: 'piece', skinKey: 'gold', title: '🥇 Oltin Donalar', price: 450, desc: 'Qirollik oltin toshlari' },
      { id: 'vip_7d', type: 'vip', title: '👑 VIP Status (7 kun)', price: 500, desc: '2x kunlik bonus, Oltin Toj va eksklyuziv status' }
    ];

    const filtered = catalog.filter((it) => it.type === activeShopTab);
    const owned = userState.ownedSkins || ['board_classic', 'piece_classic'];
    const curBoard = userState.equippedBoardSkin || 'classic';
    const curPiece = userState.equippedPieceSkin || 'classic';

    grid.innerHTML = filtered.map((it) => {
      let isEquipped = false;
      let isOwned = false;

      if (it.type === 'board') {
        isEquipped = curBoard === it.skinKey;
        isOwned = owned.includes(it.id);
      } else if (it.type === 'piece') {
        isEquipped = curPiece === it.skinKey;
        isOwned = owned.includes(it.id);
      } else if (it.type === 'vip') {
        isEquipped = Boolean(userState.isVip);
        isOwned = isEquipped;
      }

      let miniPreview = '';
      if (it.type === 'board') {
        const k = it.skinKey;
        miniPreview = `
          <div class="shop-mini-board">
            <div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div>
            <div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div>
            <div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div>
            <div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div><div class="sm-cell dark-${k}"></div><div class="sm-cell light-${k}"></div>
          </div>
        `;
      } else if (it.type === 'piece') {
        const icon = it.skinKey === 'gold' ? '👑 🥇' : it.skinKey === 'neon' ? '💎 ⚡' : '♔ ⚫';
        miniPreview = `<div style="font-size:36px; height:72px; display:flex; align-items:center; justify-content:center;">${icon}</div>`;
      } else if (it.type === 'vip') {
        miniPreview = `<div style="font-size:42px; height:72px; display:flex; align-items:center; justify-content:center;">👑</div>`;
      }

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="shop-btn btn-equipped">✅ O'rnatilgan</button>`;
      } else if (isOwned && it.type !== 'vip') {
        btnHtml = `<button class="shop-btn btn-equip" onclick="equipShopItem('${it.id}')">⚡ O'rnatish</button>`;
      } else {
        const priceTxt = it.price === 0 ? "Bepul" : `${it.price} G 🪙`;
        btnHtml = `<button class="shop-btn btn-buy" onclick="buyShopItem('${it.id}')">${priceTxt}</button>`;
      }

      return `
        <div class="shop-card ${isEquipped ? 'equipped' : isOwned ? 'owned' : ''}">
          ${miniPreview}
          <div class="shop-item-title">${it.title}</div>
          <div class="shop-item-desc">${it.desc}</div>
          ${btnHtml}
        </div>
      `;
    }).join('');
  }

  // Activate Gramora full-screen HUD on initial load
  document.body.classList.add('in-lobby-hud');

  // Global UI Handlers
  window.switchNav = (tab) => {
    if (tab === 'admin' && (!userState || !userState.isAdmin)) return;
    if (tab === 'shop') {
      renderShopItems();
    }
    if (tab === 'tasks') {
      syncAdsgramTaskVisibility();
    }
    document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
    const targetSec = document.getElementById(`view-${tab}`);
    if (targetSec) targetSec.classList.add('active');

    if (tab === 'rating') {
      window.setLeaderboardTab(selectedGame || 'checkers');
    }
    const isPlayingMatch = Boolean(currentMatch && currentMatch.status === 'playing' && document.getElementById('matchPanel').classList.contains('active'));
    if (tab === 'arena' && !isPlayingMatch) {
      document.body.classList.add('in-lobby-hud');
    } else {
      document.body.classList.remove('in-lobby-hud');
    }

    // Ensure bottom nav is visible when navigating between sub-tabs (hidden in full-screen lobby HUD via CSS)
    const bNav = document.querySelector('.bottom-nav');
    if (bNav && !isPlayingMatch) {
      bNav.style.display = 'flex';
    }

    document.querySelectorAll('.nav-item').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-nav') === tab);
    });
  };

  window.openPlaySetupModal = () => {
    const m = document.getElementById('playSetupModal');
    if (m) m.classList.add('active');
  };

  window.closePlaySetupModal = () => {
    const m = document.getElementById('playSetupModal');
    if (m) m.classList.remove('active');
  };

  window.openDailyBonusModal = () => {
    const m = document.getElementById('dailyBonusModal');
    if (m) m.classList.add('active');
  };

  window.closeDailyBonusModal = () => {
    const m = document.getElementById('dailyBonusModal');
    if (m) m.classList.remove('active');
  };

  window.openDepositView = () => {
    window.switchNav('convert');
    if (typeof window.switchConvertSubTab === 'function') {
      window.switchConvertSubTab('topup');
    }
  };

  window.openCashoutView = () => {
    window.switchNav('convert');
    if (typeof window.switchConvertSubTab === 'function') {
      window.switchConvertSubTab('cashout');
    }
  };

  window.openLangModal = () => {
    document.getElementById('langModal').classList.add('active');
  };

  window.chooseLanguage = (lang) => {
    currentLang = lang;
    localStorage.setItem('arena_lang', lang);
    document.getElementById('langModal').classList.remove('active');
    applyTranslations();
    sendWs('CHANGE_LANG', { lang });
  };

  window.selectGameMode = (game) => {
    selectedGame = game;
    const cChk = document.getElementById('cardCheckers');
    const cChs = document.getElementById('cardChess');
    const cZk = document.getElementById('cardZakovat');
    const cLu = document.getElementById('cardLudo');
    if (cChk) cChk.classList.toggle('selected', game === 'checkers');
    if (cChs) cChs.classList.toggle('selected', game === 'chess');
    if (cZk) cZk.classList.toggle('selected', game === 'zakovat');
    if (cLu) cLu.classList.toggle('selected', game === 'ludo');
    const mChk = document.getElementById('modalBtnCheckers');
    const mChs = document.getElementById('modalBtnChess');
    const mZk = document.getElementById('modalBtnZakovat');
    const mLu = document.getElementById('modalBtnLudo');
    if (mChk) mChk.classList.toggle('active', game === 'checkers');
    if (mChs) mChs.classList.toggle('active', game === 'chess');
    if (mZk) mZk.classList.toggle('active', game === 'zakovat');
    if (mLu) mLu.classList.toggle('active', game === 'ludo');
    renderHeaderUser();
  };

  window.selectStake = (stake) => {
    selectedStake = Number(stake);
    document.querySelectorAll('.stake-card').forEach((c) => {
      c.classList.toggle('selected', Number(c.getAttribute('data-stake')) === selectedStake);
    });
  };

  window.selectBotDifficulty = (diff) => {
    if (!['easy', 'medium', 'hard'].includes(diff)) diff = 'medium';
    selectedBotDifficulty = diff;
    localStorage.setItem('arena_bot_diff', diff);
    document.querySelectorAll('.bot-diff-card').forEach((c) => {
      c.classList.toggle('selected', c.getAttribute('data-diff') === diff);
    });
  };

  window.startMatchmaking = () => {
    sendWs('QUEUE_JOIN', { game: selectedGame, stake: selectedStake, botDifficulty: selectedBotDifficulty });
  };

  window.startPracticeVsBot = () => {
    sendWs('PLAY_BOT_DIRECT', { game: selectedGame, botDifficulty: selectedBotDifficulty });
  };

  window.cancelMatchmaking = () => {
    sendWs('QUEUE_CANCEL');
    if (currentDuelId) {
      sendWs('DUEL_CANCEL', { duelId: currentDuelId });
      currentDuelId = null;
    }
    document.getElementById('queueModal').classList.remove('active');
  };

  window.resignMatch = () => {
    if (currentMatch) {
      sendWs('RESIGN', { matchId: currentMatch.matchId });
    }
  };

  window.sendEmoji = (emoji) => {
    if (currentMatch) {
      sendWs('EMOJI', { matchId: currentMatch.matchId, emoji });
    }
  };

  window.toggleEmojiPicker = (e) => {
    if (e) e.stopPropagation();
    const popup = document.getElementById('emojiPickerPopup');
    if (popup) popup.classList.toggle('active');
  };

  window.closeEmojiPicker = (e) => {
    if (e) e.stopPropagation();
    const popup = document.getElementById('emojiPickerPopup');
    if (popup) popup.classList.remove('active');
  };

  window.pickEmoji = (emoji) => {
    window.sendEmoji(emoji);
    window.closeEmojiPicker();
  };

  document.addEventListener('click', (e) => {
    const popup = document.getElementById('emojiPickerPopup');
    const toggleBtn = document.getElementById('btnEmojiToggle');
    if (popup && popup.classList.contains('active')) {
      if (!popup.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        popup.classList.remove('active');
      }
    }
  });

  let currentZakovatRoom = null;
  let zkCountdownInterval = null;
  let currentLudoRoom = null;

  function stopZakovatCountdown() {
    if (zkCountdownInterval) {
      clearInterval(zkCountdownInterval);
      zkCountdownInterval = null;
    }
  }

  function renderZakovatScreen(data) {
    currentZakovatRoom = data;
    switchNav('arena');
    document.body.classList.remove('in-lobby-hud');
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('matchPanel').classList.remove('active');
    const ludoEl = document.getElementById('ludoPanel');
    if (ludoEl) ludoEl.style.display = 'none';
    const zkEl = document.getElementById('zakovatPanel');
    if (zkEl) zkEl.style.display = 'flex';

    const bNav = document.querySelector('.bottom-nav');
    if (bNav) bNav.style.display = 'none';

    const prizeBadge = document.getElementById('zkPrizeBadge');
    if (prizeBadge) {
      prizeBadge.textContent =
        data.stake > 0
          ? `🥇 1-O'RIN: +${data.prizeFirst} G | 🥈 2-O'RIN: +${data.prizeSecond} G`
          : `🧠 ZAKOVAT ARENA (Mashq • 0 G)`;
    }

    // 4-player live scoreboard
    const pBoard = document.getElementById('zkPlayersBoard');
    if (pBoard) {
      pBoard.innerHTML = (data.players || [])
        .map((p) => {
          const isMe = userState && String(p.id) === String(userState.id);
          const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '4️⃣';
          const statusIco = p.answeredCurrent ? '✅' : '⏳';
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-radius:10px; background:${isMe ? 'rgba(245,158,11,0.22)' : 'rgba(15,23,42,0.75)'}; border:1px solid ${isMe ? '#f59e0b' : 'rgba(255,255,255,0.12)'}; font-size:12px;">
              <span style="font-weight:800; color:${isMe ? '#fde047' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${medal} ${p.name} ${statusIco}</span>
              <span style="font-weight:900; color:#4ade80; flex-shrink:0;">${p.score} b</span>
            </div>
          `;
        })
        .join('');
    }

    const catEl = document.getElementById('zkCategoryBadge');
    if (catEl && data.question) catEl.textContent = data.question.cat || '🧠 Zakovat';
    const progEl = document.getElementById('zkProgressText');
    if (progEl) progEl.textContent = `Savol ${(data.qIndex || 0) + 1} / ${data.totalQuestions || 8}`;

    const qTextEl = document.getElementById('zkQuestionText');
    if (qTextEl && data.question) qTextEl.textContent = data.question.q;

    const optsGrid = document.getElementById('zkOptionsGrid');
    const letters = ['A', 'B', 'C', 'D'];
    const hidden = data.hiddenOpts || [];
    if (optsGrid && data.question) {
      optsGrid.innerHTML = (data.question.opts || [])
        .map((optText, idx) => {
          const isHidden = hidden.includes(idx) && data.phase === 'question';
          const isSelected = data.myChoice === idx;
          const isReveal = data.phase === 'reveal';
          const isCorrect = isReveal && data.correctIndex === idx;
          const isWrongSelected = isReveal && isSelected && data.correctIndex !== idx;

          let bg = 'rgba(30,41,59,0.88)';
          let border = 'rgba(255,255,255,0.16)';
          let color = '#f8fafc';
          if (isCorrect) {
            bg = 'linear-gradient(135deg, rgba(16,185,129,0.42), rgba(5,150,105,0.55))';
            border = '#10b981';
            color = '#ecfdf5';
          } else if (isWrongSelected) {
            bg = 'linear-gradient(135deg, rgba(239,68,68,0.42), rgba(185,28,28,0.55))';
            border = '#ef4444';
            color = '#fef2f2';
          } else if (isSelected) {
            bg = 'linear-gradient(135deg, rgba(245,158,11,0.35), rgba(217,119,6,0.45))';
            border = '#f59e0b';
            color = '#fef3c7';
          }

          return `
            <button
              onclick="answerZakovat(${idx})"
              ${data.myChoice !== null || isReveal || isHidden ? 'disabled' : ''}
              style="display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; border-radius:12px; background:${bg}; border:2px solid ${border}; color:${color}; font-size:14px; font-weight:700; text-align:left; cursor:pointer; opacity:${isHidden ? '0.22' : '1'}; transition:all 0.15s;"
            >
              <span style="width:26px; height:26px; border-radius:8px; background:rgba(0,0,0,0.35); display:inline-flex; align-items:center; justify-content:center; font-weight:900; color:#fde047; flex-shrink:0;">${letters[idx]}</span>
              <span style="flex:1;">${isHidden ? '— — —' : optText}</span>
              ${isCorrect ? '<span>✅</span>' : isWrongSelected ? '<span>❌</span>' : ''}
            </button>
          `;
        })
        .join('');
    }

    const statusBanner = document.getElementById('zkStatusBanner');
    if (statusBanner) {
      if (data.phase === 'reveal') {
        if (data.myPointsEarned > 0) {
          statusBanner.style.color = '#4ade80';
          statusBanner.textContent = `🎉 To'g'ri javob! +${data.myPointsEarned} ball oldingiz!`;
          playCorrectSound();
        } else if (data.myChoice === null) {
          statusBanner.style.color = '#fca5a5';
          statusBanner.textContent = `⌛ Vaqt tugadi! (+0 ball)`;
          playWrongSound();
        } else {
          statusBanner.style.color = '#fca5a5';
          statusBanner.textContent = `❌ Noto'g'ri javob! (+0 ball)`;
          playWrongSound();
        }
      } else if (data.myChoice !== null) {
        statusBanner.style.color = '#fde047';
        statusBanner.textContent = `⏳ Javobingiz qabul qilindi! Boshqa o'yinchilar kutilmoqda...`;
      } else {
        statusBanner.style.color = '#cbd5e1';
        statusBanner.textContent = `⚡ Qancha tez topsangiz, shuncha ko'p ball olasiz!`;
      }
    }

    const btnFifty = document.getElementById('btnZkFifty');
    if (btnFifty) {
      btnFifty.disabled = Boolean(data.usedFifty || data.myChoice !== null || data.phase !== 'question');
      btnFifty.textContent = data.usedFifty ? '💡 50/50 Ishlatildi' : '💡 50/50 Yordam';
    }

    stopZakovatCountdown();
    const timerEl = document.getElementById('zkTimerBadge');
    if (data.phase === 'question' && timerEl) {
      const updateZkClock = () => {
        const elapsed = (Date.now() - (data.qStartedAt || Date.now())) / 1000;
        const rem = Math.max(0, Math.ceil((data.timeLimitSec || 12) - elapsed));
        timerEl.textContent = `⏱ ${rem}s`;
      };
      updateZkClock();
      zkCountdownInterval = setInterval(updateZkClock, 300);
    } else if (timerEl) {
      timerEl.textContent = `✅ Natija`;
    }
  }

  window.answerZakovat = (optIndex) => {
    if (!currentZakovatRoom || currentZakovatRoom.phase !== 'question') return;
    playMoveSound();
    sendWs('ZAKOVAT_ANSWER', { roomId: currentZakovatRoom.roomId, optIndex });
  };

  window.useZakovatFifty = () => {
    if (!currentZakovatRoom || currentZakovatRoom.phase !== 'question') return;
    sendWs('ZAKOVAT_FIFTY', { roomId: currentZakovatRoom.roomId });
  };

  window.leaveZakovatMatch = () => {
    if (currentZakovatRoom) {
      sendWs('ZAKOVAT_LEAVE', { roomId: currentZakovatRoom.roomId });
    }
    stopZakovatCountdown();
    currentZakovatRoom = null;
    window.closeGameOverModal();
  };

  async function triggerPostMatchAdsgram() {
    if (!window.Adsgram) return;
    try {
      const blockId = String(appConfig.adsgramInterstitialBlockId || 'int-58970');
      const AdController = window.Adsgram.init({ blockId });
      await AdController.show();
      sendWs('AD_IMPRESSION', { action: 'post_match_game_over' });
    } catch (err) {
      console.warn('Post-match AdsGram ad skipped or not available:', err);
    }
  }

  function showZakovatOver(data) {
    stopZakovatCountdown();
    currentZakovatRoom = null;
    const modal = document.getElementById('gameOverModal');
    const icon = document.getElementById('goIcon');
    const title = document.getElementById('goTitle');
    const sub = document.getElementById('goSub');

    const standings = data.standings || [];
    const me = standings.find((s) => userState && String(s.id) === String(userState.id)) || standings[0] || { rank: 1, score: 0, prizeWon: 0 };

    if (me.rank === 1) {
      icon.textContent = '🥇';
      title.textContent = `1-O'RIN! G'ALABA!`;
      playWinSound();
    } else if (me.rank === 2) {
      icon.textContent = '🥈';
      title.textContent = `2-O'RIN! SOVRINDOR!`;
      playWinSound();
    } else {
      icon.textContent = '🧠';
      title.textContent = `${me.rank}-O'RIN`;
      playGameOverSound();
    }

    const tableTxt = standings
      .map((s) => `${s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : '4️⃣'} ${s.name}: ${s.score} ball${s.prizeWon > 0 ? ` (+${s.prizeWon} G)` : ''}`)
      .join('  •  ');
    sub.textContent = `${me.prizeWon > 0 ? `+${me.prizeWon} G Yutdingiz! • ` : ''}${tableTxt}`;

    const dw = document.getElementById('goDoubleWinBox');
    if (dw) dw.style.display = 'none';
    const lp = document.getElementById('goLossProtectBox');
    if (lp) lp.style.display = 'none';
    modal.classList.add('active');

    // Trigger AdsGram ad upon finishing Zakovat
    setTimeout(() => triggerPostMatchAdsgram(), 300);
  }

  // ==========================================================================
  // 🎲 AUTHENTIC 15x15 LUDO KING RENDERER & ACTIONS
  // ==========================================================================
  const LUDO_COLOR_HEX = {
    red: '#ed1c24',
    green: '#00a651',
    yellow: '#ffde00',
    blue: '#00aeef'
  };

  function createLudoPinSvg(color) {
    const fillHex = LUDO_COLOR_HEX[color] || '#ed1c24';
    return `
      <svg viewBox="0 0 32 42" width="100%" height="100%" style="display:block;">
        <path d="M16 2 C8 2 2 8.2 2 16 C2 24.5 16 39 16 39 C16 39 30 24.5 30 16 C30 8.2 24 2 16 2 Z" fill="#ffffff" stroke="#1e293b" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="16" cy="15.5" r="8.8" fill="${fillHex}" stroke="#1e293b" stroke-width="1.6"/>
        <ellipse cx="13" cy="12.5" rx="3" ry="2" fill="rgba(255,255,255,0.45)"/>
      </svg>
    `;
  }

  function renderRedDicePips(diceVal) {
    const val = Number(diceVal) || 5;
    // 3x3 grid positions (0..8) for standard dice faces 1..6
    const pipMap = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };
    const active = new Set(pipMap[val] || pipMap[5]);
    let html = '';
    for (let i = 0; i < 9; i++) {
      html += active.has(i) ? `<span class="lk-pip"></span>` : `<span></span>`;
    }
    return html;
  }

  function renderLudoScreen(data) {
    currentLudoRoom = data;
    switchNav('arena');
    document.body.classList.remove('in-lobby-hud');
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('matchPanel').classList.remove('active');
    const zkEl = document.getElementById('zakovatPanel');
    if (zkEl) zkEl.style.display = 'none';
    const ludoEl = document.getElementById('ludoPanel');
    if (ludoEl) ludoEl.style.display = 'flex';

    const bNav = document.querySelector('.bottom-nav');
    if (bNav) bNav.style.display = 'none';

    const prizeBadge = document.getElementById('ludoPrizeBadge');
    if (prizeBadge) {
      prizeBadge.textContent = data.prizePool > 0 ? `🏆 +${data.prizePool} G` : `🎲 LUDO KING (0 G)`;
    }

    const isMyTurn = data.turnColor === 'red';
    const evBanner = document.getElementById('ludoEventBanner');
    if (evBanner) {
      evBanner.textContent =
        data.lastEvent || (isMyTurn ? "🔴 Sizning navbatingiz! Zarni bosing" : `⏳ ${data.turnLabel} o'ynamoqda...`);
    }

    // Bottom Dock (You | 3D Red Dice | Opponent)
    const leftPin = document.querySelector('#lkDockLeft .lk-dock-pin');
    if (leftPin) leftPin.innerHTML = createLudoPinSvg('red');
    const rightPin = document.getElementById('lkOppPin');
    const oppLbl = document.getElementById('lkOppLabel');
    const curPlayer = (data.players || []).find((p) => p.color === data.turnColor);
    const displayOppColor = isMyTurn ? 'yellow' : data.turnColor;
    if (rightPin) rightPin.innerHTML = createLudoPinSvg(displayOppColor);
    if (oppLbl) {
      oppLbl.textContent = isMyTurn ? 'Com' : (curPlayer ? curPlayer.name.slice(0, 8) : 'Com');
    }

    const rollBtn = document.getElementById('btnLudoRoll');
    const pipsEl = document.getElementById('ludoDicePips');
    if (pipsEl) {
      pipsEl.innerHTML = renderRedDicePips(data.dice || 5);
    }
    if (rollBtn) {
      const canRoll = isMyTurn && data.phase === 'roll';
      rollBtn.disabled = !canRoll;
      rollBtn.style.boxShadow = canRoll
        ? '0 0 18px #facc15, 0 4px 12px rgba(0,0,0,0.6), inset 0 2px 4px #fff'
        : '0 4px 12px rgba(0,0,0,0.55), inset 0 2px 4px #fff';
    }

    // Build 15x15 Ludo King Board
    const grid = document.getElementById('ludoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Map board tokens (`step >= 0`) by cell key `r_c`
    const cellTokens = {};
    const tc = data.tokenCoords || {};
    for (const c of ['red', 'green', 'yellow', 'blue']) {
      for (const tk of tc[c] || []) {
        if (!tk.coords) continue;
        const key = `${tk.coords[0]}_${tk.coords[1]}`;
        cellTokens[key] = cellTokens[key] || [];
        cellTokens[key].push({ color: c, tokenIdx: tk.tokenIdx, step: tk.step });
      }
    }

    // 1. Add the 4 Corner 6x6 Home Yards (`green`, `yellow`, `red`, `blue`)
    const playersByColor = {};
    (data.players || []).forEach((p) => {
      playersByColor[p.color] = p;
    });

    for (const yColor of ['green', 'yellow', 'red', 'blue']) {
      const yard = document.createElement('div');
      yard.className = `lk-yard ${yColor} ${data.turnColor === yColor ? 'active-turn' : ''}`;

      const lbl = document.createElement('div');
      lbl.className = 'lk-yard-label';
      const pObj = playersByColor[yColor];
      lbl.textContent = yColor === 'red' ? 'You' : (pObj ? pObj.name : 'Computer');
      yard.appendChild(lbl);

      const whiteBox = document.createElement('div');
      whiteBox.className = 'lk-yard-white-box';

      const colorTokens = (data.tokens && data.tokens[yColor]) || [0, -1, -1, -1];
      for (let tIdx = 0; tIdx < 4; tIdx++) {
        const spot = document.createElement('div');
        spot.className = 'lk-yard-spot';

        // If this token is still in the Yard (`step === -1`), render its Pin inside this circle!
        if (colorTokens[tIdx] === -1) {
          const isMovable =
            isMyTurn &&
            data.phase === 'move' &&
            yColor === 'red' &&
            (data.legalTokens || []).includes(tIdx);

          const pinWrap = document.createElement('div');
          pinWrap.className = `lk-pin-wrap ${isMovable ? 'movable' : ''}`;
          pinWrap.innerHTML = createLudoPinSvg(yColor);
          if (isMovable) {
            pinWrap.addEventListener('pointerdown', (e) => {
              e.stopPropagation();
              window.moveLudoToken(tIdx);
            });
          }
          spot.appendChild(pinWrap);
        }

        whiteBox.appendChild(spot);
      }

      yard.appendChild(whiteBox);
      grid.appendChild(yard);
    }

    // 2. Add the Center 3x3 Home Triangle Pinwheel (`rows 6..8, cols 6..8`)
    const centerHome = document.createElement('div');
    centerHome.className = 'lk-center-home';
    centerHome.innerHTML = `
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style="display:block;">
        <polygon points="0,0 50,50 0,100" fill="#00a651" stroke="#1e293b" stroke-width="2"/>
        <polygon points="0,0 100,0 50,50" fill="#ffde00" stroke="#1e293b" stroke-width="2"/>
        <polygon points="100,0 100,100 50,50" fill="#00aeef" stroke="#1e293b" stroke-width="2"/>
        <polygon points="0,100 100,100 50,50" fill="#ed1c24" stroke="#1e293b" stroke-width="2"/>
      </svg>
    `;
    // Render any finished tokens inside the center home
    const finishedPockets = [
      { key: '8_7', top: '66%', left: '50%' },
      { key: '7_6', top: '50%', left: '26%' },
      { key: '6_7', top: '26%', left: '50%' },
      { key: '7_8', top: '50%', left: '74%' }
    ];
    finishedPockets.forEach((pk) => {
      const fTks = cellTokens[pk.key] || [];
      if (fTks.length > 0) {
        const holder = document.createElement('div');
        holder.style.cssText = `position:absolute; top:${pk.top}; left:${pk.left}; transform:translate(-50%,-50%); display:flex; gap:1px; z-index:6;`;
        fTks.forEach((tk) => {
          const pw = document.createElement('div');
          pw.className = 'lk-pin-wrap sm';
          pw.innerHTML = createLudoPinSvg(tk.color);
          holder.appendChild(pw);
        });
        centerHome.appendChild(holder);
      }
    });
    grid.appendChild(centerHome);

    // 3. Add the 72 Track & Home Stretch Cells
    const starSet = new Set(['8_2', '2_6', '6_12', '12_8']);
    const arrowMap = {
      '14_7': { char: '↑', color: '#ed1c24' },
      '7_0': { char: '→', color: '#00a651' },
      '0_7': { char: '↓', color: '#ffde00' },
      '7_14': { char: '←', color: '#00aeef' }
    };

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Skip the four 6x6 Yards and the 3x3 Center Home
        if (r < 6 && c < 6) continue;
        if (r < 6 && c >= 9) continue;
        if (r >= 9 && c < 6) continue;
        if (r >= 9 && c >= 9) continue;
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

        const key = `${r}_${c}`;
        const cell = document.createElement('div');
        cell.className = 'lk-cell';
        cell.style.gridRow = String(r + 1);
        cell.style.gridColumn = String(c + 1);

        // Colored Start Squares & 5-Cell Home Stretch Lanes
        if ((r === 13 && c === 6) || (c === 7 && r >= 9 && r <= 13)) {
          cell.classList.add('path-red');
        } else if ((r === 6 && c === 1) || (r === 7 && c >= 1 && c <= 5)) {
          cell.classList.add('path-green');
        } else if ((r === 1 && c === 8) || (c === 7 && r >= 1 && r <= 5)) {
          cell.classList.add('path-yellow');
        } else if ((r === 8 && c === 13) || (r === 7 && c >= 9 && c <= 13)) {
          cell.classList.add('path-blue');
        }

        // Hollow Star SVG on the 4 Star Safe Squares
        if (starSet.has(key)) {
          cell.innerHTML = `
            <svg viewBox="0 0 24 24" width="76%" height="76%" fill="none" stroke="#475569" stroke-width="1.8" style="position:absolute; pointer-events:none;">
              <polygon points="12,2 15,9 22,9.5 16.5,14.2 18.2,21.5 12,17.5 5.8,21.5 7.5,14.2 2,9.5 9,9"/>
            </svg>
          `;
        } else if (arrowMap[key]) {
          const ar = arrowMap[key];
          cell.innerHTML = `<span style="font-size:13px; font-weight:900; color:${ar.color}; line-height:1; pointer-events:none;">${ar.char}</span>`;
        }

        // Render any tokens on this cell
        const tks = cellTokens[key] || [];
        if (tks.length > 0) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:1px; z-index:5;';
          tks.forEach((tk) => {
            const isMovable =
              isMyTurn &&
              data.phase === 'move' &&
              tk.color === 'red' &&
              (data.legalTokens || []).includes(tk.tokenIdx);

            const pin = document.createElement('div');
            pin.className = `lk-pin-wrap ${tks.length > 1 ? 'sm' : ''} ${isMovable ? 'movable' : ''}`;
            pin.innerHTML = createLudoPinSvg(tk.color);
            if (isMovable) {
              pin.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                window.moveLudoToken(tk.tokenIdx);
              });
            }
            wrap.appendChild(pin);
          });
          cell.appendChild(wrap);
        }

        grid.appendChild(cell);
      }
    }
  }

  window.rollLudoDice = () => {
    if (!currentLudoRoom || currentLudoRoom.phase !== 'roll') return;
    playDiceSound();
    sendWs('LUDO_ROLL', { roomId: currentLudoRoom.roomId });
  };

  window.moveLudoToken = (tokenIdx) => {
    if (!currentLudoRoom || currentLudoRoom.phase !== 'move') return;
    playLudoPawnSound();
    sendWs('LUDO_MOVE', { roomId: currentLudoRoom.roomId, tokenIdx });
  };

  window.leaveLudoMatch = () => {
    if (currentLudoRoom) {
      sendWs('LUDO_LEAVE', { roomId: currentLudoRoom.roomId });
    }
    currentLudoRoom = null;
    window.closeGameOverModal();
  };

  function showLudoOver(data) {
    currentLudoRoom = null;
    const modal = document.getElementById('gameOverModal');
    const icon = document.getElementById('goIcon');
    const title = document.getElementById('goTitle');
    const sub = document.getElementById('goSub');

    if (data.isYouWinner) {
      icon.textContent = '🏆';
      title.textContent = `LUDO G'OLIBI!`;
      sub.textContent = data.prizePool > 0 ? `+${data.prizePool} G Yutdingiz! • +15 ELO` : `Mashq g'alabasi! +15 ELO`;
      playWinSound();
    } else {
      icon.textContent = '🎲';
      title.textContent = `${data.winnerName} Yutdi`;
      sub.textContent = `Keyingi safar omad! (-9 ELO)`;
      playGameOverSound();
    }

    const dw = document.getElementById('goDoubleWinBox');
    if (dw) dw.style.display = 'none';
    const lp = document.getElementById('goLossProtectBox');
    if (lp) lp.style.display = 'none';
    modal.classList.add('active');

    // Trigger AdsGram ad upon finishing Zakovat
    setTimeout(() => triggerPostMatchAdsgram(), 300);
  }

  window.closeGameOverModal = () => {
    lastGameOverData = null;
    currentHint = null;
    stopZakovatCountdown();
    document.getElementById('gameOverModal').classList.remove('active');
    document.getElementById('matchPanel').classList.remove('active');
    const zkEl = document.getElementById('zakovatPanel');
    if (zkEl) zkEl.style.display = 'none';
    const ludoEl = document.getElementById('ludoPanel');
    if (ludoEl) ludoEl.style.display = 'none';
    document.getElementById('lobbyPanel').style.display = 'flex';
    document.body.classList.add('in-lobby-hud');
    const bNav = document.querySelector('.bottom-nav');
    if (bNav) bNav.style.display = 'flex';
  };

  window.requestMatchHint = () => {
    if (!currentMatch || currentMatch.status !== 'playing') {
      showToast("⚠️ O'yin faol emas!");
      return;
    }
    const myColor = currentMatch.myColor || 'w';
    if (currentMatch.turn !== myColor) {
      showToast("⏳ Hozir sizning navbatingiz emas!");
      return;
    }
    if (currentHint) {
      showToast(currentMatch.game === 'chess' && currentHint.from ? `💡 Maslahat: ${currentHint.from.toUpperCase()} ➔ ${currentHint.to.toUpperCase()}` : `💡 Maslahat taxtada ko'rsatilgan!`);
      return;
    }
    const modal = document.getElementById('hintModal');
    if (modal) modal.classList.add('active');
  };

  window.closeHintModal = () => {
    const modal = document.getElementById('hintModal');
    if (modal) modal.classList.remove('active');
  };

  window.watchAdForHint = async () => {
    window.closeHintModal();
    if (!currentMatch) return;
    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ blockId: String(appConfig.adsgramBlockId || '58136') });
        await AdController.show();
        sendWs('REQUEST_MATCH_HINT', { matchId: currentMatch.matchId });
      } catch (err) {
        showToast('⚠️ Reklama oxirigacha ko\'rilmadi yoki mavjud emas');
      }
    } else {
      sendWs('REQUEST_MATCH_HINT', { matchId: currentMatch.matchId });
    }
  };

  window.claimDoubleWinAction = async () => {
    if (!lastGameOverData || !lastGameOverData.canDoubleWin) return;
    const btn = document.getElementById('btnDoubleWin');
    if (btn) btn.disabled = true;
    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ blockId: String(appConfig.adsgramBlockId || '58136') });
        await AdController.show();
        sendWs('CLAIM_DOUBLE_WIN', { matchId: lastGameOverData.matchId });
      } catch (err) {
        if (btn) btn.disabled = false;
        showToast('⚠️ Reklama oxirigacha ko\'rilmadi');
      }
    } else {
      sendWs('CLAIM_DOUBLE_WIN', { matchId: lastGameOverData.matchId });
    }
  };

  window.claimLossProtectAction = async () => {
    if (!lastGameOverData || !lastGameOverData.canLossProtect) return;
    const btn = document.getElementById('btnLossProtect');
    if (btn) btn.disabled = true;
    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ blockId: String(appConfig.adsgramBlockId || '58136') });
        await AdController.show();
        sendWs('CLAIM_LOSS_PROTECTION', { matchId: lastGameOverData.matchId });
      } catch (err) {
        if (btn) btn.disabled = false;
        showToast('⚠️ Reklama oxirigacha ko\'rilmadi');
      }
    } else {
      sendWs('CLAIM_LOSS_PROTECTION', { matchId: lastGameOverData.matchId });
    }
  };

  window.claimDailyBonus = () => {
    sendWs('CLAIM_DAILY');
  };

  window.joinTournament = (tournamentId) => {
    sendWs('TOURNAMENT_JOIN', { tournamentId });
  };

  window.handleTaskAction = async (taskId, type, channelUsername) => {
    if (type === 'adsgram_task' || type === 'task') {
      const taskEl = document.getElementById('adsgramTaskEl');
      if (taskEl) {
        taskEl.scrollIntoView({ behavior: 'smooth' });
        const btn = taskEl.querySelector('[slot="button"]') || taskEl.querySelector('[slot="claim"]');
        if (btn) btn.click();
      }
      return;
    }
    if (type === 'ad') {
      if (window.Adsgram) {
        try {
          const AdController = window.Adsgram.init({ blockId: String(appConfig.adsgramBlockId || '58136') });
          await AdController.show();
          sendWs('CLAIM_TASK', { taskId });
        } catch (err) {
          showToast('⚠️ Reklama oxirigacha ko\'rilmadi yoki mavjud emas');
        }
      } else {
        showToast('⚠️ Reklama tizimi yuklanmoqda...');
      }
    } else if (type === 'channel') {
      if (channelUsername) {
        const cleanUser = channelUsername.replace('@', '').replace('https://t.me/', '').trim();
        const url = `https://t.me/${cleanUser}`;
        if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
        else window.open(url, '_blank');
      }
      window._pendingChannelTaskId = taskId;
      setTimeout(() => {
        sendWs('CLAIM_TASK', { taskId });
      }, 3500);
    }
  };

  window.addEventListener('focus', () => {
    if (window._pendingChannelTaskId) {
      const tid = window._pendingChannelTaskId;
      window._pendingChannelTaskId = null;
      sendWs('CLAIM_TASK', { taskId: tid });
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    } else if (currentMatch) {
      sendWs('MATCH_RESYNC');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (window._pendingChannelTaskId) {
        const tid = window._pendingChannelTaskId;
        window._pendingChannelTaskId = null;
        sendWs('CLAIM_TASK', { taskId: tid });
      }
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      } else if (currentMatch) {
        sendWs('MATCH_RESYNC');
      }
    }
  });

  window.getReferralUrl = () => {
    const uid = (userState && userState.id) || '5082009770';
    return `https://t.me/${appConfig.botUsername}?start=ref_${uid}`;
  };

  window.copyReferralLink = () => {
    const link = window.getReferralUrl();
    navigator.clipboard.writeText(link).then(() => {
      showToast(t('copiedToast'));
    });
  };

  window.shareReferralTelegram = () => {
    const link = window.getReferralUrl();
    const text = encodeURIComponent("♟ Grand Arena'da men bilan Shashka va Shaxmat o'ynang! Kirishda +20 G xush kelibsiz bonusini oling:");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  };

  // Direct 1v1 challenge share
  window.shareDirectChallenge = () => {
    if (!userState) return;
    const uid = userState.id;
    const game = selectedGame || 'chess';
    const gameName = game === 'chess' ? 'Shaxmat' : 'Shashka';
    const challengeUrl = `https://t.me/${appConfig.botUsername}?start=challenge_${uid}_${game}`;
    const text = encodeURIComponent(`⚔️ Men seni ${gameName} bo'yicha 1v1 do'stona duelga chorlayman! Kirishda +20 G xush kelibsiz bonusi beriladi. Qabul qilasanmi? 👇`);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(challengeUrl)}&text=${text}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  };

  // Telegram Story share after victory (+25 G bonus)
  window.shareWinToTelegramStory = () => {
    if (!userState) return;
    const uid = userState.id;
    const refUrl = `https://t.me/${appConfig.botUsername}?start=ref_${uid}`;
    const text = `🏆 Men Grand Arena'da g'alaba qozondim!\nDo'stlar bilan o'ynang va sovrinlar yuting!`;
    if (tg && typeof tg.shareToStory === 'function') {
      try {
        tg.shareToStory('https://chess.amuhr.uz/favicon.ico', {
          text,
          widget_link: { url: refUrl, name: "Arenada O'ynash ▶" }
        });
        sendWs('CLAIM_STORY_SHARE');
        return;
      } catch (err) {
        console.warn('Story share fallback:', err);
      }
    }
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refUrl)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
    setTimeout(() => sendWs('CLAIM_STORY_SHARE'), 2000);
  };

  // Referral Milestones Claim
  window.claimRefMilestone = (milestoneCount) => {
    sendWs('CLAIM_REF_MILESTONE', { milestoneCount: Number(milestoneCount) });
  };

  // Shop & Skins handlers
  window.switchShopTab = (tab) => {
    activeShopTab = tab;
    document.querySelectorAll('.shop-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.id === `shopTab${tab.charAt(0).toUpperCase() + tab.slice(1)}s` || b.id === `shopTab${tab.toUpperCase()}`);
    });
    renderShopItems();
  };

  window.buyShopItem = (itemId) => {
    sendWs('SHOP_BUY', { itemId });
  };

  window.equipShopItem = (itemId) => {
    sendWs('SHOP_EQUIP', { itemId });
  };

  // Convert section handlers
  window.switchConvertSubTab = (sub) => {
    document.getElementById('subTabCashout').classList.toggle('active', sub === 'cashout');
    document.getElementById('subTabTopup').classList.toggle('active', sub === 'topup');
    document.getElementById('panelCashout').style.display = sub === 'cashout' ? 'block' : 'none';
    document.getElementById('panelTopup').style.display = sub === 'topup' ? 'block' : 'none';
  };

  window.selectConvertTarget = (target) => {
    selectedConvertTarget = target;
    document.querySelectorAll('#panelCashout .target-pill').forEach((el) => {
      el.classList.toggle('selected', el.getAttribute('data-target') === target);
    });
    updateConvertPreview();
  };

  window.updateConvertPreview = () => {
    const input = document.getElementById('convAmountInput');
    const preview = document.getElementById('convReceiveVal');
    if (!input || !preview) return;
    const amt = Math.max(0, Number(input.value) || 0);

    if (selectedConvertTarget === 'stars') {
      preview.textContent = `${Math.floor(amt / 100)} ⭐ Stars`;
    } else {
      preview.textContent = `${(amt / 20000).toFixed(3)} TON 💎`;
    }
  };

  window.updateStarsToCoinsPreview = () => {
    const input = document.getElementById('starsToCoinsInput');
    const preview = document.getElementById('starsToCoinsPreviewVal');
    if (!input || !preview) return;
    const stars = Math.max(0, Number(input.value) || 0);
    preview.textContent = `+${stars * 15} G 🪙`;
  };

  window.submitConversion = () => {
    const amount = Number(document.getElementById('convAmountInput').value || 0);
    const destination = document.getElementById('convDestInput').value || '';
    sendWs('CONVERT_REQUEST', {
      direction: 'earned_to_payout',
      targetType: selectedConvertTarget,
      amount,
      destination
    });
  };

  window.convertStarsToCoins = () => {
    const stars = Number(document.getElementById('starsToCoinsInput').value || 0);
    sendWs('CONVERT_REQUEST', {
      direction: 'stars_to_coins',
      amount: stars
    });
  };

  window.buyStarsPackage = (stars) => {
    sendWs('BUY_STARS_INVOICE', { stars });
  };

  // ================= ADMIN PANEL HANDLERS =================
  window.switchAdminTab = (pane) => {
    document.querySelectorAll('#view-admin .sub-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-adm') === pane);
    });
    document.querySelectorAll('#view-admin .adm-pane').forEach((el) => {
      el.style.display = el.id === `adm-${pane}` ? 'block' : 'none';
    });
  };

  window.refreshAdminState = () => {
    sendWs('ADMIN_GET_STATE', {});
    showToast('🔄 Admin ma\'lumotlari yangilandi');
  };

  function renderAdminDashboard(adm) {
    if (!adm) return;
    const st = adm.stats || {};
    const statsGrid = document.getElementById('admStatsGrid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="bal-box">
          <span class="lbl">👥 Jami / Onlayn</span>
          <span class="val">${st.totalUsers || 0} <small style="color:#10b981;font-size:13px;">(${st.onlineUsers || 0} on)</small></span>
        </div>
        <div class="bal-box">
          <span class="lbl">⚔️ O'yinlar (Aktiv / Jami)</span>
          <span class="val">${st.activeMatches || 0} / ${st.totalMatches || 0}</span>
        </div>
        <div class="bal-box">
          <span class="lbl">⏳ Kutilayotgan Yechish</span>
          <span class="val" style="color:#f5c451;">${st.pendingConversions || 0} ta</span>
        </div>
        <div class="bal-box">
          <span class="lbl">🛡 Shubhali (Anti-Cheat)</span>
          <span class="val" style="color:${st.flaggedUsers > 0 ? '#ef4444' : '#10b981'};">${st.flaggedUsers || 0} ta</span>
        </div>
        <div class="bal-box">
          <span class="lbl">🪙 Jami Earned G</span>
          <span class="val" style="color:#6ee7b7;">${st.totalEarnedCoins || 0} G</span>
        </div>
        <div class="bal-box">
          <span class="lbl">⭐ Jami Stars</span>
          <span class="val" style="color:#60a5fa;">${st.totalStars || 0} ⭐</span>
        </div>
      `;
    }

    if (adm.settings) {
      const rEl = document.getElementById('admSetRake');
      const tEl = document.getElementById('admSetTimer');
      const aEl = document.getElementById('admSetAdsgram');
      const aiEl = document.getElementById('admSetAdsgramInterstitial');
      const atEl = document.getElementById('admSetAdsgramTask');
      const mcEl = document.getElementById('admSetMinConvert');
      const mdEl = document.getElementById('admSetMaxDaily');
      const mwEl = document.getElementById('admSetMinWins');
      const mrEl = document.getElementById('admSetMinRefs');
      const meEl = document.getElementById('admSetMinElo');
      if (rEl) rEl.value = adm.settings.rakePercent ?? 15;
      if (tEl) tEl.value = adm.settings.moveTimeLimitSec ?? 25;
      if (aEl) aEl.value = adm.settings.adsgramBlockId || '58136';
      if (aiEl) aiEl.value = adm.settings.adsgramInterstitialBlockId || '';
      if (atEl) atEl.value = adm.settings.adsgramTaskBlockId || 'task-58978';
      if (mcEl) mcEl.value = adm.settings.minConvertCoins || 1000;
      if (mdEl) mdEl.value = adm.settings.maxDailyConvertCoins || 1000;
      if (mwEl) mwEl.value = adm.settings.minWinsForConvert ?? 50;
      if (mrEl) mrEl.value = adm.settings.minReferralsForConvert ?? 5;
      if (meEl) meEl.value = adm.settings.minEloForConvert ?? 1150;
    }

    // 2. Conversions list
    const convsEl = document.getElementById('admConvsList');
    if (convsEl) {
      const convs = adm.conversions || [];
      convsEl.innerHTML = convs.length
        ? convs
            .map(
              (c) => `
          <div class="glass-card" style="padding:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <strong>#${c.id} • User ID: ${c.userId}</strong>
              <span style="font-size:12px; font-weight:800; color:${c.trustScore >= 80 ? '#10b981' : '#ef4444'}">
                🛡 Trust: ${c.trustScore}%
              </span>
            </div>
            <div style="font-size:13px; color:var(--gold-bright); margin-bottom:4px;">
              🪙 ${c.coinsAmount} G → <b>${c.payoutValue}</b> (${c.targetType.toUpperCase()})
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
              Rekvizit: <code>${c.destination}</code>
            </div>
            ${
              c.status === 'pending_review'
                ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button class="btn-gold-sm" onclick="adminDecideConversion('${c.id}','approve')">✅ Tasdiqlash</button>
                    <button class="btn-resign" onclick="adminDecideConversion('${c.id}','reject')">❌ Rad etish (Qaytarish)</button>
                   </div>`
                : `<div style="font-size:12px; font-weight:700; color:${c.status === 'completed' ? '#10b981' : '#ef4444'}">
                    Holati: ${c.status.toUpperCase()}
                   </div>`
            }
          </div>
        `
            )
            .join('')
        : `<div class="glass-card" style="text-align:center; color:var(--text-muted);">So'rovlar yo'q</div>`;
    }

    // 3. Users list
    window.renderAdminUsers();

    // 4. Tasks list
    const tasksEl = document.getElementById('admTasksList');
    if (tasksEl) {
      tasksEl.innerHTML = (adm.tasks || [])
        .map(
          (tk) => `
        <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
          <div>
            <div style="font-weight:700; font-size:13px;">${(tk.title && tk.title.uz) || tk.id}</div>
            <div style="font-size:11px; color:var(--text-muted);">${tk.channelUsername || 'AdsGram'} • +${tk.rewardCoins} G</div>
          </div>
          <button class="btn-resign" style="padding:5px 10px;" onclick="deleteAdminTask('${tk.id}')">🗑 O'chirish</button>
        </div>
      `
        )
        .join('');
    }

    // 5. Tournaments list
    const toursEl = document.getElementById('admToursList');
    if (toursEl) {
      toursEl.innerHTML = (adm.tournaments || [])
        .map(
          (tr) => `
        <div class="glass-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
          <div>
            <div style="font-weight:700; font-size:13px;">${(tr.title && tr.title.uz) || tr.id}</div>
            <div style="font-size:11px; color:var(--text-muted);">
              ${tr.game} • Kirish: ${tr.entryFee} ${tr.entryType} • Fond: ${tr.prizePool}
            </div>
          </div>
          <button class="btn-resign" style="padding:5px 10px;" onclick="deleteAdminTour('${tr.id}')">🗑 O'chirish</button>
        </div>
      `
        )
        .join('');
    }

    // 6. Connected Bot Groups & Channels list
    const chatsEl = document.getElementById('admBotChatsList');
    if (chatsEl) {
      const chats = adm.botChats || [];
      chatsEl.innerHTML = chats.length
        ? chats
            .map(
              (c) => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 9px; border-radius:8px; margin-bottom:4px; font-size:11px;">
            <span>${c.type === 'channel' ? '📢' : '💬'} <b>${c.title || c.id}</b> <small style="color:var(--text-muted);">(${c.username || c.id})</small></span>
            <button class="btn-resign" style="padding:3px 7px; font-size:10px;" onclick="deleteAdminBotChat('${c.id}')">✕</button>
          </div>
        `
            )
            .join('')
        : `<div style="font-size:11px; color:var(--text-muted);">Guruhlar yo'q</div>`;
    }
  }

  window.renderAdminUsers = () => {
    const adm = window._adminData;
    const container = document.getElementById('admUsersList');
    if (!adm || !container) return;
    const q = (document.getElementById('admUserSearch')?.value || '').toLowerCase().trim();
    const list = (adm.users || []).filter(
      (u) => !q || String(u.name).toLowerCase().includes(q) || String(u.id).includes(q)
    );

    container.innerHTML = list
      .map(
        (u) => `
      <div class="glass-card" style="padding:11px 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div>
            <strong>${u.name}</strong> <small style="color:var(--text-muted)">(${u.id})</small>
            ${u.banned ? '<span style="color:#ef4444; font-weight:800;">[BANNED]</span>' : ''}
          </div>
          <span style="font-size:12px; font-weight:700; color:${u.trustScore >= 80 ? '#10b981' : '#ef4444'}">
            🛡 ${u.trustScore}% • ${u.elo} ELO
          </span>
        </div>
        <div style="font-size:12px; color:var(--gold-bright); margin-bottom:4px;">
          Bonus: <b>${u.bonusCoins} G</b> | Earned: <b>${u.earnedCoins} G</b> | Stars: <b>${u.stars} ⭐</b> | Ref: <b>${u.referralCount}</b>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">
          🎮 O'yinlar: <b>${u.totalGames || 0} ta</b> (${u.wins || 0}W / ${u.losses || 0}L) • ⚫ Shashka: <b>${u.checkersPlayed || 0}</b> • ♔ Shaxmat: <b>${u.chessPlayed || 0}</b>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:5px;">
          <button class="lang-btn" onclick="adminUpdateUser('${u.id}',{addBonus:50})">+50 Bonus</button>
          <button class="lang-btn" onclick="adminUpdateUser('${u.id}',{addEarned:50})">+50 Earned</button>
          <button class="lang-btn" onclick="adminUpdateUser('${u.id}',{setTrust:100})">🛡 100%</button>
          <button class="btn-resign" style="padding:5px;" onclick="adminUpdateUser('${u.id}',{toggleBan:true})">
            ${u.banned ? '🔓 Unban' : '🚫 Ban'}
          </button>
        </div>
      </div>
    `
      )
      .join('');
  };

  window.adminDecideConversion = (convId, decision) => {
    sendWs('ADMIN_CONV_DECISION', { convId, decision });
  };

  window.adminUpdateUser = (userId, updates) => {
    sendWs('ADMIN_USER_UPDATE', { userId, ...updates });
  };

  window.addAdminTask = () => {
    const channelUsername = document.getElementById('admTaskChannel').value;
    const title = document.getElementById('admTaskTitle').value;
    const rewardCoins = Number(document.getElementById('admTaskReward').value || 25);
    sendWs('ADMIN_TASK_ADD', { channelUsername, title, rewardCoins });
    document.getElementById('admTaskChannel').value = '';
    document.getElementById('admTaskTitle').value = '';
  };

  window.deleteAdminTask = (taskId) => {
    sendWs('ADMIN_TASK_DELETE', { taskId });
  };

  window.addAdminTournament = () => {
    const title = document.getElementById('admTourTitle').value || '🏆 Kechki Arena (20:00)';
    const game = document.getElementById('admTourGame').value;
    const entryType = document.getElementById('admTourType').value;
    const entryFee = Number(document.getElementById('admTourFee').value || 0);
    const minReferrals = Number(document.getElementById('admTourMinRefs')?.value ?? 2);
    const scheduledHour = Number(document.getElementById('admTourHour')?.value ?? 20);
    const durationMinutes = Number(document.getElementById('admTourDuration')?.value || 45);
    const prizePool = Number(document.getElementById('admTourPrize').value || 200);
    const minPlayers = Number(document.getElementById('admTourMinPlayers')?.value || 4);
    sendWs('ADMIN_TOUR_ADD', {
      title,
      game,
      entryType,
      entryFee,
      minReferrals,
      requireSub: true,
      scheduledHour,
      scheduledMinute: 0,
      durationMinutes,
      prizePool,
      minPlayers,
      maxPlayers: 64
    });
    document.getElementById('admTourTitle').value = '';
  };

  window.deleteAdminTour = (tourId) => {
    sendWs('ADMIN_TOUR_DELETE', { tourId });
  };

  window.saveAdminSettings = () => {
    const rakePercent = Number(document.getElementById('admSetRake').value || 15);
    const moveTimeLimitSec = Number(document.getElementById('admSetTimer').value || 25);
    const adsgramBlockId = document.getElementById('admSetAdsgram').value || '58136';
    const adsgramInterstitialBlockId = (document.getElementById('admSetAdsgramInterstitial')?.value || '').trim();
    const adsgramTaskBlockId = (document.getElementById('admSetAdsgramTask')?.value || 'task-58978').trim();
    const minConvertCoins = Number(document.getElementById('admSetMinConvert')?.value || 1000);
    const maxDailyConvertCoins = Number(document.getElementById('admSetMaxDaily')?.value || 1000);
    const minWinsForConvert = Number(document.getElementById('admSetMinWins')?.value || 50);
    const minReferralsForConvert = Number(document.getElementById('admSetMinRefs')?.value || 5);
    const minEloForConvert = Number(document.getElementById('admSetMinElo')?.value || 1150);
    sendWs('ADMIN_SETTINGS_UPDATE', {
      rakePercent,
      moveTimeLimitSec,
      adsgramBlockId,
      adsgramInterstitialBlockId,
      adsgramTaskBlockId,
      minConvertCoins,
      maxDailyConvertCoins,
      minWinsForConvert,
      minReferralsForConvert,
      minEloForConvert
    });
  };

  window.addAdminBotChat = () => {
    const target = (document.getElementById('admNewChatTarget')?.value || '').trim();
    const chatType = document.getElementById('admNewChatType')?.value || 'supergroup';
    if (!target) return showToast('⚠️ Guruh yoki kanal @username kiriting!');
    sendWs('ADMIN_CHAT_ADD', { target, chatType, title: target });
    document.getElementById('admNewChatTarget').value = '';
  };

  window.deleteAdminBotChat = (id) => {
    sendWs('ADMIN_CHAT_DELETE', { id });
  };

  window.sendAdminBroadcast = () => {
    const text = (document.getElementById('admBroadcastText')?.value || '').trim();
    if (!text) return showToast('⚠️ Xabar matnini kiriting!');
    const toUsers = document.getElementById('admBcUsers') ? document.getElementById('admBcUsers').checked : true;
    const toGroups = document.getElementById('admBcGroups') ? document.getElementById('admBcGroups').checked : true;
    const toChannels = document.getElementById('admBcChannels') ? document.getElementById('admBcChannels').checked : true;
    const withButton = document.getElementById('admBcBtn') ? document.getElementById('admBcBtn').checked : true;
    const buttonText = (document.getElementById('admBcBtnText')?.value || '🎮 Arenaga Kirish').trim();

    sendWs('ADMIN_BROADCAST', {
      text,
      toUsers,
      toGroups,
      toChannels,
      withButton,
      buttonText
    });
    document.getElementById('admBroadcastText').value = '';
    showToast('🚀 Xabar yuborilmoqda...');
  };

  // ==========================================================================
  // 👥 GROUP MULTIPLAYER LOBBY UI (ZAKOVAT & LUDO)
  // ==========================================================================
  let currentGroupLobby = null;

  function getLudoColorHex(c) {
    if (c === 'red') return '#ef4444';
    if (c === 'green') return '#10b981';
    if (c === 'yellow') return '#eab308';
    if (c === 'blue') return '#3b82f6';
    return '#888';
  }

  function getLudoColorName(c) {
    if (c === 'red') return 'Qizil';
    if (c === 'green') return 'Yashil';
    if (c === 'yellow') return 'Sariq';
    if (c === 'blue') return "Ko'k";
    return c;
  }

  window.renderGroupLobby = function (data) {
    currentGroupLobby = data;
    const modal = document.getElementById('groupLobbyModal');
    if (!modal) return;

    const isZakovat = data.game === 'zakovat';
    const isLudo = data.game === 'ludo';
    const isHost = String(data.hostId) === String(userState ? userState.id : '');

    const iconEl = document.getElementById('groupLobbyIcon');
    const titleEl = document.getElementById('groupLobbyTitle');
    const subEl = document.getElementById('groupLobbySubtitle');
    const listEl = document.getElementById('groupLobbyPlayersList');
    const startBtn = document.getElementById('groupLobbyStartBtn');

    if (iconEl) iconEl.textContent = isZakovat ? '🧠' : '🎲';
    if (titleEl) {
      titleEl.textContent = isZakovat
        ? 'Zakovat Guruh Xonasi'
        : 'Ludo King Guruh Stoli';
    }
    if (subEl) {
      subEl.textContent = `Ishtirokchilar: ${data.players.length} / 4 kishi`;
    }

    if (listEl) {
      listEl.innerHTML = '';
      data.players.forEach((p) => {
        const isMe = String(p.id) === String(userState ? userState.id : '');
        const colorTag = isLudo
          ? ` <span style="font-size:11px; padding:2px 7px; border-radius:6px; background:${getLudoColorHex(p.color)}; color:#fff; font-weight:700;">${getLudoColorName(p.color)}</span>`
          : '';
        const hostTag = p.isHost
          ? `<span style="font-size:11px; font-weight:700; color:#fde08d; background:rgba(245,196,81,0.2); padding:3px 8px; border-radius:12px;">👑 Boshlovchi</span>`
          : `<span style="font-size:11px; font-weight:700; color:#34d399; background:rgba(16,185,129,0.2); padding:3px 8px; border-radius:12px;">✅ Tayyor</span>`;

        const card = document.createElement('div');
        card.style.cssText = `display:flex; align-items:center; justify-content:space-between; background:${
          isMe ? 'rgba(245,196,81,0.15)' : 'rgba(255,255,255,0.06)'
        }; border:1px solid ${
          isMe ? '#f59e0b' : 'rgba(255,255,255,0.12)'
        }; border-radius:10px; padding:9px 12px;`;
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">${p.isHost ? '👑' : '👤'}</span>
            <span style="font-weight:700; color:#fff; font-size:14px;">${escapeHtml(p.name)}${isMe ? ' (Siz)' : ''}</span>
            ${colorTag}
          </div>
          ${hostTag}
        `;
        listEl.appendChild(card);
      });

      // Render empty slots up to 4
      for (let i = data.players.length; i < 4; i++) {
        const emptyCard = document.createElement('div');
        emptyCard.style.cssText =
          'display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.18); border-radius:10px; padding:9px 12px; opacity:0.65;';
        emptyCard.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">⏳</span>
            <span style="color:#aaa; font-size:13px;">Guruhdosh kutilmoqda...</span>
          </div>
          <span style="font-size:11px; color:#888;">${i + 1}-o'rin</span>
        `;
        listEl.appendChild(emptyCard);
      }
    }

    if (startBtn) {
      if (isHost) {
        startBtn.style.display = 'block';
        const remaining = 4 - data.players.length;
        if (remaining > 0) {
          startBtn.textContent = `▶️ Hozir Boshlash (${remaining} ta bot qo'shish)`;
        } else {
          startBtn.textContent = `▶️ O'yinni Boshlash (4/4 Tayyor!)`;
        }
      } else {
        startBtn.style.display = 'none';
      }
    }

    modal.classList.add('active');
  };

  window.closeGroupLobby = function () {
    currentGroupLobby = null;
    const modal = document.getElementById('groupLobbyModal');
    if (modal) modal.classList.remove('active');
  };

  window.startGroupRoomNow = function () {
    if (!currentGroupLobby) return;
    sendWs('GROUP_LOBBY_START', {
      game: currentGroupLobby.game,
      roomId: currentGroupLobby.roomId
    });
  };

  window.leaveGroupRoom = function () {
    if (!currentGroupLobby) return;
    sendWs('GROUP_LOBBY_LEAVE', {
      game: currentGroupLobby.game,
      roomId: currentGroupLobby.roomId
    });
    window.closeGroupLobby();
  };

  window.shareGroupRoomLink = function () {
    if (!currentGroupLobby) return;
    const prefix = currentGroupLobby.game === 'zakovat' ? 'zroom' : 'lroom';
    const link = `https://t.me/ChessTonArenaBot/arena?startapp=${prefix}_${currentGroupLobby.roomId}_${currentGroupLobby.hostId}`;
    const gameTitle = currentGroupLobby.game === 'zakovat' ? 'Zakovat viktorinasi' : "Ludo King o'yini";
    const shareText = `Bizning guruh ${gameTitle} xonasiga qo'shiling! Joylar soni 4 ta! 🎮`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  applyTranslations();
  const sndBtn = document.getElementById('gramoraSoundBtn');
  if (sndBtn) sndBtn.textContent = soundEnabled ? '🔊' : '🔇';
  if (typeof window.selectBotDifficulty === 'function') {
    window.selectBotDifficulty(selectedBotDifficulty);
  }
  connectWebSocket();
})();
