const { test, expect } = require('@playwright/test');
const { login, TECNICO } = require('./helpers');

test('admin ve la navegación completa y el badge de pendientes', async ({ page }) => {
  await login(page);
  const nav = page.locator('nav');
  for (const label of ['Dashboard', 'Incidencias', 'Base de conocimiento', 'Indicadores', 'Ajustes', 'Usuarios']) {
    await expect(nav.getByText(label)).toBeVisible();
  }
  await expect(page.locator('.sidebar .brand-sub')).toHaveText('Soporte Técnico y Redes');
  await expect(page.locator('.sidebar-foot').getByText('Nueva incidencia')).toBeVisible();
  await expect(nav.locator('.nav-badge')).toHaveText(/\d+/);
});

test('técnico no ve Usuarios y /usuarios redirige al inicio', async ({ page }) => {
  await login(page, TECNICO.email, TECNICO.password);
  await expect(page.locator('nav').getByText('Usuarios')).toHaveCount(0);
  await page.goto('/usuarios');
  await expect(page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' })).toBeVisible();
});