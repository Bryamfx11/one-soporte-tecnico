const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const sql = process.argv[2];
if (!sql) {
  console.error('Uso: node scripts/db-query.cjs "SELECT ..."');
  console.error('(opcional: DB_PATH=c:\\ruta\\otros.db para abrir otra base)');
  process.exit(1);
}

const dbFile = process.env.DB_PATH || path.join(__dirname, '..', 'server', 'one.db');
const db = new DatabaseSync(dbFile, { readOnly: true });
try {
  db.exec('PRAGMA query_only = ON');
  if (/^\s*select/i.test(sql)) {
    const filas = db.prepare(sql).all();
    console.table(filas);
  } else {
    const r = db.prepare(sql).run();
    console.log(r);
  }
} catch (e) {
  console.error('Error SQL:', e.message);
  process.exitCode = 1;
} finally {
  db.close();
}