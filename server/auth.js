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

export function signToken(user) {
  return jwt.sign(
    { id: user.id },
    SECRET,
    { expiresIn: '8h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    const user = db.prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
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