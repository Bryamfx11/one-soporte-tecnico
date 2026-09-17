import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal, Save, RotateCcw, LogOut, User as UserIcon,
  Sun as SunIcon, Moon as MoonIcon
} from 'lucide-react';
import { getUser, setToken, setUser } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useTheme } from '../hooks/useTheme.js';

const CRITERIOS_KEY = 'one_criterios';

const CRITERIOS_DEFAULT = {
  tasaMin: 70,      // % mínimo de resolución objetivo
  tiempoMaxH: 24,   // tiempo objetivo de diagnóstico (h)
  escalarH: 26      // umbral de escalamiento a gerencia (h)
};

const CAMPOS = [
  { key: 'tasaMin', label: 'Tasa de resolución mínima', unit: '%', hint: 'Por debajo de esta tasa se marca el objetivo en riesgo.' },
  { key: 'tiempoMaxH', label: 'Tiempo objetivo de diagnóstico', unit: 'h', hint: 'Meta del tiempo promedio para resolver cada incidencia.' },
  { key: 'escalarH', label: 'Umbral de escalamiento', unit: 'h', hint: 'A partir de este tiempo sin resolver, la incidencia se escala a gerencia.' }
];

function getCriterios() {
  try {
    const raw = localStorage.getItem(CRITERIOS_KEY);
    if (!raw) return { ...CRITERIOS_DEFAULT };
    return { ...CRITERIOS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...CRITERIOS_DEFAULT };
  }
}

export default function Ajustes() {
  const navigate = useNavigate();
  const showToast = useToast();
  const user = getUser();
  const { dark, toggle: toggleTheme } = useTheme();

  function onNum(key, e) {
    const v = Number(e.target.value);
    setForm((f) => ({ ...f, [key]: Number.isFinite(v) && v >= 0 ? v : 0 }));
  }

  function save(e) {
    e.preventDefault();
    try {
      localStorage.setItem(CRITERIOS_KEY, JSON.stringify(form));
      showToast('success', 'Criterios guardados correctamente.');
    } catch {
      showToast('error', 'No se pudieron guardar los criterios.');
    }
  }

  function reset() {
    setForm({ ...CRITERIOS_DEFAULT });
    try {
      localStorage.removeItem(CRITERIOS_KEY);
    } catch {}
    showToast('info', 'Criterios restablecidos a los valores por defecto.');
  }

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1><SlidersHorizontal size={20} /> Ajustes</h1>
        <p className="soft">Personaliza la apariencia y los criterios del plan de mejora.</p>
      </header>

      <section className="card">
        <h3><SlidersHorizontal size={16} /> Apariencia</h3>
        <div className="field-row">
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-pressed={dark}>
            {dark ? <SunIcon size={16} /> : <MoonIcon size={16} />} Tema {dark ? 'claro' : 'oscuro'}
          </button>
          <span className="soft">Se aplica en toda la plataforma y queda guardado.</span>
        </div>
      </section>

      <section className="card">
        <h3><SlidersHorizontal size={16} /> Criterios del plan de mejora</h3>
        <form onSubmit={save}>
          {CAMPOS.map(({ key, label, unit, hint }) => (
            <div className="field" key={key}>
              <label htmlFor={`cfg-${key}`}>{label}</label>
              <div className="field-inline">
                <input
                  id={`cfg-${key}`}
                  className="input input-narrow"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form[key] ?? CRITERIOS_DEFAULT[key]}
                  onChange={onNum.bind(null, key)}
                />
                <span className="unit">{unit}</span>
              </div>
              <p className="soft">{hint}</p>
            </div>
          ))}
          <div className="field-row">
            <button type="submit" className="btn btn-primary"><Save size={16} /> Guardar criterios</button>
            <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Restablecer</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3><UserIcon size={16} /> Sesión</h3>
        <div className="field-row">
          <div>
            <strong>{user?.nombre ?? 'Usuario'}</strong>
            <div className="soft">{user?.rol ?? ''} · {user?.email ?? ''}</div>
          </div>
          <button type="button" className="btn btn-danger" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>
        </div>
      </section>
    </div>
  );
}
