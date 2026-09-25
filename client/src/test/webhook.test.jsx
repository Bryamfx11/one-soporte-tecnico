import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';

vi.mock('../api.js', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn()
  },
  getUser: vi.fn(() => ({ id: 1, email: 'admin@one.com', rol: 'admin' })),
  setToken: vi.fn(),
  setUser: vi.fn()
}));

import Ajustes from '../pages/Ajustes.jsx';
import { api } from '../api.js';

function renderizarAjustes() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Ajustes />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('Webhook de salida en Ajustes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      const data = {
        '/webhook/config': { habilitada: false, url: '', secretConfigurado: false, configurado: false },
        '/notifications/config': {},
        '/notifications/historial': [],
        '/auth/2fa': { activa: false },
        '/ajustes/operacion': { sla: { alta: 24, media: 48, baja: 72, escalamiento: 26 } }
      };
      return Promise.resolve(data[url] ?? {});
    });
  });

  test('muestra el formulario del webhook y lo guarda con URL y secreto', async () => {
    api.put.mockResolvedValue({ habilitada: true, url: 'https://hook.ejemplo.com/onetec', secretConfigurado: true, configurado: true });
    renderizarAjustes();
    const urlInput = await screen.findByPlaceholderText('https://hooks.ejemplo.com/onetec');
    fireEvent.change(urlInput, { target: { value: 'https://hook.ejemplo.com/onetec' } });
    fireEvent.change(screen.getByPlaceholderText('sin secreto'), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar webhook/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/webhook/config', { habilitada: false, url: 'https://hook.ejemplo.com/onetec', secret: 's3cret' }));
  });

  test('el botón de prueba despacha /webhook/test cuando el webhook está activo', async () => {
    api.post.mockResolvedValue({ ok: true, url: 'https://hook.ejemplo.com/onetec' });
    api.put.mockResolvedValue({ habilitada: true, url: 'https://hook.ejemplo.com/onetec', secretConfigurado: false, configurado: true });
    renderizarAjustes();
    const urlInput = await screen.findByPlaceholderText('https://hooks.ejemplo.com/onetec');
    fireEvent.change(urlInput, { target: { value: 'https://hook.ejemplo.com/onetec' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /webhook activo/i }));
    fireEvent.click(screen.getByRole('button', { name: /enviar prueba/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/webhook/test'));
  });
});