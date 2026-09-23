import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test.db');
const TEST_UPLOADS = path.join(__dirname, 'test-uploads');

// Limpiar base de datos de prueba antes de cargar la app
for (const suffix of ['', '-shm', '-wal', '-journal']) {
  rmSync(TEST_DB + suffix, { force: true });
}
rmSync(TEST_UPLOADS, { recursive: true, force: true });

process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret';
process.env.UPLOADS_DIR = TEST_UPLOADS;

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

test('GET /api/health reporta el estado de la base de datos', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, 'ok');
  assert.equal(typeof res.body.incidencias, 'number');
  assert.equal(typeof res.body.uptime, 'number');
  assert.equal(typeof res.body.backups, 'object');
  assert.equal(typeof res.body.backups.cantidad, 'number');
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
  assert.equal(res.body.user.rol, 'tecnico');
});

test('POST /api/auth/register crea usuario con rol admin cuando se indica', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Segundo Admin', email: 'admin2@one.com', password: 'clave123', rol: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.rol, 'admin');
});

test('POST /api/auth/register rechaza rol inválido', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Rol Malo', email: 'rolmalo@one.com', password: 'clave123', rol: 'superadmin' });
  assert.equal(res.status, 400);
});

test('POST /api/auth/register rechaza email duplicado', async () => {
  const email = 'duplicado@one.com';
  const primero = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Primero', email, password: 'clave123', rol: 'tecnico' });
  assert.equal(primero.status, 201);

  const repetido = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Segundo', email, password: 'otraclave456' });
  assert.equal(repetido.status, 409);
});

test('GET /api/auth/me devuelve el usuario autenticado', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, 'admin@one.com');
});

test('POST /api/auth/change-password sin token responde 401', async () => {
  const res = await request(app)
    .post('/api/auth/change-password')
    .send({ password_actual: 'x', password_nueva: 'y12345' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/change-password con contraseña actual incorrecta responde 400', async () => {
  const res = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password_actual: 'incorrecta', password_nueva: 'claveNueva1' });
  assert.equal(res.status, 400);
});

test('POST /api/auth/change-password rechaza nueva corta o igual a la actual', async () => {
  const corta = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password_actual: 'admin123', password_nueva: '123' });
  assert.equal(corta.status, 400);

  const igual = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password_actual: 'admin123', password_nueva: 'admin123' });
  assert.equal(igual.status, 400);
});

