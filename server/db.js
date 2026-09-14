import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new DatabaseSync(path.join(__dirname, 'one.db'));

db.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS tecnicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'Técnico'
);

CREATE TABLE IF NOT EXISTS tipos_falla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  icono TEXT NOT NULL DEFAULT 'wifi-off'
);

CREATE TABLE IF NOT EXISTS consultas_tipo_falla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_falla_id INTEGER NOT NULL REFERENCES tipos_falla(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  pregunta TEXT NOT NULL,
  instruccion TEXT NOT NULL,
  tipo_respuesta TEXT NOT NULL DEFAULT 'si_no',
  unidad TEXT DEFAULT NULL,
  etiqueta_valor TEXT DEFAULT NULL,
  referencia TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS causas_raiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_ticket TEXT UNIQUE NOT NULL,
  cliente TEXT NOT NULL,
  telefono TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  barrio TEXT NOT NULL DEFAULT '',
  tipo_falla_id INTEGER NOT NULL REFERENCES tipos_falla(id),
  prioridad TEXT NOT NULL DEFAULT 'media',
  estado TEXT NOT NULL DEFAULT 'nueva',
  tecnico_id INTEGER REFERENCES tecnicos(id),
  sintomas TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  causa_raiz_id INTEGER REFERENCES causas_raiz(id),
  solucion_aplicada TEXT NOT NULL DEFAULT '',
  creada_en INTEGER NOT NULL,
  resuelta_en INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS respuestas_diagnostico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incidencia_id INTEGER NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE,
  consulta_id INTEGER NOT NULL REFERENCES consultas_tipo_falla(id),
  respuesta TEXT NOT NULL DEFAULT '',
  cumple INTEGER DEFAULT NULL,
  registrada_en INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidentes_tipo ON incidencias(tipo_falla_id);
CREATE INDEX IF NOT EXISTS idx_incidentes_estado ON incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_respuestas_inc ON respuestas_diagnostico(incidencia_id);
`);

seedIfEmpty();

export default db;