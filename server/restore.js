import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_PATH, BACKUP_DIR } from './backup.js';

// Verifica que el archivo sea una base SQLite íntegra y tenga tablas
export function verificarIntegridad(backup) {
  try {
    const db = new DatabaseSync(backup, { readOnly: true });
    try {
      const filas = db.prepare('PRAGMA integrity_check').all();
      const ok = filas.length > 0 && filas.every((f) => String(f.integrity_check) === 'ok');
      const tablas = db.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'").get().c;
      return { ok: ok && tablas > 0, tablas };
    } finally {
      db.close();
    }
  } catch (err) {
    return { ok: false, tablas: 0, error: err.message };
  }
}

// Restaura `backup` sobre `destino` (por defecto la BD de producción).
// Antes de sobrescribir crea un snapshot de seguridad `pre-restore-*` en BACKUP_DIR.
export function restaurar(backup, destino = DB_PATH, dirSnapshots = BACKUP_DIR) {
  if (backup === destino) {
    throw new Error('La copia de seguridad y el destino son el mismo archivo');
  }
  if (!fs.existsSync(backup)) {
    throw new Error(`No existe la copia de seguridad: ${backup}`);
  }
  const integridad = verificarIntegridad(backup);
  if (!integridad.ok) {
    throw new Error('La copia de seguridad no pasa la verificación de integridad');
  }

  const preRestore = fs.existsSync(destino) ? (() => {
    fs.mkdirSync(dirSnapshots, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pre = path.join(dirSnapshots, `pre-restore-${stamp}.db`);
    const db = new DatabaseSync(destino);
    try {
      db.exec(`VACUUM INTO '${pre.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }
    return pre;
  })() : null;

  fs.copyFileSync(backup, destino);
  return { destino, preRestore };
}

// Punto de entrada para `npm run restore -- <backup> [destino]`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [backup, destino] = process.argv.slice(2);
  if (!backup) {
    console.error('Uso: node restore.js <copia-de-seguridad.db> [destino.db]');
    console.error('Ejemplo: node restore.js backups/one-2026-01-01T12-00-00.db');
    process.exit(1);
  }
  try {
    const { destino: usado, preRestore } = restaurar(backup, destino);
    console.log(`[restore] Integridad OK, restaurado en ${usado}`);
    if (preRestore) console.log(`[restore] Snapshot de seguridad previo: ${preRestore}`);
    else console.log('[restore] No existía base previa en el destino');
  } catch (err) {
    console.error(`[restore] ${err.message}`);
    process.exit(1);
  }
}