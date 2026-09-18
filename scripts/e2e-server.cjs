const { spawn } = require('node:child_process');
const { mkdirSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const dbDir = join(root, 'e2e', '.tmp');
mkdirSync(dbDir, { recursive: true });

for (const suffix of ['', '-wal', '-shm']) {
  rmSync(join(dbDir, 'e2e.db' + suffix), { force: true });
}

process.env.DB_PATH = join(dbDir, 'e2e.db');

const child = spawn(process.execPath, [join(root, 'server', 'index.js')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env
});

function terminar() {
  child.kill();
  process.exit(0);
}
process.on('SIGTERM', terminar);
process.on('SIGINT', terminar);
child.on('exit', (code) => process.exit(code ?? 1));