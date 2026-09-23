import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, requireAdmin, signToken } from '../auth.js';
import { registrarActividad } from '../audit.js';

export const authRouter = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Hash fijo para igualar el tiempo de bcrypt cuando el email no existe
const DUMMY_PASSWORD_HASH = '$2b$10$bZ7Mz2OPnqMeBTOBYvVn4ebdRhYCZTgkvEvIMi/DpTr96u/ClVMju';

function asyncHandler(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('Error en ruta de autenticación:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    });
  };
}

function normalizarEmail(email) {
  return String(email).toLowerCase().trim();
}

function emailValido(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

function passwordValida(password) {
  return typeof password === 'string' && password.length >= 6;
}

function validateLogin(body) {
  const errors = [];
  if (!body.email || typeof body.email !== 'string') errors.push('email es obligatorio');
  else if (!EMAIL_RE.test(body.email)) errors.push('email no válido');
  if (!passwordValida(body.password)) {
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
  else if (!emailValido(body.email)) errors.push('email no válido');
  if (!passwordValida(body.password)) {
    errors.push('password es obligatorio (mínimo 6 caracteres)');
  }
  if (body.rol !== undefined && body.rol !== null && !['admin', 'tecnico'].includes(body.rol)) {
    errors.push('rol debe ser "admin" o "tecnico"');
  }
  return errors;
}

function validateChangePassword(body) {
  const errors = [];
  if (typeof body.password_actual !== 'string' || body.password_actual === '') {
    errors.push('password_actual es obligatorio');
  }
  if (!passwordValida(body.password_nueva)) {
    errors.push('password_nueva es obligatorio (mínimo 6 caracteres)');
  }
  if (body.password_actual && body.password_actual === body.password_nueva) {
    errors.push('password_nueva debe ser distinta de la actual');
  }
  return errors;
}

authRouter.post('/login', asyncHandler(async (req, res) => {
  const errors = validateLogin(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(normalizarEmail(req.body.email));
  const ok = user ? await bcrypt.compare(req.body.password, user.password_hash) : await bcrypt.compare(req.body.password, DUMMY_PASSWORD_HASH);
  if (!user || !ok) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  if (user.activo === 0) {
    return res.status(401).json({ error: 'Cuenta desactivada' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
  });
}));

// Registro restringido a administradores (el cliente no expone una pantalla de registro)
authRouter.post('/register', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const errors = validateRegister(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });

  const email = normalizarEmail(req.body.email);
  const existe = db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

  const hash = await bcrypt.hash(req.body.password, 10);
  const rol = req.body.rol === 'admin' ? 'admin' : 'tecnico';
  const r = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?)')
    .run(req.body.nombre.trim(), email, hash, rol, Date.now());

  const user = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(Number(r.lastInsertRowid));
  registrarActividad({ usuario: req.user.email, accion: 'usuario_creado', detalle: `${rol}: ${user.nombre} <${user.email}>` });
  res.status(201).json({ user });
}));

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user });
});

authRouter.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const errors = validateChangePassword(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const correcta = await bcrypt.compare(req.body.password_actual, user.password_hash);
  if (!correcta) return res.status(400).json({ error: 'La contraseña actual es incorrecta' });

  const hash = await bcrypt.hash(req.body.password_nueva, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
}));