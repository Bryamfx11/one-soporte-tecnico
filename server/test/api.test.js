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

let adminToken = '';
let tecnicoToken = '';
let incidentId = 0;

before(async () => {
  const admin = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  adminToken = admin.body.token;
  const tec = await request(app).post('/api/auth/login').send({ email: 'bryam@one.com', password: 'tecnico123' });
  tecnicoToken = tec.body.token;
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

test('GET /api/sse/events sin token responde 401', async () => {
  const res = await request(app).get('/api/sse/events');
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

test('POST /api/auth/register sin token responde 401', async () => {
  const res = await request(app).post('/api/auth/register').send({ nombre: 'Nuevo', email: 'nuevo@one.com', password: 'clave123' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/register con rol técnico responde 403', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${tecnicoToken}`)
    .send({ nombre: 'Nuevo', email: 'nuevo@one.com', password: 'clave123' });
  assert.equal(res.status, 403);
});

test('POST /api/auth/register con rol admin crea usuario', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Nuevo Técnico', email: 'nuevo@one.com', password: 'clave123' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'nuevo@one.com');
});

test('GET /api/auth/me devuelve el usuario autenticado', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'admin@one.com');
});

test('GET /api/checklists devuelve tipos de falla con consultas', async () => {
  const res = await request(app).get('/api/checklists').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 5);
  assert.ok(res.body[0].consultas.length > 0);
});

test('GET /api/tecnicos devuelve técnicos', async () => {
  const res = await request(app).get('/api/tecnicos').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 6);
});

test('PATCH /api/tecnicos/:id sin token responde 401', async () => {
  const res = await request(app).patch('/api/tecnicos/1').send({ nombre: 'Nuevo Nombre' });
  assert.equal(res.status, 401);
});

test('PATCH /api/tecnicos/:id con rol técnico responde 403', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/1')
    .set('Authorization', `Bearer ${tecnicoToken}`)
    .send({ nombre: 'Nuevo Nombre' });
  assert.equal(res.status, 403);
});

test('PATCH /api/tecnicos/:id actualiza técnico (admin)', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Yudy Garcia Actualizada', rol: 'Gerente General' });
  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Yudy Garcia Actualizada');
  assert.equal(res.body.rol, 'Gerente General');
});

test('PATCH /api/tecnicos/:id rechaza campo no permitido', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'x@y.com' });
  assert.equal(res.status, 400);
});

test('PATCH /api/tecnicos/:id rechaza cuerpo sin campos', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('PATCH /api/tecnicos/:id rechaza nombre corto', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'A' });
  assert.equal(res.status, 400);
});

test('PATCH /api/tecnicos/:id inexistente responde 404', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/99999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Nuevo Nombre' });
  assert.equal(res.status, 404);
});

test('PATCH /api/tecnicos/:id con id inválido responde 400', async () => {
  const res = await request(app)
    .patch('/api/tecnicos/abc')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Nuevo Nombre' });
  assert.equal(res.status, 400);
});

test('GET /api/checklists/causas-raiz devuelve causas (no sombreada por /:tipoId)', async () => {
  const res = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length, 8);
  assert.ok(res.body[0].categoria);
});

test('GET /api/metrics/dashboard devuelve métricas', async () => {
  const res = await request(app).get('/api/metrics/dashboard').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.total, 'number');
  assert.ok(Array.isArray(res.body.por_tecnico));
  assert.ok(Array.isArray(res.body.por_dia));
  assert.equal(res.body.por_dia.length, 30);
});

test('GET /api/incidents devuelve lista paginada con total', async () => {
  const res = await request(app).get('/api/incidents?limit=5').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.items));
  assert.equal(res.body.items.length, 5);
  assert.ok(res.body.total >= 24);
  assert.equal(res.body.limit, 5);
});

test('GET /api/incidents busca con q escapando comodines de LIKE', async () => {
  const res = await request(app).get('/api/incidents?q=%25').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
});

test('GET /api/incidents filtra por rango de fechas', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Fechas', tipo_falla_id: 1 });
  assert.equal(creado.status, 201);

  const hoy = new Date().toISOString().slice(0, 10);
  const hoyRes = await request(app).get(`/api/incidents?desde=${hoy}&hasta=${hoy}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(hoyRes.status, 200);
  assert.ok(hoyRes.body.items.some((i) => i.id === creado.body.id));

  const pasado = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  const pasadoRes = await request(app).get(`/api/incidents?desde=${pasado}&hasta=${pasado}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(pasadoRes.status, 200);
  assert.ok(pasadoRes.body.items.every((i) => i.id !== creado.body.id));

  const invalido = await request(app).get('/api/incidents?desde=no-es-fecha').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(invalido.status, 400);
});