test('POST /api/auth/change-password cambia la contraseña y permite el nuevo login', async () => {
  const cambiar = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password_actual: 'admin123', password_nueva: 'nuevaAdmin123' });
  assert.equal(cambiar.status, 200);
  assert.equal(cambiar.body.ok, true);

  const loginViejo = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  assert.equal(loginViejo.status, 401);

  const loginNuevo = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'nuevaAdmin123' });
  assert.equal(loginNuevo.status, 200);

  // Restaurar la contraseña original para no afectar al resto de la suite
  const restaurar = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${loginNuevo.body.token}`)
    .send({ password_actual: 'nuevaAdmin123', password_nueva: 'admin123' });
  assert.equal(restaurar.status, 200);
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

test('GET /api/metrics/pendientes devuelve el contador de casos abiertos', async () => {
  const res = await request(app).get('/api/metrics/pendientes').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.pendientes, 'number');
});

test('GET /api/metrics/dashboard devuelve métricas', async () => {
  const res = await request(app).get('/api/metrics/dashboard').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.total, 'number');
  assert.ok(Array.isArray(res.body.por_tecnico));
  assert.ok(Array.isArray(res.body.por_dia));
  assert.equal(res.body.por_dia.length, 30);
});

test('GET /api/metrics/comparativo devuelve el resumen mes vs mes', async () => {
  const res = await request(app).get('/api/metrics/comparativo').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.match(res.body.mes, /^\d{4}-\d{2}$/);
  assert.match(res.body.mes_anterior, /^\d{4}-\d{2}$/);
  assert.equal(typeof res.body.actual.nuevas, 'number');
  assert.equal(typeof res.body.actual.resueltas, 'number');
  assert.equal(typeof res.body.actual.pendientes, 'number');
  assert.ok(Array.isArray(res.body.por_tipo));
  assert.ok(Array.isArray(res.body.por_tecnico.actual));
  assert.ok(Array.isArray(res.body.por_tecnico.anterior));
  assert.ok(res.body.actual.nuevas >= 24);
});

test('GET /api/metrics/comparativo con mes inválido responde 400', async () => {
  const res = await request(app).get('/api/metrics/comparativo?mes=2026-13').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
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

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('POST /api/incidents/:id/adjuntos sin token responde 401', async () => {
  const res = await request(app).post('/api/incidents/1/adjuntos').send({ tipo: 'image/png', base64: PNG_BASE64 });
  assert.equal(res.status, 401);
});

test('POST /api/incidents/:id/adjuntos con tipo inválido responde 400', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Tipo', tipo_falla_id: 1 });
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo: 'application/pdf', base64: PNG_BASE64 });
  assert.equal(res.status, 400);
});

test('POST /api/incidents/:id/adjuntos con base64 vacío responde 400', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Vacío', tipo_falla_id: 1 });
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo: 'image/png', base64: '' });
  assert.equal(res.status, 400);
});

test('POST /api/incidents/:id/adjuntos con archivo mayor a 5 MB responde 400', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Grande', tipo_falla_id: 1 });
  const base64Grande = 'A'.repeat(7 * 1024 * 1024);
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo: 'image/png', base64: base64Grande });
  assert.equal(res.status, 400);
});

test('subir, listar y descargar un adjunto', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente Adjuntos', tipo_falla_id: 1 });
  const id = creado.body.id;

  const subida = await request(app)
    .post(`/api/incidents/${id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'inicio.png', tipo: 'image/png', base64: PNG_BASE64 });
  assert.equal(subida.status, 201);
  assert.equal(subida.body.nombre, 'inicio.png');
  assert.equal(subida.body.tipo, 'image/png');
  assert.ok(subida.body.id >= 1);

  const lista = await request(app).get(`/api/incidents/${id}/adjuntos`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(lista.status, 200);
  assert.equal(lista.body.length, 1);
  assert.equal(lista.body[0].id, subida.body.id);
  assert.equal('ruta' in lista.body[0], false);

  const detalle = await request(app).get(`/api/incidents/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.body.adjuntos.length, 1);

  const archivo = await request(app)
    .get(`/api/incidents/${id}/adjuntos/${subida.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(archivo.status, 200);
  assert.match(archivo.headers['content-type'], /^image\/png/);
  assert.ok(archivo.headers['content-disposition'].includes('inline'));

  const borrado = await request(app)
    .delete(`/api/incidents/${id}/adjuntos/${subida.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(borrado.status, 200);

  const listaVacia = await request(app).get(`/api/incidents/${id}/adjuntos`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(listaVacia.body.length, 0);

  const reborrado = await request(app)
    .delete(`/api/incidents/${id}/adjuntos/${subida.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(reborrado.status, 404);
});

test('descargar un adjunto inexistente responde 404', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto 404', tipo_falla_id: 1 });
  const res = await request(app)
    .get(`/api/incidents/${creado.body.id}/adjuntos/99999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('DELETE /api/incidents/:id elimina también los adjuntos', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Delete', tipo_falla_id: 1 });
  const id = creado.body.id;
  await request(app)
    .post(`/api/incidents/${id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'a.png', tipo: 'image/png', base64: PNG_BASE64 });

  const res = await request(app).delete(`/api/incidents/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  const detalle = await request(app).get(`/api/incidents/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.status, 404);
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

async function crearUsuarioPrueba(email, rol = 'tecnico') {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Usr ' + email, email, password: 'clave123', rol });
  assert.equal(res.status, 201);
  return res.body.user;
}

test('PATCH /api/usuarios/:id actualiza nombre, email y rol', async () => {
  const u = await crearUsuarioPrueba('editar@one.com');
  const res = await request(app)
    .patch(`/api/usuarios/${u.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Editado', email: 'editado2@one.com', rol: 'admin' });
  assert.equal(res.status, 200);
  assert.equal(res.body.nombre, 'Editado');
  assert.equal(res.body.email, 'editado2@one.com');
  assert.equal(res.body.rol, 'admin');
});

test('PATCH /api/usuarios/:id rechaza email duplicado', async () => {
  const u = await crearUsuarioPrueba('dup-editar@one.com');
  const res = await request(app)
    .patch(`/api/usuarios/${u.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'bryam@one.com' });
  assert.equal(res.status, 409);
});

test('PATCH /api/usuarios/:id rechaza rol inválido', async () => {
  const u = await crearUsuarioPrueba('rol-bad@one.com');
  const res = await request(app)
    .patch(`/api/usuarios/${u.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ rol: 'superadmin' });
  assert.equal(res.status, 400);
});

test('PATCH /api/usuarios/:id no permite cambiar el rol de la propia cuenta', async () => {
  const users = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${adminToken}`);
  const admin = users.body.find((u) => u.email === 'admin@one.com');
  const res = await request(app)
    .patch(`/api/usuarios/${admin.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ rol: 'tecnico' });
  assert.equal(res.status, 400);
});

test('PATCH /api/usuarios/:id restablece la contraseña de otro usuario', async () => {
  const u = await crearUsuarioPrueba('reset-pass@one.com');
  const res = await request(app)
    .patch(`/api/usuarios/${u.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password: 'nuevaClave1' });
  assert.equal(res.status, 200);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'reset-pass@one.com', password: 'nuevaClave1' });
  assert.equal(login.status, 200);
});

test('PATCH /api/usuarios/:id rechaza cuerpo vacío o solo campos desconocidos', async () => {
  const vacio = await request(app)
    .patch('/api/usuarios/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(vacio.status, 400);

  const soloDesconocido = await request(app)
    .patch('/api/usuarios/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ hacker: 'x' });
  assert.equal(soloDesconocido.status, 400);
});

test('POST /api/tecnicos sin token responde 401', async () => {
  const res = await request(app).post('/api/tecnicos').send({ nombre: 'Nuevo Técnico' });
  assert.equal(res.status, 401);
});

test('POST /api/tecnicos con rol técnico responde 403', async () => {
  const res = await request(app)
    .post('/api/tecnicos')
    .set('Authorization', `Bearer ${tecnicoToken}`)
    .send({ nombre: 'Nuevo Técnico' });
  assert.equal(res.status, 403);
});

test('POST /api/tecnicos rechaza nombre corto', async () => {
  const res = await request(app)
    .post('/api/tecnicos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'A' });
  assert.equal(res.status, 400);
});

test('POST /api/tecnicos crea técnico (admin)', async () => {
  const res = await request(app)
    .post('/api/tecnicos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Nuevo Técnico', rol: 'Técnico de Campo' });
  assert.equal(res.status, 201);
  assert.equal(res.body.nombre, 'Nuevo Técnico');
  assert.equal(res.body.rol, 'Técnico de Campo');
});

test('DELETE /api/tecnicos de un técnico con incidencias responde 409', async () => {
  const tecnicos = await request(app).get('/api/tecnicos').set('Authorization', `Bearer ${adminToken}`);
  const objetivo = tecnicos.body[0];
  await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Cliente de Técnico', tipo_falla_id: 1, tecnico_id: objetivo.id });

  const res = await request(app)
    .delete(`/api/tecnicos/${objetivo.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE /api/tecnicos con rol técnico responde 403', async () => {
  const nuevo = await request(app)
    .post('/api/tecnicos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Técnico a Borrar' });
  const res = await request(app)
    .delete(`/api/tecnicos/${nuevo.body.id}`)
    .set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 403);
});

test('DELETE /api/tecnicos sin incidencias elimina (admin)', async () => {
  const nuevo = await request(app)
    .post('/api/tecnicos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Técnico a Borrar' });
  const res = await request(app)
    .delete(`/api/tecnicos/${nuevo.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
});

test('DELETE /api/tecnicos inexistente responde 404', async () => {
  const res = await request(app)
    .delete('/api/tecnicos/99999')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('POST /api/checklists/tipos sin token responde 401', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos')
    .send({ nombre: 'Nuevo tipo', descripcion: 'Descripción' });
  assert.equal(res.status, 401);
});

test('POST /api/checklists/tipos con rol técnico responde 403', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos')
    .set('Authorization', `Bearer ${tecnicoToken}`)
    .send({ nombre: 'Nuevo tipo', descripcion: 'Descripción' });
  assert.equal(res.status, 403);
});

test('POST /api/checklists/tipos crea tipo de falla (admin)', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Falla de telefonía', descripcion: 'El teléfono fijo no registra tono', icono: 'phone' });
  assert.equal(res.status, 201);
  assert.equal(res.body.nombre, 'Falla de telefonía');
  assert.equal(res.body.icono, 'phone');
  assert.deepEqual(res.body.consultas, []);
});

test('POST /api/checklists/tipos valida campos obligatorios', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: '' });
  assert.equal(res.status, 400);
});

test('PATCH /api/checklists/tipos/:id actualiza el tipo (admin)', async () => {
  const res = await request(app)
    .patch('/api/checklists/tipos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ descripcion: 'Descripción actualizada' });
  assert.equal(res.status, 200);
  assert.equal(res.body.descripcion, 'Descripción actualizada');
  assert.equal(res.body.nombre, 'Sin servicio de internet');
});

test('PATCH /api/checklists/tipos/:id rechaza campo no permitido', async () => {
  const res = await request(app)
    .patch('/api/checklists/tipos/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ otro: 'x' });
  assert.equal(res.status, 400);
});

test('DELETE /api/checklists/tipos/:id con incidencias responde 409', async () => {
  const res = await request(app)
    .delete('/api/checklists/tipos/1')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE /api/checklists/tipos/:id sin incidencias elimina (admin)', async () => {
  const creado = await request(app)
    .post('/api/checklists/tipos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nombre: 'Tipo a Borrar', descripcion: 'Descripción' });
  const res = await request(app)
    .delete(`/api/checklists/tipos/${creado.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
});

test('POST /api/checklists/tipos/:tipoId/consultas crea consulta (admin)', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos/1/consultas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ titulo: 'Prueba de tono', pregunta: '¿Hay tono?', instruccion: 'Descolgar y verificar tono', tipo_respuesta: 'si_no', orden: 99 });
  assert.equal(res.status, 201);
  assert.equal(res.body.orden, 99);
  assert.equal(res.body.tipo_falla_id, 1);
});

test('POST /api/checklists/tipos/:tipoId/consultas en tipo inexistente responde 404', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos/99999/consultas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ titulo: 'X', pregunta: 'Y', instruccion: 'Z' });
  assert.equal(res.status, 404);
});

test('POST /api/checklists/tipos/:tipoId/consultas valida campos', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos/1/consultas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ titulo: 'X', pregunta: 'Y' });
  assert.equal(res.status, 400);
});

test('POST /api/checklists/tipos/:tipoId/consultas con id inválido responde 400', async () => {
  const res = await request(app)
    .post('/api/checklists/tipos/abc/consultas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ titulo: 'X', pregunta: 'Y', instruccion: 'Z' });
  assert.equal(res.status, 400);
});

test('PATCH /api/checklists/consultas/:id actualiza la consulta (admin)', async () => {
  const res = await request(app)
    .patch('/api/checklists/consultas/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ referencia: 'Verificar tres veces' });
  assert.equal(res.status, 200);
  assert.equal(res.body.referencia, 'Verificar tres veces');
});

test('DELETE /api/checklists/consultas/:id con respuestas responde 409', async () => {
  const res = await request(app)
    .delete('/api/checklists/consultas/1')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE /api/checklists/consultas/:id sin respuestas elimina (admin)', async () => {
  const creada = await request(app)
    .post('/api/checklists/tipos/1/consultas')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ titulo: 'Consulta a Borrar', pregunta: '¿P?', instruccion: 'I' });
  const res = await request(app)
    .delete(`/api/checklists/consultas/${creada.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
});

test('POST /api/checklists/causas-raiz crea causa (admin)', async () => {
  const res = await request(app)
    .post('/api/checklists/causas-raiz')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ categoria: 'Corte programado', descripcion: 'Mantenimiento de la red anunciado' });
  assert.equal(res.status, 201);
  assert.equal(res.body.categoria, 'Corte programado');
});

test('POST /api/checklists/causas-raiz valida campos', async () => {
  const res = await request(app)
    .post('/api/checklists/causas-raiz')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ categoria: '' });
  assert.equal(res.status, 400);
});

test('PATCH /api/checklists/causas-raiz/:id actualiza la causa (admin)', async () => {
  const res = await request(app)
    .patch('/api/checklists/causas-raiz/1')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ descripcion: 'Descripción nueva de la causa' });
  assert.equal(res.status, 200);
  assert.equal(res.body.descripcion, 'Descripción nueva de la causa');
});

test('DELETE /api/checklists/causas-raiz/:id con incidencias responde 409', async () => {
  const res = await request(app)
    .delete('/api/checklists/causas-raiz/1')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE /api/checklists/causas-raiz/:id sin incidencias elimina (admin)', async () => {
  const creada = await request(app)
    .post('/api/checklists/causas-raiz')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ categoria: 'Causa a Borrar', descripcion: 'Descripción' });
  const res = await request(app)
    .delete(`/api/checklists/causas-raiz/${creada.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
});

async function primerTipoFalla() {
  const res = await request(app).get('/api/portal/tipos');
  return res.body[0];
}

test('GET /api/portal/tipos responde sin token', async () => {
  const res = await request(app).get('/api/portal/tipos');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body) && res.body.length > 0);
  assert.equal(typeof res.body[0].nombre, 'string');
});

test('POST /api/portal/reportes sin token crea incidencia pública', async () => {
  const tipo = await primerTipoFalla();
  const clientePubl = `Cliente Público ${Date.now()}`;
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: clientePubl, telefono: '3001112233', barrio: 'San José', tipo_falla_id: tipo.id, sintomas: 'Sin internet desde ayer' });
  assert.equal(res.status, 201);
  assert.match(res.body.numero_ticket, /^ONE-\d{4}$/);
  assert.match(res.body.clave_seguimiento, /^\d{6}$/);

  const detalle = await request(app)
    .get(`/api/incidents/${res.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.cliente, clientePubl);
  assert.equal(detalle.body.estado, 'nueva');
  assert.equal(detalle.body.prioridad, 'media');
  assert.equal(detalle.body.tecnico_id, null);
});

