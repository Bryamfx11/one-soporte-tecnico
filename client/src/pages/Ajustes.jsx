import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal, Save, RotateCcw, LogOut, User as UserIcon,
  Sun as SunIcon, Moon as MoonIcon, Mail, Send, ShieldCheck, ShieldOff, Webhook as WebhookIcon
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

  const [sla, setSla] = useState(null);
  const [savingSla, setSavingSla] = useState(false);

  const [webhook, setWebhook] = useState(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [probandoWebhook, setProbandoWebhook] = useState(false);

  const [twofaActiva, setTwofaActiva] = useState(null);
  const [twofaPending, setTwofaPending] = useState(null);
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaBusy, setTwofaBusy] = useState(false);

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
    if (user?.rol === 'admin') {
      cargarNotif();
      api.get('/auth/2fa')
        .then((r) => setTwofaActiva(!!r.activa))
        .catch(() => void 0);
      api.get('/ajustes/operacion')
        .then((r) => setSla(r.sla))
        .catch(() => void 0);
      api.get('/webhook/config')
        .then((r) => setWebhook(r))
        .catch(() => void 0);
    }
  }, [user?.rol]);

  async function saveSla(e) {
    e.preventDefault();
    if (!sla) return;
    setSavingSla(true);
    try {
      const saved = await api.put('/ajustes/operacion', {
        alta: Number(sla.alta),
        media: Number(sla.media),
        baja: Number(sla.baja),
        escalamiento: Number(sla.escalamiento)
      });
      setSla(saved.sla);
      showToast('success', 'Metas de atención (SLA) guardadas.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingSla(false);
    }
  }

  async function activar2fa() {
    setTwofaBusy(true);
    try {
      const res = await api.post('/auth/2fa/activate');
      setTwofaPending(res);
      setTwofaCode('');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setTwofaBusy(false);
    }
  }

  async function confirmar2fa(e) {
    e.preventDefault();
    setTwofaBusy(true);
    try {
      await api.post('/auth/2fa/confirm', { secret: twofaPending.secret, code: twofaCode });
      setTwofaActiva(true);
      setTwofaPending(null);
      setTwofaCode('');
      showToast('success', 'Verificación en dos pasos activada. El próximo inicio de sesión pedirá el código.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setTwofaBusy(false);
    }
  }

  async function desactivar2fa(e) {
    e.preventDefault();
    setTwofaBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code: twofaCode });
      setTwofaActiva(false);
      setTwofaCode('');
      showToast('success', 'Verificación en dos pasos desactivada.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setTwofaBusy(false);
    }
  }

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
        fromName: notif.fromName ?? '',
        alertaEmail: notif.alertaEmail ?? '',
        publicUrl: notif.publicUrl ?? ''
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

  async function saveWebhook(e) {
    e.preventDefault();
    if (!webhook) return;
    setSavingWebhook(true);
    try {
      const saved = await api.put('/webhook/config', {
        habilitada: !!webhook.habilitada,
        url: webhook.url ?? '',
        secret: webhook.secretNuevo ?? ''
      });
      setWebhook({ ...saved, secretNuevo: '' });
      showToast('success', 'Configuración del webhook guardada.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSavingWebhook(false);
    }
  }

  async function probarWebhook() {
    setProbandoWebhook(true);
    try {
      const r = await api.post('/webhook/test');
      showToast('success', `Prueba enviada a ${r.url}.`);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setProbandoWebhook(false);
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

      {user?.rol === 'admin' && (
        <section className="card">
          <h3 className="sesion-sec">
            <ShieldCheck size={16} /> Verificación en dos pasos (2FA)
          </h3>

          {twofaActiva === null ? (
            <p className="soft">Consultando el estado de la 2FA…</p>
          ) : twofaActiva ? (
            <div className="field-row">
              <div>
                <span className="badge" style={{ color: '#10b981', background: '#10b9811a' }}>Activa en tu cuenta</span>
                <p className="soft">El inicio de sesión pide ahora un código 6 dígitos de tu app autenticadora.</p>
              </div>
              <div className="twofa-disable">
                <input
                  value={twofaCode}
                  onChange={(e) => setTwofaCode(e.target.value.trim())}
                  placeholder="Código actual"
                  aria-label="Código para desactivar 2FA"
                  maxLength={6}
                  inputMode="numeric"
                />
                <button type="button" className="btn btn-danger" onClick={desactivar2fa} disabled={twofaBusy || twofaCode.length !== 6}>
                  <ShieldOff size={16} /> Desactivar
                </button>
              </div>
            </div>
          ) : twofaPending ? (
            <div className="twofa-setup">
              {twofaPending.qr && <img src={twofaPending.qr} alt="Código QR de 2FA" className="twofa-qr" />}
              <ol>
                <li>Escanea el QR con Google Authenticator, Authy o similar (o agrega manualmente el enlace de abajo).</li>
                <li>Ingresa el código de 6 dígitos que genera la app para confirmar.</li>
              </ol>
              <p className="soft twofa-secret">
                Secreto: <code>{twofaPending.secret}</code>
                <br /><a href={twofaPending.otpauthUrl} className="soft">Abrir enlace otpauth://</a>
              </p>
              <form className="inline-form" onSubmit={confirmar2fa}>
                <input
                  value={twofaCode}
                  onChange={(e) => setTwofaCode(e.target.value.trim())}
                  placeholder="Código de 6 dígitos"
                  aria-label="Código para activar 2FA"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <button className="btn btn-primary" disabled={twofaBusy || twofaCode.length !== 6}>
                  <ShieldCheck size={16} /> {twofaBusy ? 'Activando…' : 'Confirmar y activar'}
                </button>
              </form>
            </div>
          ) : (
            <div className="field-row">
              <p className="soft">Añade una capa extra de seguridad: cada inicio de sesión pedirá un código de tu app autenticadora.</p>
              <button type="button" className="btn btn-primary" onClick={activar2fa} disabled={twofaBusy}>
                <ShieldCheck size={16} /> {twofaBusy ? 'Generando…' : 'Activar 2FA'}
              </button>
            </div>
          )}
        </section>
      )}

      {user?.rol === 'admin' && (
        <section className="card">
          <h3><SlidersHorizontal size={16} /> Metas de atención (SLA) y escalamiento</h3>
          {sla ? (
            <form onSubmit={saveSla}>
              <p className="soft">
                Horas máximas por prioridad antes de marcar el caso como <strong>vencido</strong>. El escalamiento
                automático notifica por correo a los admins cuando un caso abierto no recibe actividad en ese lapso.
              </p>
              <div className="grid three">
                <label>Prioridad alta (h)<input type="number" min="1" max="720" value={sla.alta} onChange={(e) => setSla((s) => ({ ...s, alta: Number(e.target.value) }))} /></label>
                <label>Prioridad media (h)<input type="number" min="1" max="720" value={sla.media} onChange={(e) => setSla((s) => ({ ...s, media: Number(e.target.value) }))} /></label>
                <label>Prioridad baja (h)<input type="number" min="1" max="720" value={sla.baja} onChange={(e) => setSla((s) => ({ ...s, baja: Number(e.target.value) }))} /></label>
                <label>Escalamiento si inactivo (h)<input type="number" min="1" max="720" value={sla.escalamiento} onChange={(e) => setSla((s) => ({ ...s, escalamiento: Number(e.target.value) }))} /></label>
              </div>
              <div className="field-row">
                <button type="submit" className="btn btn-primary" disabled={savingSla}><Save size={16} /> {savingSla ? 'Guardando…' : 'Guardar metas'}</button>
              </div>
            </form>
          ) : (
            <p className="soft">Consultando la configuración operativa…</p>
          )}
        </section>
      )}

      {user?.rol === 'admin' && (
        <section className="card">
          <h3><WebhookIcon size={16} /> Webhook de salida</h3>
          <p className="soft">
            Al crear o cerrar incidencias (y al cambiar su estado), la plataforma envía un <strong>POST</strong> en JSON a la URL
            configurada. Si se define un secreto, cada envío viaja firmado en la cabecera <code>X-ONETec-Signature</code> (HMAC-SHA256).
          </p>
          {webhook ? (
            <form onSubmit={saveWebhook}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!webhook.habilitada}
                  onChange={(e) => setWebhook((w) => ({ ...w, habilitada: e.target.checked }))}
                />
                Webhook activo
              </label>
              <label>URL del webhook
                <input value={webhook.url ?? ''} onChange={(e) => setWebhook((w) => ({ ...w, url: e.target.value }))} placeholder="https://hooks.ejemplo.com/onetec" />
              </label>
              <label>Secreto (vacío para no cambiar)
                <input type="password" autoComplete="new-password" value={webhook.secretNuevo ?? ''} onChange={(e) => setWebhook((w) => ({ ...w, secretNuevo: e.target.value }))} placeholder={webhook.secretConfigurado ? '••••••••' : 'sin secreto'} />
              </label>
              <div className="field-row">
                <button type="submit" className="btn btn-primary" disabled={savingWebhook}><Save size={16} /> {savingWebhook ? 'Guardando…' : 'Guardar webhook'}</button>
                <button type="button" className="btn btn-secondary" disabled={probandoWebhook || !webhook.habilitada} onClick={probarWebhook}><Send size={16} /> {probandoWebhook ? 'Probando…' : 'Enviar prueba'}</button>
              </div>
            </form>
          ) : (
            <p className="soft">Consultando la configuración del webhook…</p>
          )}
        </section>
      )}

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
              <label>Correo de alertas<input type="email" value={notif.alertaEmail ?? ''} onChange={(e) => setNotif((n) => ({ ...n, alertaEmail: e.target.value }))} placeholder="admin@one.com" /></label>
              <label>URL pública (portal)<input value={notif.publicUrl ?? ''} onChange={(e) => setNotif((n) => ({ ...n, publicUrl: e.target.value }))} placeholder="https://soporte.one.co" /></label>
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
