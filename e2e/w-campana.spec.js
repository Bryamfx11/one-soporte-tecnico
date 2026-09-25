const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('la campana recibe la notificación de una incidencia nueva y navega al detalle', async ({ page }) => {
  await login(page);

  const badge = page.locator('.sidebar-foot-acciones .campana-badge');
  const alternar = page.getByRole('button', { name: /Notificaciones/ });
  const panel = page.getByRole('region', { name: 'Panel de notificaciones' });

  await alternar.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('.campana-lista .campana-item, .campana-vacia').first()).toBeVisible();
  await alternar.click();
  await expect(panel).toBeHidden();

  let antes = 0;
  if (await badge.count()) antes = Number(await badge.textContent());

  const token = await page.evaluate(() => localStorage.getItem('one_soporte_token'));
  const creacion = await page.request.post('/api/incidents', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { cliente: 'Cliente campana E2E', tipo_falla_id: 1, prioridad: 'media', descripcion: 'Notificación desde el test E2E' }
  });
  expect(creacion.ok()).toBeTruthy();
  const creada = await creacion.json();

  await expect(badge).toHaveText(String(antes + 1), { timeout: 10000 });

  await alternar.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText(creada.numero_ticket)).toBeVisible();

  await panel.getByText(creada.numero_ticket).click();
  await page.waitForURL(new RegExp(`/incidencias/${creada.id}$`));
  await expect(page.getByRole('heading', { name: new RegExp(creada.numero_ticket) })).toBeVisible();
  if (antes === 0) {
    await expect(badge).toHaveCount(0);
  } else {
    await expect(badge).toHaveText(String(antes));
  }
});