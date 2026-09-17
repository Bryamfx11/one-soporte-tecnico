import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wifi, LogIn } from 'lucide-react';
import { api, setToken, setUser } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';
  const [form, setForm] = useState({ email: '', password: '' });
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
      setToken(res.token);
      setUser(res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-logo"><Wifi size={24} /></div>
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
    </div>
  );
}