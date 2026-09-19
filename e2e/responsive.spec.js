const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const RUTAS = ['/', '/incidencias', '/incidencias/nueva', '/incidencias/1', '/conocimiento', '/indicadores', '/ajustes', '/usuarios', '/inexistente'];
const ANCHOS = [320, 375, 480, 600, 768, 900, 1024, 1280, 1920];

async function evaluarDesborde(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollers = new Set([...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    }));
    const malos = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.matches('.sidebar, .toast-stack, .sr-only')) continue;
      if (el.closest('.sidebar') || el.closest('.toast-stack') || el.closest('.sr-only')) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      const pos = getComputedStyle(el);
      if (pos.position === 'fixed' || pos.position === 'absolute') continue;
      if (pos.display === 'none' || pos.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let p = el.parentElement;
        let enScrollable = false;
        while (p) {
          if (scrollers.has(p)) { enScrollable = true; break; }
          p = p.parentElement;
        }
        if (enScrollable) continue;
        malos.push((el.tagName.toLowerCase()) + (typeof el.className === 'string' ? '.' + el.className.replace(/\s+/g, '.') : ''));
      }
    }
    return { vw, malos: malos.slice(0, 8) };
  });
}

async function evaluarEspacioMuerto(page) {
  return page.evaluate(() => {
    const content = document.querySelector('.content').getBoundingClientRect();
    return { scrollH: document.documentElement.scrollHeight, contentBottom: Math.round(content.bottom), vacio: Math.round(document.documentElement.scrollHeight - content.bottom) };
  });
}

async function crearIncidencia(page) {
  await page.goto('/incidencias/nueva');
  await page.getByLabel('Cliente *').fill('Cliente Movil');
  await page.getByLabel('Tipo de falla *').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Crear incidencia' }).click();
  await page.waitForURL(/\/incidencias\/\d+$/, { timeout: 15000 });
}

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('topbar oculto y sidebar visible en flujo normal', async ({ page }) => {
    await login(page);
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('el sidebar queda compacto y fijo arriba al hacer scroll', async ({ page }) => {
    await login(page);
    await page.goto('/incidencias', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const antes = await page.evaluate(() => {
      const s = document.querySelector('.sidebar').getBoundingClientRect();
      return { top: Math.round(s.top), height: Math.round(s.height), innerH: window.innerHeight, scrollH: document.documentElement.scrollHeight };
    });
    await page.evaluate(() => window.scrollTo(0, 99999));
    await page.waitForTimeout(300);
    const despues = await page.evaluate(() => {
      const s = document.querySelector('.sidebar').getBoundingClientRect();
      const c = document.querySelector('.content').getBoundingClientRect();
      return { top: Math.round(s.top), contentTop: Math.round(c.top), scrollY: Math.round(window.scrollY) };
    });
    expect(antes.scrollH).toBeGreaterThan(antes.innerH);
    expect(antes.height).toBeLessThan(antes.innerH);
    expect(despues.scrollY).toBeGreaterThan(0);
    expect(despues.contentTop).toBeLessThan(0);
    expect(despues.top, 'el sidebar no baja con el contenido').toBe(0);
  });

  test('en pantalla ancha el contenido queda centrado y no se desborda', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await login(page);
    const bb = await page.locator('main.content').boundingBox();
    expect(bb.x).toBeGreaterThan(260 + 80);
    expect(bb.x + bb.width).toBeLessThanOrEqual(1920);
    const res = await evaluarDesborde(page);
    expect(res.malos).toEqual([]);
  });
});

test.describe('sin desbordes horizontales en ninguna ruta', () => {
  test('ningún elemento en flujo sale del viewport', async ({ page }) => {
    test.setTimeout(300_000);
    await login(page);
    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: 800 });
      for (const ruta of RUTAS) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(450);
        const res = await evaluarDesborde(page);
        expect(res.malos, `${ancho}px ${ruta}: ${JSON.stringify(res.malos)}`).toEqual([]);
        const vacio = await evaluarEspacioMuerto(page);
        expect(vacio.vacio, `${ancho}px ${ruta}: espacio muerto bajo el contenido (scrollH=${vacio.scrollH}, contentBottom=${vacio.contentBottom})`).toBeLessThanOrEqual(2);
      }
    }
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

  test('el modal del diagnóstico cabe dentro del viewport y avanza de paso', async ({ page }) => {
    await login(page);
    await crearIncidencia(page);
    await page.getByRole('button', { name: 'Iniciar diagnóstico guiado' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    const bb = await modal.boundingBox();
    expect(bb.x).toBeGreaterThanOrEqual(0);
    expect(bb.x + bb.width).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText(/Paso 2 de/)).toBeVisible();
  });
});