import app from './app.js';
import { db } from './db.js';

const PORT = process.env.PORT ?? 4000;

const server = app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`);
});

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
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);