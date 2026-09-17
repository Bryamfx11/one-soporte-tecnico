import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.jsx';
import Ajustes from '../pages/Ajustes.jsx';

function renderizarAjustes() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Ajustes />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('Ajustes', () => {
  test('renderiza la página sin errores', () => {
    renderizarAjustes();
    expect(screen.getByRole('heading', { name: /ajustes/i })).toBeInTheDocument();
  });

  test('muestra los criterios del plan de mejora por defecto', () => {
    renderizarAjustes();
    expect(screen.getByLabelText('Tasa de resolución mínima')).toHaveValue(70);
    expect(screen.getByLabelText('Tiempo objetivo de diagnóstico')).toHaveValue(24);
    expect(screen.getByLabelText('Umbral de escalamiento')).toHaveValue(26);
  });
});