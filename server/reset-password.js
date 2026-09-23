import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { registrarActividad } from './audit.js';

// Restablece la contraseña de una cuenta sin pasar por el login (último recurso de admin).
export function resetearPassword(email, nuevaPassword) {
  const emailLimpio = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailLimpio)) {
    throw new Error('Email inválido');
  }
  if (typeof nuevaPassword !== 'string' || nuevaPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  const usuario = db.prepare('SELECT id, email, rol FROM usuarios WHERE email = ?').get(emailLimpio);
  if (!usuario) {
    throw new Error(`No existe un usuario con email ${emailLimpio}`);
  }
  const hash = bcrypt.hashSync(nuevaPassword, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, usuario.id);
  registrarActividad({
    usuario: 'sistema',
    accion: 'contrasena_reseteada',
    detalle: `contraseña restablecida para ${usuario.email} (${usuario.rol})`
  });
  return { email: usuario.email };
}

// Punto de entrada para `npm run reset-password -- <email> <contraseña>`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node reset-password.js <email> <nueva-contraseña>');
    process.exit(1);
  }
  try {
    const resultado = resetearPassword(email, password);
    console.log(`[reset-password] Contraseña restablecida para ${resultado.email}`);
    console.log('[reset-password] Recomendación: use al menos un admin de respaldo (Usuarios > Nuevo usuario).');
  } catch (err) {
    console.error(`[reset-password] ${err.message}`);
    process.exit(1);
  }
}