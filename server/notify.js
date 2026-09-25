import nodemailer from 'nodemailer';
import { db } from './db.js';

export const ESTADOS_LABEL = {
  nueva: 'Nueva',
  en_diagnostico: 'En diagnóstico',
  resuelta: 'Resuelta',
  escalada: 'Escalada'
};

const CLAVES_CONFIG = ['notif_habilitada', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'alerta_email', 'url_publica'];

export function leerConfigSmtp() {
  const filas = new Map();
  for (const c of CLAVES_CONFIG) {
    const r = db.prepare('SELECT valor FROM config WHERE clave = ?').get(c);
    if (r) filas.set(c, r.valor);
  }
  const habilitada = filas.get('notif_habilitada') === '1';
  const host = (filas.get('smtp_host') ?? '').trim();
  const port = Number(filas.get('smtp_port') || 587);
  const user = (filas.get('smtp_user') ?? '').trim();
  const pass = filas.get('smtp_pass') ?? '';
  const from = (filas.get('smtp_from') ?? '').trim();
  const fromName = (filas.get('smtp_from_name') ?? '').trim();
  const alertaEmail = (filas.get('alerta_email') ?? '').trim();
  const publicUrl = (filas.get('url_publica') ?? '').trim();
  return {
    habilitada,
    host,
    port,
    user,
    from,
    fromName,
    alertaEmail,
    publicUrl,
    passConfigurada: pass !== '',
    configurado: habilitada && host !== '' && from !== ''
  };
}

export function validarConfigSmtp(body) {
  const errors = [];
  if (typeof body.habilitada !== 'boolean') {
    errors.push('habilitada debe ser un booleano');
  }
  if (typeof body.host !== 'string' || body.host.trim() === '') {
    errors.push('smtp host es obligatorio');
  }
  if (body.port !== undefined && body.port !== null && body.port !== '') {
    const p = Number(body.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      errors.push('smtp port debe ser un entero entre 1 y 65535');
    }
  }
  if (body.user !== undefined && body.user !== null && typeof body.user !== 'string') {
    errors.push('smtp user debe ser texto');
  }
  if (body.pass !== undefined && body.pass !== null && typeof body.pass !== 'string') {
    errors.push('smtp password debe ser texto');
  }
  if (typeof body.from !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.from.trim())) {
    errors.push('smtp from debe ser un correo válido');
  }
  if (body.fromName !== undefined && body.fromName !== null && typeof body.fromName !== 'string') {
    errors.push('smtp fromName debe ser texto');
  }
  if (body.alertaEmail !== undefined && body.alertaEmail !== null && body.alertaEmail !== '') {
    if (typeof body.alertaEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.alertaEmail.trim())) {
      errors.push('alertaEmail debe ser un correo válido');
    }
  }
  if (body.publicUrl !== undefined && body.publicUrl !== null && body.publicUrl !== '') {
    if (typeof body.publicUrl !== 'string' || !/^https?:\/\/[^\s]+$/i.test(body.publicUrl.trim())) {
      errors.push('url_publica debe comenzar con http(s):// y no contener espacios');
    }
  }
  return errors;
}

export function guardarConfigSmtp(body) {
  const upsert = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  upsert.run('notif_habilitada', body.habilitada ? '1' : '0');
  upsert.run('smtp_host', String(body.host).trim());
  upsert.run('smtp_port', String(Number(body.port) || 587));
  upsert.run('smtp_user', String(body.user ?? '').trim());
  if (typeof body.pass === 'string' && body.pass.trim() !== '') {
    upsert.run('smtp_pass', body.pass.trim());
  }
  upsert.run('smtp_from', String(body.from).trim());
  upsert.run('smtp_from_name', String(body.fromName ?? '').trim());
  upsert.run('alerta_email', String(body.alertaEmail ?? '').trim());
  upsert.run('url_publica', String(body.publicUrl ?? '').trim());
}

