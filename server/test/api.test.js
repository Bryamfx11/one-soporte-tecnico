import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test.db');

// Limpiar base de datos de prueba antes de cargar la app
for (const suffix of ['', '-shm', '-wal', '-journal']) {
  rmSync(TEST_DB + suffix, { force: true });
}

process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret';

const { default: app } = await import('../app.js');

let token = '';
let incidentId = 0;

before(async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  token = res.body.token;
});

test('GET /api/health responde ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('Ruta protegida sin token responde 401', async () => {
  const res = await request(app).get('/api/incidents');
  assert.equal(res.status, 401);
});

test('Ruta protegida con token inválido responde 401', async () => {
  const res = await request(app).get('/api/incidents').set('Authorization', 'Bearer invalido');
  assert.equal(res.status, 401);
});

test('POST /api/auth/login con credenciales incorrectas responde 401', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'malo123' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/login valida email', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'no-email', password: 'admin123' });
  assert.equal(res.status, 400);
});

test('GET /api/auth/me devuelve el usuario autenticado', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'admin@one.com');
});

test('GET /api/checklists devuelve tipos de falla con consultas', async () => {
  const res = await request(app).get('/api/checklists').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 5);
  assert.ok(res.body[0].consultas.length > 0);
});

test('GET /api/tecnicos devuelve técnicos', async () => {
  const res = await request(app).get('/api/tecnicos').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 6);
});

test('GET /api/checklists/causas-raiz devuelve causas (no sombreada por /:tipoId)', async () => {
  const res = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 8);
  assert.ok(res.body[0].categoria);
});

test('GET /api/metrics/dashboard devuelve métricas', async () => {
  const res = await request(app).get('/api/metrics/dashboard').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.total, 'number');
  assert.ok(Array.isArray(res.body.por_tecnico));
});

test('POST /api/incidents crea incidencia', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${token}`)
    .send({ cliente: 'Cliente Test', tipo_falla_id: 1, prioridad: 'alta' });
  assert.equal(res.status, 201);
  assert.ok(res.body.numero_ticket.startsWith('ONE-'));
  incidentId = res.body.id;
});

test('POST /api/incidents valida campos obligatorios', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${token}`)
    .send({ tipo_falla_id: 1 });
  assert.equal(res.status, 400);
});

test('POST /api/incidents rechaza tipo_falla_id inexistente', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${token}`)
    .send({ cliente: 'X', tipo_falla_id: 99999 });
  assert.equal(res.status, 400);
});

test('GET /api/incidents/:id devuelve el detalle', async () => {
  const res = await request(app).get(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.cliente, 'Cliente Test');
  assert.ok(Array.isArray(res.body.respuestas));
});

test('PATCH /api/incidents/:id actualiza la incidencia', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ prioridad: 'baja' });
  assert.equal(res.status, 200);
  assert.equal(res.body.prioridad, 'baja');
});

test('PATCH /api/incidents/:id rechaza campos no permitidos', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ campo_inexistente: 'x' });
  assert.equal(res.status, 400);
});

test('POST /api/incidents/:id/diagnostico guarda respuestas', async () => {
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/diagnostico`)
    .set('Authorization', `Bearer ${token}`)
    .send({ respuestas: [{ consulta_id: 1, respuesta: 'si', cumple: 1 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.saved, 1);
});

test('POST /api/incidents/:id/finalizar cierra el caso', async () => {
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${token}`);
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/finalizar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ estado: 'resuelta', causa_raiz_id: causas.body[0].id, solucion_aplicada: 'Reinicio de ONT' });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'resuelta');
  assert.ok(res.body.tiempo_ms != null);
});

test('DELETE /api/incidents/:id elimina la incidencia', async () => {
  const res = await request(app).delete(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
});

test('DELETE /api/incidents/:id inexistente responde 404', async () => {
  const res = await request(app).delete(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 404);
});

test('GET /api/incidents/:id con id inválido responde 400', async () => {
  const res = await request(app).get('/api/incidents/abc').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 400);
});