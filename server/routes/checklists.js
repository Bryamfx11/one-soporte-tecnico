import express from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import {
  validateIdParam, validateTipoFallaCreate, validateTipoFallaUpdate,
  validateConsultaCreate, validateConsultaUpdate, validateCausaRaizCreate,
  validateCausaRaizUpdate, validateSolucion, validationMiddleware
} from '../validate.js';
import { notifyDataChange } from '../sse.js';

export const checklistsRouter = express.Router();

function validateId(req, res, next) {
  const errors = validateIdParam(req.params.id);
  if (errors.length) return res.status(400).json({ error: 'ID inválido' });
  next();
}

function validateTipoId(req, res, next) {
  const errors = validateIdParam(req.params.tipoId);
  if (errors.length) return res.status(400).json({ error: 'ID de tipo de falla inválido' });
  next();
}

// --- Base de conocimiento viva: soluciones guardadas desde casos resueltos ---
// Debe ir antes de get('/:tipoId') para no colisionar con las rutas de tipo.

function escaparLike(str) {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

checklistsRouter.get('/soluciones', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
  let where = '';
  const params = [];
  if (q) {
    where = "WHERE (s.titulo LIKE ? ESCAPE '\\' OR s.contenido LIKE ? ESCAPE '\\' OR s.usuario LIKE ? ESCAPE '\\' OR t.nombre LIKE ? ESCAPE '\\')";
    const like = `%${escaparLike(q)}%`;
    params.push(like, like, like, like);
  }
  const soluciones = db.prepare(`
    SELECT s.id, s.tipo_falla_id, s.titulo, s.contenido, s.usuario, s.creada_en, t.nombre AS tipo_falla
    FROM soluciones s JOIN tipos_falla t ON t.id = s.tipo_falla_id
    ${where}
    ORDER BY s.creada_en DESC, s.id DESC
  `).all(...params);
  res.json({ items: soluciones, total: soluciones.length });
});

checklistsRouter.post('/soluciones', validationMiddleware(validateSolucion), (req, res) => {
  const tipo = db.prepare('SELECT 1 FROM tipos_falla WHERE id = ?').get(Number(req.body.tipo_falla_id));
  if (!tipo) return res.status(400).json({ error: 'tipo_falla_id no existe' });

  const r = db.prepare('INSERT INTO soluciones (tipo_falla_id, titulo, contenido, usuario, creada_en) VALUES (?, ?, ?, ?, ?)')
    .run(Number(req.body.tipo_falla_id), req.body.titulo.trim(), req.body.contenido.trim(), req.user.nombre, Date.now());
  db.prepare('INSERT INTO actividad (incidencia_id, usuario, accion, detalle, creada_en) VALUES (?, ?, ?, ?, ?)')
    .run(null, req.user.nombre, 'solucion_guardada', `Solución guardada en la base: ${req.body.titulo.trim().slice(0, 120)}`, Date.now());
  notifyDataChange();
  const solucion = db.prepare(`
    SELECT s.id, s.tipo_falla_id, s.titulo, s.contenido, s.usuario, s.creada_en, t.nombre AS tipo_falla
    FROM soluciones s JOIN tipos_falla t ON t.id = s.tipo_falla_id WHERE s.id = ?
  `).get(Number(r.lastInsertRowid));
  res.status(201).json(solucion);
});

checklistsRouter.delete('/soluciones/:id', requireAdmin, validateId, (req, res) => {
  const s = db.prepare('SELECT * FROM soluciones WHERE id = ?').get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: 'Solución no encontrada' });
  db.prepare('DELETE FROM soluciones WHERE id = ?').run(s.id);
  notifyDataChange();
  res.json({ ok: true });
});

// Causas raíz disponibles (debe ir antes de /:tipoId)
checklistsRouter.get('/causas-raiz', (req, res) => {
  const causas = db.prepare('SELECT * FROM causas_raiz ORDER BY id').all();
  res.json(causas);
});

// Todos los tipos de falla con sus consultas (base de conocimiento)
checklistsRouter.get('/', (req, res) => {
  const tipos = db.prepare('SELECT * FROM tipos_falla ORDER BY id').all();
  const consultas = db.prepare('SELECT * FROM consultas_tipo_falla ORDER BY tipo_falla_id, orden').all();
  const porTipo = new Map();
  for (const c of consultas) {
    if (!porTipo.has(c.tipo_falla_id)) porTipo.set(c.tipo_falla_id, []);
    porTipo.get(c.tipo_falla_id).push(c);
  }
  res.json(tipos.map((tipo) => ({ ...tipo, consultas: porTipo.get(tipo.id) ?? [] })));
});

