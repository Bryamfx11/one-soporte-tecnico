import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test-features.db');
const TEST_UPLOADS = path.join(__dirname, 'test-features-uploads');

for (const suffix of ['', '-shm', '-wal', '-journal']) {
  rmSync(TEST_DB + suffix, { force: true });
}
rmSync(TEST_UPLOADS, { recursive: true, force: true });

process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret-features';
process.env.UPLOADS_DIR = TEST_UPLOADS;

const { default: app } = await import('../app.js');
const { db } = await import('../db.js');
const { calcularSla, guardarMetas } = await import('../sla.js');
const { escalarAbandonadas } = await import('../monitor.js');

let adminToken = '';
let tecnicoToken = '';
let incidenteResuelta = null;

function nextTicket() {
  const m = db.prepare('SELECT COALESCE(MAX(CAST(SUBSTR(numero_ticket, 5) AS INTEGER)), 0) AS m FROM incidencias').get().m;
  return `ONE-${String(m + 1).padStart(4, '0')}`;
}

function insertarIncidencia(datos = {}) {
  const r = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, email, creada_en, clave_seguimiento)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      datos.numero_ticket ?? nextTicket(),
      datos.cliente ?? 'Cliente test',
      datos.telefono ?? '',
      datos.direccion ?? '',
      datos.barrio ?? 'Centro',
      datos.tipo_falla_id ?? 1,
      datos.prioridad ?? 'media',
      datos.estado ?? 'nueva',
      datos.tecnico_id ?? null,
      datos.sintomas ?? '',
      datos.descripcion ?? '',
      datos.email ?? 'cliente@test.com',
      datos.creada_en ?? Date.now(),
      datos.clave ?? null
    );
  return Number(r.lastInsertRowid);
}

before(async () => {
  const admin = await request(app).post('/api/auth/login').send({ email: 'admin@one.com', password: 'admin123' });
  adminToken = admin.body.token;
  const tec = await request(app).post('/api/auth/login').send({ email: 'bryam@one.com', password: 'tecnico123' });
  tecnicoToken = tec.body.token;

  const id = insertarIncidencia({ estado: 'resuelta', clave: '111111', prioridad: 'alta', creada_en: Date.now() - 72 * 3600000 });
  db.prepare("UPDATE incidencias SET resuelta_en = ? WHERE id = ?").run(Date.now() - 24 * 3600000, id);
  db.prepare(`UPDATE incidencias SET numero_ticket = ? WHERE id = ?`).run('ONE-7777', id);
  incidenteResuelta = db.prepare('SELECT * FROM incidencias WHERE id = ?').get(id);
});

test('PUT /api/ajustes/operacion requiere admin', async () => {
  const res = await request(app).put('/api/ajustes/operacion').set('Authorization', `Bearer ${tecnicoToken}`).send({ alta: 12, media: 24, baja: 48, escalamiento: 8 });
  assert.equal(res.status, 403);
});

test('PUT /api/ajustes/operacion valida horas', async () => {
  const res = await request(app).put('/api/ajustes/operacion').set('Authorization', `Bearer ${adminToken}`).send({ alta: 0, media: 24, baja: 48, escalamiento: 900 });
  assert.equal(res.status, 400);
  assert.ok(Array.isArray(res.body.details));
});

test('PUT y GET /api/ajustes/operacion persisten las metas', async () => {
  const put = await request(app).put('/api/ajustes/operacion').set('Authorization', `Bearer ${adminToken}`)
    .send({ alta: 12, media: 24, baja: 48, escalamiento: 8 });
  assert.equal(put.status, 200);
  assert.equal(put.body.sla.alta, 12);
  assert.equal(put.body.sla.escalamiento, 8);

  const get = await request(app).get('/api/ajustes/operacion').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(get.status, 200);
  assert.deepEqual(get.body.sla, { alta: 12, media: 24, baja: 48, escalamiento: 8 });
});

test('calcularSla marca vencido pasada la meta y ok en casos cerrados', async () => {
  guardarMetas({ alta: 2, media: 24, baja: 48, escalamiento: 8 });
  const vencido = calcularSla({ estado: 'nueva', prioridad: 'alta', creada_en: Date.now() - 5 * 3600000 });
  assert.equal(vencido.estado, 'vencido');
  const proximo = calcularSla({ estado: 'en_diagnostico', prioridad: 'media', creada_en: Date.now() - 17 * 3600000 });
  assert.equal(proximo.estado, 'proximo');
  const ok = calcularSla({ estado: 'resuelta', prioridad: 'alta', creada_en: Date.now() - 200 * 3600000 });
  assert.equal(ok.estado, 'ok');
});

