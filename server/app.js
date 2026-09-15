import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import './db.js';
import { requireAuth } from './auth.js';
import { authRouter } from './routes/auth.js';
import { incidentsRouter } from './routes/incidents.js';
import { checklistsRouter } from './routes/checklists.js';
import { metricsRouter } from './routes/metrics.js';
import { tecnicosRouter } from './routes/tecnicos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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

export default app;