// Lista ligera de tipos (para dropdowns y filtros)
checklistsRouter.get('/tipos', (req, res) => {
  const tipos = db.prepare('SELECT id, nombre, descripcion, icono FROM tipos_falla ORDER BY id').all();
  res.json(tipos);
});

// --- Mantenimiento de la base de conocimiento (solo administradores) ---

function tipoConIncidencias(id) {
  return db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE tipo_falla_id = ?').get(id).c;
}

function causaConIncidencias(id) {
  return db.prepare('SELECT COUNT(*) AS c FROM incidencias WHERE causa_raiz_id = ?').get(id).c;
}

function consultaConRespuestas(id) {
  return db.prepare('SELECT COUNT(*) AS c FROM respuestas_diagnostico WHERE consulta_id = ?').get(id).c;
}

checklistsRouter.post('/causas-raiz', requireAdmin, validationMiddleware(validateCausaRaizCreate), (req, res) => {
  const r = db.prepare('INSERT INTO causas_raiz (categoria, descripcion) VALUES (?, ?)')
    .run(req.body.categoria.trim(), req.body.descripcion.trim());
  const causa = db.prepare('SELECT * FROM causas_raiz WHERE id = ?').get(Number(r.lastInsertRowid));
  notifyDataChange();
  res.status(201).json(causa);
});

checklistsRouter.patch('/causas-raiz/:id', requireAdmin, validateId, validationMiddleware(validateCausaRaizUpdate), (req, res) => {
  const causa = db.prepare('SELECT * FROM causas_raiz WHERE id = ?').get(Number(req.params.id));
  if (!causa) return res.status(404).json({ error: 'Causa raíz no encontrada' });

  const sets = [];
  const params = [];
  for (const k of ['categoria', 'descripcion']) {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(String(req.body[k]).trim());
    }
  }
  if (sets.length) {
    params.push(causa.id);
    db.prepare(`UPDATE causas_raiz SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    notifyDataChange();
  }
  res.json(db.prepare('SELECT * FROM causas_raiz WHERE id = ?').get(causa.id));
});

checklistsRouter.delete('/causas-raiz/:id', requireAdmin, validateId, (req, res) => {
  const causa = db.prepare('SELECT * FROM causas_raiz WHERE id = ?').get(Number(req.params.id));
  if (!causa) return res.status(404).json({ error: 'Causa raíz no encontrada' });

  const usadas = causaConIncidencias(causa.id);
  if (usadas > 0) {
    return res.status(409).json({ error: `No se puede eliminar: hay ${usadas} incidencia(s) registrada(s) con esta causa raíz` });
  }
  db.prepare('DELETE FROM causas_raiz WHERE id = ?').run(causa.id);
  notifyDataChange();
  res.json({ ok: true });
});

checklistsRouter.post('/tipos', requireAdmin, validationMiddleware(validateTipoFallaCreate), (req, res) => {
  const r = db.prepare('INSERT INTO tipos_falla (nombre, descripcion, icono) VALUES (?, ?, ?)')
    .run(req.body.nombre.trim(), req.body.descripcion.trim(), (req.body.icono ?? '').toString().trim() || 'wifi-off');
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(Number(r.lastInsertRowid));
  notifyDataChange();
  res.status(201).json({ ...tipo, consultas: [] });
});

checklistsRouter.patch('/tipos/:id', requireAdmin, validateId, validationMiddleware(validateTipoFallaUpdate), (req, res) => {
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(Number(req.params.id));
  if (!tipo) return res.status(404).json({ error: 'Tipo de falla no encontrado' });

  const sets = [];
  const params = [];
  for (const k of ['nombre', 'descripcion', 'icono']) {
    if (req.body[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(String(req.body[k]).trim());
    }
  }
  if (sets.length) {
    params.push(tipo.id);
    db.prepare(`UPDATE tipos_falla SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    notifyDataChange();
  }
  res.json(db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(tipo.id));
});

checklistsRouter.delete('/tipos/:id', requireAdmin, validateId, (req, res) => {
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(Number(req.params.id));
  if (!tipo) return res.status(404).json({ error: 'Tipo de falla no encontrado' });

  const usadas = tipoConIncidencias(tipo.id);
  if (usadas > 0) {
    return res.status(409).json({ error: `No se puede eliminar: hay ${usadas} incidencia(s) registrada(s) con este tipo de falla` });
  }
  db.prepare('DELETE FROM tipos_falla WHERE id = ?').run(tipo.id); // las consultas se eliminan en cascada
  notifyDataChange();
  res.json({ ok: true });
});

