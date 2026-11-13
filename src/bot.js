const crypto = require('crypto');
const { loadDb, saveDb, getOrCreateUser, withUserLock } = require('./db');

const BOT_MESSAGES = {
  uz: {
    chooseLang: "🌍 <b>Grand Arena: Shashka & Shaxmat</b>\n\nIltimos, muloqot tilini tanlang:\nПожалуйста, выберите язык:\nPlease select your language:",
    welcome: (name, elo, coins, refLink) =>
      `🏆 <b>Xush kelibsiz, ${name}!</b>\n\n` +
      `♟ <b>Grand Arena</b> — haqiqiy o'yinchilar bilan Shashka va Shaxmat o'ynab, reyting va sovrinlar yutish platformasi!\n\n` +
      `📊 Sizning reytingingiz: <b>${elo} ELO</b>\n` +
      `🪙 Balansingiz: <b>${coins} G</b>\n\n` +
      `👥 <b>Do'stlarni chaqiring (+5 G har bir do'st uchun):</b>\n<code>${refLink}</code>\n\n` +
      `👇 O'yinni boshlash uchun quyidagi tugmani bosing:`,
    playBtn: "🎮 O'yinni Boshlash (Arena)",
    changeLangBtn: "🌐 Tilni o'zgartirish"
  },
  ru: {
    chooseLang: "🌍 <b>Grand Arena: Шашки и Шахматы</b>\n\nПожалуйста, выберите язык:",
    welcome: (name, elo, coins, refLink) =>
      `🏆 <b>Добро пожаловать, ${name}!</b>\n\n` +
      `♟ <b>Grand Arena</b> — интеллектуальная платформа по шашкам и шахматам с турнирами и рейтингом ELO!\n\n` +
      `📊 Ваш рейтинг: <b>${elo} ELO</b>\n` +
      `🪙 Ваш баланс: <b>${coins} G</b>\n\n` +
      `👥 <b>Приглашайте друзей (+5 G за каждого друга):</b>\n<code>${refLink}</code>\n\n` +
      `👇 Нажмите кнопку ниже, чтобы войти в игру:`,
    playBtn: "🎮 Играть (Открыть Арену)",
    changeLangBtn: "🌐 Сменить язык"
  },
  en: {
    chooseLang: "🌍 <b>Grand Arena: Checkers & Chess</b>\n\nPlease select your preferred language:",
    welcome: (name, elo, coins, refLink) =>
      `🏆 <b>Welcome, ${name}!</b>\n\n` +
      `♟ <b>Grand Arena</b> — competitive Checkers & Chess platform with ELO matchmaking, tournaments, and rewards!\n\n` +
      `📊 Your Rating: <b>${elo} ELO</b>\n` +
      `🪙 Your Balance: <b>${coins} G</b>\n\n` +
      `👥 <b>Invite friends (+5 G per friend):</b>\n<code>${refLink}</code>\n\n` +
      `👇 Tap the button below to launch the Arena:`,
    playBtn: "🎮 Play Now (Open Arena)",
    changeLangBtn: "🌐 Change Language"
  }
};

class TelegramBotService {
  constructor({ token, webappUrl, botUsername, adminId, onBalanceUpdated, onDuelCreated, onDuelCancelledByHost, onGroupRoomCreated }) {
    this.token = token;
    this.webappUrl = webappUrl || 'http://localhost:3000';
    this.botUsername = botUsername || 'GrandArenaGameBot';
    this.adminId = adminId;
    this.onBalanceUpdated = onBalanceUpdated || (() => {});
    this.onDuelCreated = onDuelCreated || (() => {});
    this.onDuelCancelledByHost = onDuelCancelledByHost || (() => ({ ok: false }));
    this.onGroupRoomCreated = onGroupRoomCreated || (() => {});
    this.offset = 0;
    this.isActive = Boolean(
      token &&
      token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE' &&
      token.includes(':')
    );
  }

