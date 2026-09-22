import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(__dirname, 'test-notif.db');

for (const suffix of ['', '-shm', '-wal', '-journal']) {
  rmSync(TEST_DB + suffix, { force: true });
}

process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret';

const { db } = await import('../db.js');
const notify = await import('../notify.js');

let incidenciaId = 0;

before(() => {
  const r = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, tipo_falla_id, prioridad, estado, sintomas, email, creada_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('ONE-9900', 'Cliente Prueba', '3001112233', 1, 'media', 'en_diagnostico', '', 'cliente@test.co', Date.now());
  incidenciaId = Number(r.lastInsertRowid);
});

test('leerConfigSmtp por defecto no está configurado', () => {
  const c = notify.leerConfigSmtp();
  assert.equal(c.configurado, false);
  assert.equal(c.habilitada, false);
});

test('enviarNotificacion sin destinatario no registra nada', async () => {
  await notify.enviarNotificacion({ tipo: 'estado', incidenciaId, destinatario: '  ' });
  const n = db.prepare('SELECT COUNT(*) AS c FROM notificaciones').get().c;
  assert.equal(n, 0);
});

test('enviarNotificacion sin SMTP registra omitido', async () => {
  await notify.enviarNotificacion({ tipo: 'estado', incidenciaId, destinatario: 'cliente@test.co' });
  const fila = db.prepare('SELECT * FROM notificaciones').get();
  assert.ok(fila);
  assert.equal(fila.estado, 'omitido');
  assert.equal(fila.destinatario, 'cliente@test.co');
});

test('guardarConfigSmtp persiste la configuración', () => {
  notify.guardarConfigSmtp({
    habilitada: true,
    host: 'smtp.test.local',
    port: 587,
    user: 'bot@one.com',
    pass: 'secreto',
    from: 'no-reply@one.com',
    fromName: 'ONETec'
  });
  const c = notify.leerConfigSmtp();
  assert.equal(c.configurado, true);
  assert.equal(c.host, 'smtp.test.local');
  assert.equal(c.from, 'no-reply@one.com');
  assert.equal(c.passConfigurada, true);
});

test('construirCorreo de registro incluye el ticket y la clave de seguimiento', () => {
  const { asunto, html } = notify.construirCorreo({
    tipo: 'registro',
    inc: { numero_ticket: 'ONE-0100', cliente: 'Ana', estado: 'nueva', prioridad: 'media' },
    clave: '123456'
  });
  assert.match(asunto, /ONE-0100/);
  assert.match(asunto, /registrada/i);
  assert.match(html, /ONE-0100/);
  assert.match(html, /123456/);
});

test('construirCorreo de cierre resuelto incluye la solución', () => {
  const { asunto, html } = notify.construirCorreo({
    tipo: 'cierre',
    inc: { numero_ticket: 'ONE-0101', cliente: 'Ana', estado: 'resuelta', prioridad: 'media', solucion_aplicada: 'Cambio de ONT' },
    clave: null
  });
  assert.match(asunto, /finalizado/i);
  assert.match(html, /Cambio de ONT/);
});

test('enviarNotificacion registra enviado cuando el transporte responde', async () => {
  notify.transporte.sendMail = async () => ({ messageId: 'fake-id' });
  await notify.enviarNotificacion({ tipo: 'estado', incidenciaId, destinatario: 'cliente@test.co' });
  const ultima = db.prepare('SELECT * FROM notificaciones ORDER BY id DESC').get();
  assert.equal(ultima.estado, 'enviado');
  assert.match(ultima.asunto, /ONE-9900/);
});

test('enviarNotificacion registra error cuando el transporte falla', async () => {
  notify.transporte.sendMail = async () => { throw new Error('fallo simulado'); };
  await notify.enviarNotificacion({ tipo: 'cierre', incidenciaId, destinatario: 'cliente@test.co' });
  const ultima = db.prepare('SELECT * FROM notificaciones ORDER BY id DESC').get();
  assert.equal(ultima.estado, 'error');
  assert.match(ultima.error, /fallo simulado/);
});
test('el nombre del remitente se limpia para evitar inyección de cabeceras', () => {
  const conf = { from: 'no-reply@one.com', fromName: 'ONETec\r\nBcc: spam@malo.com"' };
  const from = notify.remitenteDesdeConfig(conf);
  assert.equal(from, '"ONETecBcc: spam@malo.com" <no-reply@one.com>');
  assert.ok(!from.includes('\r') && !from.includes('\n'));
});
