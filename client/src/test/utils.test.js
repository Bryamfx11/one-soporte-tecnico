import { describe, test, expect } from 'vitest';
import { fmtFecha, fmtTiempo, fmtTiempoProm, ESTADOS, PRIORIDADES } from '../utils.js';

describe('utils', () => {
  test('fmtFecha formatea una fecha', () => {
    const out = fmtFecha(new Date('2025-01-15T10:30:00').getTime());
    expect(out).toMatch(/2025/);
    expect(out).not.toBe('—');
  });

  test('fmtFecha devuelve guion para valores vacíos', () => {
    expect(fmtFecha(null)).toBe('—');
    expect(fmtFecha(0)).toBe('—');
  });

  test('fmtTiempo convierte minutos', () => {
    expect(fmtTiempo(30 * 60000)).toBe('30 min');
  });

  test('fmtTiempo convierte horas', () => {
    expect(fmtTiempo(5 * 3600000)).toBe('5.0 h');
  });

  test('fmtTiempo convierte días', () => {
    expect(fmtTiempo(48 * 3600000)).toBe('2.0 días');
  });

  test('fmtTiempo devuelve guion para null', () => {
    expect(fmtTiempo(null)).toBe('—');
  });

  test('fmtTiempoProm se comporta igual que fmtTiempo', () => {
    expect(fmtTiempoProm(3600000)).toBe('1.0 h');
    expect(fmtTiempoProm(null)).toBe('—');
  });

  test('ESTADOS contiene los cuatro estados', () => {
    expect(Object.keys(ESTADOS)).toEqual(['nueva', 'en_diagnostico', 'resuelta', 'escalada']);
  });

  test('PRIORIDADES contiene alta media baja', () => {
    expect(Object.keys(PRIORIDADES)).toEqual(['alta', 'media', 'baja']);
  });
});
