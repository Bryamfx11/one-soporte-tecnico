import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, 'one.db');
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(__dirname, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

if (!fs.existsSync(DB_PATH)) {
  console.error(`[backup] La base de datos no existe: ${DB_PATH}`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(BACKUP_DIR, `one-${stamp}.db`);
const destSafe = dest.replace(/'/g, "''");

const db = new DatabaseSync(DB_PATH);
db.exec(`VACUUM INTO '${destSafe}'`);
db.close();

const backups = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.db')).sort();
for (const name of backups.slice(0, backups.length - KEEP)) {
  fs.rmSync(path.join(BACKUP_DIR, name));
}

console.log(`[backup] ${dest}`);