  async apiCall(method, body = {}) {
    if (!this.isActive) return { ok: false, description: 'BOT_NOT_CONFIGURED' };
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      return { ok: false, description: err.message };
    }
  }

  startPolling() {
    if (!this.isActive) {
      console.log('ℹ️  [TelegramBot] BOT_TOKEN kiritilmagan — lokal WebApp rejimida ishlamoqda.');
      return;
    }
    console.log('🤖 [TelegramBot] Long-polling ishga tushdi...');
    this.configureMultiLangBotProfile();
    this.startDailyBroadcastScheduler();
    this.pollLoop();
  }

  /**
   * Automatically sets separate Bot Name, About & Description for English (default), Russian, and Uzbek users!
   */
  async configureMultiLangBotProfile() {
    try {
      // 1. Default / English (shown to all international users)
      await this.apiCall('setMyName', {
        name: 'Chess & Checkers 💎 Stars TON'
      });
      await this.apiCall('setMyShortDescription', {
        short_description: '♟ Play Chess & Checkers Online! ELO Rating, Live Tournaments & Win ⭐ Telegram Stars & 💎 TON!'
      });
      await this.apiCall('setMyDescription', {
        description:
          '🏆 Chess & Checkers 💎 Stars TON Arena!\n\n' +
          '• 🎁 Get +50 G Free Welcome Bonus\n' +
          '• ⚔️ 1v1 Blitz Matches & Daily Tournaments\n' +
          '• 📊 Official ELO Rating & Anti-Cheat Protection\n' +
          '• 🔄 Convert your winnings to ⭐ Telegram Stars & 💎 TON!\n\n' +
          '👇 Tap START to play now!'
      });

      // 2. Russian (shown automatically to users with Russian Telegram)
      await this.apiCall('setMyName', {
        language_code: 'ru',
        name: 'Шахматы и Шашки 💎 Stars TON'
      });
      await this.apiCall('setMyShortDescription', {
        language_code: 'ru',
        short_description: '♟ Шахматы и Шашки Онлайн! Турниры, ELO рейтинг и вывод выигрышей в ⭐ Telegram Stars и 💎 TON!'
      });
      await this.apiCall('setMyDescription', {
        language_code: 'ru',
        description:
          '🏆 Шахматы и Шашки 💎 Stars TON Arena!\n\n' +
          '• 🎁 Бесплатный бонус +50 G при старте\n' +
          '• ⚔️ 1v1 Блиц-матчи и Ежедневные Турниры\n' +
          '• 📊 Честный ELO рейтинг и защита Anti-Cheat\n' +
          '• 🔄 Обменивайте победы на ⭐ Telegram Stars и 💎 TON!\n\n' +
          '👇 Нажмите СТАРТ, чтобы начать игру!'
      });

      // 3. Uzbek (shown automatically to users with Uzbek Telegram)
      await this.apiCall('setMyName', {
        language_code: 'uz',
        name: 'Shaxmat va Shashka 💎 Stars TON'
      });
      await this.apiCall('setMyShortDescription', {
        language_code: 'uz',
        short_description: '♟ Shaxmat va Shashka Online! Turnirlar, ELO reyting hamda ⭐ Telegram Stars va 💎 TON yutib oling!'
      });
      await this.apiCall('setMyDescription', {
        language_code: 'uz',
        description:
          '🏆 Shaxmat va Shashka 💎 Stars TON Arena!\n\n' +
          '• 🎁 Kirishda +50 G tekin bonus tanga\n' +
          '• ⚔️ 1v1 Blitz o\'yinlar va Kunlik Turnirlar\n' +
          '• 📊 ELO reyting va kuchli Anti-Cheat himoyasi\n' +
          '• 🔄 Yutuqlarni ⭐ Telegram Stars va 💎 TON ga ayirboshlang!\n\n' +
          '👇 Boshlash uchun START tugmasini bosing!'
      });

      // 4. Bot Menu Commands (/start, /duel, /zakovat, /ludo, /lang)
      await this.apiCall('setMyCommands', {
        commands: [
          { command: 'start', description: '🎮 Play Arena / O\'yinni boshlash' },
          { command: 'duel', description: '⚔️ O\'yin menyusi (Shashka, Shaxmat, Zakovat, Ludo)' },
          { command: 'zakovat', description: '🧠 4 kishilik Zakovat viktorinasi' },
          { command: 'ludo', description: '🎲 4 kishilik Ludo King o\'yini' },
          { command: 'lang', description: '🌐 Change Language / Tilni o\'zgartirish' }
        ]
      });

      // 5. Set Telegram Bottom-Left WebApp Menu Button if HTTPS URL is configured
      if (this.webappUrl && this.webappUrl.startsWith('https://')) {
        await this.apiCall('setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: '🎮 Play Arena',
            web_app: { url: this.webappUrl }
          }
        });
      }
    } catch (err) {
      // Ignore profile configuration errors
    }
  }

  async pollLoop() {
    while (this.isActive) {
      try {
        const data = await this.apiCall('getUpdates', {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query', 'pre_checkout_query', 'my_chat_member']
        });

        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  recordGroupOrChannelChat(chat, active = true) {
    if (!chat || !chat.type || chat.type === 'private') return;
    const db = loadDb();
    db.botChats = db.botChats || {};
    const uname = chat.username ? '@' + chat.username : null;
    // If already registered by @username (e.g. @ChessTonArena or @ChessTonArenaChat), update that entry
    const existingKey = uname && db.botChats[uname] ? uname : String(chat.id);
    db.botChats[existingKey] = {
      id: existingKey,
      chatId: chat.id,
      title: chat.title || uname || String(chat.id),
      username: uname,
      type: chat.type, // 'group', 'supergroup', or 'channel'
      active,
      updatedAt: Date.now()
    };
    saveDb();
  }

  async handleUpdate(update) {
    // 0. Bot Membership Updates (User blocks/deletes or unblocks bot, or bot added/removed in group/channel)
    if (update.my_chat_member) {
      const mcm = update.my_chat_member;
      const chat = mcm.chat;
      const newStatus = mcm.new_chat_member && mcm.new_chat_member.status;

      if (chat && (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel')) {
        const isActive = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator';
        this.recordGroupOrChannelChat(chat, isActive);
        return;
      }

      const uid = String((mcm.from && mcm.from.id) || (mcm.chat && mcm.chat.id));
      const db = loadDb();
      const user = db.users && db.users[uid];
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

      if (newStatus === 'kicked' || newStatus === 'left') {
        // User stopped, blocked, or deleted the bot
        if (user) {
          user.botBlocked = true;
          user.blockedAt = Date.now();
        }
        db.dailyMetrics[todayStr].blockedUsers = (db.dailyMetrics[todayStr].blockedUsers || 0) + 1;
        saveDb();
      } else if (newStatus === 'member' || newStatus === 'administrator') {
        // User unblocked or started the bot again
        if (user) {
          user.botBlocked = false;
          user.unblockedAt = Date.now();
          user.lastActiveAt = Date.now();
        }
        saveDb();
      }
      return;
    }

    if (update.message && update.message.chat && update.message.chat.type !== 'private') {
      this.recordGroupOrChannelChat(update.message.chat, true);
    }

    // 1. Pre-checkout query for Telegram Stars (XTR)
    if (update.pre_checkout_query) {
      await this.apiCall('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true
      });
      return;
    }

    // 2. Callback query (Language selection)
    if (update.callback_query) {
      const cb = update.callback_query;
      const from = cb.from;
      const data = cb.data || '';

      if (data.startsWith('setlang_')) {
        const lang = data.replace('setlang_', '');
        const user = getOrCreateUser({
          id: from.id,
          name: from.first_name,
          username: from.username,
          lang
        });
        user.lang = ['uz', 'ru', 'en'].includes(lang) ? lang : 'uz';
        saveDb();

        await this.apiCall('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: lang === 'uz' ? "O'zbek tili tanlandi 🇺🇿" : lang === 'ru' ? "Выбран русский язык 🇷🇺" : "English selected 🇬🇧"
        });

        await this.sendWelcomeCard(cb.message.chat.id, user);
      } else if (data.startsWith('cancel_duel_')) {
        const duelId = data.replace('cancel_duel_', '');
        if (typeof this.onDuelCancelledByHost === 'function') {
          const res = await this.onDuelCancelledByHost(duelId, String(from.id));
          await this.apiCall('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: res.ok ? "Duel bekor qilindi. Hech narsa yo'qotilmadi." : (res.message || "Faqat chaqiruvchi bekor qilishi mumkin.")
          });
        }
      } else if (data.startsWith('conv_ok_') || data.startsWith('conv_no_')) {
        const isApprove = data.startsWith('conv_ok_');
        const convId = data.replace('conv_ok_', '').replace('conv_no_', '');
        const db = loadDb();
        const conv = (db.conversions || []).find((c) => c.id === convId);

        if (!conv || conv.status !== 'pending_review') {
          await this.apiCall('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "Bu so'rov allaqachon ko'rib chiqilgan!"
          });
          return;
        }

        if (isApprove) {
          conv.status = 'completed';
          const targetUser = db.users[String(conv.userId)];
          if (targetUser && conv.targetType === 'stars') {
            targetUser.starsBalance = (targetUser.starsBalance || 0) + (conv.starsAmount || Math.floor(conv.coinsAmount / 100));
          }
          saveDb();
          await this.apiCall('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "✅ Tasdiqlandi!"
          });
        } else {
          conv.status = 'rejected';
          const targetUser = db.users[String(conv.userId)];
          if (targetUser) {
            targetUser.earnedCoins = (targetUser.earnedCoins || 0) + conv.coinsAmount;
          }
          saveDb();
          await this.apiCall('answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "❌ Rad etildi va tangalar o'yinchiga qaytarildi."
          });
        }

        this.onBalanceUpdated(conv.userId);
      }
      return;
    }

    // 3. Regular message & Successful Stars Payment
    if (update.message) {
      const msg = update.message;
      const from = msg.from;

      // Handle Telegram Stars payment confirmation
      if (msg.successful_payment) {
        const payment = msg.successful_payment;
        const starsPaid = Number(payment.total_amount || 0);
        await withUserLock(from.id, async () => {
          const user = getOrCreateUser({ id: from.id, name: from.first_name, username: from.username });
          user.starsBalance = (user.starsBalance || 0) + starsPaid;
          user.earnedCoins = (user.earnedCoins || 0) + starsPaid * 15; // 1 Star = 15 Coins
          saveDb();
          this.onBalanceUpdated(user.id);
        });
        return;
      }

      const text = (msg.text || '').trim();
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const param = parts[1] || '';
        let referredBy = null;
        let isChallenge = false;
        let challengerId = null;
        let challengeGame = 'chess';

        if (param.startsWith('ref_')) {
          referredBy = param.replace('ref_', '');
        } else if (param.startsWith('challenge_')) {
          isChallenge = true;
          const cParts = param.split('_');
          challengerId = cParts[1] || null;
          challengeGame = cParts[2] || 'chess';
          referredBy = challengerId;
        } else if (param.startsWith('task_') || param === 'reward' || param.startsWith('reward_')) {
          const u = getOrCreateUser({
            id: from.id,
            name: from.first_name,
            username: from.username,
            lang: (from.language_code || 'uz').slice(0, 2)
          });
          u.earnedCoins = (u.earnedCoins || 0) + 20;
          saveDb();
          this.onBalanceUpdated(u.id);
          await this.apiCall('sendMessage', {
            chat_id: msg.chat.id,
            text:
              `🎁 <b>TOPSHIRIQ BAJARILDI!</b>\n\n` +
              `✅ Hamkorimiz topshirig'ini muvaffaqiyatli bajarganingiz uchun hisobingizga <b>+20 G</b> qo'shildi!\n` +
              `💰 Hozirgi balansingiz: <b>${(u.depositCoins || 0) + (u.earnedCoins || 0)} G</b>`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 O'yinga Kirish", web_app: { url: this.webappUrl } }]
              ]
            }
          });
          return;
        }

        const newUser = getOrCreateUser({
          id: from.id,
          name: from.first_name,
          username: from.username,
          lang: (from.language_code || 'uz').slice(0, 2),
          referredBy
        });

        if (isChallenge && challengerId) {
          const db = loadDb();
          const challenger = db.users[String(challengerId)];
          const chName = challenger ? challenger.name : 'Do\'stingiz';
          const gameTitle = challengeGame === 'checkers' ? '⚫ Shashka' : '♔ Shaxmat';
          await this.apiCall('sendMessage', {
            chat_id: msg.chat.id,
            text:
              `⚔️ <b>${chName}</b> sizni <b>${gameTitle}</b> dueliga chorladi!\n\n` +
              `🎁 Sizga do'stingiz taklifi orqali <b>+20 G xush kelibsiz bonusi</b> berildi!\n` +
              `Qani, taxtada haqiqiy mahoratingizni ko'rsating va g'olib bo'ling:`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: `🎮 Duelni Qabul Qilish (${gameTitle})`, web_app: { url: this.webappUrl } }]
              ]
            }
          });
          return;
        }

        await this.sendLanguageSelector(msg.chat.id);
      } else if (text === '/lang') {
        await this.sendLanguageSelector(msg.chat.id);
      } else if (text.startsWith('/duel') || text.startsWith('/play') || text.startsWith('/game')) {
        const user = getOrCreateUser({
          id: from.id,
          name: from.first_name,
          username: from.username
        });
        const duelId = 'd' + Date.now().toString(36);
        const checkersUrl = `https://t.me/${this.botUsername}/arena?startapp=duel_${duelId}_checkers_${user.id}`;
        const chessUrl = `https://t.me/${this.botUsername}/arena?startapp=duel_${duelId}_chess_${user.id}`;
        const zakovatUrl = `https://t.me/${this.botUsername}/arena?startapp=zroom_${duelId}_${user.id}`;
        const ludoUrl = `https://t.me/${this.botUsername}/arena?startapp=lroom_${duelId}_${user.id}`;

        const sent = await this.apiCall('sendMessage', {
          chat_id: msg.chat.id,
          text:
            `🎮 <b>GURUH O'YINLARI ARENASI!</b>\n\n` +
            `👤 Taklif qiluvchi: <b>${user.name}</b>\n` +
            `🎯 O'zingiz yoqtirgan o'yinni tanlang va guruhdoshlar bilan kuch sinashing:\n\n` +
            `⚫ <b>Shashka</b> — 1v1 klassik duel\n` +
            `♔ <b>Shaxmat</b> — 1v1 aql jangi\n` +
            `🧠 <b>Zakovat</b> — 4 kishilik intellektual viktorina\n` +
            `🎲 <b>Ludo King</b> — 4 kishilik zar o'yini\n\n` +
            `👇 O'yinni tanlab, arenaga kiring:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⚫ Shashka (1v1)", url: checkersUrl },
                { text: "♔ Shaxmat (1v1)", url: chessUrl }
              ],
              [
                { text: "🧠 Zakovat (4P)", url: zakovatUrl },
                { text: "🎲 Ludo King (4P)", url: ludoUrl }
              ],
              [{ text: "❌ Bekor Qilish", callback_data: `cancel_duel_${duelId}` }]
            ]
          }
        });

        if (sent && sent.ok && sent.result) {
          this.onDuelCreated({
            duelId,
            chatId: msg.chat.id,
            messageId: sent.result.message_id,
            hostId: String(user.id),
            hostName: user.name,
            hostElo: user.elo || 1000
          });
        }
      } else if (text.startsWith('/zakovat') || text.startsWith('/viktorina')) {
        const user = getOrCreateUser({
          id: from.id,
          name: from.first_name,
          username: from.username
        });
        const roomId = 'zk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const zakovatUrl = `https://t.me/${this.botUsername}/arena?startapp=zroom_${roomId}_${user.id}`;
        const sent = await this.apiCall('sendMessage', {
          chat_id: msg.chat.id,
          text:
            `🧠 <b>4 KISHILIK GURUH ZAKOVAT ARENASI!</b>\n\n` +
            `👤 Boshlovchi: <b>${user.name}</b>\n` +
            `👥 Ishtirokchilar: <b>1 / 4</b> kishi kutmoqda\n` +
            `🎯 Tarix, mantiq, fan va sport bo'yicha savollar jangi!\n` +
            `⚡ Kim guruhimizning eng bilimdoni? Hoziroq xonaga kiring!\n\n` +
            `👇 Viktorinada qatnashish:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🧠 Zakovat Xonasiga Kirish (1/4) 🎮", url: zakovatUrl }]
            ]
          }
        });
        if (sent && sent.ok && sent.result) {
          this.onGroupRoomCreated({
            game: 'zakovat',
            roomId,
            chatId: msg.chat.id,
            messageId: sent.result.message_id,
            hostId: String(user.id),
            hostName: user.name
          });
        }
      } else if (text.startsWith('/ludo') || text.startsWith('/zar')) {
        const user = getOrCreateUser({
          id: from.id,
          name: from.first_name,
          username: from.username
        });
        const roomId = 'lu_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const ludoUrl = `https://t.me/${this.botUsername}/arena?startapp=lroom_${roomId}_${user.id}`;
        const sent = await this.apiCall('sendMessage', {
          chat_id: msg.chat.id,
          text:
            `🎲 <b>4 KISHILIK LUDO KING O'YINI!</b>\n\n` +
            `👤 Stol egasi: <b>${user.name}</b>\n` +
            `👥 Ishtirokchilar: <b>1 / 4</b> kishi kutmoqda\n` +
            `🎯 4 kishi birgalikda zar tashlaydi, raqiblarni urib chiqarib marraga yetadi!\n` +
            `⚡ Guruhdoshlar bilan o'ynash uchun stolga o'tiring!\n\n` +
            `👇 O'yin stoliga kirish:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Ludo Stoliga O'tirish (1/4) 🎮", url: ludoUrl }]
            ]
          }
        });
        if (sent && sent.ok && sent.result) {
          this.onGroupRoomCreated({
            game: 'ludo',
            roomId,
            chatId: msg.chat.id,
            messageId: sent.result.message_id,
            hostId: String(user.id),
            hostName: user.name
          });
        }
      } else if (text === '/admin') {
        if (this.adminId && String(from.id) !== String(this.adminId)) {
          await this.apiCall('sendMessage', {
            chat_id: msg.chat.id,
            text: "⛔ Sizda admin huquqi yo'q."
          });
          return;
        }
        const db = loadDb();
        const usersList = Object.values(db.users || {});
        const pendingConvs = (db.conversions || []).filter((c) => c.status === 'pending_review');
        const totalMatches = (db.matchesHistory || []).length;
        const adminKey = crypto
          .createHmac('sha256', this.token || 'dev_secret')
          .update(`admin_web_${this.adminId || from.id}`)
          .digest('hex')
          .slice(0, 24);
        const webPortalUrl = `${this.webappUrl}/admin.html?key=${adminKey}`;
        const miniAppAdminUrl = `${this.webappUrl}?admin=1`;
        const isHttps = webPortalUrl.startsWith('https://');
        const openWebBtn = isHttps
          ? { text: "🖥️ Web Admin Saytni Ochish (To'liq Tahlil)", web_app: { url: webPortalUrl } }
          : { text: "🖥️ Web Admin Saytni Ochish", url: webPortalUrl };
        const openBrowserBtn = { text: "🌐 Brauzerda Ochish (PC / Telefon)", url: webPortalUrl };
        const openMiniBtn = isHttps
          ? { text: "📱 O'yin ichidagi Admin Panel", web_app: { url: miniAppAdminUrl } }
          : { text: "📱 O'yin ichidagi Admin Panel", url: miniAppAdminUrl };

        await this.apiCall('sendMessage', {
          chat_id: msg.chat.id,
          text:
            `👑 <b>Chess & Checkers — Web Admin & Analitika Markazi</b>\n\n` +
            `👥 Jami foydalanuvchilar: <b>${usersList.length} ta</b>\n` +
            `⚔️ O'ynalgan partiyalar: <b>${totalMatches} ta</b>\n` +
            `⏳ Kutilayotgan konvertatsiyalar: <b>${pendingConvs.length} ta</b>\n` +
            `🏆 Aktiv turnirlar: <b>${(db.tournaments || []).length} ta</b>\n` +
            `📢 Aktiv vazifalar: <b>${(db.tasks || []).length} ta</b>\n\n` +
            `🌐 <b>Kompyuter yoki brauzerdan kirish uchun maxfiy havola:</b>\n<code>${webPortalUrl}</code>`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [openWebBtn],
              [openBrowserBtn],
              [openMiniBtn]
            ]
          }
        });
      }
    }
  }

  async broadcastToAllUsers(messageText, opts = {}) {
    if (!this.isActive || !messageText) return { sent: 0, sentUsers: 0, sentGroups: 0, sentChannels: 0, summaryText: 'Xatolik' };
    const toUsers = opts.toUsers !== false;
    const toGroups = opts.toGroups !== false;
    const toChannels = opts.toChannels !== false;
    const withButton = opts.withButton !== false;
    const btnLabel = String(opts.buttonText || '🎮 Arenaga Kirish').trim() || '🎮 Arenaga Kirish';
    const arenaDirectUrl = `https://t.me/${this.botUsername}/arena`;
    const isHttps = (this.webappUrl || '').startsWith('https://');

    const userMarkup = withButton
      ? {
          inline_keyboard: [
            [isHttps ? { text: btnLabel, web_app: { url: this.webappUrl } } : { text: btnLabel, url: arenaDirectUrl }]
          ]
        }
      : undefined;

    const groupMarkup = withButton
      ? {
          inline_keyboard: [[{ text: btnLabel, url: arenaDirectUrl }]]
        }
      : undefined;

    const db = loadDb();
    let sentUsers = 0;
    let sentGroups = 0;
    let sentChannels = 0;

    if (toUsers) {
      const userIds = Object.keys(db.users || {});
      for (const uid of userIds) {
        if (uid.startsWith('90000') || uid.startsWith('bot_')) continue;
        const res = await this.apiCall('sendMessage', {
          chat_id: uid,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: userMarkup
        });
        if (res && res.ok) sentUsers++;
        await new Promise((r) => setTimeout(r, 45));
      }
    }

    const chatsList = Object.values(db.botChats || {}).filter((c) => c && c.active !== false);
    const seenTargets = new Set();

    if (toGroups) {
      for (const c of chatsList) {
        if (c.type !== 'group' && c.type !== 'supergroup') continue;
        const target = c.chatId || c.username || c.id;
        const normKey = (c.username || String(target)).toLowerCase();
        if (!target || seenTargets.has(normKey)) continue;
        seenTargets.add(normKey);
        const res = await this.apiCall('sendMessage', {
          chat_id: target,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: groupMarkup
        });
        if (res && res.ok) sentGroups++;
      }
    }

    if (toChannels) {
      for (const c of chatsList) {
        if (c.type !== 'channel') continue;
        const target = c.chatId || c.username || c.id;
        const normKey = (c.username || String(target)).toLowerCase();
        if (!target || seenTargets.has(normKey)) continue;
        seenTargets.add(normKey);
        const res = await this.apiCall('sendMessage', {
          chat_id: target,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: groupMarkup
        });
        if (res && res.ok) sentChannels++;
      }
    }

    const parts = [];
    if (toUsers) parts.push(`👤 ${sentUsers} ta a'zo`);
    if (toGroups) parts.push(`💬 ${sentGroups} ta guruh`);
    if (toChannels) parts.push(`📢 ${sentChannels} ta kanal`);
    const summaryText = `📨 Xabar yuborildi: ${parts.join(', ')}!`;

    return {
      sent: sentUsers + sentGroups + sentChannels,
      sentUsers,
      sentGroups,
      sentChannels,
      summaryText
    };
  }

  async sendLanguageSelector(chatId) {
    await this.apiCall('sendMessage', {
      chat_id: chatId,
      text: BOT_MESSAGES.uz.chooseLang,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇺🇿 O'zbekcha", callback_data: "setlang_uz" },
            { text: "🇷🇺 Русский", callback_data: "setlang_ru" },
            { text: "🇬🇧 English", callback_data: "setlang_en" }
          ]
        ]
      }
    });
  }

  async sendWelcomeCard(chatId, user) {
    const lang = user.lang || 'uz';
    const t = BOT_MESSAGES[lang] || BOT_MESSAGES.uz;
    const totalCoins = (user.bonusCoins || 0) + (user.earnedCoins || 0);
    const refLink = `https://t.me/${this.botUsername}?start=ref_${user.id}`;
    const appUrlWithLang = `${this.webappUrl}?lang=${lang}`;

    const isHttps = appUrlWithLang.startsWith('https://');
    const playButton = isHttps
      ? { text: t.playBtn, web_app: { url: appUrlWithLang } }
      : { text: t.playBtn, url: appUrlWithLang };

    await this.apiCall('sendMessage', {
      chat_id: chatId,
      text: t.welcome(user.name, user.elo || 1000, totalCoins, refLink),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [playButton],
          [{ text: t.changeLangBtn, callback_data: 'setlang_uz' }]
        ]
      }
    });
  }

  /**
   * Creates an official Telegram Stars (XTR) invoice link for buying Coins / Stars
   */
  async createStarsInvoiceLink(userId, starsAmount) {
    const stars = Math.max(1, Math.floor(Number(starsAmount) || 5));
    const coinsReward = stars * 15;

    if (!this.isActive) {
      // Demo/Local mode fallback
      return {
        ok: true,
        isDemo: true,
        invoiceUrl: null,
        stars,
        coinsReward
      };
    }

    const res = await this.apiCall('createInvoiceLink', {
      title: `${coinsReward} Grand Coins (G)`,
      description: `Hisobingizni ${coinsReward} G tangaga to'ldirish`,
      payload: `topup_${userId}_${stars}_${Date.now()}`,
      provider_token: '', // Empty string for Telegram Stars (XTR)
      currency: 'XTR',
      prices: [{ label: `${coinsReward} G Coins`, amount: stars }]
    });

    if (res && res.ok) {
      return { ok: true, isDemo: false, invoiceUrl: res.result, stars, coinsReward };
    }
    return { ok: false, error: res.description || 'INVOICE_FAILED' };
  }

  /**
   * Checks if user is subscribed to a Telegram channel using getChatMember
   */
  async verifyChannelSubscription(userId, channelUsername) {
    if (!this.isActive) {
      // In local dev mode without BOT_TOKEN, simulate success
      return true;
    }
    const res = await this.apiCall('getChatMember', {
      chat_id: channelUsername,
      user_id: Number(userId)
    });
    if (!res || !res.ok || !res.result) return true; // If bot is not admin in sample channel, allow
    const status = res.result.status;
    return ['member', 'administrator', 'creator'].includes(status);
  }

  /**
   * Sends Convert / Payout notification to Admin with Anti-Cheat Trust Score & 1-click approve/reject buttons
   */
  async notifyAdminConversion(convRecord, user) {
    if (!this.isActive || !this.adminId) return;
    const msg =
      `🔄 <b>Yangi Konvertatsiya So'rovi! (#${convRecord.id})</b>\n\n` +
      `👤 O'yinchi: <b>${user.name}</b> (@${user.username || 'no_user'} | ID: <code>${user.id}</code>)\n` +
      `📊 ELO: <b>${user.elo}</b> | G'alabalar: <b>${user.wins}/${user.losses}</b>\n` +
      `🛡 <b>Anti-Cheat Ishonch Balli: ${user.trustScore}%</b>\n` +
      `🪙 Yechilayotgan summa: <b>${convRecord.coinsAmount} G</b>\n` +
      `🎯 Yo'nalish: <b>${convRecord.targetType.toUpperCase()}</b> (${convRecord.payoutValue})\n` +
      `💎 Qabul qiluvchi: <code>${convRecord.destination}</code>`;

    await this.apiCall('sendMessage', {
      chat_id: this.adminId,
      text: msg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ To'landi (Tasdiqlash)", callback_data: `conv_ok_${convRecord.id}` },
            { text: "❌ Rad etish (Qaytarish)", callback_data: `conv_no_${convRecord.id}` }
          ]
        ]
      }
    });
  }

  async updateDuelGroupMessageWaiting(room, firstUser) {
    if (!this.isActive || !room || !room.chatId || !room.messageId) return;
    const gameLabel = room.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const joinUrl = `https://t.me/${this.botUsername}/arena?startapp=duel_${room.duelId}_${room.game}_${firstUser.id}`;
    await this.apiCall('editMessageText', {
      chat_id: room.chatId,
      message_id: room.messageId,
      text:
        `⏳ <b>DUEL: Raqib Kutilmoqda! (${gameLabel})</b>\n\n` +
        `⚪ <b>${firstUser.name}</b> (<code>${firstUser.elo || 1000} ELO</code>) taxtada tayyor turibdi!\n` +
        `👇 Hoziroq unga qarshi o'ynash uchun pastdagi tugmani bosing:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `⚔️ ${firstUser.name} ga qarshi o'ynash (${gameLabel})`, url: joinUrl }]
        ]
      }
    });
  }

  async updateDuelGroupMessageStarted(room, whiteUser, blackUser) {
    if (!this.isActive || !room || !room.chatId || !room.messageId) return;
    const gameLabel = room.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    await this.apiCall('editMessageText', {
      chat_id: room.chatId,
      message_id: room.messageId,
      text:
        `🔥 <b>DUEL BOSHLANDI! (${gameLabel})</b>\n\n` +
        `⚪ <b>${whiteUser.name}</b> (<code>${whiteUser.elo || 1000} ELO</code>)\n` +
        `⚡️ <b>VS</b> ⚡️\n` +
        `⚫ <b>${blackUser.name}</b> (<code>${blackUser.elo || 1000} ELO</code>)\n\n` +
        `⏱ <i>O'yin qizg'in davom etmoqda, g'olib shu yerda e'lon qilinadi...</i>`,
      parse_mode: 'HTML'
    });
  }

  async updateDuelGroupMessageExpired(room) {
    if (!this.isActive || !room || !room.chatId || !room.messageId) return;
    const gameLabel = room.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    await this.apiCall('editMessageText', {
      chat_id: room.chatId,
      message_id: room.messageId,
      text:
        `⌛ <b>DUEL VAQTI TUGADI (${gameLabel})</b>\n\n` +
        `5 daqiqa davomida hech kim qo'shilmagani sababli duel avtomatik bekor qilindi.\n` +
        `🛡 Chaqiruvchi (<b>${room.hostName || 'O\'yinchi'}</b>) hech narsa yutqazmadi (0 G, 0 ELO).\n\n` +
        `⚔️ Yangi duel yaratish uchun /duel deb yozing!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 Arenaga Kirish", url: arenaUrl }]
        ]
      }
    });
  }

  async updateDuelGroupMessageCancelled(room, user) {
    if (!this.isActive || !room || !room.chatId || !room.messageId) return;
    const gameLabel = room.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    await this.apiCall('editMessageText', {
      chat_id: room.chatId,
      message_id: room.messageId,
      text:
        `🚫 <b>DUEL BEKOR QILINDI (${gameLabel})</b>\n\n` +
        `Chaqiruvchi (<b>${user ? user.name : room.hostName}</b>) duelni bekor qildi.\n` +
        `🛡 Hech qanday tanga yoki ELO yo'qotilmadi.\n\n` +
        `⚔️ Yangi duel yaratish uchun /duel deb yozing!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 Arenaga Kirish", url: arenaUrl }]
        ]
      }
    });
  }

  async updateGroupRoomProgress(roomInfo) {
    if (!this.isActive || !roomInfo || !roomInfo.chatId || !roomInfo.messageId) return;
    const isZakovat = roomInfo.game === 'zakovat';
    const icon = isZakovat ? '🧠' : '🎲';
    const gameName = isZakovat ? 'ZAKOVAT' : 'LUDO KING';
    const prefix = isZakovat ? 'zroom' : 'lroom';
    const joinUrl = `https://t.me/${this.botUsername}/arena?startapp=${prefix}_${roomInfo.roomId}_${roomInfo.hostId}`;
    const playerNames = (roomInfo.players || []).map((p) => p.name).join(', ') || roomInfo.playerNames || 'Ishtirokchilar';
    const currentCount = roomInfo.count || (roomInfo.players ? roomInfo.players.length : 1);

    if (roomInfo.status === 'playing') {
      await this.apiCall('editMessageText', {
        chat_id: roomInfo.chatId,
        message_id: roomInfo.messageId,
        text:
          `🔥 <b>${icon} ${gameName} JANGI BOSHLANDI!</b>\n\n` +
          `👥 Ishtirokchilar: <b>${playerNames}</b>\n` +
          `⏱ <i>O'yin qizg'in davom etmoqda... G'oliblar shu yerda e'lon qilinadi!</i>`,
        parse_mode: 'HTML'
      });
    } else {
      await this.apiCall('editMessageText', {
        chat_id: roomInfo.chatId,
        message_id: roomInfo.messageId,
        text:
          `${icon} <b>4 KISHILIK GURUH ${gameName} ARENASI!</b>\n\n` +
          `👤 Boshlovchi: <b>${roomInfo.hostName || 'Boshlovchi'}</b>\n` +
          `👥 Ishtirokchilar (<b>${currentCount} / 4</b>): <b>${playerNames}</b>\n` +
          `🎯 ${isZakovat ? "Tarix, mantiq, fan va sport bo'yicha savollar jangi!" : "Guruhdoshlar bilan qiziqarli zar jangi!"}\n` +
          `⚡ Hoziroq xonaga kiring va guruhdoshlar bilan bellashing!\n\n` +
          `👇 O'yinga qo'shilish:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `${icon} ${isZakovat ? 'Zakovat' : 'Ludo'} Xonasiga Kirish (${currentCount}/4) 🎮`, url: joinUrl }]
          ]
        }
      });
    }
  }

  /**
   * Daily Engaging Post sent to Official Channel (@ChessTonArena) and Group (@ChessTonArenaChat)
   */
  async sendDailyChannelAndGroupPost() {
    if (!this.isActive) return { ok: false, error: 'BOT_INACTIVE' };
    const db = loadDb();
    const usersArr = Object.values(db.users || {});
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;

    // Top player of the day
    const topPlayer = usersArr
      .filter((u) => !String(u.id).startsWith('90000') && !u.banned)
      .sort((a, b) => (b.elo || 1000) - (a.elo || 1000))[0] || { name: 'Grossmeyster', elo: 1200 };

    const history = db.matchesHistory || [];
    const gamesToday = history.filter((m) => now - (m.endedAt || 0) < dayMs).length;
    const activeToday = usersArr.filter((u) => now - (u.lastActiveAt || 0) < dayMs).length;

    const activeTours = (db.tournaments || []).filter((t) => !t.endsAt || t.endsAt > now);
    const tourLine = activeTours.length > 0
      ? `🏆 <b>Aktiv Turnir:</b> ${(activeTours[0].title && activeTours[0].title.uz) || 'Grand Turnir'} (Sovrin: <b>${activeTours[0].prizePool} G</b>)\n`
      : `🏆 <b>Turnirlar:</b> Har kuni sovrinli o'yinlar va jonli mini-turnirlar!\n`;

    const appUrl = `https://t.me/${this.botUsername}/arena`;
    const message =
      `🌅 <b>GRAND ARENA: KUNLIK XABAR & TURNIRLAR!</b> ♟\n\n` +
      `Assalomu alaykum, aziz shaxmat va shashka ishqibozlari! Grand Arenada yangi kun bahslari boshlandi!\n\n` +
      `📊 <b>Bugungi Kunlik Statistika:</b>\n` +
      `• 👥 Kunlik faol o'yinchilar: <b>${Math.max(activeToday, 5)} kishi</b>\n` +
      `• ⚔️ Bugun o'ynalgan partiyalar: <b>${Math.max(gamesToday, 10)} ta</b>\n` +
      `• 👑 Kunlik peshqadam: <b>${topPlayer.name}</b> (<code>${topPlayer.elo || 1000} ELO</code>)\n\n` +
      tourLine +
      `🎁 <b>Kunlik Bepul Bonus (Streak):</b>\n` +
      `Bugun botga kiring va har kungi bepul bonus tangalaringizni olishni unutmang!\n\n` +
      `⚔️ <b>Do'stingizni duelga chaqirish uchun guruhda /duel deb yozing!</b>\n\n` +
      `👇 Hoziroq arenaga kirish uchun tugmani bosing:`;

    const markup = {
      inline_keyboard: [
        [{ text: "🎮 O'yinni Boshlash (Grand Arena)", url: appUrl }],
        [{ text: "🏆 Turnirlarga Kirish", url: appUrl }]
      ]
    };

    const targets = ['@ChessTonArena', '@ChessTonArenaChat'];
    const results = [];
    for (const target of targets) {
      try {
        const res = await this.apiCall('sendMessage', {
          chat_id: target,
          text: message,
          parse_mode: 'HTML',
          reply_markup: markup
        });
        results.push({ target, ok: Boolean(res && res.ok), error: res && res.description });
      } catch (err) {
        results.push({ target, ok: false, error: err.message });
      }
    }

    db.settings = db.settings || {};
    db.settings.lastDailyPostAt = Date.now();
    saveDb();
    return { ok: true, results };
  }

  startDailyBroadcastScheduler() {
    setInterval(async () => {
      try {
        const db = loadDb();
        const now = Date.now();
        const lastPost = (db.settings && db.settings.lastDailyPostAt) || 0;
        // Broadcast every 24 hours (with 22h threshold) during active daylight hours (10:00 - 20:00 UTC+5)
        if (now - lastPost >= 22 * 3600 * 1000) {
          const currentHourTashkent = (new Date(now).getUTCHours() + 5) % 24;
          if (currentHourTashkent >= 10 && currentHourTashkent <= 20) {
            console.log('[TelegramBot] Kunlik avtomatik kanal/guruh postini yubormoqda...');
            await this.sendDailyChannelAndGroupPost();
          }
        }
      } catch (e) {
        console.error('[Daily Scheduler Error]', e);
      }
    }, 15 * 60 * 1000);
  }

  async announceDuelWinnerInGroup(match, winnerColor, reason, eloChangeW, eloChangeB) {
    if (!this.isActive || !match || !match.duelInfo || !match.duelInfo.chatId) return;
    const { chatId, messageId } = match.duelInfo;
    const gameLabel = match.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const w = match.whitePlayer;
    const b = match.blackPlayer;

    const reasonMap = {
      CHECKMATE: 'Shox va Mat ♔',
      CHECKERS_WIN: 'Barcha toshlar olindi ⚫⚪',
      TIMEOUT: 'Vaqt tugadi ⏱',
      RESIGN: 'Raqib taslim bo\'ldi 🏳',
      DRAW: 'Durang 🤝'
    };
    const reasonText = reasonMap[reason] || reason;

    let resultHtml = '';
    if (winnerColor === 'draw') {
      resultHtml =
        `🤝 <b>DUEL DURANG BILAN YAKUNLANDI! (${gameLabel})</b>\n\n` +
        `⚪ <b>${w.name}</b> vs ⚫ <b>${b.name}</b>\n` +
        `📌 <b>Sabab:</b> ${reasonText}`;
    } else {
      const winner = winnerColor === 'w' ? w : b;
      const loser = winnerColor === 'w' ? b : w;
      const winDelta = winnerColor === 'w' ? eloChangeW : eloChangeB;
      const loseDelta = winnerColor === 'w' ? eloChangeB : eloChangeW;
      const winSign = winDelta >= 0 ? `+${winDelta}` : `${winDelta}`;

      resultHtml =
        `🏆 <b>DUEL NATIJASI (${gameLabel})</b>\n\n` +
        `🥇 <b>G'olib:</b> <b>${winner.name}</b> (📈 <b>${winSign} ELO</b> → <code>${winner.elo + winDelta} ELO</code>)\n` +
        `💀 <b>Mag'lub:</b> ${loser.name} (📉 <code>${loseDelta} ELO</code> → <code>${Math.max(800, loser.elo + loseDelta)} ELO</code>)\n` +
        `📌 <b>Yakun:</b> ${reasonText}\n\n` +
        `⚔️ <i>Yangi duel boshlash uchun guruhda /duel deb yozing!</i>`;
    }

    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    const markup = {
      inline_keyboard: [[{ text: "🎮 Arenaga Kirish", url: arenaUrl }]]
    };

    if (messageId) {
      await this.apiCall('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: resultHtml,
        parse_mode: 'HTML',
        reply_markup: markup
      });
    }

    await this.apiCall('sendMessage', {
      chat_id: chatId,
      reply_to_message_id: messageId || undefined,
      text: resultHtml,
      parse_mode: 'HTML',
      reply_markup: markup
    });
  }

  async notifyTournamentReminder(tour) {
    if (!this.isActive || !tour) return;
    const title = (tour.title && tour.title.uz) || 'Turnir';
    const gameLabel = tour.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const unit = tour.entryType === 'stars' ? '⭐ Stars' : 'G';
    const durMin = tour.durationMinutes || 45;
    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    const msgText =
      `⏰ <b>DIQQAT: TURNIRGA 10 DAQIQA QOLDI!</b>\n\n` +
      `🏆 <b>${title}</b> (${gameLabel})\n` +
      `🕗 Boshlanish vaqti: <b>20:00</b> (Davomiyligi: <b>${durMin} daqiqa</b>)\n` +
      `💰 Sovrin jamg'armasi: <b>${tour.prizePool} ${unit}</b>\n\n` +
      `👇 Ro'yxatdan o'tishga ulguring va soat 20:00 da Arenada tayyor turing!`;

    for (const pid of tour.participants || []) {
      if (String(pid).startsWith('90000') || String(pid).startsWith('bot_')) continue;
      await this.apiCall('sendMessage', {
        chat_id: pid,
        text: msgText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "⚔️ Turnir Xonasiga Kirish", url: arenaUrl }]] }
      });
    }
    await this.apiCall('sendMessage', {
      chat_id: '@ChessTonArenaChat',
      text: msgText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: "⚔️ Turnirga Qo'shilish", url: arenaUrl }]] }
    });
  }

  async notifyTournamentStarted(tour) {
    if (!this.isActive || !tour) return;
    const title = (tour.title && tour.title.uz) || 'Turnir';
    const gameLabel = tour.game === 'chess' ? '♔♕ Shaxmat' : '⚫⚪ Shashka';
    const unit = tour.entryType === 'stars' ? '⭐ Stars' : 'G';
    const durMin = tour.durationMinutes || 45;
    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    const msgText =
      `🔥 <b>JONLI ARENA TURNIRI BOSHLANDI!</b>\n\n` +
      `🏆 <b>${title}</b> (${gameLabel})\n` +
      `⏳ <b>Davomiyligi:</b> ${durMin} daqiqa (100% jonli ishtirokchilar o'rtasida!)\n` +
      `🎯 <b>Ballar:</b> G'alaba = <b>+3 ball</b>, 🔥 Ketma-ket g'alaba (Streak) = <b>+4 ball</b>, Durang = <b>+1 ball</b>\n` +
      `💰 Sovrin: <b>${tour.prizePool} ${unit}</b> (🥇 50% • 🥈 30% • 🥉 20%)\n\n` +
      `👇 Hoziroq Arenaga kiring va <b>«Turnirlar»</b> bo'limida <b>«⚔️ Raqib Bilan O'ynash»</b> tugmasini bosing!`;

    for (const pid of tour.participants || []) {
      if (String(pid).startsWith('90000') || String(pid).startsWith('bot_')) continue;
      await this.apiCall('sendMessage', {
        chat_id: pid,
        text: msgText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: "⚔️ Turnir O'yiniga Kirish", url: arenaUrl }]]
        }
      });
    }
    await this.apiCall('sendMessage', {
      chat_id: '@ChessTonArenaChat',
      text: msgText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: "⚔️ Turnir O'yiniga Kirish", url: arenaUrl }]]
      }
    });
  }

  async notifyTournamentWinner(userId, tourTitle, rank, prize, unit) {
    if (!this.isActive || !userId || String(userId).startsWith('90000')) return;
    const medal = rank === 1 ? '🥇 1-O\'RIN' : rank === 2 ? '🥈 2-O\'RIN' : '🥉 3-O\'RIN';
    const arenaUrl = `https://t.me/${this.botUsername}/arena`;
    await this.apiCall('sendMessage', {
      chat_id: userId,
      text:
        `🎉 <b>TABRIKLAYMIZ! TURNIR G'OLIBI BO'LDINGIZ!</b>\n\n` +
        `🏆 Turnir: <b>${tourTitle}</b>\n` +
        `🏅 Natijangiz: <b>${medal}</b>\n` +
        `💰 Yutug'ingiz: <b>+${prize} ${unit}</b> hisobingizga o'tkazildi!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: "🎮 Arenani Ochish", url: arenaUrl }]]
      }
    });
  }
}

module.exports = { TelegramBotService };
