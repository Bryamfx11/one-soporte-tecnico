import { db } from './db.js';
import { notifyApp } from './sse.js';

// Guarda una notificación en la tabla `not_app` y la empuja en tiempo real al usuario
// conectado por SSE (si hay una sesión abierta con su navegador). Nunca lanza.
export function crearNotificacionApp({ usuarioId, incidenciaId, titulo, cuerpo }) {
  const r = db.prepare('INSERT INTO not_app (usuario_id, incidencia_id, titulo, cuerpo, leida, creada_en) VALUES (?,?,?,?,0,?)')
    .run(Number(usuarioId), incidenciaId == null ? null : Number(incidenciaId), String(titulo ?? '').slice(0, 200), String(cuerpo ?? '').slice(0, 500), Date.now());
  const fila = db.prepare('SELECT n.*, i.numero_ticket FROM not_app n LEFT JOIN incidencias i ON i.id = n.incidencia_id WHERE n.id = ?')
    .get(Number(r.lastInsertRowid));
  notifyApp(fila.usuario_id, fila);
  return fila;
}

// Crea una notificación para todos los usuarios activos (opcionalmente de un rol).
export function notificarAUsuariosActivos({ rol = null, incidenciaId = null, titulo, cuerpo }) {
  const usuarios = rol
    ? db.prepare('SELECT id FROM usuarios WHERE activo = 1 AND rol = ? ORDER BY id').all(rol)
    : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id').all();
  let creadas = 0;
  for (const u of usuarios) {
    crearNotificacionApp({ usuarioId: u.id, incidenciaId, titulo, cuerpo });
    creadas += 1;
  }
  return creadas;
}

export function listarNotificaciones(usuarioId, { soloNoLeidas = false, limite = 50 } = {}) {
  const where = soloNoLeidas ? 'n.leida = 0 AND' : '';
  const items = db.prepare(`
    SELECT n.id, n.incidencia_id, i.numero_ticket, n.titulo, n.cuerpo, n.leida, n.creada_en
    FROM not_app n
    LEFT JOIN incidencias i ON i.id = n.incidencia_id
    WHERE ${where} n.usuario_id = ?
    ORDER BY n.creada_en DESC, n.id DESC
    LIMIT ?
  `).all(Number(usuarioId), Math.min(Math.max(Number(limite) || 50, 1), 200));
  const noLeidas = db.prepare('SELECT COUNT(*) AS c FROM not_app WHERE usuario_id = ? AND leida = 0').get(Number(usuarioId)).c;
  return { no_leidas: noLeidas, items };
}

export function marcarLeida(usuarioId, id) {
  const r = db.prepare('UPDATE not_app SET leida = 1 WHERE id = ? AND usuario_id = ? AND leida = 0')
    .run(Number(id), Number(usuarioId));
  return Number(r.changes) > 0;
}

export function marcarTodasLeidas(usuarioId) {
  const r = db.prepare('UPDATE not_app SET leida = 1 WHERE usuario_id = ? AND leida = 0').run(Number(usuarioId));
  return Number(r.changes);
}