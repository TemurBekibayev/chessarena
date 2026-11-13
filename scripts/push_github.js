const cp = require('child_process');

function run(cmd) {
  try {
    const out = cp.execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log('[OK]', cmd);
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (err) {
    console.log('[ERR/WARN]', cmd, err.stderr || err.message);
    return null;
  }
}

run('git init');
run('git config user.name "TemurBekibayev"');
run('git config user.email "temurkhann2000@gmail.com"');
run('git add .');
run('git commit -m "Initial commit"');
run('git branch -M main');
run('git remote remove origin');
run('git remote add origin https://github.com/TemurBekibayev/chessarena.git');
run('git remote -v');
run('git push -u origin main');
