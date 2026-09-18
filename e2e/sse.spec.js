const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('dos pestañas se actualizan en vivo por SSE sin recargar', async ({ browser }) => {
  const ctx = await browser.newContext();
  const pestañaA = await ctx.newPage();

  await login(pestañaA);
  await pestañaA.goto('/');

  const statTotal = pestañaA.locator('.stat', { hasText: 'Total incidencias' }).locator('.stat-value');
  const badge = pestañaA.locator('.nav-badge');
  await expect(statTotal).toHaveText(/\d+/);
  await expect(badge).toHaveText(/\d+/);
  const totalInicial = Number(await statTotal.textContent());
  const pendientes = Number(await badge.textContent());

  const pestañaB = await ctx.newPage();
  await pestañaB.goto('/incidencias/nueva');
  await pestañaB.getByLabel(/Cliente/).fill('Cliente SSE');
  await pestañaB.getByLabel(/Tipo de falla/).selectOption({ index: 1 });
  await pestañaB.getByRole('button', { name: 'Crear incidencia' }).click();
  await expect(pestañaB.getByRole('heading', { name: /ONE-\d{4}/ })).toBeVisible();

  await expect(statTotal).toHaveText(String(totalInicial + 1), { timeout: 15000 });
  await expect(badge).toHaveText(String(pendientes + 1), { timeout: 15000 });

  await ctx.close();
});