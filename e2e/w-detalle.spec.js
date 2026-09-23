const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

async function crearIncidencia(page, cliente) {
  await page.goto('/incidencias/nueva');
  await page.getByLabel(/Cliente/).fill(cliente);
  await page.getByLabel(/Tipo de falla/).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Crear incidencia' }).click();
  await expect(page.getByRole('heading', { name: /ONE-\d{4} ·/ })).toBeVisible();
  return (await page.locator('.breadcrumbs').textContent()).match(/ONE-\d{4}/)[0];
}

async function resolverWizard(page, resultado = 'resuelta') {
  await page.getByRole('button', { name: 'Iniciar diagnóstico guiado' }).click();
  const totalPasos = 7;
  for (let paso = 1; paso <= totalPasos; paso++) {
    if (paso > 1) await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.locator('.wizard-step-info')).toHaveText(new RegExp(`^Paso ${paso} de ${totalPasos}`));
    if (await page.locator('.wizard > .value-box').count()) {
      await page.locator('.wizard > .value-box input:not([type="checkbox"])').fill('123');
      await page.locator('.wizard > .value-box .check-label input').check();
    } else {
      await page.locator('.wizard > .choice-row').getByRole('button', { name: 'Sí / OK' }).click();
    }
  }
  const tipoCierre = resultado === 'escalada' ? 'Escalada' : 'Resuelta';
  if (resultado === 'escalada') {
    await page.locator('.final-box .choice-row').getByRole('button', { name: 'Escalada', exact: true }).click();
  }
  await page.locator('.final-box select').selectOption({ index: 1 });
  await page.locator('.final-box textarea').fill(`Solución aplicada (${resultado}) desde el test E2E.`);
  await page.locator('.final-box').getByRole('button', { name: 'Finalizar caso' }).click();
  await expect(page.getByRole('heading', { name: `Diagnóstico ${tipoCierre === 'Resuelta' ? 'finalizado' : 'escalado'}` })).toBeVisible();
  await expect(page.locator('.modal')).toContainText('con éxito');
  await expect(page.locator('.modal')).toBeHidden({ timeout: 5000 });
  await expect(page.locator('.page-head .head-right')).toContainText(tipoCierre === 'Resuelta' ? 'Resuelta' : 'Escalada');
}

test('abrir una incidencia desde la lista y volver por las migas', async ({ page }) => {
  await login(page);
  await page.goto('/incidencias');
  await expect(page.locator('.page-head p')).toHaveText(/registros/);
  await page.locator('tbody tr').first().click();
  await expect(page).toHaveURL(/\/incidencias\/\d+/);
  await expect(page.getByRole('heading', { name: /ONE-\d{4} ·/ })).toBeVisible();
  await page.locator('.breadcrumbs').getByRole('link', { name: 'Incidencias' }).click();
  await expect(page).toHaveURL(/\/incidencias$/);
});

test('el diagnóstico guiado resuelve un caso y registra el historial', async ({ page }) => {
  await login(page);
  await crearIncidencia(page, 'Caso diagnóstico E2E');
  await resolverWizard(page, 'resuelta');

  await expect(page.locator('.result-box')).toContainText('Causa raíz:');
  await expect(page.locator('.result-box')).toContainText('Solución aplicada (resuelta) desde el test E2E.');
  const histActividad = page.locator('.card').filter({ hasText: 'Historial de actividad' });
  await expect(histActividad.locator('tbody tr')).toHaveCount(4);
  const histDiagnostico = page.locator('.card').filter({ hasText: 'Historial de diagnóstico' });
  await expect(histDiagnostico.locator('tbody tr')).toHaveCount(7);
  await expect(histDiagnostico).toContainText('OK');
});

test('escalar un caso a gerencia lo cierra como escalada', async ({ page }) => {
  await login(page);
  await crearIncidencia(page, 'Caso escalado E2E');
  await resolverWizard(page, 'escalada');

  await expect(page.locator('.result-box')).toContainText('Caso escalado a nivel superior');
});

test('eliminar una incidencia pide confirmación y refresca la lista', async ({ page }) => {
  await login(page);
  const ticket = await crearIncidencia(page, 'Caso a eliminar E2E');

  await page.getByRole('button', { name: 'Eliminar incidencia' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`¿Confirma la eliminación de ${ticket}?`);
  await dialog.getByRole('button', { name: 'Eliminar' }).click();

  await expect(page).toHaveURL(/\/incidencias$/);
  await expect(page.getByRole('status').filter({ hasText: `${ticket} eliminada.` })).toBeVisible();
  await page.getByLabel('Buscar por cliente, ticket o barrio').fill('Caso a eliminar E2E');
  await expect(page.locator('.page-head p')).toHaveText('0 registros');
  await expect(page.getByText('No hay incidencias que coincidan con el filtro')).toBeVisible();
});