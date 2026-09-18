const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('filtrar por estado en diagnóstico muestra solo casos abiertos', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await page.getByLabel('Filtrar por estado').selectOption('en_diagnostico');
  await expect(page).toHaveURL(/estado=en_diagnostico/);
  await expect(page.locator('.page-head p')).toHaveText('3 registros');
  const filas = page.locator('tbody tr');
  await expect(filas).toHaveCount(3);
  await expect(filas.nth(0)).toContainText('En diagnóstico');
});

test('filtrar por tipo de falla de televisión', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await page.getByLabel('Filtrar por tipo de falla').selectOption({ label: 'Falla de televisión (TV)' });
  await expect(page).toHaveURL(/tipo=\d+/);
  await expect(page.locator('.page-head p')).toHaveText('4 registros');
  await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('la paginación navega y Limpiar restaura el listado', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await expect(page.locator('.pagination-info')).toHaveText(/Página 1 de \d+ · \d+ registros/);
  await page.getByRole('button', { name: 'Siguiente ›' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.pagination-info')).toHaveText(/Página 2 de \d+/);
  await page.getByRole('button', { name: '‹ Anterior' }).click();
  await expect(page.locator('.pagination-info')).toHaveText(/Página 1 de \d+/);

  await page.getByLabel('Buscar por cliente, ticket o barrio').fill('ONE-0001');
  await expect(page.locator('.page-head p')).toHaveText('1 registros');
  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.locator('.page-head p')).toHaveText(/registros/);
  await expect(page.locator('.page-head p')).not.toHaveText('1 registros');
});