import express from 'express';
import { db } from '../db.js';

export const checklistsRouter = express.Router();

// Todos los tipos de falla con sus consultas (base de conocimiento)
checklistsRouter.get('/', (req, res) => {
  const tipos = db.prepare('SELECT * FROM tipos_falla ORDER BY id').all();
  const result = tipos.map((tipo) => ({
    ...tipo,
    consultas: db.prepare('SELECT * FROM consultas_tipo_falla WHERE tipo_falla_id = ? ORDER BY orden').all(tipo.id)
  }));
  res.json(result);
});

// Checklist de un tipo específico (para diagnóstico guiado)
checklistsRouter.get('/:tipoId', (req, res) => {
  const tipo = db.prepare('SELECT * FROM tipos_falla WHERE id = ?').get(req.params.tipoId);
  if (!tipo) return res.status(404).json({ error: 'Tipo de falla no encontrado' });
  const consultas = db.prepare('SELECT * FROM consultas_tipo_falla WHERE tipo_falla_id = ? ORDER BY orden').all(tipo.id);
  res.json({ ...tipo, consultas });
});

// Causas raíz disponibles
checklistsRouter.get('/causas-raiz', (req, res) => {
  const causas = db.prepare('SELECT * FROM causas_raiz ORDER BY id').all();
  res.json(causas);
});