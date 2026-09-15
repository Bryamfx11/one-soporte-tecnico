import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, LogIn } from 'lucide-react';
import { api, setToken, setUser } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
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
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-logo"><Wifi size={24} /></div>
          <h1>ONE Soporte Técnico</h1>
          <p>Plataforma de gestión de soporte · Plan de Mejora N3</p>
        </div>

        <label>Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="usuario@one.com"
            autoFocus
          />
        </label>
        <label>Contraseña
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
          />
        </label>

        {error && <div className="alert-error">{error}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          <LogIn size={16} /> {saving ? 'Ingresando…' : 'Iniciar sesión'}
        </button>

        <div className="login-hint">
          <p><strong>Admin:</strong> admin@one.com / admin123</p>
          <p><strong>Técnico:</strong> bryam@one.com / tecnico123</p>
        </div>
      </form>
    </div>
  );
}