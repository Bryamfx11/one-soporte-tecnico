import express from 'express';
import { listarNotificaciones, marcarLeida, marcarTodasLeidas } from '../not_app.js';

export const notificacionesAppRouter = express.Router();

notificacionesAppRouter.get('/', (req, res) => {
  const soloNoLeidas = req.query.solo_no_leidas === '1';
  res.json(listarNotificaciones(req.user.id, { soloNoLeidas }));
});

notificacionesAppRouter.patch('/:id/leer', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
  if (!marcarLeida(req.user.id, id)) return res.status(404).json({ error: 'Notificación no encontrada' });
  res.json({ ok: true });
});

notificacionesAppRouter.post('/leer-todas', (req, res) => {
  const marcadas = marcarTodasLeidas(req.user.id);
  res.json({ ok: true, marcadas });
});