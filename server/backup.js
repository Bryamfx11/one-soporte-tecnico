import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, 'one.db');
export const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(__dirname, 'backups');
export const BACKUP_KEEP = Number(process.env.BACKUP_KEEP ?? 14);
// Copia espejo de cada backup en un directorio externo (USB/NAS/red). Vacío = desactivado.
export const BACKUP_EXTERNO_DIR = (process.env.BACKUP_EXTERNO_DIR ?? '').trim();

export function podarBackups(keep = BACKUP_KEEP, dir = BACKUP_DIR) {
  const backups = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      try { return { name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }; }
      catch { return { name, mtime: 0 }; }
    })
    .sort((a, b) => a.mtime - b.mtime);
  const sobrantes = backups.slice(0, Math.max(backups.length - keep, 0));
  for (const { name } of sobrantes) {
    fs.rmSync(path.join(dir, name), { force: true });
  }
  return backups.length - sobrantes.length;
}

export function copiarExterno(dest, dir = BACKUP_EXTERNO_DIR) {
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  const nombre = path.basename(dest);
  const externo = path.join(dir, nombre);
  fs.copyFileSync(dest, externo);
  podarBackups(BACKUP_KEEP, dir);
  return externo;
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
  const externo = copiarExterno(dest);
  if (externo) console.log(`[backup] copia externa en ${externo}`);
  podarBackups();
  return dest;
}

// Punto de entrada para `npm run backup`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    crearBackup();
    const restantes = podarBackups();
    console.log(`[backup] Se conservan hasta ${BACKUP_KEEP} copias en ${BACKUP_DIR} (${restantes} en disco)`);
  } catch (err) {
    console.error(`[backup] ${err.message}`);
    process.exit(1);
  }
}