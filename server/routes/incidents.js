import express from 'express';
import { db } from '../db.js';

export const incidentsRouter = express.Router();

const INC_SELECT = `
  SELECT i.*, t.nombre AS tipo_falla, t.icono AS tipo_icono,
         tec.nombre AS tecnico, c.categoria AS causa_raiz_cat
  FROM incidencias i
  JOIN tipos_falla t ON t.id = i.tipo_falla_id
  LEFT JOIN tecnicos tec ON tec.id = i.tecnico_id
  LEFT JOIN causas_raiz c ON c.id = i.causa_raiz_id
`;

// Lista con filtros
incidentsRouter.get('/', (req, res) => {
  const { estado, tipo, q, tecnico } = req.query;
  const where = [];
  const params = [];
  if (estado) { where.push('i.estado = ?'); params.push(estado); }
  if (tipo) { where.push('i.tipo_falla_id = ?'); params.push(tipo); }
  if (tecnico) { where.push('i.tecnico_id = ?'); params.push(tecnico); }
  if (q) {
    where.push('(i.cliente LIKE ? OR i.numero_ticket LIKE ? OR i.barrio LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sql = `${INC_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.creada_en DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(mapInc));
});

// Detalle con preguntas del checklist + respuestas registradas
incidentsRouter.get('/:id', (req, res) => {
  const inc = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const respuestas = db.prepare('SELECT * FROM respuestas_diagnostico WHERE incidencia_id = ? ORDER BY registrada_en').all(inc.id);

  res.json({ ...mapInc(inc), respuestas });
});

// Crear incidencia
incidentsRouter.post('/', (req, res) => {
  const { cliente, telefono = '', direccion = '', barrio = '', tipo_falla_id, prioridad = 'media', tecnico_id = null, sintomas = '', descripcion = '' } = req.body;
  if (!cliente || !tipo_falla_id) return res.status(400).json({ error: 'cliente y tipo_falla_id son obligatorios' });

  const count = db.prepare('SELECT COUNT(*) AS c FROM incidencias').get().c + 1;
  const numero_ticket = `ONE-${String(count).padStart(4, '0')}`;
  const r = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, creada_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, 'nueva', tecnico_id, sintomas, descripcion, Date.now()
  );
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(Number(r.lastInsertRowid));
  res.status(201).json(mapInc(row));
});

// Actualizar (estado, técnico, datos generales)
incidentsRouter.patch('/:id', (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const allowed = ['cliente', 'telefono', 'direccion', 'barrio', 'tipo_falla_id', 'prioridad', 'estado', 'tecnico_id', 'sintomas', 'descripcion'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (k in req.body) {
      sets.push(`${k} = ?`);
      params.push(req.body[k]);
    }
  }
  if (sets.length) {
    params.push(req.params.id);
    db.prepare(`UPDATE incidencias SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(req.params.id);
  res.json(mapInc(row));
});

// Guardar respuestas del diagnóstico (reemplaza las existentes)
incidentsRouter.post('/:id/diagnostico', (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const { respuestas } = req.body;
  if (!Array.isArray(respuestas)) return res.status(400).json({ error: 'respuestas debe ser una lista' });

  db.prepare('DELETE FROM respuestas_diagnostico WHERE incidencia_id = ?').run(inc.id);
  const ins = db.prepare('INSERT INTO respuestas_diagnostico (incidencia_id, consulta_id, respuesta, cumple, registrada_en) VALUES (?,?,?,?,?)');
  for (const r of respuestas) {
    ins.run(inc.id, r.consulta_id, (r.respuesta ?? '').toString(), r.cumple == null ? null : (r.cumple ? 1 : 0), Date.now());
  }
  db.prepare("UPDATE incidencias SET estado = 'en_diagnostico' WHERE id = ?").run(inc.id);
  res.json({ ok: true, saved: respuestas.length });
});

// Finalizar incidencia con causa raíz y solución
incidentsRouter.post('/:id/finalizar', (req, res) => {
  const inc = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const { estado, causa_raiz_id = null, solucion_aplicada = '' } = req.body;
  const fin = estado === 'resuelta' || estado === 'escalada' ? estado : 'resuelta';
  db.prepare(`UPDATE incidencias SET estado = ?, causa_raiz_id = ?, solucion_aplicada = ?, resuelta_en = ? WHERE id = ?`)
    .run(fin, causa_raiz_id, solucion_aplicada, Date.now(), inc.id);
  const row = db.prepare(`${INC_SELECT} WHERE i.id = ?`).get(req.params.id);
  res.json(mapInc(row));
});

// Eliminar
incidentsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM incidencias WHERE id = ?').run(req.params.id);
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