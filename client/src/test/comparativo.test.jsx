import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api.js', () => ({
  api: { get: vi.fn() },
  useApi: vi.fn(),
}));

import Comparativo from '../pages/Comparativo.jsx';
import { useApi } from '../api.js';

const DATOS = {
  mes: '2026-09',
  mes_anterior: '2026-08',
  actual: { nuevas: 12, resueltas: 9, pendientes: 3, tiempo_promedio_ms: 7200000 },
  anterior: { nuevas: 10, resueltas: 6, pendientes: 5, tiempo_promedio_ms: 10800000 },
  por_tipo: [
    { nombre: 'Sin servicio', actual: 6, anterior: 4 },
    { nombre: 'Cable dañado', actual: 4, anterior: 2 }
  ],
  por_tecnico: {
    actual: [{ nombre: 'Bryam', total: 8, resueltas: 6 }],
    anterior: [{ nombre: 'Bryam', total: 6 }]
  },
  causas: [{ categoria: 'Daño de infraestructura', c: 3 }]
};

const VACIO = {
  mes: '2026-09',
  mes_anterior: '2026-08',
  actual: { nuevas: 0, resueltas: 0, pendientes: 0, tiempo_promedio_ms: null },
  anterior: { nuevas: 0, resueltas: 0, pendientes: 0, tiempo_promedio_ms: null },
  por_tipo: [],
  por_tecnico: { actual: [], anterior: [] },
  causas: []
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Comparativo', () => {
  test('muestra tarjetas, gráfica y tabla de técnicos', async () => {
    useApi.mockReturnValue({ data: DATOS, loading: false, error: null });
    render(
      <MemoryRouter>
        <Comparativo />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /comparativo mensual/i })).toBeInTheDocument();
    expect(screen.getByText(/incidencias nuevas por tipo de falla/i)).toBeInTheDocument();
    expect(screen.getByText('Bryam')).toBeInTheDocument();
    expect(screen.getByText('Daño de infraestructura')).toBeInTheDocument();
  });

  test('muestra vacío cuando no hay registros en el mes', async () => {
    useApi.mockReturnValue({ data: VACIO, loading: false, error: null });
    render(
      <MemoryRouter>
        <Comparativo />
      </MemoryRouter>
    );

    expect(screen.getByText(/No hay incidencias registradas en/)).toBeInTheDocument();
  });
});