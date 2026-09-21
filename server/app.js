import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { rateLimit, securityHeaders, corsMiddleware } from './security.js';
import { sseHandler } from './sse.js';
import { estadoBackups } from './monitor.js';
import { authRouter } from './routes/auth.js';
import { portalRouter } from './routes/portal.js';
import { incidentsRouter } from './routes/incidents.js';
import { checklistsRouter } from './routes/checklists.js';
import { metricsRouter } from './routes/metrics.js';
import { tecnicosRouter } from './routes/tecnicos.js';
import { usuariosRouter } from './routes/usuarios.js';
import { notificationsRouter } from './routes/notifications.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable('x-powered-by');

const trustProxy = (process.env.TRUST_PROXY ?? 'loopback').split(',').map((s) => s.trim()).filter(Boolean);
app.set('trust proxy', trustProxy.length === 1 ? trustProxy[0] : trustProxy);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(corsMiddleware(ALLOWED_ORIGINS));

app.use(securityHeaders);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const inicio = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - inicio}ms`);
    });
    next();
  });
}

app.use('/api', rateLimit({ windowMs: 60000, max: process.env.NODE_ENV === 'production' ? 300 : 1000 }));
app.use('/api/auth', rateLimit({ windowMs: 60000, max: process.env.NODE_ENV === 'production' ? 10 : 1000, message: 'Demasiados intentos de autenticación, intente más tarde' }));

app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM incidencias').get().c;
    res.json({
      ok: true,
      db: 'ok',
      incidencias: total,
      uptime: Math.round(process.uptime()),
      timestamp: Date.now(),
      backups: estadoBackups()
    });
  } catch {
    res.status(503).json({ ok: false, db: 'error', error: 'Error consultando la base de datos' });
  }
});

// Rutas públicas de autenticación
app.use('/api/auth', authRouter);

// Portal público del cliente: reportes sin login y seguimiento por ticket + clave
app.use('/api/portal', rateLimit({ windowMs: 60000, max: process.env.NODE_ENV === 'production' ? 15 : 1000, message: 'Demasiadas solicitudes, intente más tarde' }), portalRouter);

// Rutas protegidas
app.use('/api/incidents', requireAuth, incidentsRouter);
app.use('/api/checklists', requireAuth, checklistsRouter);
app.use('/api/metrics', requireAuth, metricsRouter);
app.use('/api/tecnicos', requireAuth, tecnicosRouter);
app.use('/api/usuarios', requireAuth, usuariosRouter);
app.use('/api/notifications', requireAuth, notificationsRouter);
app.get('/api/sse/events', requireAuth, sseHandler);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API no encontrada' }));

// Servir el build del cliente en producción
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;