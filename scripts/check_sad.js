const https = require('https');

https.get('https://sad.adsgram.ai/js/sad.min.js', (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    const idx = d.indexOf('adsgram-task');
    console.log('Found index:', idx);
    if (idx !== -1) {
      console.log('Snippet around adsgram-task:');
      console.log(d.slice(Math.max(0, idx - 200), idx + 800));
    }
  });
});
