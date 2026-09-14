import express from 'express';
import { db } from '../db.js';

export const tecnicosRouter = express.Router();

tecnicosRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tecnicos ORDER BY nombre').all();
  res.json(rows);
});