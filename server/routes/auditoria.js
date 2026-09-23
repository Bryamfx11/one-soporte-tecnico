import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';

export const auditoriaRouter = express.Router();

auditoriaRouter.use(requireAdmin);

// Historial de auditoría global (incluye eventos de sistema sin incidencia asociada).
// Filtros: ?q= (usuario/acción/detalle/ticket) y ?accion= (valor exacto). límite máx 500.
auditoriaRouter.get('/', (req, res) => {
  const limite = Math.min(Number.parseInt(req.query.limite, 10) || 100, 500);
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const accion = String(req.query.accion ?? '').trim().slice(0, 50);

  const params = [];
  let where = '';
  if (accion) {
    where += 'WHERE a.accion = ?';
    params.push(accion);
  }
  if (q) {
    const pat = `%${q}%`;
    where += `${where ? ' AND' : 'WHERE'} (a.usuario LIKE ? OR a.accion LIKE ? OR a.detalle LIKE ? OR COALESCE(i.numero_ticket, '') LIKE ?)`;
    params.push(pat, pat, pat, pat);
  }
  params.push(limite);

  const filas = db.prepare(`
    SELECT a.id, a.incidencia_id, i.numero_ticket, a.usuario, a.accion, a.detalle, a.creada_en
    FROM actividad a
    LEFT JOIN incidencias i ON i.id = a.incidencia_id
    ${where}
    ORDER BY a.creada_en DESC, a.id DESC
    LIMIT ?
  `).all(...params);
  res.json(filas);
});