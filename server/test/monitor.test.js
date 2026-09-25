import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-monitor');

rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

process.env.DB_PATH = path.join(TEST_DIR, 'data.db');
process.env.NODE_ENV = 'test';

const { db } = await import('../db.js');
const { guardarConfigSmtp, transporte } = await import('../notify.js');
const { enviarAlerta, enviarResumenDiario, enviarResumenSemanal } = await import('../monitor.js');

function configurar(extra = {}) {
  guardarConfigSmtp({
    habilitada: true,
    host: 'smtp.test.com',
    port: 587,
    user: '',
    pass: '',
    from: 'no-reply@one.com',
    fromName: 'ONETec',
    ...extra
  });
}

test('enviarAlerta usa el correo de alertas configurado', async () => {
  configurar({ alertaEmail: 'alertas@one.com' });
  let enviado = null;
  transporte.sendMail = async (_conf, mail) => { enviado = mail; return {}; };
  const ok = await enviarAlerta({ asunto: 'Fallo del backup', cuerpo: 'detalle' });
  assert.equal(ok, true);
  assert.equal(enviado.to, 'alertas@one.com');
  assert.equal(enviado.subject, '[ONETec] Fallo del backup');
});

test('enviarAlerta sin alerta_email cae a los correos de admins activos', async () => {
  configurar({ alertaEmail: '' });
  const recibidos = [];
  transporte.sendMail = async (_conf, mail) => { recibidos.push(mail.to); return {}; };
  await enviarAlerta({ asunto: 'Backup atrasado', cuerpo: 'cuerpo' });
  assert.ok(recibidos.includes('admin@one.com'), 'se notifica al admin de respaldo');
});

test('enviarAlerta con SMTP desactivado no lanza', async () => {
  configurar({ alertaEmail: 'alertas@one.com' });
  db.prepare("UPDATE config SET valor = '0' WHERE clave = 'notif_habilitada'").run();
  const ok = await enviarAlerta({ asunto: 'x', cuerpo: 'y' });
  assert.equal(ok, false);
});

test('enviarResumenDiario arma el cuerpo con las cifras de hoy', async () => {
  configurar({ alertaEmail: 'resumen@one.com' });
  let mail = null;
  transporte.sendMail = async (_conf, m) => { mail = m; return {}; };
  const ok = await enviarResumenDiario();
  assert.equal(ok, true);
  assert.equal(mail.to, 'resumen@one.com');
  assert.equal(mail.subject, '[ONETec] Resumen operativo diario');
  assert.match(mail.html, /Fecha: /);
  assert.match(mail.html, /pendientes \(nueva \+ en diagnosis\)|Incidencias pendientes/);
  assert.match(mail.html, /backup/);
});

test('enviarResumenDiario con SMTP desactivado no envía ni lanza', async () => {
  configurar({ alertaEmail: 'resumen@one.com' });
  db.prepare("UPDATE config SET valor = '0' WHERE clave = 'notif_habilitada'").run();
  let llamadas = 0;
  transporte.sendMail = async () => { llamadas += 1; return {}; };
  const ok = await enviarResumenDiario();
  assert.equal(ok, false);
  assert.equal(llamadas, 0);
});

test('enviarResumenSemanal arma el cuerpo con las cifras de los últimos 7 días', async () => {
  configurar({ alertaEmail: 'semanal@one.com' });
  let mail = null;
  transporte.sendMail = async (_conf, m) => { mail = m; return {}; };
  const ok = await enviarResumenSemanal();
  assert.equal(ok, true);
  assert.equal(mail.to, 'semanal@one.com');
  assert.equal(mail.subject, '[ONETec] Resumen operativo semanal');
  assert.match(mail.html, /Período: /);
  assert.match(mail.html, /Nuevas: /);
  assert.match(mail.html, /Resueltas: /);
  assert.match(mail.html, /SLA vencido/);
});

test('enviarResumenSemanal con SMTP desactivado no envía ni lanza', async () => {
  configurar({ alertaEmail: 'semanal@one.com' });
  db.prepare("UPDATE config SET valor = '0' WHERE clave = 'notif_habilitada'").run();
  let llamadas = 0;
  transporte.sendMail = async () => { llamadas += 1; return {}; };
  const ok = await enviarResumenSemanal();
  assert.equal(ok, false);
  assert.equal(llamadas, 0);
});