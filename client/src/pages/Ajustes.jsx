import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal, Save, RotateCcw, LogOut, User as UserIcon,
  Sun as SunIcon, Moon as MoonIcon, Mail, Send
} from 'lucide-react';
import { api, getUser, setToken, setUser } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { fmtFecha } from '../utils.js';

const CRITERIOS_KEY = 'one_criterios';

const CRITERIOS_DEFAULT = {
  tasaMin: 70,      // % mínimo de resolución meta
  tiempoMaxH: 24,   // tiempo máximo de diagnóstico (h)
  escalarH: 26      // umbral de escalamiento a gerencia (h)
};

const CAMPOS = [
  { key: 'tasaMin', label: 'Tasa de resolución mínima', unit: '%', hint: 'Por debajo de esta tasa se marca la meta en riesgo.' },
  { key: 'tiempoMaxH', label: 'Tiempo máximo de diagnóstico', unit: 'h', hint: 'Meta del tiempo promedio para resolver cada incidencia.' },
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
  const [form, setForm] = useState(getCriterios);

  const [notif, setNotif] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [savingNotif, setSavingNotif] = useState(false);
  const [testeando, setTesteando] = useState(false);

  async function cargarNotif() {
    try {
      const [cfg, hist] = await Promise.all([api.get('/notifications/config'), api.get('/notifications/historial')]);
      setNotif(cfg);
      setHistorial(hist);
    } catch {
      void 0;
    }
  }

  useEffect(() => {
    if (user?.rol === 'admin') cargarNotif();
  }, [user?.rol]);

  async function saveNotif(e) {
    e.preventDefault();
    setSavingNotif(true);
    try {
      const saved = await api.put('/notifications/config', {
        habilitada: !!notif.habilitada,
        host: notif.host ?? '',
        port: Number(notif.port) || 587,
        user: notif.user ?? '',
        pass: notif.passNueva ?? '',
        from: notif.from ?? '',
        fromName: notif.fromName ?? ''
      });
      setNotif({ ...saved, passNueva: '' });
      showToast('success', 'Configuración de notificaciones guardada.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingNotif(false);
    }
  }

  async function enviarNotifPrueba() {
    setTesteando(true);
    try {
      const r = await api.post('/notifications/test');
      showToast('success', `Correo de prueba enviado a ${r.destinatario}.`);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setTesteando(false);
    }
  }

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
    } catch {
      void 0;
    }
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
        <p className="soft">Personaliza la apariencia y las metas de servicio.</p>
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
        <h3><SlidersHorizontal size={16} /> Metas de servicio</h3>
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

      {user?.rol === 'admin' && notif && (
        <section className="card">
          <h3><Mail size={16} /> Notificaciones por correo</h3>
          <p className="soft">
            Cuando un ticket cambia de estado, el cliente recibe un correo automático si dejó su dirección y el SMTP
            está configurado. El correo de prueba llega a <strong>{user.email}</strong>.
          </p>
          <form onSubmit={saveNotif}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!notif.habilitada}
                onChange={(e) => setNotif((n) => ({ ...n, habilitada: e.target.checked }))}
              />
              Notificaciones activas
            </label>
            <div className="grid two">
              <label>Servidor SMTP<input value={notif.host ?? ''} onChange={(e) => setNotif((n) => ({ ...n, host: e.target.value }))} placeholder="smtp.gmail.com" /></label>
              <label>Puerto<input type="number" value={notif.port ?? 587} onChange={(e) => setNotif((n) => ({ ...n, port: e.target.value }))} placeholder="587" /></label>
              <label>Usuario SMTP<input autoComplete="off" value={notif.user ?? ''} onChange={(e) => setNotif((n) => ({ ...n, user: e.target.value }))} placeholder="cuenta@correo.com" /></label>
              <label>Contraseña (vacío para no cambiar)<input type="password" autoComplete="new-password" value={notif.passNueva ?? ''} onChange={(e) => setNotif((n) => ({ ...n, passNueva: e.target.value }))} placeholder={notif.passConfigurada ? '••••••••' : 'contraseña'} /></label>
              <label>Correo remitente<input type="email" value={notif.from ?? ''} onChange={(e) => setNotif((n) => ({ ...n, from: e.target.value }))} placeholder="no-reply@one.com" /></label>
              <label>Nombre del remitente<input value={notif.fromName ?? ''} onChange={(e) => setNotif((n) => ({ ...n, fromName: e.target.value }))} placeholder="ONETec" /></label>
            </div>
            <div className="field-row">
              <button type="submit" className="btn btn-primary" disabled={savingNotif}><Save size={16} /> Guardar configuración</button>
              <button type="button" className="btn btn-secondary" disabled={testeando || !notif.configurado} onClick={enviarNotifPrueba}><Send size={16} /> {testeando ? 'Enviando…' : 'Enviar correo de prueba'}</button>
            </div>
          </form>

          <h3 className="mt">Historial de notificaciones</h3>
          {historial.length === 0 ? (
            <p className="soft">Todavía no se han enviado notificaciones.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Ticket</th><th>Destinatario</th><th>Tipo</th><th>Estado</th><th>Detalle</th></tr></thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td>{fmtFecha(h.creada_en)}</td>
                      <td>{h.numero_ticket ?? '—'}</td>
                      <td>{h.destinatario}</td>
                      <td>{h.tipo}</td>
                      <td><span className={`badge notif-${h.estado}`}>{h.estado}</span></td>
                      <td className="soft">{h.error || h.asunto || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
