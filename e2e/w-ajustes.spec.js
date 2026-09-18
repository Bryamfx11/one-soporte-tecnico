const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('cambiar el tema se aplica y queda guardado', async ({ page }) => {
  await login(page);
  await page.goto('/ajustes');
  const toggle = page.locator('.sidebar-foot .theme-toggle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toContainText('Tema oscuro');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toContainText('Tema claro');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.sidebar-foot .theme-toggle')).toContainText('Tema claro');

  await page.locator('.sidebar-foot .theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('guardar y restablecer las metas de servicio', async ({ page }) => {
  await login(page);
  await page.goto('/ajustes');
  await page.locator('#cfg-tasaMin').fill('88');
  await page.locator('#cfg-escalarH').fill('40');
  await page.getByRole('button', { name: 'Guardar criterios' }).click();
  await expect(page.getByRole('status')).toContainText('Criterios guardados correctamente.');

  await page.reload();
  await expect(page.locator('#cfg-tasaMin')).toHaveValue('88');
  await expect(page.locator('#cfg-escalarH')).toHaveValue('40');

  await page.getByRole('button', { name: 'Restablecer' }).click();
  await expect(page.getByRole('status')).toContainText('Criterios restablecidos a los valores por defecto.');
  await expect(page.locator('#cfg-tasaMin')).toHaveValue('70');
  await expect(page.locator('#cfg-escalarH')).toHaveValue('26');
});