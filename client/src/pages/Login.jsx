import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import { api, setToken, setUser } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [step, setStep] = useState('credenciales');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password) {
      setError('Ingrese email y contraseña.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/auth/login', form);
      if (res.twoFactorRequired) {
        setTwoFactorToken(res.twoFactorToken);
        setStep('2fa');
        setCode('');
        return;
      }
      setToken(res.token);
      setUser(res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Ingrese el código de la aplicación autenticadora.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/auth/2fa/verify', { twoFactorToken, code });
      setToken(res.token);
      setUser(res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (step === '2fa') {
    return (
      <div className="login-wrap">
        <form className="card login-card" onSubmit={submitCode}>
          <div className="login-brand">
            <img className="login-logo-img" src="/logo-one.png" alt="Logo ONE Telecomunicaciones" />
            <h1>Verificación en dos pasos</h1>
            <p>Ingrese el código de 6 dígitos de su aplicación autenticadora.</p>
          </div>

          <label>
            <span>Código 2FA</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.trim()); if (error) setError(''); }}
              placeholder="000000"
              autoFocus
              maxLength={6}
            />
          </label>

          {error && <div className="alert-error" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
            <ShieldCheck size={16} /> {saving ? 'Verificando…' : 'Verificar y entrar'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => { setStep('credenciales'); setTwoFactorToken(''); setError(''); }}
          >
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <img className="login-logo-img" src="/logo-one.png" alt="Logo ONE Telecomunicaciones" />
          <h1>ONETec</h1>
          <p>Plataforma de Soporte Técnico · ONE Telecomunicaciones</p>
        </div>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); if (error) setError(''); }}
            placeholder="usuario@one.com"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label>
          <span>Contraseña</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); if (error) setError(''); }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="alert-error" role="alert">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          <LogIn size={16} /> {saving ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="login-hint portal-login-foot">
        ¿Es cliente y tiene una novedad? <Link to="/reportar">Repórtela aquí</Link>
      </p>
    </div>
  );
}