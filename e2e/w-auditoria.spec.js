const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('auditoría: buscar, filtrar por acción y exportar CSV', async ({ page }) => {
  await login(page);
  await page.goto('/auditoria');
  await expect(page.getByRole('heading', { name: /Auditoría/ })).toBeVisible();
  await expect(page.locator('.table tbody tr').first()).toBeVisible();

  // Búsqueda por acción (el LIKE sobre `accion` alcanza a los inicios de sesión)
  await page.getByLabel('Buscar en auditoría').fill('login');
  const filas = page.locator('.table tbody tr');
  await expect(filas.first()).toBeVisible();
  await expect(filas.first().locator('td').nth(1)).toContainText(/Inicio de sesión|Intento de acceso fallido/);

  // Filtro por acción exacta
  await page.getByLabel('Filtrar por acción').selectOption('login_exitoso');
  await expect(filas.first()).toContainText('Inicio de sesión');

  // Exportar CSV
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^auditoria-/);
  const stream = await download.createReadStream();
  const contenido = await new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (c) => { data += c.toString(); });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
  expect(contenido).toMatch(/Fecha,Acción,Usuario/);
  expect(contenido).toContain('Inicio de sesión');
});