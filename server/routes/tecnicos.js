import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { validateTecnicoUpdate, validateIdParam, validationMiddleware } from '../validate.js';
import { notifyDataChange } from '../sse.js';

export const tecnicosRouter = express.Router();

tecnicosRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tecnicos ORDER BY nombre').all();
  res.json(rows);
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