test('POST /api/portal/reportes rechaza tipo de falla inexistente', async () => {
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Cliente X', tipo_falla_id: 99999 });
  assert.equal(res.status, 400);
});

test('POST /api/portal/reportes valida campos obligatorios', async () => {
  const tipo = await primerTipoFalla();
  const sinNombre = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: '  ', tipo_falla_id: tipo.id });
  assert.equal(sinNombre.status, 400);

  const sinTipo = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Cliente Y' });
  assert.equal(sinTipo.status, 400);
});

test('POST /api/portal/reportes rechaza campos no permitidos (sin escalada)', async () => {
  const tipo = await primerTipoFalla();
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Cliente Z', tipo_falla_id: tipo.id, estado: 'resuelta', tecnico_id: 1 });
  assert.equal(res.status, 400);
});

test('POST /api/portal/reportes con honeypot no crea incidencia', async () => {
  const tipo = await primerTipoFalla();
  const antes = (await request(app).get('/api/health')).body.incidencias;
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Bot', empresa: 'http://spam', tipo_falla_id: tipo.id });
  assert.equal(res.status, 201);
  const despues = (await request(app).get('/api/health')).body.incidencias;
  assert.equal(despues, antes);
});

test('GET /api/portal/incidencias/:ticket con clave correcta devuelve estado sin datos de contacto', async () => {
  const tipo = await primerTipoFalla();
  const creada = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Rastreo', telefono: '3001112233', direccion: 'Calle 1 #2-3', tipo_falla_id: tipo.id });
  const consulta = await request(app)
    .get(`/api/portal/incidencias/${creada.body.numero_ticket}`)
    .query({ clave: creada.body.clave_seguimiento });
  assert.equal(consulta.status, 200);
  assert.equal(consulta.body.estado, 'nueva');
  assert.equal(consulta.body.numero_ticket, creada.body.numero_ticket);
  assert.equal(consulta.body.tipo_falla, tipo.nombre);
  assert.equal(consulta.body.cliente, undefined);
  assert.equal(consulta.body.telefono, undefined);
  assert.equal(consulta.body.direccion, undefined);
  assert.equal(consulta.body.clave_seguimiento, undefined);
});

