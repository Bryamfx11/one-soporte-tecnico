import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'one-soporte-dev-secret-cambiar-en-produccion';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
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
    req.user = jwt.verify(header.slice(7), SECRET);
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

export default SECRET;