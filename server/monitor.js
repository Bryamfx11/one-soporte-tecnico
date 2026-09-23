import fs from 'node:fs';
import path from 'node:path';
import { crearBackup, BACKUP_DIR, BACKUP_KEEP } from './backup.js';
import { leerConfigSmtp, transporte, remitenteDesdeConfig, registrarNotificacion } from './notify.js';
import { db } from './db.js';

export const AUTO_BACKUP_HOUR = clampHora(Number(process.env.AUTO_BACKUP_HOUR ?? 3));
const INTERVALO_MS = 10 * 60 * 1000;
const ATRASO_MAX_HORAS = 26;

function clampHora(n) {
  if (Number.isInteger(n) && n >= 0 && n <= 23) return n;
  return 3;
}

function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function destinatariosAlerta(conf) {
  const lista = conf.alertaEmail ? [conf.alertaEmail] : [];
  if (lista.length === 0) {
    const admins = db.prepare("SELECT email FROM usuarios WHERE rol = 'admin' AND activo = 1 ORDER BY id").all();
    lista.push(...admins.map((a) => a.email));
  }
  return [...new Set(lista.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)))];
}

// Envía una alerta operativa (backup, monitoreo). Nunca lanza.
export async function enviarAlerta({ asunto, cuerpo }) {
  try {
    const conf = leerConfigSmtp();
    if (!conf.configurado) return false;
    const destinatarios = destinatariosAlerta(conf);
    if (destinatarios.length === 0) return false;
    const asuntoFinal = `[ONETec] ${String(asunto ?? '').slice(0, 80)}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;"><h3 style="margin:0 0 8px;">${escapar(asunto)}</h3><pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap;">${escapar(cuerpo)}</pre></div>`;
    for (const to of destinatarios) {
      await transporte.sendMail(conf, { from: remitenteDesdeConfig(conf), to, subject: asuntoFinal, html });
      registrarNotificacion({ tipo: 'alerta', destinatario: to, asunto: asuntoFinal, estado: 'enviado' });
    }
    return true;
  } catch (err) {
    registrarNotificacion({ tipo: 'alerta', destinatario: '', asunto: `[ONETec] ${String(asunto ?? '')}`, estado: 'error', error: err.message });
    return false;
  }
}

// Compara la última copia local con el tiempo máximo tolerable y avisa una vez al día.
let avisoAtrasoDia = '';
function avisarSiAtrasado() {
  const estado = estadoBackups();
  if (!estado.ultimo) return;
  const horas = (Date.now() - estado.ultimo) / 3600000;
  const hoy = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
  if (horas > ATRASO_MAX_HORAS && avisoAtrasoDia !== hoy) {
    avisoAtrasoDia = hoy;
    const texto = `El último backup de la base de datos tiene ${Math.floor(horas)} horas.\nRevise el estado del servidor y la programación diaria (AUTO_BACKUP_HOUR).`;
    void enviarAlerta({ asunto: 'Backup atrasado', cuerpo: texto });
  }
}

export function programarBackupDiario() {
  let diaEjecutado = '';
  const timer = setInterval(() => {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${ahora.getMonth() + 1}-${ahora.getDate()}`;
    avisarSiAtrasado();
    if (ahora.getHours() !== AUTO_BACKUP_HOUR || diaEjecutado === hoy) return;
    try {
      const dest = crearBackup();
      console.log(`[monitor] backup automático: ${dest}`);
      diaEjecutado = hoy;
    } catch (err) {
      console.error(`[monitor] falló el backup automático: ${err.message}`);
      void enviarAlerta({ asunto: 'Fallo del backup automático', cuerpo: err.message });
    }
  }, INTERVALO_MS);
  timer.unref();
  return timer;
}

export function estadoBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return { ultimo: null, cantidad: 0 };
  const archivos = fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      try { return { name, mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs }; }
      catch { return { name, mtime: 0 }; }
    })
    .sort((a, b) => a.mtime - b.mtime);
  if (archivos.length === 0) return { ultimo: null, cantidad: 0 };
  const ultimo = archivos[archivos.length - 1].mtime;
  return { ultimo: Math.round(ultimo), cantidad: archivos.length, guardados: BACKUP_KEEP };
}