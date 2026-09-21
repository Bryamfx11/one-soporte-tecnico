import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-backup');
const TEST_DB = path.join(TEST_DIR, 'data.db');
const TEST_BACKUPS = path.join(TEST_DIR, 'backups');

rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

process.env.DB_PATH = TEST_DB;
process.env.BACKUP_DIR = TEST_BACKUPS;
process.env.BACKUP_KEEP = '5';

const { crearBackup, podarBackups, BACKUP_DIR } = await import('../backup.js');
const { estadoBackups } = await import('../monitor.js');

// BD de prueba con un registro para verificar que el snapshot conserva los datos
const seed = new DatabaseSync(TEST_DB);
seed.exec('CREATE TABLE prueba (id INTEGER PRIMARY KEY, valor TEXT)');
seed.prepare('INSERT INTO prueba (valor) VALUES (?)').run('onepet');
seed.close();

test('crearBackup crea un snapshot con los datos', () => {
  const dest = crearBackup();
  assert.ok(fs.existsSync(dest));
  assert.ok(fs.statSync(dest).size > 0);
  assert.match(dest, new RegExp(BACKUP_DIR.replace(/\\/g, '\\\\')));

  const snap = new DatabaseSync(dest);
  const valor = snap.prepare('SELECT valor FROM prueba WHERE id = 1').get().valor;
  snap.close();
  assert.equal(valor, 'onepet');
});

test('podarBackups conserva solo las K copias más recientes', () => {
  for (let i = 1; i <= 6; i++) {
    fs.writeFileSync(path.join(BACKUP_DIR, `one-antiguo-${i}.db`), `basura-${i}`);
  }
  const restantes = podarBackups(3);
  assert.equal(restantes, 3);
  const archivos = fs.readdirSync(BACKUP_DIR).filter((n) => n.endsWith('.db')).sort();
  assert.equal(archivos.length, 3);
  assert.ok(!archivos.some((n) => n.includes('antiguo-1') || n.includes('antiguo-2') || n.includes('antiguo-3')));
});

test('crearBackup pule automáticamente hasta BACKUP_KEEP', () => {
  for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(BACKUP_DIR, `one-extra-${i}.db`), 'x');
  crearBackup();
  const archivos = fs.readdirSync(BACKUP_DIR).filter((n) => n.endsWith('.db')).sort();
  assert.equal(archivos.length, 5);
});

test('estadoBackups reporta el último backup y la cantidad', () => {
  const estado = estadoBackups();
  assert.equal(estado.cantidad, 5);
  assert.equal(estado.guardados, 5);
  assert.ok(typeof estado.ultimo === 'number' && estado.ultimo > 0);
});