import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-reset');

rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

process.env.DB_PATH = path.join(TEST_DIR, 'data.db');
process.env.NODE_ENV = 'test';

const { db } = await import('../db.js');
const { resetearPassword } = await import('../reset-password.js');

test('resetearPassword cambia el hash y registra auditoría', () => {
  const res = resetearPassword('admin@one.com', 'nuevaClave99');
  assert.equal(res.email, 'admin@one.com');

  const usuario = db.prepare('SELECT password_hash FROM usuarios WHERE email = ?').get('admin@one.com');
  assert.ok(bcrypt.compareSync('nuevaClave99', usuario.password_hash));

  const evento = db.prepare("SELECT * FROM actividad WHERE accion = 'contrasena_reseteada' ORDER BY id DESC").get();
  assert.ok(evento, 'se registra el evento de auditoría');
  assert.match(evento.detalle, /admin@one\.com/);
});

test('resetearPassword rechaza contraseña corta y email inexistente', () => {
  assert.throws(() => resetearPassword('admin@one.com', '123'), /6 caracteres/);
  assert.throws(() => resetearPassword('nadie@one.com', 'clave123'), /No existe un usuario/);
  assert.throws(() => resetearPassword('correo-malo', 'clave123'), /Email inválido/);
});