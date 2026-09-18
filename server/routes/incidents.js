import express from 'express';
import { db } from '../db.js';
import {
  validateIncidentCreate, validateIncidentUpdate, validateDiagnostico,
  validateFinalizar, validateIdParam, validationMiddleware, ESTADOS_TRANSICION
} from '../validate.js';
import { requireAdmin } from '../auth.js';
import { notifyDataChange } from '../sse.js';

export const incidentsRouter = express.Router();

const ESTADOS_VALIDOS = ['nueva', 'en_diagnostico', 'resuelta', 'escalada'];
const CAMPOS_ACTUALIZABLES = ['cliente', 'telefono', 'direccion', 'barrio', 'tipo_falla_id', 'prioridad', 'estado', 'tecnico_id', 'sintomas', 'descripcion'];

const INC_SELECT = `
  SELECT i.*, t.nombre AS tipo_falla, t.icono AS tipo_icono,
         tec.nombre AS tecnico, c.categoria AS causa_raiz_cat
  FROM incidencias i
  JOIN tipos_falla t ON t.id = i.tipo_falla_id
  LEFT JOIN tecnicos tec ON tec.id = i.tecnico_id
  LEFT JOIN causas_raiz c ON c.id = i.causa_raiz_id
`;

function validateId(req, res, next) {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });
  next();
}

function registrarActividad(incidenciaId, usuario, accion, detalle = '') {
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)')
    .run(incidenciaId, usuario, accion, detalle, Date.now());
}

function buscarIncidencia(id) {
  return db.prepare('SELECT * FROM incidencias WHERE id = ?').get(Number(id));
}

function buscarIncidenciaCompleta(id) {
  return db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(id));
}

function incidenciaOr404(res, incidencia) {
  if (incidencia) return incidencia;
  res.status(404).json({ error: 'Incidencia no encontrada' });
  return null;
}

function existeTipoFalla(id) {
  return !!db.prepare('SELECT 1 FROM tipos_falla WHERE id = ?').get(Number(id));
}

function existeTecnico(id) {
  return !!db.prepare('SELECT 1 FROM tecnicos WHERE id = ?').get(Number(id));
}

function existeCausaRaiz(id) {
  return !!db.prepare('SELECT 1 FROM causas_raiz WHERE id = ?').get(Number(id));
}

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function esCasoCerrado(estado) {
  return estado === 'resuelta' || estado === 'escalada';
}

function escaparLike(str) {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function insertarIncidencia({ cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, tecnico_id, sintomas, descripcion }) {
  const insert = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, creada_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (let intento = 0; intento < 3; intento++) {
    const maxNum = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(numero_ticket, 5) AS INTEGER)), 0) AS m FROM incidencias").get().m;
    const numero_ticket = `ONE-${String(maxNum + 1).padStart(4, '0')}`;
    try {
      const r = insert.run(
        numero_ticket, String(cliente).trim(),
        typeof telefono === 'string' ? telefono.trim() : '',
        typeof direccion === 'string' ? direccion.trim() : '',
        typeof barrio === 'string' ? barrio.trim() : '',
        Number(tipo_falla_id), prioridad, 'nueva', tecnico_id ? Number(tecnico_id) : null,
        typeof sintomas === 'string' ? sintomas.trim() : '',
        typeof descripcion === 'string' ? descripcion.trim() : '',
        Date.now()
      );
      return Number(r.lastInsertRowid);
    } catch (err) {
      if (esColisionDeTicket(err)) continue;
      throw err;
    }
  }

  const err = new Error('No se pudo generar un numero_ticket único (colisión persistente)');
  err.status = 500;
  throw err;
}

function esColisionDeTicket(err) {
  return err.code === 'ERR_SQLITE_ERROR' && (err.errcode & 0xff) === 19;
}

function mapInc(r) {
  return {
    ...r,
    resuelta_en: r.resuelta_en ?? null,
    tiempo_ms: r.resuelta_en && r.creada_en ? r.resuelta_en - r.creada_en : null,
    causa_raiz_cat: r.causa_raiz_cat ?? null
  };
}

