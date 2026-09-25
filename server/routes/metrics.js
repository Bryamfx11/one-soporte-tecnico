import express from 'express';
import { db } from '../db.js';

export const metricsRouter = express.Router();

const CO_OFFSET_MS = -5 * 3600000; // Bogotá (UTC-5)
const DIA_MS = 24 * 3600000;
const DIAS_VENTANA = 30;

function fechaLocalISO(tsLocalMs) {
  const d = new Date(tsLocalMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

metricsRouter.get('/pendientes', (_req, res) => {
  const r = db.prepare("SELECT COUNT(*) AS c FROM incidencias WHERE estado IN ('nueva', 'en_diagnostico')").get();
  res.json({ pendientes: r.c });
});

metricsRouter.get('/comparativo', (req, res) => {
  const ahoraLocal = new Date(Date.now() + CO_OFFSET_MS);
  const mesActual = req.query.mes
    ? String(req.query.mes)
    : `${ahoraLocal.getUTCFullYear()}-${String(ahoraLocal.getUTCMonth() + 1).padStart(2, '0')}`;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesActual)) {
    return res.status(400).json({ error: 'mes inválido (formato YYYY-MM)' });
  }

  const [anio, mes] = mesActual.split('-').map(Number);
  const inicio = Date.UTC(anio, mes - 1, 1) - CO_OFFSET_MS;
  const fin = Date.UTC(anio, mes, 1) - CO_OFFSET_MS;

  const prev = new Date(Date.UTC(anio, mes - 2, 1));
  const inicioAnterior = Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1) - CO_OFFSET_MS;

  function resumen(inicioMs, finMs) {
    const nuevas = db.prepare(
      'SELECT COUNT(*) AS c FROM incidencias WHERE creada_en >= ? AND creada_en < ?'
    ).get(inicioMs, finMs).c;
    const resueltas = db.prepare(
      'SELECT COUNT(*) AS c FROM incidencias WHERE resuelta_en >= ? AND resuelta_en < ?'
    ).get(inicioMs, finMs).c;
    // Creadas en el mes que siguen abiertas hoy
    const pendientes = db.prepare(
      "SELECT COUNT(*) AS c FROM incidencias WHERE estado IN ('nueva', 'en_diagnostico') AND creada_en >= ? AND creada_en < ?"
    ).get(inicioMs, finMs).c;
    const tPromedio = db.prepare(
      'SELECT AVG(resuelta_en - creada_en) AS ms FROM incidencias WHERE resuelta_en >= ? AND resuelta_en < ?'
    ).get(inicioMs, finMs).ms;
    return { nuevas, resueltas, pendientes, tiempo_promedio_ms: tPromedio };
  }

  const actual = resumen(inicio, fin);
  const anterior = resumen(inicioAnterior, inicio);

  function nuevasPorTipo(inicioMs, finMs) {
    return db.prepare(`
      SELECT t.nombre, COUNT(*) AS c
      FROM incidencias i JOIN tipos_falla t ON t.id = i.tipo_falla_id
      WHERE i.creada_en >= ? AND i.creada_en < ?
      GROUP BY i.tipo_falla_id ORDER BY c DESC
    `).all(inicioMs, finMs);
  }

  const tiposActual = nuevasPorTipo(inicio, fin);
  const tiposAnterior = nuevasPorTipo(inicioAnterior, inicio);
  const mapAnterior = Object.fromEntries(tiposAnterior.map((t) => [t.nombre, t.c]));
  const porTipo = tiposActual.map((t) => ({ nombre: t.nombre, actual: t.c, anterior: mapAnterior[t.nombre] ?? 0 }));
  for (const t of tiposAnterior) {
    if (!porTipo.some((x) => x.nombre === t.nombre)) {
      porTipo.push({ nombre: t.nombre, actual: 0, anterior: t.c });
    }
  }

  const porTecnicoActual = db.prepare(`
    SELECT tec.nombre,
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.resuelta_en >= ? AND i.resuelta_en < ? THEN 1 ELSE 0 END) AS resueltas
    FROM incidencias i JOIN tecnicos tec ON tec.id = i.tecnico_id
    WHERE i.tecnico_id IS NOT NULL AND i.creada_en >= ? AND i.creada_en < ?
    GROUP BY i.tecnico_id ORDER BY total DESC
  `).all(inicio, fin, inicio, fin);

  const porTecnicoAnterior = db.prepare(`
    SELECT tec.nombre,
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.resuelta_en >= ? AND i.resuelta_en < ? THEN 1 ELSE 0 END) AS resueltas
    FROM incidencias i JOIN tecnicos tec ON tec.id = i.tecnico_id
    WHERE i.tecnico_id IS NOT NULL AND i.creada_en >= ? AND i.creada_en < ?
    GROUP BY i.tecnico_id ORDER BY total DESC
  `).all(inicioAnterior, inicio, inicioAnterior, inicio);

  const causas = db.prepare(`
    SELECT c.categoria, COUNT(*) AS c
    FROM incidencias i JOIN causas_raiz c ON c.id = i.causa_raiz_id
    WHERE i.creada_en >= ? AND i.creada_en < ?
    GROUP BY c.id ORDER BY c DESC LIMIT 6
  `).all(inicio, fin);

  res.json({
    mes: mesActual,
    mes_anterior: `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`,
    actual,
    anterior,
    por_tipo: porTipo,
    por_tecnico: { actual: porTecnicoActual, anterior: porTecnicoAnterior },
    causas
  });
});

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

  const satisfaccion = db.prepare('SELECT AVG(valor) AS promedio, COUNT(*) AS total FROM calificaciones').get();

  // Incidencias de los últimos 30 días calendario (zona horaria de Bogotá)
  const now = Date.now();
  const hoyInicioLocal = Math.floor((now + CO_OFFSET_MS) / DIA_MS) * DIA_MS;
  const inicioVentanaLocal = hoyInicioLocal - (DIAS_VENTANA - 1) * DIA_MS;

  const porDia = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', datetime((creada_en + ${-CO_OFFSET_MS})/1000, 'unixepoch')) AS dia,
      COUNT(*) AS c
    FROM incidencias
    WHERE creada_en >= ?
    GROUP BY dia
  `).all(inicioVentanaLocal - CO_OFFSET_MS);
  const porDiaMap = Object.fromEntries(porDia.map((r) => [r.dia, Number(r.c)]));

  const dias = [];
  for (let i = 0; i < DIAS_VENTANA; i++) {
    const iso = fechaLocalISO(inicioVentanaLocal + i * DIA_MS);
    dias.push({ dia: iso, c: porDiaMap[iso] ?? 0 });
  }

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
    satisfaccion_promedio: satisfaccion.total > 0 ? Number(satisfaccion.promedio.toFixed(2)) : null,
    satisfacciones: satisfaccion.total,
    por_dia: dias
  });
});