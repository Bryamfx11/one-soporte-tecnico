import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../api.js', () => ({
  getToken: () => localStorage.getItem('one_soporte_token'),
  setToken: (t) => (t ? localStorage.setItem('one_soporte_token', t) : localStorage.removeItem('one_soporte_token')),
  setUser: () => {},
  getUser: () => null,
  api: { post: vi.fn() },
}));

import RequireAuth from '../components/RequireAuth.jsx';
import Login from '../pages/Login.jsx';

beforeEach(() => {
  localStorage.clear();
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
});
