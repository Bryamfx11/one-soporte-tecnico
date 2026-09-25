import express from 'express';
import { randomInt } from 'node:crypto';
import { db } from '../db.js';
import { validatePortalReporte, validateCalificacion, validationMiddleware } from '../validate.js';
import { notifyDataChange } from '../sse.js';
import { enviarNotificacion } from '../notify.js';

export const portalRouter = express.Router();

function siguienteTicket() {
  db.prepare("INSERT INTO secuencias (nombre, valor) VALUES ('ticket', 1) ON CONFLICT(nombre) DO UPDATE SET valor = valor + 1").run();
  return db.prepare('SELECT valor FROM secuencias WHERE nombre = ?').get('ticket').valor;
}

function esColisionDeTicket(err) {
  return err.code === 'ERR_SQLITE_ERROR' && (err.errcode & 0xff) === 19;
}

function generarClave() {
  return String(randomInt(100000, 1000000));
}

// Tipos de falla públicos para el formulario del cliente
portalRouter.get('/tipos', (_req, res) => {
  res.json(db.prepare('SELECT id, nombre FROM tipos_falla ORDER BY nombre').all());
});

// Reporte de novedad sin autenticación
portalRouter.post('/reportes', validationMiddleware(validatePortalReporte), (req, res) => {
  // Honeypot anti-spam: si el campo oculto "empresa" viene completo, se simula éxito sin crear
  if (typeof req.body.empresa === 'string' && req.body.empresa.trim() !== '') {
    return res.status(201).json({ recibido: true });
  }

  const tipo = db.prepare('SELECT 1 FROM tipos_falla WHERE id = ?').get(Number(req.body.tipo_falla_id));
  if (!tipo) {
    return res.status(400).json({ error: 'tipo_falla_id no existe' });
  }

  const insert = db.prepare(`INSERT INTO incidencias
    (numero_ticket, cliente, telefono, direccion, barrio, tipo_falla_id, prioridad, estado, tecnico_id, sintomas, descripcion, email, creada_en, clave_seguimiento)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  for (let intento = 0; intento < 3; intento++) {
    const numero_ticket = `ONE-${String(siguienteTicket()).padStart(4, '0')}`;
    const clave_seguimiento = generarClave();
    try {
      const r = insert.run(
        numero_ticket,
        String(req.body.nombre).trim(),
        typeof req.body.telefono === 'string' ? req.body.telefono.trim() : '',
        typeof req.body.direccion === 'string' ? req.body.direccion.trim() : '',
        typeof req.body.barrio === 'string' ? req.body.barrio.trim() : '',
        Number(req.body.tipo_falla_id),
        'media',
        'nueva',
        null,
        typeof req.body.sintomas === 'string' ? req.body.sintomas.trim() : '',
        typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : '',
        typeof req.body.email === 'string' ? req.body.email.trim() : '',
        Date.now(),
        clave_seguimiento
      );
      const id = Number(r.lastInsertRowid);
      notifyDataChange();
      void enviarNotificacion({ tipo: 'registro', incidenciaId: id, destinatario: req.body.email, clave: clave_seguimiento });
      return res.status(201).json({ numero_ticket, clave_seguimiento, id });
    } catch (err) {
      if (esColisionDeTicket(err)) continue;
      throw err;
    }
  }

  const err = new Error('No se pudo generar un numero_ticket único (colisión persistente)');
  err.status = 500;
  throw err;
});

// Consulta de estado por ticket + clave (no expone datos de contacto)
portalRouter.get('/incidencias/:ticket', (req, res) => {
  const ticket = String(req.params.ticket ?? '').trim().toUpperCase();
  const clave = String(req.query.clave ?? '').trim();

  if (!/^ONE-\d{4,}$/.test(ticket) || !/^\d{6}$/.test(clave)) {
    return res.status(404).json({ error: 'No se encontró la incidencia' });
  }

  const inc = db.prepare('SELECT * FROM incidencias WHERE numero_ticket = ?').get(ticket);
  if (!inc || !inc.clave_seguimiento || inc.clave_seguimiento !== clave) {
    return res.status(404).json({ error: 'No se encontró la incidencia' });
  }

  const row = db.prepare(`
    SELECT i.numero_ticket AS numero_ticket, i.estado, i.prioridad, i.creada_en, i.resuelta_en, i.solucion_aplicada,
           t.nombre AS tipo_falla, tec.nombre AS tecnico, c.valor AS calificacion_valor, c.comentario AS calificacion_comentario
    FROM incidencias i
    JOIN tipos_falla t ON t.id = i.tipo_falla_id
    LEFT JOIN tecnicos tec ON tec.id = i.tecnico_id
    LEFT JOIN calificaciones c ON c.incidencia_id = i.id
    WHERE i.id = ?
  `).get(inc.id);

  res.json({
    numero_ticket: row.numero_ticket,
    estado: row.estado,
    prioridad: row.prioridad,
    tipo_falla: row.tipo_falla,
    tecnico: row.tecnico ?? null,
    creada_en: row.creada_en,
    resuelta_en: row.resuelta_en,
    solucion_aplicada: row.solucion_aplicada,
    tiempo_ms: row.resuelta_en && row.creada_en ? row.resuelta_en - row.creada_en : null,
    calificacion: row.calificacion_valor != null ? { valor: row.calificacion_valor, comentario: row.calificacion_comentario } : null
  });
});

// Valoración del servicio (CSAT) de una incidencia resuelta, por ticket + clave.
portalRouter.post('/calificar', validationMiddleware(validateCalificacion), (req, res) => {
  const ticket = String(req.body.ticket ?? '').trim().toUpperCase();
  const clave = String(req.body.clave ?? '').trim();

  if (!/^ONE-\d{4,}$/.test(ticket) || !/^\d{6}$/.test(clave)) {
    return res.status(404).json({ error: 'No se encontró la incidencia' });
  }

  const inc = db.prepare('SELECT id, clave_seguimiento, estado FROM incidencias WHERE numero_ticket = ?').get(ticket);
  if (!inc || !inc.clave_seguimiento || inc.clave_seguimiento !== clave) {
    return res.status(404).json({ error: 'No se encontró la incidencia' });
  }
  if (inc.estado !== 'resuelta') {
    return res.status(409).json({ error: 'Solo se puede valorar un caso ya resuelto' });
  }

  const existente = db.prepare('SELECT valor FROM calificaciones WHERE incidencia_id = ?').get(inc.id);
  if (existente) {
    return res.status(409).json({ error: 'Este caso ya fue calificado', valor: existente.valor });
  }

  const valor = Number(req.body.valor);
  const comentario = typeof req.body.comentario === 'string' ? req.body.comentario.trim().slice(0, 500) : '';
  db.prepare('INSERT INTO calificaciones (incidencia_id, valor, comentario, creada_en) VALUES (?, ?, ?, ?)')
    .run(inc.id, valor, comentario, Date.now());
  res.status(201).json({ ok: true, valor, comentario });
});