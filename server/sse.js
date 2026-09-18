import { EventEmitter } from 'node:events';

const cambios = new EventEmitter();
cambios.setMaxListeners(0);

export function notifyDataChange() {
  cambios.emit('change');
}

export function sseHandler(_req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');

  const enviar = () => res.write('data: {"type":"update"}\n\n');
  cambios.on('change', enviar);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

  res.on('close', () => {
    cambios.off('change', enviar);
    clearInterval(heartbeat);
  });
}