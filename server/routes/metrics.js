import express from 'express';
import { db } from '../db.js';

export const metricsRouter = express.Router();

metricsRouter.get('/dashboard', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM incidencias').get().c;

  const porEstado = db.prepare('SELECT estado, COUNT(*) AS c FROM incidencias GROUP BY estado ORDER BY c DESC').all();
  const porEstadoMap = Object.fromEntries(porEstado.map((r) => [r.estado, r.c]));

  const tiempoPromedio = db.prepare(`
    SELECT
      AVG(resuelta_en - creada_en) AS ms,
      MIN(resuelta_en - creada_en) AS ms_min,
      MAX(resuelta_en - creada_en) AS ms_max
    FROM incidencias WHERE resuelta_en IS NOT NULL
  `).get();

  const tiempoPorTipo = db.prepare(`
    SELECT t.nombre, t.icono, AVG(i.resuelta_en - i.creada_en) AS ms
    FROM incidencias i JOIN tipos_falla t ON t.id = i.tipo_falla_id
    WHERE i.resuelta_en IS NOT NULL
    GROUP BY i.tipo_falla_id ORDER BY ms
  `).all();

  const topCausas = db.prepare(`
    SELECT c.categoria, COUNT(*) AS c
    FROM incidencias i JOIN causas_raiz c ON c.id = i.causa_raiz_id
    WHERE i.causa_raiz_id IS NOT NULL
    GROUP BY c.id ORDER BY c DESC LIMIT 6
  `).all();

  const porTecnico = db.prepare(`
    SELECT tec.nombre, COUNT(*) AS total,
      SUM(CASE WHEN i.resuelta_en IS NOT NULL THEN 1 ELSE 0 END) AS resueltas,
      AVG(CASE WHEN i.resuelta_en IS NOT NULL THEN i.resuelta_en - i.creada_en END) AS ms
    FROM incidencias i JOIN tecnicos tec ON tec.id = i.tecnico_id
    WHERE i.tecnico_id IS NOT NULL
    GROUP BY i.tecnico_id ORDER BY total DESC
  `).all();

  // Incidencias últimos 30 días (por día)
  const now = Date.now();
  const dias = [];
  const porDia = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime(creada_en/1000, 'unixepoch')) AS dia,
      COUNT(*) AS c
    FROM incidencias
    GROUP BY dia ORDER BY dia DESC LIMIT 30
  `).all();
  const porDiaMap = Object.fromEntries(porDia.map((r) => [r.dia, r.c]));

  res.json({
    total,
    resueltas: porEstadoMap['resuelta'] ?? 0,
    escaladas: porEstadoMap['escalada'] ?? 0,
    en_diagnostico: porEstadoMap['en_diagnostico'] ?? 0,
    nueva: porEstadoMap['nueva'] ?? 0,
    tiempo_promedio_ms: tiempoPromedio.ms,
    tiempo_min_ms: tiempoPromedio.ms_min,
    tiempo_max_ms: tiempoPromedio.ms_max,
    tiempo_por_tipo: tiempoPorTipo,
    top_causas: topCausas,
    por_tecnico: porTecnico,
    por_dia: porDia.reverse()
  });
});