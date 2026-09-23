import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';

vi.mock('../api.js', () => ({
  api: { get: vi.fn() },
  getUser: vi.fn(() => ({ id: 1, email: 'admin@one.com', rol: 'admin' })),
  useApi: vi.fn(),
}));

import Auditoria from '../pages/Auditoria.jsx';
import { useApi } from '../api.js';

const EVENTOS = [
  { id: 3, incidencia_id: null, numero_ticket: null, usuario: 'admin@one.com', accion: 'usuario_creado', detalle: 'tecnico: Bryam <bryam@one.com>', creada_en: 1700000003000 },
  { id: 2, incidencia_id: 7, numero_ticket: 'ONE-0007', usuario: 'Bryam', accion: 'cierre', detalle: 'Caso cerrado como resuelta', creada_en: 1700000002000 },
];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Auditoría', () => {
  test('muestra el historial con acciones traducidas', () => {
    useApi.mockReturnValue({ data: EVENTOS, loading: false, error: null, reload: vi.fn() });
    render(
      <MemoryRouter>
        <ToastProvider>
          <Auditoria />
        </ToastProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /auditoría/i })).toBeInTheDocument();
    expect(screen.getByText('Usuario creado')).toBeInTheDocument();
    expect(screen.getByText('Cierre')).toBeInTheDocument();
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
});