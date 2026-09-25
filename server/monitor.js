import fs from 'node:fs';
import path from 'node:path';
import { crearBackup, BACKUP_DIR, BACKUP_KEEP } from './backup.js';
import { leerConfigSmtp, transporte, remitenteDesdeConfig, registrarNotificacion } from './notify.js';
import { db } from './db.js';
import { metasHoras, calcularSla } from './sla.js';
import { notificarAUsuariosActivos } from './not_app.js';

export const AUTO_BACKUP_HOUR = clampHora(Number(process.env.AUTO_BACKUP_HOUR ?? 3));
export const RESUMEN_HOUR = clampHora(Number(process.env.RESUMEN_HOUR ?? 6));
export const RESUMEN_SEMANAL_DIA = clampDia(Number(process.env.RESUMEN_SEMANAL_DIA ?? 1));
export const RESUMEN_SEMANAL_HOUR = clampHora(Number(process.env.RESUMEN_SEMANAL_HOUR ?? 7));
const INTERVALO_MS = 10 * 60 * 1000;
const ATRASO_MAX_HORAS = 26;
const CO_OFFSET_MS = -5 * 60 * 60 * 1000; // Bogotá (UTC-5)
const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

function clampHora(n) {
  if (Number.isInteger(n) && n >= 0 && n <= 23) return n;
  return 3;
}

