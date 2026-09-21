import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { leerConfigSmtp, validarConfigSmtp, guardarConfigSmtp, enviarPrueba } from '../notify.js';

export const notificationsRouter = express.Router();

notificationsRouter.use(requireAdmin);

notificationsRouter.get('/config', (_req, res) => {
  res.json(leerConfigSmtp());
});

notificationsRouter.put('/config', (req, res) => {
  const errors = validarConfigSmtp(req.body);
  if (errors.length) return res.status(400).json({ error: 'Error de validación', details: errors });
  guardarConfigSmtp(req.body);
  res.json(leerConfigSmtp());
});

notificationsRouter.post('/test', async (req, res) => {
  try {
    const info = await enviarPrueba(req.user.email);
    res.json({ ok: true, destinatario: req.user.email, messageId: info.messageId ?? null });
  } catch (err) {
    res.status(502).json({ error: `No se pudo enviar el correo de prueba: ${err.message}` });
  }
});

notificationsRouter.get('/historial', (_req, res) => {
  res.json(db.prepare(`
    SELECT n.id, n.incidencia_id, i.numero_ticket, n.tipo, n.destinatario, n.asunto, n.estado, n.error, n.creada_en
    FROM notificaciones n
    LEFT JOIN incidencias i ON i.id = n.incidencia_id
    ORDER BY n.creada_en DESC
    LIMIT 50
  `).all());
});