test('GET /api/incidents incluye sla por prioridad', async () => {
  const res = await request(app).get('/api/incidents').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.items.length > 0);
  for (const i of res.body.items) {
    assert.ok(i.sla && typeof i.sla.meta_horas === 'number');
    assert.ok(['ok', 'proximo', 'vencido'].includes(i.sla.estado));
  }
});

test('GET /api/incidents/:id incluye sla', async () => {
  const res = await request(app).get(`/api/incidents/${incidenteResuelta.id}`).set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.sla.estado, 'ok');
});

test('escalarAbandonadas detecta casos sin actividad y los audita una sola vez', async () => {
  const viejo = insertarIncidencia({ estado: 'nueva', creada_en: Date.now() - 40 * 3600000 });
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?,?,?,?,?)')
    .run(viejo, 'admin', 'creada', 'hace mucho', Date.now() - 40 * 3600000);
  const reciente = insertarIncidencia({ estado: 'nueva', creada_en: Date.now() - 3600000 });
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?,?,?,?,?)')
    .run(reciente, 'admin', 'creada', 'hace poco', Date.now() - 3600000);

  const escaladosViejo = () => db.prepare("SELECT COUNT(*) AS c FROM actividad WHERE accion = 'escalamiento_automatico' AND incidencia_id = ?").get(viejo).c;
  const escaladosReciente = () => db.prepare("SELECT COUNT(*) AS c FROM actividad WHERE accion = 'escalamiento_automatico' AND incidencia_id = ?").get(reciente).c;

  const primera = escalarAbandonadas();
  assert.ok(primera >= 1, 'escala al menos el caso viejo');
  assert.equal(escaladosViejo(), 1);
  assert.equal(escaladosReciente(), 0, 'el caso con actividad reciente no se escala');
  assert.equal(escaladosViejo(), 1, 'el caso viejo solo se escala una vez');

  const segunda = escalarAbandonadas();
  assert.ok(segunda < primera, 'no vuelve a escalar los casos ya escalados');
});

test('POST /api/checklists/soluciones guarda en la base y audita', async () => {
  const res = await request(app).post('/api/checklists/soluciones').set('Authorization', `Bearer ${tecnicoToken}`)
    .send({ tipo_falla_id: 1, titulo: 'ONT sin enlace óptico', contenido: 'Cambiar el puerto del OLT y verificar el nivel óptico en -18 dBm.' });
  assert.equal(res.status, 201);
  assert.equal(res.body.tipo_falla, res.body.tipo_falla);
  assert.ok(res.body.id > 0);

  const lista = await request(app).get('/api/checklists/soluciones?q=ONT').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(lista.status, 200);
  assert.ok(lista.body.items.length >= 1);
  assert.match(lista.body.items[0].contenido, /-18 dBm/);

  const auditado = db.prepare("SELECT COUNT(*) AS c FROM actividad WHERE accion = 'solucion_guardada'").get().c;
  assert.ok(auditado >= 1);

  const del = await request(app).delete(`/api/checklists/soluciones/${res.body.id}`).set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(del.status, 403, 'solo admin elimina');
  const delAdmin = await request(app).delete(`/api/checklists/soluciones/${res.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(delAdmin.status, 200);
});

test('POST /api/portal/calificar valida ticket + clave y solo casos resueltos', async () => {
  const res = await request(app).post('/api/portal/calificar')
    .send({ ticket: incidenteResuelta.numero_ticket, clave: '000000', valor: 5, comentario: '' });
  assert.equal(res.status, 404, 'clave incorrecta no coincide');

  const abierta = await request(app).post('/api/portal/calificar')
    .send({ ticket: 'ONE-7777', clave: '111111', valor: 5 });
  assert.equal(abierta.status, 201);

  const otraVez = await request(app).post('/api/portal/calificar')
    .send({ ticket: 'ONE-7777', clave: '111111', valor: 3 });
  assert.equal(otraVez.status, 409, 'no se puede calificar dos veces');

  const mal = await request(app).post('/api/portal/calificar')
    .send({ ticket: 'ONE-7777', clave: '111111', valor: 9 });
  assert.equal(mal.status, 400);
});

test('seguimiento del portal incluye la calificación existente', async () => {
  const res = await request(app).get('/api/portal/incidencias/ONE-7777?clave=111111');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.calificacion, { valor: 5, comentario: '' });
});

test('GET /api/metrics/dashboard reporta satisfacción', async () => {
  const res = await request(app).get('/api/metrics/dashboard').set('Authorization', `Bearer ${tecnicoToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.satisfacciones, 1);
  assert.equal(res.body.satisfaccion_promedio, 5);
});