incidentsRouter.get('/', (req, res) => {
  const { estado, tipo, tecnico } = req.query;
  const where = [];
  const params = [];

  if (estado) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'estado inválido' });
    }
    where.push('i.estado = ?'); params.push(estado);
  }
  if (tipo) {
    const tipoId = idValido(tipo);
    if (tipoId === null) return res.status(400).json({ error: 'tipo inválido' });
    where.push('i.tipo_falla_id = ?'); params.push(tipoId);
  }
  if (tecnico) {
    const tecnicoId = idValido(tecnico);
    if (tecnicoId === null) return res.status(400).json({ error: 'tecnico inválido' });
    where.push('i.tecnico_id = ?'); params.push(tecnicoId);
  }
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (q.trim()) {
    const sanitized = escaparLike(q.trim().slice(0, 200));
    where.push("(i.cliente LIKE ? ESCAPE '\\' OR i.numero_ticket LIKE ? ESCAPE '\\' OR i.barrio LIKE ? ESCAPE '\\')");
    params.push(`%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`);
  }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const base = `${INC_SELECT} ${whereSql}`;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM incidencias i ${whereSql}`)
    .get(...params).c;

  const limitRaw = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 100;
  const offsetRaw = Number.parseInt(req.query.offset, 10);
  const offset = Number.isInteger(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  const rows = db.prepare(`${base} ORDER BY i.creada_en DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ items: rows.map(mapInc), total, limit, offset });
});

incidentsRouter.get('/:id', validateId, (req, res) => {
  const inc = incidenciaOr404(res, buscarIncidenciaCompleta(req.params.id));
  if (!inc) return;

  const respuestas = db.prepare('SELECT * FROM respuestas_diagnostico WHERE incidencia_id = ? ORDER BY registrada_en').all(inc.id);
  const actividad = db.prepare('SELECT * FROM actividad WHERE incidencia_id = ? ORDER BY creada_en DESC').all(inc.id);
  res.json({ ...mapInc(inc), respuestas, actividad });
});

incidentsRouter.post('/', validationMiddleware(validateIncidentCreate), (req, res) => {
  const {
    cliente, telefono = '', direccion = '', barrio = '',
    tipo_falla_id, prioridad = 'media', tecnico_id = null, sintomas = '', descripcion = ''
  } = req.body;

  if (!existeTipoFalla(tipo_falla_id)) return res.status(400).json({ error: 'tipo_falla_id no existe' });
  if (tecnico_id && !existeTecnico(tecnico_id)) return res.status(400).json({ error: 'tecnico_id no existe' });

  const nuevoId = insertarIncidencia({ cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, tecnico_id, sintomas, descripcion });
  registrarActividad(nuevoId, req.user.nombre, 'creada', 'Incidencia registrada');
  notifyDataChange();
  res.status(201).json(mapInc(buscarIncidenciaCompleta(nuevoId)));
});

