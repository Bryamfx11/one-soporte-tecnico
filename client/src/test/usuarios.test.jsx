import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';

vi.mock('../api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  getUser: vi.fn(() => ({ id: 1, email: 'admin@one.com', rol: 'admin' })),
  useApi: vi.fn(),
}));

import Usuarios from '../pages/Usuarios.jsx';
import { api, useApi } from '../api.js';

const USUARIOS = [
  { id: 1, nombre: 'Administrador', email: 'admin@one.com', rol: 'admin', activo: 1, creado_en: 1700000000000 },
  { id: 2, nombre: 'Bryam', email: 'bryam@one.com', rol: 'tecnico', activo: 1, creado_en: 1700000000000 },
];

function renderizarUsuarios(reload = vi.fn()) {
  useApi.mockReturnValue({ data: USUARIOS, loading: false, error: null, reload });
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Usuarios />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Usuarios', () => {
  test('lista las cuentas con su rol', () => {
    renderizarUsuarios();
    expect(screen.getByRole('heading', { name: /gestión de usuarios/i })).toBeInTheDocument();
    expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0);
    expect(screen.getByText('Bryam')).toBeInTheDocument();
    expect(screen.getAllByText(/Técnico/i).length).toBeGreaterThan(0);
  });

  test('crea un usuario admin desde el modal y refresca la lista', async () => {
    const reload = vi.fn();
    api.post.mockResolvedValue({ user: { id: 3, nombre: 'Laura', email: 'laura@one.com', rol: 'admin' } });
    renderizarUsuarios(reload);

    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Laura' } });
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'laura@one.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'clave123' } });
    fireEvent.change(screen.getByLabelText(/rol/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText('Usuario Laura creado (Administrador).')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      nombre: 'Laura',
      email: 'laura@one.com',
      password: 'clave123',
      rol: 'admin'
    });
    expect(reload).toHaveBeenCalled();
  });

  test('rechaza crear con datos inválidos sin llamar a la API', async () => {
    renderizarUsuarios();

    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/indique el nombre/i);
    expect(api.post).not.toHaveBeenCalled();
  });

  test('edita un usuario (nombre, email y contraseña) desde el modal', async () => {
    const reload = vi.fn();
    api.patch.mockResolvedValue({ id: 2, nombre: 'Bryam G.', email: 'bryam2@one.com', rol: 'tecnico', activo: 1, creado_en: 1700000000000 });
    renderizarUsuarios(reload);

    fireEvent.click(screen.getByRole('button', { name: /editar bryam/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Bryam G.' } });
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'bryam2@one.com' } });
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'nuevaClave1' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('Usuario Bryam G. actualizado.')).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith('/usuarios/2', {
      nombre: 'Bryam G.',
      email: 'bryam2@one.com',
      rol: 'tecnico',
      password: 'nuevaClave1'
    });
    expect(reload).toHaveBeenCalled();
  });

  test('muestra el rol deshabilitado al editar la propia cuenta', async () => {
    renderizarUsuarios();

    fireEvent.click(screen.getByRole('button', { name: /editar administrador/i }));
    const selRol = screen.getByLabelText(/rol/i);
    expect(selRol).toBeDisabled();
    expect(screen.getByText(/el rol no se puede modificar/i)).toBeInTheDocument();
  });
});