test('GET /api/portal/incidencias/:ticket con clave incorrecta responde 404', async () => {
  const tipo = await primerTipoFalla();
  const creada = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Clave Mala', tipo_falla_id: tipo.id });
  const res = await request(app)
    .get(`/api/portal/incidencias/${creada.body.numero_ticket}`)
    .query({ clave: '000000' });
  assert.equal(res.status, 404);
});

test('GET /api/portal/incidencias/:ticket inexistente o inválido responde 404', async () => {
  const inexistente = await request(app)
    .get('/api/portal/incidencias/ONE-9999')
    .query({ clave: '123456' });
  assert.equal(inexistente.status, 404);

  const invalido = await request(app)
    .get('/api/portal/incidencias/abc')
    .query({ clave: '123456' });
  assert.equal(invalido.status, 404);
});

test('POST /api/incidents guarda el correo del cliente', async () => {
  const tipo = await primerTipoFalla();
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Con Correo', tipo_falla_id: tipo.id, email: 'cliente@correo.co' });
  assert.equal(res.status, 201);
  const det = await request(app)
    .get(`/api/incidents/${res.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(det.body.email, 'cliente@correo.co');
});

test('PATCH /api/incidents/:id actualiza el correo del cliente', async () => {
  const tipo = await primerTipoFalla();
  const creada = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Correo Update', tipo_falla_id: tipo.id, email: 'viejo@correo.co' });
  const res = await request(app)
    .patch(`/api/incidents/${creada.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'nuevo@correo.co' });
  assert.equal(res.status, 200);
  const det = await request(app)
    .get(`/api/incidents/${res.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(det.body.email, 'nuevo@correo.co');
});

test('PATCH /api/incidents/:id rechaza correo inválido', async () => {
  const tipo = await primerTipoFalla();
  const creada = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Correo Malo', tipo_falla_id: tipo.id });
  const res = await request(app)
    .patch(`/api/incidents/${creada.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'no-es-un-email' });
  assert.equal(res.status, 400);
});