incidentsRouter.patch('/:id', validateId, validationMiddleware(validateIncidentUpdate), (req, res) => {
  const inc = incidenciaOr404(res, buscarIncidencia(req.params.id));
  if (!inc) return;

  if (req.body.estado !== undefined && req.body.estado !== inc.estado) {
    const permitidos = ESTADOS_TRANSICION[inc.estado] ?? [];
    if (!permitidos.includes(req.body.estado)) {
      return res.status(400).json({ error: `Transición de estado no permitida: ${inc.estado} → ${req.body.estado} (use el flujo de finalización para cerrar casos)` });
    }
  }
  if (req.body.tipo_falla_id && !existeTipoFalla(req.body.tipo_falla_id)) {
    return res.status(400).json({ error: 'tipo_falla_id no existe' });
  }
  if (req.body.tecnico_id && req.body.tecnico_id !== null && !existeTecnico(req.body.tecnico_id)) {
    return res.status(400).json({ error: 'tecnico_id no existe' });
  }

  const sets = [];
  const params = [];
  const cambios = [];
  for (const k of CAMPOS_ACTUALIZABLES) {
    if (k in req.body) {
      sets.push(`${k} = ?`);
      const valor = typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k];
      params.push(valor);
      if (String(inc[k] ?? '') !== String(valor ?? '')) {
        cambios.push(`${k}: ${inc[k] ?? '—'} → ${valor ?? '—'}`);
      }
    }
  }
  if (sets.length) {
    params.push(Number(req.params.id));
    db.prepare(`UPDATE incidencias SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (cambios.length) {
      registrarActividad(inc.id, req.user.nombre, 'actualizada', cambios.join(', '));
    }
  }
  notifyDataChange();
  res.json(mapInc(buscarIncidenciaCompleta(req.params.id)));
});

incidentsRouter.post('/:id/diagnostico', validateId, validationMiddleware(validateDiagnostico), (req, res) => {
  const inc = incidenciaOr404(res, buscarIncidencia(req.params.id));
  if (!inc) return;

  if (esCasoCerrado(inc.estado)) {
    return res.status(409).json({ error: 'El caso está cerrado y no puede reabrirse' });
  }

  // Verificar que todas las consultas correspondan al tipo de falla de la incidencia
  const consultasTipo = db.prepare('SELECT id FROM consultas_tipo_falla WHERE tipo_falla_id = ?').all(inc.tipo_falla_id);
  const idsValidos = new Set(consultasTipo.map((c) => c.id));
  for (const r of req.body.respuestas) {
    if (!idsValidos.has(Number(r.consulta_id))) {
      return res.status(400).json({ error: `consulta_id ${r.consulta_id} no corresponde al tipo de falla de la incidencia` });
    }
  }

  const now = Date.now();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM respuestas_diagnostico WHERE incidencia_id = ?').run(inc.id);
    const insert = db.prepare('INSERT INTO respuestas_diagnostico (incidencia_id, consulta_id, respuesta, cumple, registrada_en) VALUES (?,?,?,?,?)');
    for (const r of req.body.respuestas) {
      insert.run(inc.id, Number(r.consulta_id), (r.respuesta ?? '').toString().slice(0, 500), r.cumple == null ? null : (r.cumple ? 1 : 0), now);
    }
    db.prepare("UPDATE incidencias SET estado = 'en_diagnostico' WHERE id = ?").run(inc.id);
    db.exec('COMMIT');
    registrarActividad(inc.id, req.user.nombre, 'diagnostico', `Checklist ${req.body.respuestas.length} respuestas`);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  notifyDataChange();
  res.json({ ok: true, saved: req.body.respuestas.length });
});

incidentsRouter.post('/:id/finalizar', validateId, validationMiddleware(validateFinalizar), (req, res) => {
  const inc = incidenciaOr404(res, buscarIncidencia(req.params.id));
  if (!inc) return;

  if (esCasoCerrado(inc.estado)) {
    return res.status(409).json({ error: 'El caso ya está cerrado' });
  }

  if (!existeCausaRaiz(req.body.causa_raiz_id)) return res.status(400).json({ error: 'causa_raiz_id no existe' });

  const estado = req.body.estado === 'escalada' ? 'escalada' : 'resuelta';
  const solucion = typeof req.body.solucion_aplicada === 'string' ? req.body.solucion_aplicada : '';
  // Solo las incidencias resueltas cuentan con tiempo de resolución
  const resueltaEn = estado === 'resuelta' ? Date.now() : null;
  db.prepare(`UPDATE incidencias SET estado = ?, causa_raiz_id = ?, solucion_aplicada = ?, resuelta_en = ? WHERE id = ?`)
    .run(estado, Number(req.body.causa_raiz_id), solucion.slice(0, 2000), resueltaEn, inc.id);
  registrarActividad(inc.id, req.user.nombre, 'cierre', `Caso cerrado como ${estado}`);
  notifyDataChange();
  res.json(mapInc(buscarIncidenciaCompleta(req.params.id)));
});

// Solo administradores pueden eliminar incidencias
incidentsRouter.delete('/:id', validateId, requireAdmin, (req, res) => {
  const inc = incidenciaOr404(res, buscarIncidencia(req.params.id));
  if (!inc) return;
  registrarActividad(inc.id, req.user.nombre, 'eliminada', 'Incidencia eliminada');
  db.prepare('DELETE FROM incidencias WHERE id = ?').run(Number(req.params.id));
  notifyDataChange();
  res.json({ ok: true });
});