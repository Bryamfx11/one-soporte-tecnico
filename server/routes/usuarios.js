import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { validateIdParam } from '../validate.js';

export const usuariosRouter = express.Router();

const SELECT_PUBLICO = 'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios';
const ROLES = ['admin', 'tecnico'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function validateId(req, res, next) {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });
  next();
}

function tieneAlMenosUnCampo(body) {
  return ['nombre', 'email', 'rol', 'activo', 'password'].some((k) => body[k] !== undefined);
}

usuariosRouter.get('/', requireAdmin, (req, res) => {
  const usuarios = db.prepare(`${SELECT_PUBLICO} ORDER BY id`).all();
  res.json(usuarios);
});

usuariosRouter.patch('/:id', requireAdmin, validateId, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const target = db.prepare(`${SELECT_PUBLICO} WHERE id = ?`).get(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (!tieneAlMenosUnCampo(body)) {
    return res.status(400).json({ error: 'Error de validación', details: ['No hay campos para actualizar'] });
  }

  const updates = {};
  const errors = [];

  if (body.activo !== undefined) {
    if (body.activo !== 0 && body.activo !== 1) {
      errors.push('activo debe ser 0 o 1');
    } else if (target.id === req.user.id && body.activo === 0) {
      errors.push('No puedes desactivar tu propia cuenta');
    } else {
      updates.activo = body.activo;
    }
  }

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
      errors.push('nombre debe tener al menos 2 caracteres');
    } else if (body.nombre.trim().length > 200) {
      errors.push('nombre no puede exceder 200 caracteres');
    } else {
      updates.nombre = body.nombre.trim();
    }
  }

  if (body.email !== undefined) {
    const email = String(body.email).toLowerCase().trim();
    if (!EMAIL_RE.test(email)) {
      errors.push('email no válido');
    } else {
      const existe = db.prepare('SELECT 1 FROM usuarios WHERE email = ? AND id != ?').get(email, target.id);
      if (existe) return res.status(409).json({ error: 'El email ya está registrado' });
      updates.email = email;
    }
  }

  if (body.rol !== undefined) {
    if (!ROLES.includes(body.rol)) {
      errors.push(`rol debe ser una de: ${ROLES.join(', ')}`);
    } else if (target.id === req.user.id && body.rol !== target.rol) {
      errors.push('No puedes cambiar el rol de tu propia cuenta');
    } else {
      updates.rol = body.rol;
    }
  }

  if (body.password !== undefined && body.password !== null && body.password !== '') {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      errors.push('password debe tener al menos 6 caracteres');
    } else {
      updates.password = body.password;
    }
  }

  // No dejar a la plataforma sin administradores activos
  if (target.rol === 'admin') {
    const seDegrada = updates.rol !== undefined && updates.rol !== 'admin';
    const seDesactiva = updates.activo === 0;
    if (seDegrada || seDesactiva) {
      const otrosAdmins = db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id != ?").get(target.id).n;
      if (otrosAdmins === 0) {
        errors.push('No se puede degradar ni desactivar al último administrador activo');
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Error de validación', details: errors });
  }

  let hashNueva = null;
  if (updates.password) {
    hashNueva = await bcrypt.hash(updates.password, 10);
    delete updates.password;
  }

  if (Object.keys(updates).length > 0) {
    const set = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE usuarios SET ${set} WHERE id = ?`).run(...Object.values(updates), target.id);
  }
  if (hashNueva) {
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hashNueva, target.id);
  }

  const updated = db.prepare(`${SELECT_PUBLICO} WHERE id = ?`).get(target.id);
  res.json(updated);
}));