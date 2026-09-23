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
const { enviarAlerta } = await import('../monitor.js');

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