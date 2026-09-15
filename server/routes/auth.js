import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, signToken } from '../auth.js';

export const authRouter = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLogin(body) {
  const errors = [];
  if (!body.email || typeof body.email !== 'string') errors.push('email es obligatorio');
  else if (!EMAIL_RE.test(body.email)) errors.push('email no válido');
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('password es obligatorio (mínimo 6 caracteres)');
  }
  return errors;
}

function validateRegister(body) {
  const errors = [];
  if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
    errors.push('nombre es obligatorio (mínimo 2 caracteres)');
  }
  if (!body.email || typeof body.email !== 'string') errors.push('email es obligatorio');
  else if (!EMAIL_RE.test(body.email)) errors.push('email no válido');
  if (!body.password || typeof body.password !== 'string' || body.password.length < 6) {
    errors.push('password es obligatorio (mínimo 6 caracteres)');
  }
  return errors;
}

authRouter.post('/login', (req, res) => {
  const errors = validateLogin(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(String(req.body.email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
  });
});

authRouter.post('/register', (req, res) => {
  const errors = validateRegister(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });

  const email = String(req.body.email).toLowerCase().trim();
  const existe = db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

  const hash = bcrypt.hashSync(req.body.password, 10);
  const r = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?)')
    .run(req.body.nombre.trim(), email, hash, 'tecnico', Date.now());

  const user = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(Number(r.lastInsertRowid));
  const token = signToken(user);
  res.status(201).json({ token, user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user });
});