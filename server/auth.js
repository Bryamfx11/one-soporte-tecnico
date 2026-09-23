import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from './db.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

const SECRET = process.env.JWT_SECRET ?? (() => {
  const s = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET no definido: usando secreto aleatorio para esta ejecución. Todos los tokens existentes quedan inválidos (expiran en 8h). Define JWT_SECRET en producción.');
  return s;
})();

const EMISOR = 'one-soporte';

export function signToken(user) {
  return jwt.sign(
    { id: user.id },
    SECRET,
    { algorithm: 'HS256', expiresIn: '8h', issuer: EMISOR }
  );
}

// Token del primer paso de 2FA: corto (5 min) y marcado, no da acceso a la API.
export function signMfaToken(user) {
  return jwt.sign(
    { id: user.id, mfa: true },
    SECRET,
    { algorithm: 'HS256', expiresIn: '5m', issuer: EMISOR }
  );
}

// Devuelve el id del usuario si el token es un token parcial 2FA válido (aún sin code).
export function mfaTokenToId(token) {
  const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'], issuer: EMISOR });
  if (!payload.mfa) return null;
  return payload.id;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET, { algorithms: ['HS256'], issuer: EMISOR });
    if (payload.mfa) {
      // Tokens del primer paso (2FA) no dan acceso a la API.
      return res.status(401).json({ error: 'Complete la verificación en dos pasos' });
    }
    const user = db.prepare('SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
    if (user.activo === 0) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere rol de administrador' });
  }
  next();
}