test('POST /api/incidents crea incidencia', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Test', tipo_falla_id: 1, prioridad: 'alta' });
  assert.equal(res.status, 201);
  assert.ok(res.body.numero_ticket.startsWith('ONE-'));
  incidentId = res.body.id;
});

test('POST /api/incidents valida campos obligatorios', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo_falla_id: 1 });
  assert.equal(res.status, 400);
});

test('POST /api/incidents rechaza campos no-string', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Test', tipo_falla_id: 1, telefono: 3001234567 });
  assert.equal(res.status, 400);
});

test('POST /api/incidents rechaza tipo_falla_id inexistente', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'X', tipo_falla_id: 99999 });
  assert.equal(res.status, 400);
});

test('GET /api/incidents/:id devuelve el detalle', async () => {
  const res = await request(app).get(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.cliente, 'Cliente Test');
  assert.ok(Array.isArray(res.body.respuestas));
});

test('PATCH /api/incidents/:id actualiza la incidencia', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ prioridad: 'baja' });
  assert.equal(res.status, 200);
  assert.equal(res.body.prioridad, 'baja');
});

test('PATCH /api/incidents/:id rechaza campos no permitidos', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ campo_inexistente: 'x' });
  assert.equal(res.status, 400);
});

test('PATCH /api/incidents/:id rechaza transición directa a resuelta', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta' });
  assert.equal(res.status, 400);
});

test('PATCH /api/incidents/:id permite nueva → en_diagnostico', async () => {
  const res = await request(app)
    .patch(`/api/incidents/${incidentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'en_diagnostico' });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'en_diagnostico');
});

test('POST /api/incidents/:id/diagnostico guarda respuestas', async () => {
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/diagnostico`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ respuestas: [{ consulta_id: 1, respuesta: 'si', cumple: 1 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.saved, 1);
});

test('POST /api/incidents/:id/diagnostico rechaza consulta ajena al tipo', async () => {
  const checklists = await request(app).get('/api/checklists').set('Authorization', `Bearer ${adminToken}`);
  const otroTipo = checklists.body.find((c) => c.id !== 1);
  const consultaAjena = otroTipo.consultas[0].id;
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/diagnostico`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ respuestas: [{ consulta_id: consultaAjena, respuesta: 'si', cumple: 1 }] });
  assert.equal(res.status, 400);
});

test('POST /api/incidents/:id/finalizar cierra el caso', async () => {
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta', causa_raiz_id: causas.body[0].id, solucion_aplicada: 'Reinicio de ONT' });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'resuelta');
  assert.ok(res.body.tiempo_ms != null);
});

test('POST /api/incidents/:id/finalizar sin causa raíz responde 400', async () => {
  const res = await request(app)
    .post(`/api/incidents/${incidentId}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta' });
  assert.equal(res.status, 400);
});

test('finalizar como escalada no marca resuelta_en', async () => {
  const nuevo = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Escalada Test', tipo_falla_id: 2 });
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  const res = await request(app)
    .post(`/api/incidents/${nuevo.body.id}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'escalada', causa_raiz_id: causas.body[0].id });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'escalada');
  assert.equal(res.body.resuelta_en, null);
  assert.equal(res.body.tiempo_ms, null);
});

test('POST /api/incidents/:id/diagnostico en caso cerrado responde 409', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cerrado Diag', tipo_falla_id: 1 });
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  await request(app)
    .post(`/api/incidents/${creado.body.id}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta', causa_raiz_id: causas.body[0].id });

  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/diagnostico`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ respuestas: [{ consulta_id: 1, respuesta: 'si', cumple: 1 }] });
  assert.equal(res.status, 409);
  const detalle = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.body.estado, 'resuelta');
});

test('POST /api/incidents/:id/finalizar en caso ya cerrado responde 409', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cerrado Fin', tipo_falla_id: 1 });
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  await request(app)
    .post(`/api/incidents/${creado.body.id}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'escalada', causa_raiz_id: causas.body[0].id });

  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta', causa_raiz_id: causas.body[0].id });
  assert.equal(res.status, 409);
  const detalle = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.body.estado, 'escalada');
  assert.equal(detalle.body.resuelta_en, null);
});

