import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';
import './db.js';
import { incidentsRouter } from './routes/incidents.js';
import { checklistsRouter } from './routes/checklists.js';
import { metricsRouter } from './routes/metrics.js';
import { tecnicosRouter } from './routes/tecnicos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 4000;
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/incidents', incidentsRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/tecnicos', tecnicosRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API no encontrada' }));

// Servir el build del cliente en producción
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`));