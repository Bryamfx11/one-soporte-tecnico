const { test, expect } = require('@playwright/test');
const { login, ADMIN, TECNICO } = require('./helpers');

test('redirige a /login cuando no hay sesión', async ({ page }) => {
  await page.goto('/incidencias');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'ONETec' })).toBeVisible();
});

test('rechaza credenciales incorrectas', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill('clave-incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/Credenciales incorrectas/);
});

test('admin inicia sesión y ve el dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByText('ONE Telecomunicaciones S.A.S.')).toBeVisible();
  await expect(page.locator('.stats .stat')).toHaveCount(6);
});

test('técnico inicia sesión', async ({ page }) => {
  await login(page, TECNICO.email, TECNICO.password);
  await expect(page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' })).toBeVisible();
});

test('cerrar sesión regresa al login', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'ONETec' })).toBeVisible();
});