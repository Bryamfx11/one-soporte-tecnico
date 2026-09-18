const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('la base de conocimiento lista protocolos y abre uno', async ({ page }) => {
  await login(page);
  await page.goto('/conocimiento');
  await expect(page.getByRole('heading', { name: 'Base de conocimiento' })).toBeVisible();
  await page.getByRole('button', { name: /Sin servicio de internet/ }).click();
  await expect(page.locator('.kb-header')).toContainText('Sin servicio de internet');
  await expect(page.locator('.kb-step')).toHaveCount(7);
  await expect(page.locator('.kb-step').first()).toContainText('Estado de la ONT');
  await page.getByRole('button', { name: '← Volver al listado' }).click();
  await expect(page.locator('.kb-grid')).toBeVisible();
});