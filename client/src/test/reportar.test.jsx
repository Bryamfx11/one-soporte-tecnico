import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api.js', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import Reportar from '../pages/Reportar.jsx';
import { api } from '../api.js';

const TIPOS = [{ id: 1, nombre: 'Sin servicio de internet' }, { id: 2, nombre: 'Cable dañado' }];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Reportar (portal del cliente)', () => {
  test('envía el reporte y muestra ticket y clave de seguimiento', async () => {
    api.get.mockResolvedValue(TIPOS);
    api.post.mockResolvedValue({ numero_ticket: 'ONE-0100', clave_seguimiento: '123456', id: 99 });

    render(
      <MemoryRouter>
        <Reportar />
      </MemoryRouter>
    );

    await screen.findByRole('option', { name: 'Sin servicio de internet' });
    fireEvent.change(screen.getByLabelText(/nombre del cliente/i), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText(/tipo de novedad/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));

    expect(await screen.findByText('ONE-0100')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/portal/reportes', expect.objectContaining({ nombre: 'Ana Pérez', tipo_falla_id: '1' }));
  });

  test('rechaza el envío sin datos obligatorios', async () => {
    render(
      <MemoryRouter>
        <Reportar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /enviar reporte/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/indique su nombre/i);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('consulta el estado con ticket y clave', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/portal/incidencias/')) {
        return Promise.resolve({ numero_ticket: 'ONE-0025', estado: 'en_diagnostico', prioridad: 'media', tipo_falla: 'Cable dañado', creada_en: 1700000000000, tecnico: 'Bryam' });
      }
      return Promise.resolve(TIPOS);
    });

    render(
      <MemoryRouter>
        <Reportar />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/número de ticket/i), { target: { value: 'one-0025' } });
    fireEvent.change(screen.getByLabelText(/clave de seguimiento/i), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /consultar estado/i }));

    expect(await screen.findByText('En diagnóstico')).toBeInTheDocument();
    expect(screen.getByText('ONE-0025')).toBeInTheDocument();
    expect(screen.getByText('Bryam')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/portal/incidencias/ONE-0025?clave=654321');
  });

  test('muestra error cuando no se encuentra el ticket', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/portal/incidencias/')) return Promise.reject(new Error('No se encontró la incidencia'));
      return Promise.resolve(TIPOS);
    });

    render(
      <MemoryRouter>
        <Reportar />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/número de ticket/i), { target: { value: 'ONE-0000' } });
    fireEvent.change(screen.getByLabelText(/clave de seguimiento/i), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: /consultar estado/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró la incidencia');
    expect(screen.queryByText('En diagnóstico')).not.toBeInTheDocument();
  });
});