test('DELETE /api/incidents/:id con rol técnico responde 403', async () => {
  const nuevo = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Borrable', tipo_falla_id: 1 });
  const res = await request(app)
    .delete(`/api/incidents/${nuevo.body.id}`)
    .set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 403);
});

test('DELETE /api/incidents/:id elimina la incidencia (admin)', async () => {
  const res = await request(app).delete(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
});

test('DELETE /api/incidents/:id inexistente responde 404', async () => {
  const res = await request(app).delete(`/api/incidents/${incidentId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET /api/incidents/:id con id inválido responde 400', async () => {
  const res = await request(app).get('/api/incidents/abc').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
});

test('GET /api/incidents/:id incluye historial de actividad', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Auditoría', tipo_falla_id: 1 });
  assert.equal(creado.status, 201);

  const detalle1 = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle1.status, 200);
  assert.ok(Array.isArray(detalle1.body.actividad));
  assert.equal(detalle1.body.actividad.length, 1);
  assert.equal(detalle1.body.actividad[0].accion, 'creada');

  await request(app)
    .patch(`/api/incidents/${creado.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ prioridad: 'alta' });

  const detalle2 = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(detalle2.body.actividad.map((a) => a.accion), ['actualizada', 'creada']);
  assert.ok(detalle2.body.actividad[0].detalle.includes('prioridad'));
});

test('POST /api/incidents/:id/diagnostico registra actividad', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Diagnóstico', tipo_falla_id: 1 });
  const consultas = await request(app).get('/api/checklists/1').set('Authorization', `Bearer ${adminToken}`);
  const respuestas = consultas.body.consultas.map((c) => ({ consulta_id: c.id, respuesta: 'Sí', cumple: true }));
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/diagnostico`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ respuestas });
  assert.equal(res.status, 200);
  const detalle = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.ok(detalle.body.actividad.some((a) => a.accion === 'diagnostico'));
});

test('POST /api/incidents/:id/finalizar registra el cierre en la actividad', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Cierre', tipo_falla_id: 1 });
  const causas = await request(app).get('/api/checklists/causas-raiz').set('Authorization', `Bearer ${adminToken}`);
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/finalizar`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ estado: 'resuelta', causa_raiz_id: causas.body[0].id });
  assert.equal(res.status, 200);
  const detalle = await request(app).get(`/api/incidents/${creado.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.body.actividad[0].accion, 'cierre');
});

test('GET /api/usuarios sin token responde 401', async () => {
  const res = await request(app).get('/api/usuarios');
  assert.equal(res.status, 401);
});

test('GET /api/usuarios con rol técnico responde 403', async () => {
  const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 403);
});

test('GET /api/usuarios devuelve lista con activo (admin)', async () => {
  const res = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.some((u) => u.rol === 'admin'));
  assert.ok(res.body.every((u) => typeof u.activo === 'number'));
});

test('PATCH /api/usuarios/:id desactiva y bloquea sesión vigente (admin)', async () => {
  const users = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`);
  const tec = users.body.find((u) => u.email === 'bryam@one.com');
  assert.ok(tec);

  const desactivar = await request(app)
    .patch(`/api/usuarios/${tec.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activo: 0 });
  assert.equal(desactivar.status, 200);
  assert.equal(desactivar.body.activo, 0);

  const bloqueada = await request(app).get('/api/incidents').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(bloqueada.status, 401);

  const loginBloqueado = await request(app)
    .post('/api/auth/login')
    .send({ email: 'bryam@one.com', password: 'tecnico123' });
  assert.equal(loginBloqueado.status, 401);

  await request(app)
    .patch(`/api/usuarios/${tec.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activo: 1 });
  const restaurada = await request(app).get('/api/incidents').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(restaurada.status, 200);
});

test('PATCH /api/usuarios/:id no permite desactivar la propia cuenta', async () => {
  const users = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`);
  const admin = users.body.find((u) => u.rol === 'admin');
  const res = await request(app)
    .patch(`/api/usuarios/${admin.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activo: 0 });
  assert.equal(res.status, 400);
});

test('PATCH /api/usuarios/:id rechaza activo no 0/1 y id inválido', async () => {
  const noBool = await request(app)
    .patch('/api/usuarios/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activo: 'si' });
  assert.equal(noBool.status, 400);

  const badId = await request(app)
    .patch('/api/usuarios/abc')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ activo: 1 });
  assert.equal(badId.status, 400);
});