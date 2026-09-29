import crypto from 'node:crypto';
import { db } from './db.js';
import { registrarNotificacion } from './notify.js';

// Webhook de salida: POST asíncrono a una URL configurada por el admin cuando
// ocurren eventos en la plataforma (incidencia creada, estado cambiado, cierre).
// La configuración vive en la tabla `config` (webhook_url, webhook_secret, webhook_habilitada).
// Nunca lanza: cada intento se registra en el historial de notificaciones.

const CLAVES = ['webhook_url', 'webhook_secret', 'webhook_habilitada', 'webhook_intentos', 'webhook_retraso_ms'];
const TIMEOUT_MS = 8000;
const INTENTOS_DEFAULT = 3;
const RETRASO_DEFAULT = 1000;
const MAX_INTENTOS = 6;

function clampInt(valor, minimo, maximo) {
  const n = Number(valor);
  return !Number.isInteger(n) ? minimo : Math.max(minimo, Math.min(maximo, n));
}

export function leerConfigWebhook() {
  const filas = new Map();
  for (const c of CLAVES) {
    const r = db.prepare('SELECT valor FROM config WHERE clave = ?').get(c);
    if (r) filas.set(c, r.valor);
  }
  const url = (filas.get('webhook_url') ?? '').trim();
  const secret = filas.get('webhook_secret') ?? '';
  const habilitada = filas.get('webhook_habilitada') === '1';
  return {
    habilitada,
    url,
    secretConfigurado: secret !== '',
    configurado: habilitada && url !== '',
    intentos: clampInt(filas.get('webhook_intentos') ?? INTENTOS_DEFAULT, 1, MAX_INTENTOS),
    retraso: clampInt(filas.get('webhook_retraso_ms') ?? RETRASO_DEFAULT, 0, 60000)
  };
}

export function validarConfigWebhook(body) {
  const errors = [];
  if (typeof body.habilitada !== 'boolean') {
    errors.push('habilitada debe ser un booleano');
  }
  if (typeof body.url !== 'string' || body.url.trim() === '') {
    errors.push('webhook url es obligatorio');
  } else if (!/^https?:\/\/[^\s]+$/i.test(body.url.trim())) {
    errors.push('webhook url debe comenzar con http(s):// y no contener espacios');
  }
  if (body.secret !== undefined && body.secret !== null && typeof body.secret !== 'string') {
    errors.push('webhook secret debe ser texto');
  }
  if (body.intentos !== undefined && body.intentos !== null && !(Number.isInteger(Number(body.intentos)) && Number(body.intentos) >= 1 && Number(body.intentos) <= MAX_INTENTOS)) {
    errors.push(`webhook intentos debe ser un entero entre 1 y ${MAX_INTENTOS}`);
  }
  if (body.retraso !== undefined && body.retraso !== null && !(Number.isInteger(Number(body.retraso)) && Number(body.retraso) >= 0 && Number(body.retraso) <= 60000)) {
    errors.push('webhook retraso debe ser un entero entre 0 y 60000 ms');
  }
  return errors;
}

export function guardarConfigWebhook(body) {
  const upsert = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  upsert.run('webhook_habilitada', body.habilitada ? '1' : '0');
  upsert.run('webhook_url', String(body.url).trim());
  if (typeof body.secret === 'string' && body.secret.trim() === '') {
    db.prepare("DELETE FROM config WHERE clave = 'webhook_secret'").run();
  } else if (typeof body.secret === 'string' && body.secret.trim() !== '') {
    upsert.run('webhook_secret', body.secret.trim());
  }
  if (body.intentos !== undefined && body.intentos !== null) {
    upsert.run('webhook_intentos', String(clampInt(body.intentos, 1, MAX_INTENTOS)));
  }
  if (body.retraso !== undefined && body.retraso !== null) {
    upsert.run('webhook_retraso_ms', String(clampInt(body.retraso, 0, 60000)));
  }
}

function firmar(raw, secret) {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

// POST del payload al endpoint configurado con reintentos y backoff exponencial.
// Cada intento se registra en el historial de notificaciones. Nunca lanza.
// `intentos` (override) fuerza una cantidad de intentos (lo usa la prueba rápida).
export async function enviarWebhook({ evento, incidencia = null, usuario = null, intentos: intentosOverride = null }) {
  try {
    const conf = leerConfigWebhook();
    if (!conf.configurado) return false;

    const maxIntentos = intentosOverride === null ? conf.intentos : clampInt(intentosOverride, 1, MAX_INTENTOS);
    const baseRetraso = conf.retraso;

    const payload = {
      evento,
      fecha: Date.now(),
      remitente: usuario,
      incidencia: incidencia
        ? {
            id: incidencia.id ?? null,
            numero_ticket: incidencia.numero_ticket ?? null,
            estado: incidencia.estado ?? null,
            prioridad: incidencia.prioridad ?? null,
            cliente: incidencia.cliente ?? null,
            barrio: incidencia.barrio ?? null,
            tipo_falla: incidencia.tipo_falla ?? null,
            tecnico: incidencia.tecnico ?? null,
            descripcion: incidencia.descripcion ?? '',
            email: incidencia.email ?? '',
            creada_en: incidencia.creada_en ?? null,
            resuelta_en: incidencia.resuelta_en ?? null,
            solucion_aplicada: incidencia.solucion_aplicada ?? ''
          }
        : null
    };
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'ONETec/1.0' };
    const filaSecret = db.prepare("SELECT valor FROM config WHERE clave = 'webhook_secret'").get();

    for (let i = 1; i <= maxIntentos; i++) {
      const cuerpo = JSON.stringify({ ...payload, intento: i, intentos: maxIntentos });
      const headersEnvio = { ...headers };
      if (filaSecret?.valor) headersEnvio['X-ONETec-Signature'] = firmar(cuerpo, filaSecret.valor);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(conf.url, { method: 'POST', headers: headersEnvio, body: cuerpo, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        registrarNotificacion({ incidenciaId: incidencia?.id ?? null, tipo: 'webhook', destinatario: conf.url.slice(0, 254), asunto: `${evento} (intento ${i}/${maxIntentos})`.slice(0, 300), estado: 'enviado' });
        return true;
      } catch (err) {
        registrarNotificacion({
          incidenciaId: incidencia?.id ?? null,
          tipo: 'webhook',
          destinatario: conf.url.slice(0, 254),
          asunto: `${evento} (intento ${i}/${maxIntentos})`.slice(0, 300),
          estado: 'error',
          error: err?.name === 'AbortError' ? `timeout (${TIMEOUT_MS / 1000} s)` : err.message
        });
        if (i < maxIntentos) {
          await new Promise((resolve) => setTimeout(resolve, baseRetraso * 2 ** (i - 1)));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    return false;
  } catch {
    return false;
  }
}