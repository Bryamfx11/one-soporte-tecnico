import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { validateTecnicoCreate, validateTecnicoUpdate, validateIdParam, validationMiddleware } from '../validate.js';
import { notifyDataChange } from '../sse.js';

export const tecnicosRouter = express.Router();

function validateId(req, res, next) {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });
  next();
}

tecnicosRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tecnicos ORDER BY nombre').all();
  res.json(rows);
});

// Solo administradores pueden crear técnicos
tecnicosRouter.post('/', requireAdmin, validationMiddleware(validateTecnicoCreate), (req, res) => {
  const r = db.prepare('INSERT INTO tecnicos (nombre, rol) VALUES (?, ?)')
    .run(req.body.nombre.trim(), (req.body.rol ?? '').toString().trim() || 'Técnico');
  const tecnico = db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(Number(r.lastInsertRowid));
  notifyDataChange();
  res.status(201).json(tecnico);
});

// Solo administradores pueden actualizar técnicos
tecnicosRouter.patch('/:id', requireAdmin, validationMiddleware(validateTecnicoUpdate), (req, res) => {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });

  const tecnico = db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(Number(req.params.id));
  if (!tecnico) return res.status(404).json({ error: 'Técnico no encontrado' });

  const sets = [];
  const params = [];
  if (req.body.nombre !== undefined && req.body.nombre !== null) {
    sets.push('nombre = ?');
    params.push(String(req.body.nombre).trim());
  }
  if (req.body.rol !== undefined && req.body.rol !== null) {
    sets.push('rol = ?');
    params.push(String(req.body.rol).trim());
  }
  if (sets.length) {
    params.push(tecnico.id);
    db.prepare(`UPDATE tecnicos SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  notifyDataChange();
  res.json(db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(tecnico.id));
});

// Solo administradores pueden eliminar técnicos cuando no tienen incidencias asignadas
tecnicosRouter.delete('/:id', requireAdmin, validateId, (req, res) => {
  const tecnico = db.prepare('SELECT * FROM tecnicos WHERE id = ?').get(Number(req.params.id));
  if (!tecnico) return res.status(404).json({ error: 'Técnico no encontrado' });

  const asignadas = db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE tecnico_id = ?').get(tecnico.id).c;
  if (asignadas > 0) {
    return res.status(409).json({ error: `No se puede eliminar: tiene ${asignadas} incidencia(s) asignada(s). Reasigne antes de eliminar` });
  }

  db.prepare('DELETE FROM tecnicos WHERE id = ?').run(tecnico.id);
  notifyDataChange();
  res.json({ ok: true });
});