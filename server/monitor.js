import fs from 'node:fs';
import path from 'node:path';
import { crearBackup, BACKUP_DIR, BACKUP_KEEP } from './backup.js';

export const AUTO_BACKUP_HOUR = clampHora(Number(process.env.AUTO_BACKUP_HOUR ?? 3));
const INTERVALO_MS = 10 * 60 * 1000;

function clampHora(n) {
  if (Number.isInteger(n) && n >= 0 && n <= 23) return n;
  return 3;
}

export function programarBackupDiario() {
  let diaEjecutado = '';
  const timer = setInterval(() => {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`;
    if (ahora.getHours() !== AUTO_BACKUP_HOUR || diaEjecutado === hoy) return;
    try {
      const dest = crearBackup();
      console.log(`[monitor] backup automático: ${dest}`);
      diaEjecutado = hoy;
    } catch (err) {
      console.error(`[monitor] falló el backup automático: ${err.message}`);
    }
  }, INTERVALO_MS);
  timer.unref();
  return timer;
}

export function estadoBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return { ultimo: null, cantidad: 0 };
  const archivos = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.db')).sort();
  if (archivos.length === 0) return { ultimo: null, cantidad: 0 };
  const mtime = fs.statSync(path.join(BACKUP_DIR, archivos[archivos.length - 1])).mtimeMs;
  return { ultimo: Math.round(mtime), cantidad: archivos.length, guardados: BACKUP_KEEP };
}