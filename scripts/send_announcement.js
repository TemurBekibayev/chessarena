const fs = require('fs');
const path = require('path');
const https = require('https');

const ENV_PATHS = [
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env'),
  '/var/www/chess.amuhr.uz/.env'
];
const DB_PATHS = [
  path.resolve(__dirname, 'data/database.json'),
  path.resolve(__dirname, '../data/database.json'),
  '/var/www/chess.amuhr.uz/data/database.json'
];

function loadEnv() {
  const env = {};
  for (const p of ENV_PATHS) {
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let val = (match[2] || '').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[match[1]] = val;
        }
      }
      break;
    }
  }
  return env;
}

function getDbPath() {
  for (const p of DB_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return DB_PATHS[0];
}

const env = loadEnv();
const BOT_TOKEN = process.env.BOT_TOKEN || env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME || env.BOT_USERNAME || 'ChessTonArenaBot';
const WEBAPP_URL = process.env.WEBAPP_URL || env.WEBAPP_URL || 'https://chess.amuhr.uz';

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN not found in .env');
  process.exit(1);
}

function telegramRequest(method, payload) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ ok: false, error: 'JSON parse error' });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(postData);
    req.end();
  });
}

const MESSAGE_TEXT =
`🎉 <b>KATTA YANGILANISH: YANGI O'YINLAR VA ADOLATLI ELO REYTINQI!</b> 🚀

Hurmatli <b>Chess Ton Arena</b> ishtirokchilari! Platformamizda katta va kutilgan yangilanishlar amalga oshirildi:

🧠 <b>1. Zakovat Arena (Viktorina)</b>
• 4 kishilik intellektual turnir!
• Tarix, mantiq, fan va sport bo'yicha savollarga tezkor javob bering, 50/50 yordamidan foydalaning va sovrin yutib oling!

🎲 <b>2. Ludo King Arena</b>
• 4 kishilik klassik va zavqli stol o'yini!
• Zarlarni tashlang, donalaringizni marraga yetkazing va do'stlaringiz bilan qizg'in bahslashib g'olib bo'ling!

🏆 <b>3. Adolatli va Mustaqil ELO Reytingi</b>
• Endi har bir o'yin (Shaxmat, Shashka, Zakovat, Ludo) uchun <b>alohida ELO reytingi</b> joriy qilindi!
• O'tmishdagi barcha partiyalar qayta hisoblab chiqildi va Reyting bo'limida har bir o'yin uchun alohida peshqadamlar jadvali ochildi!

🎵 <b>4. Jonli Ovozlar va Musiqa</b>
• Har bir harakat, g'alaba, mag'lubiyat, Ludo zarlari hamda atmosferali fon musiqasi qo'shildi!

🎁 <i>Hoziroq kiring, o'z mahoratingizni sinang va sovrinlarni yutib oling!</i>`;

const REPLY_MARKUP_USER = {
  inline_keyboard: [
    [
      { text: "🎮 Arenada O'ynash", web_app: { url: WEBAPP_URL } }
    ]
  ]
};

const REPLY_MARKUP_GROUP = {
  inline_keyboard: [
    [
      { text: "🎮 Arenada O'ynash", url: `https://t.me/${BOT_USERNAME}/app` }
    ]
  ]
};

async function broadcast() {
  console.log('--- E\'LON TARQATISH BOSHLANDI ---');
  const db = JSON.parse(fs.readFileSync(getDbPath(), 'utf8'));

  let sentUsers = 0;
  let failedUsers = 0;
  let sentChats = 0;
  let failedChats = 0;

  // 1. Foydalanuvchilarga yuborish
  const userIds = Object.keys(db.users || {});
  console.log(`Jami foydalanuvchilar: ${userIds.length} ta`);

  for (const uid of userIds) {
    if (uid.startsWith('90000') || uid.startsWith('bot_')) continue;
    try {
      const res = await telegramRequest('sendMessage', {
        chat_id: uid,
        text: MESSAGE_TEXT,
        parse_mode: 'HTML',
        reply_markup: REPLY_MARKUP_USER
      });
      if (res.ok) {
        sentUsers++;
      } else {
        failedUsers++;
      }
    } catch {
      failedUsers++;
    }
    await new Promise((r) => setTimeout(r, 45)); // Rate-limit himoyasi
  }

  // 2. Guruhlarga yuborish
  const botChats = Object.values(db.botChats || {});
  console.log(`Ulangan guruhlar soni: ${botChats.length} ta`);

  const seenChats = new Set();
  for (const c of botChats) {
    const target = c.chatId || c.username || c.id;
    if (!target) continue;
    const key = String(target).toLowerCase();
    if (seenChats.has(key)) continue;
    seenChats.add(key);

    try {
      const res = await telegramRequest('sendMessage', {
        chat_id: target,
        text: MESSAGE_TEXT,
        parse_mode: 'HTML',
        reply_markup: REPLY_MARKUP_GROUP
      });
      if (res.ok) {
        sentChats++;
        console.log(`Guruhga yuborildi: ${target}`);
      } else {
        failedChats++;
        console.log(`Guruhga yuborilmadi (${target}): ${res.description || res.error}`);
      }
    } catch (err) {
      failedChats++;
      console.log(`Guruhga xatolik: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  // 3. Rasmiy Kanal va Guruhga yuborish
  const publicChannels = ['@ChessTonArena', '@ChessTonArenaChat'];
  for (const ch of publicChannels) {
    if (seenChats.has(ch.toLowerCase())) continue;
    try {
      const res = await telegramRequest('sendMessage', {
        chat_id: ch,
        text: MESSAGE_TEXT,
        parse_mode: 'HTML',
        reply_markup: REPLY_MARKUP_GROUP
      });
      if (res.ok) {
        sentChats++;
        console.log(`Kanal/Guruhga yuborildi: ${ch}`);
      } else {
        console.log(`Kanal/Guruhga yuborilmadi (${ch}): ${res.description || res.error}`);
      }
    } catch (err) {
      console.log(`Kanal xatolik: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log('\n--- XULOSA ---');
  console.log(`✅ Foydalanuvchilarga yetkazildi: ${sentUsers} ta (Muvaffaqiyatsiz/Bloklangan: ${failedUsers})`);
  console.log(`✅ Guruh va Kanallarga yetkazildi: ${sentChats} ta`);
  console.log('--- YAKUNLANDI ---');
}

broadcast();
