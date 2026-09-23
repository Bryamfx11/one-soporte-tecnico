import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';

vi.mock('../api.js', () => ({
  api: { get: vi.fn() },
  getUser: vi.fn(() => ({ id: 1, email: 'admin@one.com', rol: 'admin' })),
  useApi: vi.fn(),
}));

vi.mock('../utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, downloadCSV: vi.fn() };
});

import Auditoria, { ACCIONES_AUDITORIA } from '../pages/Auditoria.jsx';
import { api, useApi } from '../api.js';
import { downloadCSV } from '../utils.js';

const EVENTOS = [
  { id: 2, incidencia_id: null, numero_ticket: null, usuario: 'admin@one.com', accion: 'usuario_creado', detalle: 'tecnico: Bryam <bryam@one.com>', creada_en: 1700000003000 },
  { id: 1, incidencia_id: 7, numero_ticket: 'ONE-0007', usuario: 'Bryam', accion: 'login_fallido', detalle: 'intento de acceso', creada_en: 1700000002000 },
];

function renderizarAuditoria() {
  useApi.mockReturnValue({ data: EVENTOS, loading: false, error: null, reload: vi.fn() });
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Auditoria />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Auditoría', () => {
  test('lista el historial con acciones traducidas', () => {
    renderizarAuditoria();
    expect(screen.getByRole('heading', { name: /auditoría/i })).toBeInTheDocument();
    expect(screen.getAllByText('Usuario creado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Intento de acceso fallido').length).toBeGreaterThan(0);
    expect(screen.getByText('ONE-0007')).toBeInTheDocument();
  });

  test('muestra estado vacío cuando no hay eventos', () => {
    useApi.mockReturnValue({ data: [], loading: false, error: null, reload: vi.fn() });
    render(
      <MemoryRouter>
        <ToastProvider>
          <Auditoria />
        </ToastProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/no hay eventos registrados/i)).toBeInTheDocument();
  });

  test('el buscador y el filtro por acción piden datos al servidor', async () => {
    useApi.mockImplementation((fn) => {
      fn();
      return { data: EVENTOS, loading: false, error: null, reload: vi.fn() };
    });
    api.get.mockResolvedValue(EVENTOS);
    render(
      <MemoryRouter>
        <ToastProvider>
          <Auditoria />
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/buscar en auditoría/i), { target: { value: 'bryam' } });
    await new Promise((r) => setTimeout(r, 400));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('q=bryam'));

    api.get.mockClear();
    fireEvent.change(screen.getByLabelText(/filtrar por acción/i), { target: { value: 'login_fallido' } });
    await new Promise((r) => setTimeout(r, 400));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('accion=login_fallido'));
  });

  test('exporta el historial a CSV', () => {
    renderizarAuditoria();
    fireEvent.click(screen.getByRole('button', { name: /exportar csv/i }));
    expect(downloadCSV).toHaveBeenCalledTimes(1);
    expect(downloadCSV.mock.calls[0][1]).toContain('Usuario');
    expect(downloadCSV.mock.calls[0][1]).toContain('Ticket');
    expect(ACCIONES_AUDITORIA.login_exitoso).toBe('Inicio de sesión');
  });
});