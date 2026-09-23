import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';

export const auditoriaRouter = express.Router();

auditoriaRouter.use(requireAdmin);

// Historial de auditoría global (incluye eventos de sistema sin incidencia asociada)
auditoriaRouter.get('/', (req, res) => {
  const limite = Math.min(Number.parseInt(req.query.limite, 10) || 100, 500);
  const filas = db.prepare(`
    SELECT a.id, a.incidencia_id, i.numero_ticket, a.usuario, a.accion, a.detalle, a.creada_en
    FROM actividad a
    LEFT JOIN incidencias i ON i.id = a.incidencia_id
    ORDER BY a.creada_en DESC, a.id DESC
    LIMIT ?
  `).all(limite);
  res.json(filas);
});