export function registrarNotificacion({ incidenciaId, tipo, destinatario, asunto, estado, error = '' }) {
  db.prepare('INSERT INTO notificaciones (incidencia_id, tipo, destinatario, asunto, estado, error, creada_en) VALUES (?,?,?,?,?,?,?)')
    .run(incidenciaId ?? null, String(tipo ?? 'estado'), String(destinatario ?? '').slice(0, 254), String(asunto ?? '').slice(0, 300), String(estado), String(error ?? '').slice(0, 500), Date.now());
}

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// El nombre del remitente viaja en una cabecera de correo: se limpia para evitar
// inyección de cabeceras (CR/LF/") o nombres absurdamente largos.
function limpiarNombreRemitente(s) {
  return String(s ?? '').replace(/[\r\n"]/g, '').trim().slice(0, 100);
}

export function remitenteDesdeConfig(conf) {
  return conf.fromName ? `"${limpiarNombreRemitente(conf.fromName)}" <${conf.from}>` : conf.from;
}

export function construirCorreo({ tipo, inc, clave }) {
  const estado = ESTADOS_LABEL[inc.estado] ?? inc.estado;
  const titulo = tipo === 'registro' ? 'Novedad registrada' : tipo === 'cierre' ? 'Caso finalizado' : `Estado actualizado: ${estado}`;
  const asunto = `${inc.numero_ticket} · ${titulo}`;

  const detalles = [
    ['Ticket', escaparHtml(inc.numero_ticket)],
    ['Estado', escaparHtml(estado)],
    ['Prioridad', escaparHtml(inc.prioridad ?? 'media')],
    ['Técnico', escaparHtml(inc.tecnico ?? 'Pendiente de asignación')]
  ];
  if (tipo === 'registro' && clave) {
    detalles.push(['Clave de seguimiento', escaparHtml(clave)]);
  }
  if (tipo === 'cierre' && inc.estado === 'resuelta') {
    detalles.push(['Solución aplicada', escaparHtml(inc.solucion_aplicada || '—')]);
  }

  const filas = detalles.map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;width:160px;">${k}</td><td style="padding:6px 0;font-weight:600;word-break:break-word;">${v}</td></tr>`).join('');

  let cta = '';
  if (tipo === 'cierre' && inc.estado === 'resuelta') {
    const conf = leerConfigSmtp();
    if (conf.publicUrl) {
      const base = conf.publicUrl.replace(/\/+$/, '');
      const url = `${base}/reportar?ticket=${encodeURIComponent(inc.numero_ticket)}&clave=${encodeURIComponent(inc.clave_seguimiento ?? '')}`;
      cta = `
        <p style="margin:20px 0 0;font-size:13px;">
          ¿Cómo fue la atención recibida? Comparta su valoración en un minuto:<br />
          <a href="${escaparHtml(url)}" style="color:#1e3a8a;font-weight:700;">Valorar atención (1 a 5 estrellas)</a>
        </p>`;
    }
  }

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#1e3a8a;color:#fff;padding:16px 24px;">
      <div style="font-size:15px;font-weight:700;">ONETec · ONE Telecomunicaciones</div>
      <div style="font-size:11px;opacity:.85;">Plataforma de Soporte Técnico</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;">Hola <strong>${escaparHtml(inc.cliente)}</strong>,</p>
      <p style="margin:0 0 16px;">Le informamos sobre el estado de su caso:</p>
      <table style="font-size:13px;width:100%;border-collapse:collapse;">${filas}</table>
      <p style="margin:18px 0 0;font-size:12px;color:#64748b;">Si renovó o cambió su servicio mientras tanto y el caso ya no aplica, no es necesario que haga nada.</p>
      ${cta}
    </div>
  </div>`;

  return { asunto, html };
}

// Envía y registra el intento en el historial. Nunca lanza: todo error queda en el historial.
export async function enviarNotificacion({ tipo, incidenciaId, destinatario, clave }) {
  let asunto = '';
  try {
    const destino = String(destinatario ?? '').trim();
    if (!destino) return;

    const inc = incidenciaId
      ? db.prepare('SELECT i.*, tec.nombre AS tecnico FROM incidencias i LEFT JOIN tecnicos tec ON tec.id = i.tecnico_id WHERE i.id = ?').get(incidenciaId)
      : null;
    if (incidenciaId && !inc) return;

    const conf = leerConfigSmtp();
    if (!conf.configurado) {
      registrarNotificacion({ incidenciaId, tipo, destinatario: destino, asunto: '', estado: 'omitido', error: 'SMTP no configurado o notificaciones desactivadas' });
      return;
    }

    const correo = inc ? construirCorreo({ tipo, inc, clave }) : { asunto: 'Notificación ONETec', html: '<p>Notificación desde la plataforma ONETec.</p>' };
    asunto = correo.asunto;
    await transporte.sendMail(conf, { from: remitenteDesdeConfig(conf), to: destino, subject: correo.asunto, html: correo.html });
    registrarNotificacion({ incidenciaId, tipo, destinatario: destino, asunto: correo.asunto, estado: 'enviado' });
  } catch (err) {
    registrarNotificacion({ incidenciaId, tipo, destinatario: destinatario ?? '', asunto, estado: 'error', error: err.message });
  }
}

export const transporte = {
  async sendMail(conf, mail) {
    const t = nodemailer.createTransport({
      host: conf.host,
      port: conf.port,
      secure: conf.port === 465,
      auth: conf.user && conf.pass ? { user: conf.user, pass: conf.pass } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });
    return t.sendMail(mail);
  }
};

export async function enviarPrueba(destinatario) {
  const conf = leerConfigSmtp();
  if (!conf.configurado) {
    const err = new Error('SMTP no configurado');
    err.codigo = 'NO_CONFIGURADO';
    throw err;
  }
  const info = await transporte.sendMail(conf, {
    from: remitenteDesdeConfig(conf),
    to: destinatario,
    subject: 'Prueba de notificaciones ONETec',
    html: '<p style="font-family:Arial,sans-serif;font-size:14px;">Este es un correo de prueba enviado desde la plataforma ONETec.</p><p style="font-family:Arial,sans-serif;font-size:14px;">Si está viendo este mensaje, el envío de notificaciones funciona correctamente.</p>'
  });
  return info;
}