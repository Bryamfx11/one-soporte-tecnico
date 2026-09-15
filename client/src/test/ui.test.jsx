import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatCard, Spinner, Empty } from '../components/ui.jsx';
import { Activity } from 'lucide-react';

describe('componentes UI', () => {
  test('Badge renderiza el contenido', () => {
    render(<Badge color="#10b981">Resuelta</Badge>);
    expect(screen.getByText('Resuelta')).toBeInTheDocument();
  });

  test('StatCard muestra etiqueta, valor y subtexto', () => {
    render(<StatCard icon={Activity} label="Total" value={42} sub="Min 1 · Max 5" tone="blue" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Min 1 · Max 5')).toBeInTheDocument();
  });

  test('Empty muestra el mensaje', () => {
    render(<Empty message="Sin datos" />);
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  test('Spinner renderiza', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.spinner')).toBeTruthy();
  });
});
