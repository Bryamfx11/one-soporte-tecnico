import { db } from './db.js';

// Metas de atención (SLA) por prioridad y umbral de escalamiento automático,
// configurables por el admin vía GET/PUT /api/ajustes/operacion (tabla `config`).

const DEFAULTS = {
  alta: 24,
  media: 48,
  baja: 72,
  escalamiento: 26
};

export function metasHoras() {
  const leer = (clave, defecto) => {
    const r = db.prepare('SELECT valor FROM config WHERE clave = ?').get(clave);
    const n = Number(r?.valor);
    if (Number.isInteger(n) && n >= 1 && n <= 720) return n;
    return defecto;
  };
  return {
    alta: leer('sla_horas_alta', DEFAULTS.alta),
    media: leer('sla_horas_media', DEFAULTS.media),
    baja: leer('sla_horas_baja', DEFAULTS.baja),
    escalamiento: leer('escalamiento_horas', DEFAULTS.escalamiento)
  };
}

export function guardarMetas({ alta, media, baja, escalamiento }) {
  const up = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  up.run('sla_horas_alta', String(Number(alta)));
  up.run('sla_horas_media', String(Number(media)));
  up.run('sla_horas_baja', String(Number(baja)));
  up.run('escalamiento_horas', String(Number(escalamiento)));
}

export function validarMetas(body) {
  const errors = [];
  for (const k of ['alta', 'media', 'baja', 'escalamiento']) {
    if (body[k] === undefined || body[k] === null) {
      errors.push(`${k} es obligatorio`);
      continue;
    }
    const n = Number(body[k]);
    if (!Number.isInteger(n) || n < 1 || n > 720) {
      errors.push(`${k} debe ser un entero entre 1 y 720 horas`);
    }
  }
  return errors;
}

const ESTADOS_SLA = { ok: 'ok', proximo: 'proximo', vencido: 'vencido' };

// Semáforo del caso frente a su meta: abierto sin vencer → ok; ≥70 % de la meta → próximo;
// ≥ meta → vencido. Los casos cerrados no marcan vencimiento.
export function calcularSla(inc) {
  const horas = inc?.prioridad ? (metasHoras()[inc.prioridad] ?? DEFAULTS.media) : DEFAULTS.media;
  if (inc.estado !== 'nueva' && inc.estado !== 'en_diagnostico') {
    return { meta_horas: horas, transcurridas_horas: 0, estado: ESTADOS_SLA.ok, ref_creada: inc.creada_en };
  }
  const transcurridas = Math.max(0, (Date.now() - inc.creada_en) / 3600000);
  const porcentaje = horas > 0 ? transcurridas / horas : 0;
  const estado = porcentaje >= 1 ? ESTADOS_SLA.vencido : porcentaje >= 0.7 ? ESTADOS_SLA.proximo : ESTADOS_SLA.ok;
  return { meta_horas: horas, transcurridas_horas: transcurridas, estado, ref_creada: inc.creada_en };
}

export function slaDeIncidencias(lista) {
  return lista.map((i) => ({ ...i, sla: calcularSla(i) }));
}