test('POST /api/portal/reportes guarda el correo del cliente', async () => {
  const tipo = await primerTipoFalla();
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Con Correo', tipo_falla_id: tipo.id, email: 'cliente@correo.co' });
  assert.equal(res.status, 201);
  const det = await request(app)
    .get(`/api/incidents/${res.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(det.body.email, 'cliente@correo.co');
});

test('POST /api/portal/reportes rechaza correo inválido', async () => {
  const tipo = await primerTipoFalla();
  const res = await request(app)
    .post('/api/portal/reportes')
    .send({ nombre: 'Correo Malo', tipo_falla_id: tipo.id, email: 'no-es-un-email' });
  assert.equal(res.status, 400);
});

test('GET /api/notifications/config sin token responde 401', async () => {
  const res = await request(app).get('/api/notifications/config');
  assert.equal(res.status, 401);
});

test('GET /api/notifications/config con rol técnico responde 403', async () => {
  const res = await request(app)
    .get('/api/notifications/config')
    .set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 403);
});

test('GET /api/notifications/config devuelve el estado (admin)', async () => {
  const res = await request(app)
    .get('/api/notifications/config')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.configurado, 'boolean');
  assert.equal(typeof res.body.passConfigurada, 'boolean');
});

test('PUT /api/notifications/config valida campos', async () => {
  const res = await request(app)
    .put('/api/notifications/config')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ habilitada: 'si', host: 'h', from: 'no-valido' });
  assert.equal(res.status, 400);
});

test('PUT /api/notifications/config guarda y devuelve (admin)', async () => {
  const res = await request(app)
    .put('/api/notifications/config')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ habilitada: true, host: 'smtp.test.local', port: 587, user: 'bot@one.com', pass: 'secreto', from: 'no-reply@one.com', fromName: 'ONETec' });
  assert.equal(res.status, 200);
  assert.equal(res.body.configurado, true);
  assert.equal(res.body.host, 'smtp.test.local');
  assert.equal(res.body.passConfigurada, true);
});

test('POST /api/notifications/test con SMTP inalcanzable responde 502', async () => {
  await request(app)
    .put('/api/notifications/config')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ habilitada: true, host: '127.0.0.1', port: 1, user: 'bot@one.com', pass: 'secreto', from: 'no-reply@one.com', fromName: 'ONETec' });
  const res = await request(app)
    .post('/api/notifications/test')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 502);
  assert.match(res.body.error, /No se pudo enviar/);
});

test('GET /api/notifications/historial devuelve la lista (admin)', async () => {
  const res = await request(app)
    .get('/api/notifications/historial')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});

// ---- Endurecimiento de seguridad ----

test('JSON malformado responde 400 (no 500) y no expone detalles', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email": "admin@one.com", "password"');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /JSON/);
  assert.equal(res.body.code, undefined);
});

test('Cuerpo sin JSON (sin Content-Type) no rompe la validación y responde 400', async () => {
  const res = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .type('text/plain')
    .send('hola');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Error de validación');
});

test('Respuestas de la API no quedan en caché (Cache-Control: no-store)', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('Todas las rutas de la API envían cabeceras de seguridad', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
  assert.match(res.headers['content-security-policy'], /default-src 'self'/);
});

test('Token emitido sin issuer del servidor es rechazado (401)', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const falso = jwt.sign({ id: 1 }, 'otro-secreto', { algorithm: 'HS256', expiresIn: '8h' });
  const res = await request(app).get('/api/incidents').set('Authorization', `Bearer ${falso}`);
  assert.equal(res.status, 401);
});

test('POST /api/incidents/:id/adjuntos con base64 con caracteres inválidos responde 400', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Basura', tipo_falla_id: 1 });
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo: 'image/png', base64: '!!!!not-base64!!!' });
  assert.equal(res.status, 400);
});

test('POST /api/incidents/:id/adjuntos con payload mayor a 8 MB responde 413', async () => {
  const creado = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ cliente: 'Adjunto Enorme', tipo_falla_id: 1 });
  const res = await request(app)
    .post(`/api/incidents/${creado.body.id}/adjuntos`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tipo: 'image/png', base64: 'A'.repeat(9 * 1024 * 1024) });
  assert.equal(res.status, 413);
});