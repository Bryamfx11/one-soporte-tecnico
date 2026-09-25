import express from 'express';
import { requireAdmin } from '../auth.js';
import { leerConfigWebhook, validarConfigWebhook, guardarConfigWebhook, enviarWebhook } from '../webhook.js';
import { registrarActividad } from '../audit.js';

export const webhookRouter = express.Router();

webhookRouter.get('/config', requireAdmin, (_req, res) => {
  res.json(leerConfigWebhook());
});

webhookRouter.put('/config', requireAdmin, (req, res) => {
  const errors = validarConfigWebhook(req.body ?? {});
  if (errors.length) return res.status(400).json({ error: 'Validación fallida', details: errors });
  guardarConfigWebhook(req.body);
  const conf = leerConfigWebhook();
  registrarActividad({ usuario: req.user.email, accion: 'webhook_config', detalle: `Webhook ${conf.url || '—'} ${conf.habilitada ? 'activado' : 'desactivado'}` });
  res.json(conf);
});

webhookRouter.post('/test', requireAdmin, async (req, res) => {
  const conf = leerConfigWebhook();
  if (!conf.configurado) {
    return res.status(409).json({ error: 'Webhook no configurado o desactivado' });
  }
  registrarActividad({ usuario: req.user.email, accion: 'webhook_test', detalle: `Prueba a ${conf.url}` });
  const ok = await enviarWebhook({ evento: 'test', incidencia: null, usuario: req.user.nombre });
  if (!ok) {
    return res.status(502).json({ error: 'No se pudo enviar la prueba al webhook (revise el historial de notificaciones)' });
  }
  res.json({ ok: true, url: conf.url });
});