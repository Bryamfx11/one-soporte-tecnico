const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('topbar oculto y sidebar fija visible', async ({ page }) => {
    await login(page);
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});

test.describe('móvil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el menú abre y cierra como drawer off-canvas', async ({ page }) => {
    await login(page);
    await expect(page.locator('.topbar')).toBeVisible();
    const sidebar = page.locator('.sidebar');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(page.locator('.overlay-mobile')).toBeVisible();
    await page.locator('.overlay-mobile').click({ position: { x: 280, y: 400 } });
    await expect(sidebar).not.toHaveClass(/open/);
  });

  test('menos de 480px: las tarjetas de stats se apilan en una columna', async ({ page }) => {
    await login(page);
    const primera = page.locator('.stats .stat').first();
    const segunda = page.locator('.stats .stat').nth(1);
    const b1 = await primera.boundingBox();
    const b2 = await segunda.boundingBox();
    expect(Math.round(b1.x)).toBe(Math.round(b2.x));
    expect(b2.y).toBeGreaterThan(b1.y);
  });
});