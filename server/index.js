import app from './app.js';
import { db } from './db.js';
import { programarBackupDiario } from './monitor.js';

const PORT = process.env.PORT ?? 4000;

const server = app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
});

// Backup automático diario en producción (o forzado con AUTO_BACKUP=1)
if (process.env.NODE_ENV === 'production' || process.env.AUTO_BACKUP === '1') {
  programarBackupDiario();
  console.log(`[monitor] backup automático activado (hora ${process.env.AUTO_BACKUP_HOUR ?? 3})`);
}

server.on('error', (err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa no manejada:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
});

const shutdown = () => {
  console.log('\nCerrando servidor…');
  server.close(() => {
    try {
      db.close();
    } catch (err) {
      console.error('No se pudo cerrar la base de datos:', err.message);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);