const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('la lista muestra las incidencias del seed con paginación', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await expect(page.getByRole('heading', { name: 'Incidencias (PQR)' })).toBeVisible();
  await expect(page.locator('.page-head p')).toHaveText('24 registros');
  await expect(page.getByText(/Página 1 de 3/)).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('ONE-');
});

test('el buscador filtra por ticket', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await page.getByLabel('Buscar por cliente, ticket o barrio').fill('ONE-0001');
  await expect(page.locator('.page-head p')).toHaveText('1 registros');
  await expect(page.locator('tbody').getByText('ONE-0001')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('crear una incidencia llega al detalle y aparece en la lista', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await expect(page.locator('.page-head p')).toHaveText(/registros/);
  const antes = Number((await page.locator('.page-head p').textContent()).match(/\d+/)[0]);
  await page.goto('/incidencias/nueva');
  await page.getByLabel(/Cliente/).fill('Cliente E2E');
  await page.getByLabel(/Tipo de falla/).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Crear incidencia' }).click();
  await expect(page).toHaveURL(/\/incidencias\/\d+/);
  await expect(page.getByRole('heading', { name: /ONE-\d{4}/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/ONE-\d{4} creada/);
  await page.goto('/incidencias');
  await expect(page.locator('.page-head p')).toHaveText(`${antes + 1} registros`);
  await expect(page.locator('tbody').getByText('Cliente E2E')).toBeVisible();
});

test('exportar CSV desde el dashboard muestra el toast', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  await expect(page.getByRole('status')).toContainText('Reporte CSV descargado.');
});