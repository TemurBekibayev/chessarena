const fs = require('fs');
const path = require('path');

const dbPaths = [
  path.resolve(__dirname, '../data/database.json'),
  '/var/www/chess.amuhr.uz/data/database.json'
];

for (const p of dbPaths) {
  if (fs.existsSync(p)) {
    const db = JSON.parse(fs.readFileSync(p, 'utf8'));
    db.settings = db.settings || {};
    db.settings.adsgramTaskBlockId = 'task-58978';
    
    if (!db.tasks) db.tasks = [];
    if (!db.tasks.find((t) => t.id === 'adsgram_official_task')) {
      db.tasks.splice(2, 0, {
        id: 'adsgram_official_task',
        type: 'adsgram_task',
        rewardCoins: 10,
        repeatableCooldownMs: 30000,
        title: {
          uz: "🎯 Hamkor topshirig'ini bajaring (+10 G)",
          ru: "🎯 Выполнить задание партнера (+10 G)",
          en: "🎯 Complete Partner Task (+10 G)"
        }
      });
    }
    fs.writeFileSync(p, JSON.stringify(db, null, 2));
    console.log('Successfully updated:', p);
    break;
  }
}
