# 🏆 Grand Arena — Shashka & Shaxmat Telegram Mini App

To'liq himoyalangan (Server-Authoritative + Anti-Cheat), 3 tilda ishlovchi (**🇺🇿 O'zbek, 🇷🇺 Русский, 🇬🇧 English**), **ELO Reyting**, **Turnirlar**, **Referal ko'paytirish tizimi**, **AdsGram** va **Convert (Valyuta ayirboshlash)** bo'limlariga ega tayyor Telegram Bot + WebApp loyihasi.

---

## 📂 Loyiha tuzilmasi

- [src/server.js](file:///d:/projects/ai%20chess/src/server.js) — Express va WebSocket (`ws`) o'yin serveri, Matchmaking, Turnirlar va Convert API.
- [src/bot.js](file:///d:/projects/ai%20chess/src/bot.js) — Telegram Bot (`/start`, til tanlash, Referal, Telegram Stars `XTR` to'lovlari, Kanal obunasi tekshiruvi va Admin xabarnomalari).
- [src/security.js](file:///d:/projects/ai%20chess/src/security.js) — Telegram `initData` (HMAC-SHA256) tekshiruvi, Anti-Collusion (Chip-dumping himoyasi) va Anti-Cheat dvijoki.
- [src/checkersEngine.js](file:///d:/projects/ai%20chess/src/checkersEngine.js) — Server-side Shashka qoidalari (majburiy urib olish, ko'p sakrash `path`, Damka) + Minimax Alpha-Beta AI.
- [src/chessEngine.js](file:///d:/projects/ai%20chess/src/chessEngine.js) — Server-side Shaxmat qoidalari (`chess.js`) + Minimax Alpha-Beta AI.
- [src/db.js](file:///d:/projects/ai%20chess/src/db.js) — Atomik qulflangan (`withUserLock` — Race Condition'ga qarshi) ma'lumotlar bazasi (`Bonus Balans` va `Earned Balans` ajratilgan).
- [public/index.html](file:///d:/projects/ai%20chess/public/index.html), [public/styles.css](file:///d:/projects/ai%20chess/public/styles.css), [public/app.js](file:///d:/projects/ai%20chess/public/app.js), [public/i18n.js](file:///d:/projects/ai%20chess/public/i18n.js) — Mobil Mini App interfeysi.

---

## 🚀 Ishga tushirish

1. `.env` faylini ochib, o'z ma'lumotlaringizni kiriting:
   ```env
   BOT_TOKEN=123456789:AAH...
   BOT_USERNAME=SizningBotingizUseri
   WEBAPP_URL=https://sizning-domeningiz.uz
   ADMIN_TELEGRAM_ID=5082009770
   ADSGRAM_BLOCK_ID=48571
   PORT=3000
   ```
2. Serverni ishga tushiring:
   ```bash
   npm start
   ```
3. Brauzerda ko'rish va test qilish uchun:
   `http://localhost:3000` manzilini oching.
