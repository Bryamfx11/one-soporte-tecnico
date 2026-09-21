/*
 * Despliegue de producción en un comando: `npm run deploy`
 *   git pull → backup → install → build → lint+tests → pm2 reload
 *
 * Uso: npm run deploy [-- --no-check]   (--no-check saltea lint + tests)
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CON_APPS = { shell: true, cwd: ROOT, stdio: 'inherit' };

const noCheck = process.argv.includes('--no-check');

function ejecutar(titulo, comando) {
  console.log(`\n===== ${titulo} =====`);
  const r = spawnSync(comando, CON_APPS);
  if (r.error || r.status !== 0) {
    console.error(`\n[deploy] Falló: ${titulo}`);
    process.exit(r.status ?? 1);
  }
}

function appEnPm2() {
  const r = spawnSync('pm2 jlist', { shell: true, cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  try {
    const lista = JSON.parse(r.stdout);
    return lista.find((a) => a.name === 'onetec') ?? null;
  } catch {
    return null;
  }
}

console.log('Despliegue ONETec — será mejor correrlo con el repo limpio (git status sin cambios).');

ejecutar('Actualizando el repositorio (git pull --ff-only)', 'git pull --ff-only');
ejecutar('Respaldo de la base de datos (npm run backup)', 'npm run backup');
ejecutar('Instalando dependencias (npm run install:all)', 'npm run install:all');

if (!noCheck) {
  ejecutar('Lint', 'npm run lint');
  ejecutar('Tests del servidor y cliente', 'npm test');
}

ejecutar('Compilando el cliente (npm run build)', 'npm run build');

const app = appEnPm2();
if (app) {
  ejecutar('Recargando onetec en pm2 (cero cortes)', 'pm2 reload onetec');
} else {
  ejecutar('Iniciando onetec en pm2 por primera vez', 'pm2 start ecosystem.config.cjs && pm2 save');
}

console.log('\n[deploy] Despliegue completado. Verificar: pm2 logs onetec  y  GET /api/health');