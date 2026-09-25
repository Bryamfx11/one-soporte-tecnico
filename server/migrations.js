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
  },
  {
    version: 5,
    nombre: 'usuarios.twofa_secret',
    // Secreto TOTP para 2FA de administradores (NULL = 2FA desactivada).
    aplicar: (db) => {
      if (!columnaExiste(db, 'usuarios', 'twofa_secret')) {
        db.exec('ALTER TABLE usuarios ADD COLUMN twofa_secret TEXT DEFAULT NULL');
      }
    }
  },
  {
    version: 6,
    nombre: 'notas_internas',
    aplicar: (db) => {
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notas'").get()) return;
      db.exec(`
        CREATE TABLE notas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          incidencia_id INTEGER NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE,
          usuario TEXT NOT NULL,
          texto TEXT NOT NULL,
          creada_en INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notas_inc ON notas(incidencia_id);
      `);
    }
  },
  {
    version: 7,
    nombre: 'soluciones_kb',
    // Base de conocimiento viva: soluciones registradas desde casos resueltos.
    aplicar: (db) => {
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='soluciones'").get()) return;
      db.exec(`
        CREATE TABLE soluciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo_falla_id INTEGER NOT NULL REFERENCES tipos_falla(id),
          titulo TEXT NOT NULL,
          contenido TEXT NOT NULL,
          usuario TEXT NOT NULL,
          creada_en INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_soluciones_tipo ON soluciones(tipo_falla_id);
      `);
    }
  },
  {
    version: 8,
    nombre: 'calificaciones_cliente',
    // CSAT del cliente: una valoración por incidencia resuelta (ticket + clave).
    aplicar: (db) => {
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='calificaciones'").get()) return;
      db.exec(`
        CREATE TABLE calificaciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          incidencia_id INTEGER NOT NULL UNIQUE REFERENCES incidencias(id) ON DELETE CASCADE,
          valor INTEGER NOT NULL CHECK (valor >= 1 AND valor <= 5),
          comentario TEXT NOT NULL DEFAULT '',
          creada_en INTEGER NOT NULL
        );
      `);
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