import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { metasHoras, guardarMetas, validarMetas } from '../sla.js';

export const ajustesRouter = express.Router();

// Configuración operativa (SLAs por prioridad y escalamiento automático). Solo admin.

ajustesRouter.get('/operacion', requireAdmin, (_req, res) => {
  res.json({ sla: metasHoras() });
});

ajustesRouter.put('/operacion', requireAdmin, (req, res) => {
  const body = req.body?.sla ?? req.body ?? {};
  const errors = validarMetas(body);
  if (errors.length) {
    return res.status(400).json({ error: 'Error de validación', details: errors });
  }
  guardarMetas({
    alta: Number(body.alta),
    media: Number(body.media),
    baja: Number(body.baja),
    escalamiento: Number(body.escalamiento)
  });
  db.prepare(`INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)`)
    .run(null, req.user.nombre, 'config_operacion', `SLAs: alta ${Number(body.alta)}h, media ${Number(body.media)}h, baja ${Number(body.baja)}h · escalamiento ${Number(body.escalamiento)}h`, Date.now());
  res.json({ sla: metasHoras() });
});