import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';
import Ajustes from '../pages/Ajustes.jsx';
import App from '../App.jsx';

function renderizarAjustes() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Ajustes />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Ajustes', () => {
  test('renderiza la página sin errores', () => {
    renderizarAjustes();
    expect(screen.getByRole('heading', { name: /ajustes/i })).toBeInTheDocument();
  });

  test('muestra las metas de servicio por defecto', () => {
    renderizarAjustes();
    expect(screen.getByLabelText('Tasa de resolución mínima')).toHaveValue(70);
    expect(screen.getByLabelText('Tiempo máximo de diagnóstico')).toHaveValue(24);
    expect(screen.getByLabelText('Umbral de escalamiento')).toHaveValue(26);
  });
});

describe('Ajustes dentro de la app completa', () => {
  test('abre /ajustes con sesión sin lanzar errores', async () => {
    localStorage.setItem('one_soporte_token', 'token-test');
    render(
      <MemoryRouter initialEntries={['/ajustes']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: /ajustes/i })).toBeInTheDocument();
  });
});