import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, BookOpen, BarChart3, Plus, Wifi, LogOut, Menu, X, User, Sun, Moon, Settings, Users } from 'lucide-react';
import { api, getUser, setToken, setUser, useApi } from '../api.js';
import { useLiveData } from '../sse.js';
import { useTheme } from '../hooks/useTheme.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidencias', label: 'Incidencias', icon: ListTodo },
  { to: '/conocimiento', label: 'Base de conocimiento', icon: BookOpen },
  { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icon: Settings }
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const user = getUser();
  const { data: metrica, reload: reloadMetrica } = useApi(() => api.get('/metrics/dashboard'), []);
  useLiveData(reloadMetrica);
  const pendientes = (metrica?.nueva ?? 0) + (metrica?.en_diagnostico ?? 0);

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <div className="topbar">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Abrir menú" aria-expanded={open} aria-controls="sidebar-nav">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="topbar-brand">
          <Link to="/" className="brand-link" aria-label="Ir al inicio"><img className="topbar-logo-img" src="/logo-one.png" alt="" /> ONETec</Link>
        </div>
        <div className="topbar-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn logout-btn" onClick={logout} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand" aria-label="Ir al inicio">
          <img className="brand-logo-img" src="/logo-one.png" alt="Logo ONE Telecomunicaciones" />
          <div>
            <div className="brand-name">ONETec</div>
            <div className="brand-sub">Soporte Técnico y Redes</div>
          </div>
        </Link>

        <div className="sidebar-user">
          <User size={16} />
          <div>
            <div className="sidebar-user-name">{user?.nombre ?? 'Usuario'}</div>
            <div className="sidebar-user-rol">{user?.rol ?? ''}</div>
          </div>
        </div>

        <nav id="sidebar-nav" className="nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>
              <Icon size={18} />
              <span>{label}</span>
              {to === '/incidencias' && pendientes > 0 && (
                <span className="nav-badge" title="Nuevas + en diagnóstico">{pendientes}</span>
              )}
            </NavLink>
          ))}
          {user?.rol === 'admin' && (
            <NavLink to="/usuarios" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>
              <Users size={18} />
              <span>Usuarios</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-foot">
          <Link to="/incidencias/nueva" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
            <Plus size={16} /> Nueva incidencia
          </Link>
          <button className="theme-toggle" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} Tema {dark ? 'claro' : 'oscuro'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={logout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
          <div className="meta">
            <Wifi size={14} /> FTTH · Tunja / Bogotá
          </div>
        </div>
      </aside>

      {open && <div className="overlay-mobile" onClick={() => setOpen(false)} />}

      <main id="main-content" className="content">
        <Outlet />
      </main>
    </div>
  );
}