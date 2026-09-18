const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('indicadores muestra gráficas, el sello de actualización y exporta CSV', async ({ page }) => {
  await login(page);
  await page.goto('/indicadores');
  await expect(page.getByRole('heading', { name: 'Indicadores de Operación' })).toBeVisible();
  await expect(page.locator('.live-pill')).toContainText(/Actualizado|Conectando/);
  await expect(page.locator('.ind-card')).toHaveCount(3);
  await expect(page.locator('.chart[aria-label]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  await expect(page.getByRole('status')).toContainText('Reporte CSV descargado.');
});