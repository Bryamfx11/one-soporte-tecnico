import express from 'express';
import { db } from '../db.js';
import {
  validateIncidentCreate, validateIncidentUpdate, validateDiagnostico,
  validateFinalizar, validateIdParam, validationMiddleware
} from '../validate.js';

export const incidentsRouter = express.Router();

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

incidentsRouter.get('/', (req, res) => {
  const { estado, tipo, q, tecnico } = req.query;
  const where = [];
  const params = [];

  if (estado) {
    if (!['nueva', 'en_diagnostico', 'resuelta', 'escalada'].includes(estado)) {
      return res.status(400).json({ error: 'estado inválido' });
    }
    where.push('i.estado = ?'); params.push(estado);
  }
  if (tipo) {
    const t = Number(tipo);
    if (!Number.isInteger(t) || t < 1) return res.status(400).json({ error: 'tipo inválido' });
    where.push('i.tipo_falla_id = ?'); params.push(t);
  }
  if (tecnico) {
    const t = Number(tecnico);
    if (!Number.isInteger(t) || t < 1) return res.status(400).json({ error: 'tecnico inválido' });
    where.push('i.tecnico_id = ?'); params.push(t);
  }
  if (q && typeof q === 'string') {
    const sanitized = q.trim().slice(0, 200);
    where.push('(i.cliente LIKE ? OR i.numero_ticket LIKE ? OR i.barrio LIKE ?)');
    params.push(`%${sanitized}%`, `%${sanitized}%`, `%${sanitized}%`);
  }

  const sql = `${INC_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.creada_en DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapInc));
});

incidentsRouter.get('/:id', validateId, (req, res) => {
  const inc = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(req.params.id));
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const respuestas = db.prepare('SELECT * FROM respuestas_diagnostico WHERE incidencia_id = ? ORDER BY registrada_en').all(inc.id);
  res.json({ ...mapInc(inc), respuestas });
});

incidentsRouter.post('/', validationMiddleware(validateIncidentCreate), (req, res) => {
  const { cliente, telefono = '', direccion = '', barrio = '', tipo_falla_id, prioridad = 'media', tecnico_id = null, sintomas = '', descripcion = '' } = req.body;

  const tipoExiste = db.prepare('SELECT 1 FROM tipos_falla WHERE id = ?').get(Number(tipo_falla_id));
  if (!tipoExiste) return res.status(400).json({ error: 'tipo_falla_id no existe' });

  if (tecnico_id) {
    const tecExiste = db.prepare('SELECT 1 FROM tecnicos WHERE id = ?').get(Number(tecnico_id));
    if (!tecExiste) return res.status(400).json({ error: 'tecnico_id no existe' });
  }

  const maxNum = db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(numero_ticket, 5) AS INTEGER)), 0) AS m FROM incidencias").get().m;
  const numero_ticket = `ONE-${String(maxNum + 1).padStart(4, '0')}`;
  const r = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, creada_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    numero_ticket, cliente.trim(), telefono.trim(), direccion.trim(), barrio.trim(),
    Number(tipo_falla_id), prioridad, 'nueva', tecnico_id ? Number(tecnico_id) : null,
    sintomas.trim(), descripcion.trim(), Date.now()
  );
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(r.lastInsertRowid));
  res.status(201).json(mapInc(row));
});

incidentsRouter.patch('/:id', validateId, validationMiddleware(validateIncidentUpdate), (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(Number(req.params.id));
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  if (req.body.tipo_falla_id) {
    const tipoExiste = db.prepare('SELECT 1 FROM tipos_falla WHERE id = ?').get(Number(req.body.tipo_falla_id));
    if (!tipoExiste) return res.status(400).json({ error: 'tipo_falla_id no existe' });
  }
  if (req.body.tecnico_id && req.body.tecnico_id !== null) {
    const tecExiste = db.prepare('SELECT 1 FROM tecnicos WHERE id = ?').get(Number(req.body.tecnico_id));
    if (!tecExiste) return res.status(400).json({ error: 'tecnico_id no existe' });
  }

  const allowed = ['cliente', 'telefono', 'direccion', 'barrio', 'tipo_falla_id', 'prioridad', 'estado', 'tecnico_id', 'sintomas', 'descripcion'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (k in req.body) {
      sets.push(`${k} = ?`);
      params.push(typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k]);
    }
  }
  if (sets.length) {
    params.push(Number(req.params.id));
    db.prepare(`UPDATE incidencias SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(req.params.id));
  res.json(mapInc(row));
});

incidentsRouter.post('/:id/diagnostico', validateId, validationMiddleware(validateDiagnostico), (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(Number(req.params.id));
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  db.prepare('DELETE FROM respuestas_diagnostico WHERE incidencia_id = ?').run(inc.id);
  const ins = db.prepare('INSERT INTO respuestas_diagnostico (incidencia_id, consulta_id, respuesta, cumple, registrada_en) VALUES (?,?,?,?,?)');
  for (const r of req.body.respuestas) {
    ins.run(inc.id, Number(r.consulta_id), (r.respuesta ?? '').toString().slice(0, 500), r.cumple == null ? null : (r.cumple ? 1 : 0), Date.now());
  }
  db.prepare("UPDATE incidencias SET estado = 'en_diagnostico' WHERE id = ?").run(inc.id);
  res.json({ ok: true, saved: req.body.respuestas.length });
});

incidentsRouter.post('/:id/finalizar', validateId, validationMiddleware(validateFinalizar), (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(Number(req.params.id));
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  if (req.body.causa_raiz_id) {
    const causaExiste = db.prepare('SELECT 1 FROM causas_raiz WHERE id = ?').get(Number(req.body.causa_raiz_id));
    if (!causaExiste) return res.status(400).json({ error: 'causa_raiz_id no existe' });
  }

  const { estado, causa_raiz_id = null, solucion_aplicada = '' } = req.body;
  const fin = estado === 'resuelta' || estado === 'escalada' ? estado : 'resuelta';
  db.prepare(`UPDATE incidencias SET estado = ?, causa_raiz_id = ?, solucion_aplicada = ?, resuelta_en = ? WHERE id = ?`)
    .run(fin, causa_raiz_id ? Number(causa_raiz_id) : null, solucion_aplicada.slice(0, 2000), Date.now(), inc.id);
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(req.params.id));
  res.json(mapInc(row));
});

incidentsRouter.delete('/:id', validateId, (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(Number(req.params.id));
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });
  db.prepare('DELETE FROM incidencias WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

function mapInc(r) {
  return {
    ...r,
    resuelta_en: r.resuelta_en ?? null,
    tiempo_ms: r.resuelta_en && r.creada_en ? r.resuelta_en - r.creada_en : null,
    causa_raiz_cat: r.causa_raiz_cat ?? null
  };
}
