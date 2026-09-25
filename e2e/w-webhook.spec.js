const http = require('node:http');
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const PUERTO = 4144;
let recibidos = [];

function iniciarServidor() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (d) => (cuerpo += d));
      req.on('end', () => {
        recibidos.push({ url: req.url, headers: req.headers, body: cuerpo });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    server.listen(PUERTO, '127.0.0.1', () => resolve(server));
  });
}

function esperarEvento(evento, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    (function poll() {
      const encontrado = recibidos.find((r) => {
        try {
          return JSON.parse(r.body).evento === evento;
        } catch {
          return false;
        }
      });
      if (encontrado) return resolve(encontrado);
      if (Date.now() - inicio > timeout) return reject(new Error(`timeout esperando el evento ${evento}`));
      setTimeout(poll, 150);
    })();
  });
}

test('configurar el webhook y recibir eventos firmados de prueba y de incidencias', async ({ page }) => {
  const servidor = await iniciarServidor();
  try {
    await login(page);
    await page.goto('/ajustes');
    await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible();

    await page.getByPlaceholder('https://hooks.ejemplo.com/onetec').fill(`http://127.0.0.1:${PUERTO}/onetec`);
    await page.getByPlaceholder('sin secreto').fill('secreto-e2e');
    await page.getByRole('checkbox', { name: 'Webhook activo' }).check();
    await page.getByRole('button', { name: 'Guardar webhook' }).click();
    await expect(page.getByRole('status')).toContainText('Configuración del webhook guardada.');

    await page.getByRole('button', { name: 'Enviar prueba' }).click();
    const prueba = await esperarEvento('test');
    expect(JSON.parse(prueba.body).evento).toBe('test');
    expect(prueba.headers['x-onetec-signature']).toBeTruthy();

    const token = await page.evaluate(() => localStorage.getItem('one_soporte_token'));
    const creacion = await page.request.post('/api/incidents', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { cliente: 'Cliente webhook E2E', tipo_falla_id: 1, prioridad: 'media', descripcion: 'Webhook desde el test E2E' }
    });
    expect(creacion.ok()).toBeTruthy();
    const creada = await creacion.json();

    const envio = await esperarEvento('incidencia_creada');
    const payload = JSON.parse(envio.body);
    expect(payload.evento).toBe('incidencia_creada');
    expect(payload.incidencia.numero_ticket).toBe(creada.numero_ticket);
    expect(payload.incidencia.cliente).toBe('Cliente webhook E2E');
    expect(envio.headers['x-onetec-signature']).toBeTruthy();
  } finally {
    recibidos = [];
    await new Promise((resolve) => servidor.close(resolve));
  }
});