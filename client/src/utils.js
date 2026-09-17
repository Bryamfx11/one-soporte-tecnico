export const ESTADOS = {
  nueva: 'Nueva',
  en_diagnostico: 'En diagnóstico',
  resuelta: 'Resuelta',
  escalada: 'Escalada'
};

export const PRIORIDADES = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja'
};

export const ESTADO_COLOR = {
  nueva: '#64748b',
  en_diagnostico: '#f59e0b',
  resuelta: '#10b981',
  escalada: '#ef4444'
};

export const PRIORIDAD_COLOR = {
  alta: '#ef4444',
  media: '#f59e0b',
  baja: '#3b82f6'
};

export function fmtFecha(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function fmtTiempo(ms) {
  if (ms == null) return '—';
  const horas = ms / 3600000;
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(filename, headers, rows) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}