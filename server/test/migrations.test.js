import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations, MIGRATIONS } from '../migrations.js';

function baseEsquema() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'tecnico', creado_en INTEGER NOT NULL);
    CREATE TABLE incidencias (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_ticket TEXT UNIQUE NOT NULL, cliente TEXT NOT NULL, telefono TEXT NOT NULL DEFAULT '', direccion TEXT NOT NULL DEFAULT '', barrio TEXT NOT NULL DEFAULT '', tipo_falla_id INTEGER NOT NULL, prioridad TEXT NOT NULL DEFAULT 'media', estado TEXT NOT NULL DEFAULT 'nueva', tecnico_id INTEGER, sintomas TEXT NOT NULL DEFAULT '', descripcion TEXT NOT NULL DEFAULT '', causa_raiz_id INTEGER, solucion_aplicada TEXT NOT NULL DEFAULT '', creada_en INTEGER NOT NULL, resuelta_en INTEGER DEFAULT NULL);
    CREATE TABLE actividad (id INTEGER PRIMARY KEY AUTOINCREMENT, incidencia_id INTEGER NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE, usuario TEXT NOT NULL, accion TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '', creada_en INTEGER NOT NULL);
  `);
  return db;
}

test('applyMigrations aplica todas y queda idempotente', () => {
  const db = baseEsquema();
  applyMigrations(db);
  applyMigrations(db);

  const versions = db.prepare('SELECT version FROM migraciones ORDER BY version').all().map((r) => r.version);
  assert.deepEqual(versions, MIGRATIONS.map((m) => m.version));

  const cols = db.prepare("SELECT name FROM pragma_table_info('usuarios')").all().map((c) => c.name);
  assert.ok(cols.includes('activo'));
  const incCols = db.prepare("SELECT name FROM pragma_table_info('incidencias')").all().map((c) => c.name);
  assert.ok(incCols.includes('clave_seguimiento'));
  assert.ok(incCols.includes('email'));
  db.close();
});

test('migración 4 relaja actividad.incidencia_id conservando los datos', () => {
  const db = baseEsquema();
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?)').run('Admin', 'a@one.com', 'hash', 'admin', Date.now());
  db.prepare('INSERT INTO incidencias (numero_ticket, tipo_falla_id, cliente, creada_en) VALUES (?, ?, ?, ?)').run('ONE-0001', 1, 'Cliente', Date.now());
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)').run(1, 'admin@one.com', 'prueba', 'detalle', Date.now());

  applyMigrations(db);

  const col = db.prepare('SELECT "notnull" FROM pragma_table_info(\'actividad\') WHERE name = \'incidencia_id\'').get();
  assert.equal(col.notnull, 0);
  const filas = db.prepare('SELECT incidencia_id, accion FROM actividad ORDER BY id').all();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].accion, 'prueba');
  assert.equal(filas[0].incidencia_id, 1);
  db.close();
});

test('applyMigrations no rompe en BD nueva con esquema completo', () => {
  const db = baseEsquema();
  db.exec('ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
  db.exec('ALTER TABLE incidencias ADD COLUMN clave_seguimiento TEXT DEFAULT NULL');
  db.exec("ALTER TABLE incidencias ADD COLUMN email TEXT NOT NULL DEFAULT ''");
  db.exec(`
    PRAGMA foreign_keys = OFF;
    ALTER TABLE actividad RENAME TO actividad_legacy;
    CREATE TABLE actividad (id INTEGER PRIMARY KEY AUTOINCREMENT, incidencia_id INTEGER REFERENCES incidencias(id) ON DELETE CASCADE, usuario TEXT NOT NULL, accion TEXT NOT NULL, detalle TEXT NOT NULL DEFAULT '', creada_en INTEGER NOT NULL);
    INSERT INTO actividad (id, incidencia_id, usuario, accion, detalle, creada_en) SELECT id, incidencia_id, usuario, accion, detalle, creada_en FROM actividad_legacy;
    DROP TABLE actividad_legacy;
    PRAGMA foreign_keys = ON;
  `);

  applyMigrations(db);
  const versions = db.prepare('SELECT COUNT(*) AS c FROM migraciones').get().c;
  assert.equal(versions, MIGRATIONS.length);
  db.close();
});