function clampDia(n) {
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return 1; // domingo=0 … sábado=6; por defecto lunes
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

// Fecha local de Bogotá en formato YYYY-M-D (para deduplicar avisos por día).
function claveDia() {
  const b = new Date(Date.now() + CO_OFFSET_MS);
  return `${b.getUTCFullYear()}-${b.getUTCMonth() + 1}-${b.getUTCDate()}`;
}

// Media noche de hoy en Bogotá como epoch (ms).
function inicioDeHoyBogota() {
  return Math.floor((Date.now() + CO_OFFSET_MS) / DIA_MS) * DIA_MS - CO_OFFSET_MS;
}

// Clave de la semana (lunes de la semana actual en Bogotá, YYYY-M-D) para deduplicar.
function claveSemana() {
  const b = new Date(Date.now() + CO_OFFSET_MS);
  const diaSemana = b.getUTCDay(); // 0 = domingo
  const lunes = new Date(b.getTime() - (diaSemana === 0 ? 6 : diaSemana - 1) * DIA_MS + CO_OFFSET_MS);
  return `${lunes.getUTCFullYear()}-${lunes.getUTCMonth() + 1}-${lunes.getUTCDate()}`;
}

// Compara la última copia local con el tiempo máximo tolerable y avisa una vez al día.
let avisoAtrasoDia = '';
function avisarSiAtrasado() {
  const estado = estadoBackups();
  if (!estado.ultimo) return;
  const horas = (Date.now() - estado.ultimo) / 3600000;
  if (horas > ATRASO_MAX_HORAS && avisoAtrasoDia !== claveDia()) {
    avisoAtrasoDia = claveDia();
    const texto = `El último backup de la base de datos tiene ${Math.floor(horas)} horas.\nRevise el estado del servidor y la programación diaria (AUTO_BACKUP_HOUR).`;
    void enviarAlerta({ asunto: 'Backup atrasado', cuerpo: texto });
  }
}

// Resumen operativo diario por correo: pendientes, nuevas/resueltas de hoy, backups y admins.
// Nunca lanza; no envía (ni registra) si SMTP o destinatarios no están configurados.
export async function enviarResumenDiario() {
  try {
    const conf = leerConfigSmtp();
    if (!conf.configurado) return false;
    const destinatarios = destinatariosAlerta(conf);
    if (destinatarios.length === 0) return false;

    const inicioHoy = inicioDeHoyBogota();
    const hoy = new Date(Date.now() + CO_OFFSET_MS).toISOString().slice(0, 10);
    const pendientes = db.prepare("SELECT COUNT(*) AS c FROM incidencias WHERE estado IN ('nueva','en_diagnostico')").get().c;
    const nuevasHoy = db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE creada_en >= ?').get(inicioHoy).c;
    const resueltasHoy = db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE estado = ? AND resuelta_en >= ?').get('resuelta', inicioHoy).c;
    const admins = db.prepare("SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin' AND activo = 1").get().c;
    const backups = estadoBackups();
    const ultimoBackup = backups.ultimo
      ? `${Math.round((Date.now() - backups.ultimo) / 3600000)} h atrás`
      : 'sin copias';

    const cuerpo = [
      `Fecha: ${hoy}`,
      `Incidencias pendientes (nueva + en diagnóstico): ${pendientes}`,
      `Nuevas hoy: ${nuevasHoy}`,
      `Resueltas hoy: ${resueltasHoy}`,
      `Último backup: ${ultimoBackup} (${backups.cantidad} copias locales)`,
      `Administradores activos: ${admins}`
    ].join('\n');

    return enviarAlerta({ asunto: 'Resumen operativo diario', cuerpo });
  } catch {
    return false;
  }
}

// Resumen semanal por correo (lunes por defecto): actividad de los últimos 7 días.
// Nunca lanza; no envía (ni registra) si SMTP o destinatarios no están configurados.
export async function enviarResumenSemanal() {
  try {
    const conf = leerConfigSmtp();
    if (!conf.configurado) return false;
    const destinatarios = destinatariosAlerta(conf);
    if (destinatarios.length === 0) return false;

    const hace7 = Date.now() - SEMANA_MS;
    const inicioTexto = new Date(hace7 + CO_OFFSET_MS).toISOString().slice(0, 10);
    const finTexto = new Date(Date.now() + CO_OFFSET_MS).toISOString().slice(0, 10);

    const nuevas = db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE creada_en >= ?').get(hace7).c;
    const resueltas = db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE estado = ? AND resuelta_en >= ?').get('resuelta', hace7).c;
    const pendientes = db.prepare("SELECT COUNT(*) AS c FROM incidencias WHERE estado IN ('nueva','en_diagnostico')").get().c;
    const abiertas = db.prepare("SELECT estado, prioridad, creada_en FROM incidencias WHERE estado IN ('nueva','en_diagnostico')").all();
    const slaVencidas = abiertas.filter((i) => calcularSla(i).estado === 'vencido').length;

    const califs = db.prepare('SELECT valor FROM calificaciones WHERE creada_en >= ?').all(hace7);
    const prom = califs.length ? (califs.reduce((s, c) => s + c.valor, 0) / califs.length) : null;

    const filaTiempo = db.prepare('SELECT AVG(resuelta_en - creada_en) AS ms FROM incidencias WHERE estado = ? AND resuelta_en >= ?').get('resuelta', hace7);
    const tMin = filaTiempo?.ms != null ? Math.round(filaTiempo.ms / 60000) : null;

    const cuerpo = [
      `Período: ${inicioTexto} → ${finTexto}`,
      `Nuevas: ${nuevas} (promedio ${nuevas ? (nuevas / 7).toFixed(1) : 0}/día)`,
      `Resueltas: ${resueltas} (promedio ${resueltas ? (resueltas / 7).toFixed(1) : 0}/día)`,
      `Tiempo promedio de resolución: ${tMin == null ? '—' : `${tMin} min`}`,
      `Pendientes actuales: ${pendientes}`,
      `Casos abiertos con SLA vencido: ${slaVencidas}`,
      `Valoraciones recibidas: ${califs.length}${prom != null ? ` (promedio ${prom.toFixed(2)}/5)` : ''}`
    ].join('\n');

    return enviarAlerta({ asunto: 'Resumen operativo semanal', cuerpo });
  } catch {
    return false;
  }
}

export function programarBackupDiario() {
  let diaEjecutado = '';
  let diaResumen = '';
  let semanaEjecutada = '';
  const timer = setInterval(() => {
    const ahora = new Date();
    const hoy = claveDia();
    avisarSiAtrasado();
    if (ahora.getHours() === RESUMEN_HOUR && diaResumen !== hoy) {
      diaResumen = hoy;
      void enviarResumenDiario();
    }
    if (ahora.getDay() === RESUMEN_SEMANAL_DIA && ahora.getHours() === RESUMEN_SEMANAL_HOUR && semanaEjecutada !== claveSemana()) {
      semanaEjecutada = claveSemana();
      void enviarResumenSemanal();
    }
    if (ahora.getMinutes() % 30 === 0) {
      void escalarAbandonadas();
    }
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

// Escalamiento automático de casos sin atención: incidencias abiertas (nueva/en
// diagnóstico) sin actividad en las últimas N horas (config `escalamiento_horas`).
// Cada escalamiento inserta una fila en `actividad`, usada como deduplicador: el
// caso no vuelve a escalar hasta que pase de nuevo el umbral de inactividad.
export function escalarAbandonadas() {
  let escaladas = 0;
  try {
    const horas = metasHoras().escalamiento;
    const cutoff = Date.now() - horas * 3600000;
    const casos = db.prepare(`
      SELECT i.id, i.numero_ticket, i.cliente, i.prioridad, i.creada_en, i.estado, t.nombre AS tecnico
      FROM incidencias i
      LEFT JOIN tecnicos t ON t.id = i.tecnico_id
      WHERE i.estado IN ('nueva','en_diagnostico')
        AND i.creada_en < ?
        AND NOT EXISTS (SELECT 1 FROM actividad a WHERE a.incidencia_id = i.id AND a.creada_en >= ?)
    `).all(cutoff, cutoff);

    if (casos.length === 0) return 0;

    const insert = db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)');
    for (const c of casos) {
      const sinActividad = Math.max(1, Math.round((Date.now() - c.creada_en) / 3600000));
      insert.run(c.id, 'Sistema', 'escalamiento_automatico', `Sin actividad en ${sinActividad} h · escalada por el sistema`, Date.now());
      notificarAUsuariosActivos({
        rol: 'admin',
        incidenciaId: c.id,
        titulo: `${c.numero_ticket} escalada por inactividad`,
        cuerpo: `Sin actividad en ${sinActividad} h · ${c.cliente}`
      });
    }
    escaladas = casos.length;

    const cuerpo = [
      `Se detectaron ${escaladas} caso(s) abierto(s) sin actividad en las últimas ${horas} horas:`,
      '',
      ...casos.map((c) => `· ${c.numero_ticket} — ${c.cliente} (prioridad ${c.prioridad}) — técnico: ${c.tecnico ?? 'sin asignar'} — abierta hace ${Math.round((Date.now() - c.creada_en) / 3600000)} h`),
      '',
      'Revise estos casos en la plataforma y priorice su atención.'
    ].join('\n');
    void enviarAlerta({ asunto: `Escalamiento automático: ${escaladas} caso(s) sin atención`, cuerpo });
  } catch (err) {
    console.error(`[monitor] falló el escalamiento automático: ${err.message}`);
  }
  return escaladas;
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