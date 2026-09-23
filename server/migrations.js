// Migraciones versionadas: cada cambio de esquema se registra en la tabla `migraciones`
// y solo se aplica una vez. Se ejecutan al arrancar desde db.js, tras crear el esquema base.
// Los ALTER idempotentes (comprobar columna antes de añadirla) permiten migrar BDs antiguas.

function columnaExiste(db, tabla, columna) {
  return db.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).all().some((c) => c.name === columna);
}

export const MIGRATIONS = [
  {
    version: 1,
    nombre: 'usuarios.activo',
    aplicar: (db) => {
      if (!columnaExiste(db, 'usuarios', 'activo')) {
        db.exec('ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
      }
    }
  },
  {
    version: 2,
    nombre: 'incidencias.clave_seguimiento',
    aplicar: (db) => {
      if (!columnaExiste(db, 'incidencias', 'clave_seguimiento')) {
        db.exec('ALTER TABLE incidencias ADD COLUMN clave_seguimiento TEXT DEFAULT NULL');
      }
    }
  },
  {
    version: 3,
    nombre: 'incidencias.email',
    aplicar: (db) => {
      if (!columnaExiste(db, 'incidencias', 'email')) {
        db.exec("ALTER TABLE incidencias ADD COLUMN email TEXT NOT NULL DEFAULT ''");
      }
    }
  },
  {
    version: 4,
    nombre: 'actividad.incidencia_id_nullable',
    // Permite eventos de auditoría globales (sin incidencia asociada, p. ej. cuentas y config).
    // SQLite no permite relajar NOT NULL con ALTER, así que se reconstruye la tabla.
    aplicar: (db) => {
      const col = db.prepare('SELECT "notnull" FROM pragma_table_info(\'actividad\') WHERE name = \'incidencia_id\'').get();
      if (!col || col.notnull === 0) return;
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        BEGIN;
        ALTER TABLE actividad RENAME TO actividad_legacy;
        CREATE TABLE actividad (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          incidencia_id INTEGER REFERENCES incidencias(id) ON DELETE CASCADE,
          usuario TEXT NOT NULL,
          accion TEXT NOT NULL,
          detalle TEXT NOT NULL DEFAULT '',
          creada_en INTEGER NOT NULL
        );
        INSERT INTO actividad (id, incidencia_id, usuario, accion, detalle, creada_en)
          SELECT id, incidencia_id, usuario, accion, detalle, creada_en FROM actividad_legacy;
        DROP TABLE actividad_legacy;
        CREATE INDEX IF NOT EXISTS idx_actividad_inc ON actividad(incidencia_id);
        COMMIT;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }
];

export function applyMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS migraciones (
    version INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    aplicada_en INTEGER NOT NULL
  )`);

  const aplicadas = new Set(db.prepare('SELECT version FROM migraciones').all().map((r) => r.version));

  for (const m of MIGRATIONS) {
    if (aplicadas.has(m.version)) continue;
    m.aplicar(db);
    db.prepare('INSERT INTO migraciones (version, nombre, aplicada_en) VALUES (?, ?, ?)').run(m.version, m.nombre, Date.now());
  }
}