import { useEffect, useRef } from 'react';
import { getToken, setToken, setUser } from './api.js';

const RECONNECT_INICIAL = 3000;
const RECONNECT_MAX = 30000;

export function useLiveData(reload, { enabled = true, onChange } = {}) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled || typeof reload !== 'function') return;

    let activo = true;
    let controller = null;
    let reintento = RECONNECT_INICIAL;
    let timer = null;

    async function conectar() {
      while (activo) {
        controller = new AbortController();
        try {
          const res = await fetch('/api/sse/events', {
            headers: { Authorization: `Bearer ${getToken()}` },
            signal: controller.signal
          });
          if (!activo) return;
          if (res.status === 401) {
            setToken(null);
            setUser(null);
            window.location.assign('/login');
            return;
          }
          if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
          reintento = RECONNECT_INICIAL;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fin = false;
          while (activo && !fin) {
            const { done, value } = await reader.read();
            if (done) {
              fin = true;
            } else {
              buffer += decoder.decode(value, { stream: true });
              let corte;
              while ((corte = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, corte);
                buffer = buffer.slice(corte + 2);
                for (const linea of frame.split('\n')) {
                  if (linea.startsWith('data: ')) {
                    try {
                      const evento = JSON.parse(linea.slice(6));
                      if (evento.type === 'update') {
                        reload();
                        if (onChangeRef.current) onChangeRef.current();
                      }
                    } catch {
                      void 0;
                    }
                  }
                }
              }
            }
          }
        } catch {
          void 0;
        }
        if (!activo) return;
        await new Promise((resolve) => { timer = setTimeout(resolve, reintento); });
        if (!activo) return;
        reintento = Math.min(reintento * 2, RECONNECT_MAX);
      }
    }

    conectar();
    return () => {
      activo = false;
      if (controller) controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, reload]);
}