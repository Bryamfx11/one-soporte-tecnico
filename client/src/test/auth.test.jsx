import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../api.js', () => ({
  getToken: () => localStorage.getItem('one_soporte_token'),
  setToken: (t) => (t ? localStorage.setItem('one_soporte_token', t) : localStorage.removeItem('one_soporte_token')),
  setUser: (u) => (u ? localStorage.setItem('one_soporte_user', JSON.stringify(u)) : localStorage.removeItem('one_soporte_user')),
  getUser: () => null,
  api: { post: vi.fn() },
}));

import RequireAuth from '../components/RequireAuth.jsx';
import Login from '../pages/Login.jsx';
import { api } from '../api.js';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('RequireAuth', () => {
  test('redirige a /login sin token', () => {
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route path="/login" element={<div>Pantalla de login</div>} />
          <Route path="/privado" element={<RequireAuth><div>Contenido privado</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido privado')).not.toBeInTheDocument();
  });

  test('muestra el contenido con token', () => {
    localStorage.setItem('one_soporte_token', 'token-valido');
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route path="/privado" element={<RequireAuth><div>Contenido privado</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Contenido privado')).toBeInTheDocument();
  });
});

describe('Login', () => {
  test('renderiza el formulario', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('ONETec')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('usuario@one.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  test('pide el código 2FA cuando el servidor lo requiere', async () => {
    api.post.mockImplementation((url, body) => {
      if (url === '/auth/login') {
        return Promise.resolve({ twoFactorRequired: true, twoFactorToken: 'token-parcial' });
      }
      if (url === '/auth/2fa/verify') {
        expect(body.code).toBe('123456');
        return Promise.resolve({ token: 'token-real', user: { email: 'admin@one.com', rol: 'admin' } });
      }
      return Promise.reject(new Error('ruta inesperada'));
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Panel principal</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('usuario@one.com'), { target: { value: 'admin@one.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(screen.getByText(/verificación en dos pasos/i)).toBeInTheDocument());
    expect(screen.queryByText(/panel principal/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar y entrar/i }));

    await waitFor(() => expect(screen.getByText(/panel principal/i)).toBeInTheDocument());
    expect(localStorage.getItem('one_soporte_token')).toBe('token-real');
  });

  test('muestra error cuando el código 2FA es incorrecto', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/auth/login') return Promise.resolve({ twoFactorRequired: true, twoFactorToken: 'token-parcial' });
      return Promise.reject(new Error('Código 2FA incorrecto'));
    });
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('usuario@one.com'), { target: { value: 'a@one.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'clave123' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /verificar y entrar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Código 2FA incorrecto'));
  });
});