checklistsRouter.post('/tipos/:tipoId/consultas', requireAdmin, validateTipoId, (req, res, next) => {
  req.body = { ...req.body, tipo_falla_id: Number(req.params.tipoId) };
  next();
}, validationMiddleware(validateConsultaCreate), (req, res) => {
  const tipoId = Number(req.params.tipoId);
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(tipoId);
  if (!tipo) return res.status(404).json({ error: 'Tipo de falla no encontrado' });

  const orden = req.body.orden === undefined || req.body.orden === null || req.body.orden === ''
    ? (db.prepare('SELECT COALESCE(MAX(orden), 0) AS m FROM consultas_tipo_falla WHERE tipo_falla_id = ?').get(tipoId).m + 1)
    : Number(req.body.orden);

  const r = db.prepare(`INSERT INTO consultas_tipo_falla
    (tipo_falla_id, orden, titulo, pregunta, instruccion, tipo_respuesta, unidad, etiqueta_valor, referencia)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(
      tipoId, orden,
      req.body.titulo.trim(), req.body.pregunta.trim(), req.body.instruccion.trim(),
      (req.body.tipo_respuesta ?? 'si_no'),
      req.body.unidad == null || req.body.unidad === '' ? null : String(req.body.unidad).trim(),
      req.body.etiqueta_valor == null || req.body.etiqueta_valor === '' ? null : String(req.body.etiqueta_valor).trim(),
      req.body.referencia == null || req.body.referencia === '' ? null : String(req.body.referencia).trim()
    );
  const consulta = db.prepare('SELECT * FROM consultas_tipo_falla WHERE id = ?').get(Number(r.lastInsertRowid));
  notifyDataChange();
  res.status(201).json(consulta);
});

checklistsRouter.patch('/consultas/:id', requireAdmin, validateId, validationMiddleware(validateConsultaUpdate), (req, res) => {
  const consulta = db.prepare('SELECT * FROM consultas_tipo_falla WHERE id = ?').get(Number(req.params.id));
  if (!consulta) return res.status(404).json({ error: 'Consulta no encontrada' });

  const sets = [];
  const params = [];
  for (const k of ['titulo', 'pregunta', 'instruccion', 'tipo_respuesta', 'unidad', 'etiqueta_valor', 'referencia', 'orden']) {
    if (req.body[k] !== undefined) {
      if (['unidad', 'etiqueta_valor', 'referencia'].includes(k)) {
        const v = req.body[k] == null || req.body[k] === '' ? null : String(req.body[k]).trim();
        sets.push(`${k} = ?`);
        params.push(v);
      } else {
        sets.push(`${k} = ?`);
        params.push(typeof req.body[k] === 'string' ? req.body[k].trim() : req.body[k]);
      }
    }
  }
  if (sets.length) {
    params.push(consulta.id);
    db.prepare(`UPDATE consultas_tipo_falla SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    notifyDataChange();
  }
  res.json(db.prepare('SELECT * FROM consultas_tipo_falla WHERE id = ?').get(consulta.id));
});

checklistsRouter.delete('/consultas/:id', requireAdmin, validateId, (req, res) => {
  const consulta = db.prepare('SELECT * FROM consultas_tipo_falla WHERE id = ?').get(Number(req.params.id));
  if (!consulta) return res.status(404).json({ error: 'Consulta no encontrada' });

  const usadas = consultaConRespuestas(consulta.id);
  if (usadas > 0) {
    return res.status(409).json({ error: `No se puede eliminar: hay ${usadas} respuesta(s) registrada(s) para esta consulta` });
  }
  db.prepare('DELETE FROM consultas_tipo_falla WHERE id = ?').run(consulta.id);
  notifyDataChange();
  res.json({ ok: true });
});

// Checklist de un tipo específico (para diagnóstico guiado)
checklistsRouter.get('/:tipoId', (req, res) => {
  const tipoId = Number(req.params.tipoId);
  if (!Number.isInteger(tipoId) || tipoId < 1) {
    return res.status(400).json({ error: 'ID de tipo de falla inválido' });
  }
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(tipoId);
  if (!tipo) return res.status(404).json({ error: 'Tipo de falla no encontrado' });
  const consultas = db.prepare('SELECT * FROM consultas_tipo_falla WHERE tipo_falla_id = ? ORDER BY orden').all(tipo.id);
  res.json({ ...tipo, consultas });
});