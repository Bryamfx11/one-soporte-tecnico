import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-restore');
const TEST_DB = path.join(TEST_DIR, 'data.db');

rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

process.env.DB_PATH = TEST_DB;
process.env.BACKUP_DIR = path.join(TEST_DIR, 'backups');

const { verificarIntegridad, restaurar } = await import('../restore.js');

function crearDb(ruta, valor) {
  const db = new DatabaseSync(ruta);
  db.exec('CREATE TABLE IF NOT EXISTS prueba (id INTEGER PRIMARY KEY, valor TEXT)');
  db.prepare('DELETE FROM prueba').run();
  db.prepare('INSERT INTO prueba (id, valor) VALUES (1, ?)').run(valor);
  db.close();
  return ruta;
}

const backup = path.join(TEST_DIR, 'backup-ok.db');
crearDb(backup, 'datos-originales');
crearDb(TEST_DB, 'datos-actuales');

test('verificarIntegridad acepta una copia válida y rechaza basura', () => {
  const ok = verificarIntegridad(backup);
  assert.equal(ok.ok, true);
  assert.ok(ok.tablas > 0);

  const basura = path.join(TEST_DIR, 'basura.db');
  fs.writeFileSync(basura, 'esto no es una base de datos');
  const mal = verificarIntegridad(basura);
  assert.equal(mal.ok, false);
});

test('restaurar sobreescribe el destino y guarda un snapshot previo', () => {
  const { destino, preRestore } = restaurar(backup, TEST_DB, path.join(TEST_DIR, 'backups'));
  assert.equal(destino, TEST_DB);
  assert.ok(preRestore && fs.existsSync(preRestore), 'se conserva snapshot del estado previo');

  const db = new DatabaseSync(TEST_DB);
  const valor = db.prepare('SELECT valor FROM prueba WHERE id = 1').get().valor;
  db.close();
  assert.equal(valor, 'datos-originales');

  const previo = new DatabaseSync(preRestore);
  const previoValor = previo.prepare('SELECT valor FROM prueba WHERE id = 1').get().valor;
  previo.close();
  assert.equal(previoValor, 'datos-actuales');
});

test('restaurar rechaza la misma ruta como origen y destino', () => {
  assert.throws(() => restaurar(TEST_DB, TEST_DB), /mismo archivo/);
});

test('restaurar rechaza un archivo sin integridad', () => {
  const basura = path.join(TEST_DIR, 'basura2.db');
  fs.writeFileSync(basura, 'nada');
  assert.throws(() => restaurar(basura, TEST_DB), /integridad/);
});