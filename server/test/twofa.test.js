import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-twofa');

rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

process.env.DB_PATH = path.join(TEST_DIR, 'data.db');
process.env.JWT_SECRET = 'test-secret-twofa';
process.env.NODE_ENV = 'test';

const { default: request } = await import('supertest');
const { app } = await import('../app.js');
const { generarCodigo } = await import('../totp.js');

let token;
let secret;

test('estado inicial: el admin de respaldo no tiene 2FA', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.twoFactorRequired, undefined);
  token = login.body.token;
  assert.ok(token, 'login normal devuelve token');
});

test('se construye el fixture mfa@one.com (admin)', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'MFA Admin', email: 'mfa@one.com', password: 'clave123', rol: 'admin' });
  assert.equal(res.status, 201);
});

test('activate genera secreto y confirm lo persiste', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  token = login.body.token;

  const act = await request(app)
    .post('/api/auth/2fa/activate')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(act.status, 200);
  secret = act.body.secret;
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(act.body.otpauthUrl, /otpauth:\/\/totp\//);

  const codigo = generarCodigo(secret);
  const confirm = await request(app)
    .post('/api/auth/2fa/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ secret, code: codigo });
  assert.equal(confirm.status, 200);

  const mal = await request(app)
    .post('/api/auth/2fa/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({ secret, code: '000000' });
  assert.equal(mal.status, 400);
});

test('con 2FA el login pide el segundo paso y el token parcial no da acceso', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.twoFactorRequired, true);
  assert.ok(login.body.twoFactorToken, 'devuelve token de segundo paso');
  assert.equal(login.body.token, undefined, 'no devuelve token de acceso aún');

  const apiConParcial = await request(app)
    .get('/api/incidents')
    .set('Authorization', `Bearer ${login.body.twoFactorToken}`);
  assert.equal(apiConParcial.status, 401, 'el token parcial no accede a la API');
});

test('verify con código incorrecto responde 401 y registra el intento', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  const mal = await request(app)
    .post('/api/auth/2fa/verify')
    .send({ twoFactorToken: login.body.twoFactorToken, code: '000000' });
  assert.equal(mal.status, 401);

  const log = await request(app)
    .get('/api/auditoria?accion=login_fallido')
    .set('Authorization', `Bearer ${token}`);
  assert.ok(log.body.some((e) => e.detalle.includes('2FA')), 'se audita el 2FA fallido');
});

test('verify con código correcto emite token real de acceso', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  const codigo = generarCodigo(secret);
  const ok = await request(app)
    .post('/api/auth/2fa/verify')
    .send({ twoFactorToken: login.body.twoFactorToken, code: codigo });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token, 'devuelve token real');
  assert.equal(ok.body.user.email, 'mfa@one.com');

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`);
  assert.equal(me.status, 200);
});

test('disable requiere código válido y vuelve al login de un solo paso', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  const acceso = await request(app)
    .post('/api/auth/2fa/verify')
    .send({ twoFactorToken: login.body.twoFactorToken, code: generarCodigo(secret) });
  token = acceso.body.token;

  const mal = await request(app)
    .post('/api/auth/2fa/disable')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: '000000' });
  assert.equal(mal.status, 400);

  const codigo = generarCodigo(secret);
  const ok = await request(app)
    .post('/api/auth/2fa/disable')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: codigo });
  assert.equal(ok.status, 200);

  const login2 = await request(app).post('/api/auth/login').send({ email: 'mfa@one.com', password: 'clave123' });
  assert.equal(login2.status, 200);
  assert.equal(login2.body.twoFactorRequired, undefined);
  assert.ok(login2.body.token);
});