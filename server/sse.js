import { EventEmitter } from 'node:events';

const cambios = new EventEmitter();
cambios.setMaxListeners(0);

// Clientes suscritos por usuario para notificaciones en la app (campana).
const porUsuario = new Map();

export function notifyDataChange() {
  cambios.emit('change');
}

// Empuja una notificación al navegador del usuario si tiene el SSE abierto.
export function notifyApp(usuarioId, notificacion) {
  const cbs = porUsuario.get(Number(usuarioId));
  if (!cbs) return;
  for (const cb of [...cbs]) {
    try {
      cb(notificacion);
    } catch {
      void 0;
    }
  }
}

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');

  const enviar = () => res.write('data: {"type":"update"}\n\n');
  cambios.on('change', enviar);

  const usuarioId = Number(req.user?.id ?? 0);
  let enviarApp = null;
  if (usuarioId > 0) {
    enviarApp = (notificacion) => {
      res.write(`data: ${JSON.stringify({ type: 'notificacion', data: notificacion })}\n\n`);
    };
    if (!porUsuario.has(usuarioId)) porUsuario.set(usuarioId, new Set());
    porUsuario.get(usuarioId).add(enviarApp);
  }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

  res.on('close', () => {
    cambios.off('change', enviar);
    if (enviarApp && porUsuario.has(usuarioId)) {
      porUsuario.get(usuarioId).delete(enviarApp);
      if (porUsuario.get(usuarioId).size === 0) porUsuario.delete(usuarioId);
    }
    clearInterval(heartbeat);
  });
}