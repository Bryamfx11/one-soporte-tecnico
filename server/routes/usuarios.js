import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { validateIdParam } from '../validate.js';

export const usuariosRouter = express.Router();

const SELECT_PUBLICO = 'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios';

function validateId(req, res, next) {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });
  next();
}

usuariosRouter.get('/', requireAdmin, (req, res) => {
  const usuarios = db.prepare(`${SELECT_PUBLICO} ORDER BY id`).all();
  res.json(usuarios);
});

usuariosRouter.patch('/:id', requireAdmin, validateId, (req, res) => {
  if (req.body.activo !== 0 && req.body.activo !== 1) {
    return res.status(400).json({ error: 'activo debe ser 0 o 1' });
  }
  const target = db.prepare(`${SELECT_PUBLICO} WHERE id = ?`).get(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.id === req.user.id && req.body.activo === 0) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(req.body.activo, target.id);
  const updated = db.prepare(`${SELECT_PUBLICO} WHERE id = ?`).get(target.id);
  res.json(updated);
});