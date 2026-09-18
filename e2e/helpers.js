const ADMIN = { email: 'admin@one.com', password: 'admin123' };
const TECNICO = { email: 'bryam@one.com', password: 'tecnico123' };

async function login(page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: 'Dashboard de Soporte Técnico' }).waitFor({ timeout: 15000 });
}

module.exports = { ADMIN, TECNICO, login };