const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test('gestionar usuarios: roles, bloqueo de propia cuenta y activar/desactivar', async ({ page }) => {
  await login(page);
  await page.goto('/usuarios');
  await expect(page.getByRole('heading', { name: /Gestión de usuarios/ })).toBeVisible();

  const filas = page.locator('tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Administrador');
  await expect(page.locator('tbody')).toContainText('Técnico');

  const filaAdmin = page.locator('tbody tr', { hasText: 'admin@one.com' });
  await expect(filaAdmin.getByRole('button', { name: 'Desactivar' })).toBeDisabled();

  const filaBryam = page.locator('tbody tr', { hasText: 'bryam@one.com' });
  await filaBryam.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('status')).toContainText('Bryam Villalba desactivado.');
  await expect(filaBryam.getByRole('button', { name: 'Activar' })).toBeVisible();

  await filaBryam.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bryam Villalba activado.' })).toBeVisible();
  await expect(filaBryam.getByRole('button', { name: 'Desactivar' })).toBeVisible();
});