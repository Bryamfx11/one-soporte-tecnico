import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import './db.js';
import { requireAuth } from './auth.js';
import { rateLimit, securityHeaders } from './security.js';
import { authRouter } from './routes/auth.js';
import { incidentsRouter } from './routes/incidents.js';
import { checklistsRouter } from './routes/checklists.js';
import { metricsRouter } from './routes/metrics.js';
import { tecnicosRouter } from './routes/tecnicos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable('x-powered-by');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(securityHeaders);

app.use('/api', rateLimit({ windowMs: 60000, max: 300 }));
app.use('/api/auth', rateLimit({ windowMs: 60000, max: 10, message: 'Demasiados intentos de autenticación, intente más tarde' }));

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rutas públicas de autenticación
app.use('/api/auth', authRouter);

// Rutas protegidas
app.use('/api/incidents', requireAuth, incidentsRouter);
app.use('/api/checklists', requireAuth, checklistsRouter);
app.use('/api/metrics', requireAuth, metricsRouter);
app.use('/api/tecnicos', requireAuth, tecnicosRouter);
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