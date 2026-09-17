import express from 'express';
import { db } from '../db.js';

export const checklistsRouter = express.Router();

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