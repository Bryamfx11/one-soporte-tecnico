import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, 'one.db');
export const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(__dirname, 'backups');
export const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 14);

export function podarBackups(keep = BACKUP_KEEP, dir = BACKUP_DIR) {
  const backups = fs.readdirSync(dir).filter((name) => name.endsWith('.db')).sort();
  const sobrantes = backups.slice(0, backups.length - keep);
  for (const name of sobrantes) {
    fs.rmSync(path.join(dir, name), { force: true });
  }
  return backups.length - sobrantes.length;
}

export function crearBackup() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`La base de datos no existe: ${DB_PATH}`);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `one-${stamp}.db`);
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  podarBackups();
  return dest;
}

// Punto de entrada para `npm run backup`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const dest = crearBackup();
    console.log(`[backup] ${dest}`);
    const restantes = podarBackups();
    console.log(`[backup] Se conservan hasta ${BACKUP_KEEP} copias en ${BACKUP_DIR} (${restantes} en disco)`);
  } catch (err) {
    console.error(`[backup] ${err.message}`);
    process.exit(1);
  }
}