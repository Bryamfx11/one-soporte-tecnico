const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { login, ADMIN, TECNICO } = require('./helpers');

const ROOT = path.resolve(__dirname, '..');

function codigo2fa(secret) {
  if (!secret) throw new Error('Secreto 2FA vacío');
  const out = execFileSync(process.execPath, [
    '-e',
    "const { generarCodigo } = require('./server/totp.js'); process.stdout.write(generarCodigo(process.argv[1]));",
    secret
  ], { cwd: ROOT });
  return out.toString().trim();
}

async function cerrarSesion(page) {
  await page.evaluate(() => localStorage.removeItem('one_soporte_token'));
}

test('administrar 2FA: activar, login en dos pasos y desactivar', async ({ page }) => {
  await login(page);
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { name: /Ajustes/ })).toBeVisible();

  // 1) El admin sin 2FA ve el botón de activar
  await page.getByRole('button', { name: 'Activar 2FA' }).click();
  await expect(page.locator('.twofa-secret code')).toBeVisible();

  const secreto = (await page.locator('.twofa-secret code').textContent()).trim();
  const codigo = codigo2fa(secreto);

  await page.getByLabel('Código para activar 2FA').fill(codigo);
  await page.getByRole('button', { name: /Confirmar y activar/ }).click();
  await expect(page.locator('.twofa-setup')).toHaveCount(0);
  await expect(page.getByText('Activa en tu cuenta')).toBeVisible();

  // 2) El siguiente login pide el segundo paso
  await cerrarSesion(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();

  await page.getByLabel('Código 2FA').fill(codigo2fa(secreto));
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  await page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' }).waitFor({ timeout: 15000 });

  // 3) El código incorrecto no da acceso y vuelve al login sin sesión
  await cerrarSesion(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();
  await page.getByLabel('Código 2FA').fill('000000');
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  await page.waitForURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'ONETec' })).toBeVisible();
  await expect(page.locator('.login-card')).toBeVisible();

  // 4) Desactivación con código válido y login de un solo paso
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Código 2FA').fill(codigo2fa(secreto));
  await page.getByRole('button', { name: 'Verificar y entrar' }).click();
  await page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' }).waitFor({ timeout: 15000 });

  await page.goto('/ajustes');
  await page.getByLabel('Código para desactivar 2FA').fill(codigo2fa(secreto));
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('button', { name: 'Activar 2FA' })).toBeVisible();

  await cerrarSesion(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' }).waitFor({ timeout: 15000 });

  // El técnico ordinario no ve la sección de 2FA
  await cerrarSesion(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(TECNICO.email);
  await page.getByLabel('Contraseña').fill(TECNICO.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' }).waitFor({ timeout: 15000 });
  await page.goto('/ajustes');
  await expect(page.getByText('Verificación en dos pasos (2FA)')).toHaveCount(0);
});