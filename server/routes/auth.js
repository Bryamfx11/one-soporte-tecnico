import express from 'express';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import { db } from '../db.js';
import { requireAuth, requireAdmin, signToken, signMfaToken, mfaTokenToId } from '../auth.js';
import { generarSecreto, otpauthUrl, verificarCodigo, esSecretoValido } from '../totp.js';
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
    registrarActividad({ usuario: normalizarEmail(req.body.email), accion: 'login_fallido', detalle: 'credenciales incorrectas' });
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  if (user.activo === 0) {
    registrarActividad({ usuario: user.email, accion: 'login_fallido', detalle: 'cuenta desactivada' });
    return res.status(401).json({ error: 'Cuenta desactivada' });
  }

  if (user.twofa_secret) {
    const twoFactorToken = signMfaToken(user);
    return res.json({
      twoFactorRequired: true,
      twoFactorToken,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  }

  const token = signToken(user);
  registrarActividad({ usuario: user.email, accion: 'login_exitoso', detalle: `${user.rol}` });
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

// --- Verificación en dos pasos (2FA TOTP) ---

// Estado de 2FA del usuario autenticado (no expone el secreto).
authRouter.get('/2fa', requireAuth, (req, res) => {
  const u = db.prepare('SELECT twofa_secret FROM usuarios WHERE id = ?').get(req.user.id);
  res.json({ activa: !!u?.twofa_secret });
});

// Segundo paso del login: valida el código contra el secreto del usuario y emite el token real.
authRouter.post('/2fa/verify', asyncHandler(async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  const twoFactorToken = String(req.body?.twoFactorToken ?? '');
  if (!code || !twoFactorToken) {
    return res.status(400).json({ error: 'Error de validación', details: ['code y twoFactorToken son obligatorios'] });
  }
  let userId;
  try {
    userId = mfaTokenToId(twoFactorToken);
  } catch {
    return res.status(401).json({ error: 'Sesión en dos pasos inválida o expirada' });
  }
  if (!userId) return res.status(401).json({ error: 'Sesión en dos pasos inválida o expirada' });

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
  if (!user || user.activo === 0) return res.status(401).json({ error: 'Usuario no disponible' });
  if (!user.twofa_secret) return res.status(401).json({ error: 'El usuario no tiene 2FA activada' });
  if (!verificarCodigo(user.twofa_secret, code)) {
    registrarActividad({ usuario: user.email, accion: 'login_fallido', detalle: 'código 2FA incorrecto' });
    return res.status(401).json({ error: 'Código 2FA incorrecto' });
  }

  const token = signToken(user);
  registrarActividad({ usuario: user.email, accion: 'login_exitoso', detalle: user.rol });
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
  });
}));

// Activa 2FA: genera (sin guardar) el secreto y, si está disponible, el QR en base64.
authRouter.post('/2fa/activate', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Requiere rol de administrador' });
  const secreto = generarSecreto();
  const url = otpauthUrl(secreto, req.user.email);
  let qr = null;
  try {
    qr = await qrcode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
  } catch {
    qr = null;
  }
  res.json({ secret: secreto, otpauthUrl: url, qr });
}));

// Confirma y persiste la 2FA (requiere un código válido del secreto recién generado).
authRouter.post('/2fa/confirm', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { secret, code } = req.body ?? {};
  if (!esSecretoValido(secret)) return res.status(400).json({ error: 'Error de validación', details: ['secret no válido'] });
  if (!verificarCodigo(secret, code)) return res.status(400).json({ error: 'El código no coincide con el secreto generado' });
  db.prepare('UPDATE usuarios SET twofa_secret = ? WHERE id = ?').run(String(secret).toUpperCase(), req.user.id);
  registrarActividad({ usuario: req.user.email, accion: 'twofa_activada', detalle: '2FA TOTP habilitada' });
  res.json({ ok: true });
}));

// Desactiva la 2FA validando el código actual del usuario.
authRouter.post('/2fa/disable', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  if (!user?.twofa_secret) return res.status(400).json({ error: 'La 2FA no está activada' });
  const code = String(req.body?.code ?? '').trim();
  if (!verificarCodigo(user.twofa_secret, code)) return res.status(400).json({ error: 'El código 2FA es incorrecto' });
  db.prepare('UPDATE usuarios SET twofa_secret = NULL WHERE id = ?').run(user.id);
  registrarActividad({ usuario: user.email, accion: 'twofa_desactivada', detalle: '2FA TOTP deshabilitada' });
  res.json({ ok: true });
}));

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