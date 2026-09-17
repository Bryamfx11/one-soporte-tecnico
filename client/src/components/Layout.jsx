import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, BookOpen, BarChart3, Plus, Wifi, LogOut, Menu, X, User, Sun, Moon } from 'lucide-react';
import { getUser, setToken, setUser } from '../api.js';

const THEME_KEY = 'one_theme';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidencias', label: 'Incidencias', icon: ListTodo },
  { to: '/conocimiento', label: 'Base de conocimiento', icon: BookOpen },
  { to: '/indicadores', label: 'Indicadores', icon: BarChart3 }
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);

  function toggleTheme() {
    setDark((d) => !d);
  }

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
          <img className="topbar-logo-img" src="/logo-one.png" alt="" /> ONETec
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
        <div className="brand">
          <img className="brand-logo-img" src="/logo-one.png" alt="Logo ONE Telecomunicaciones" />
          <div>
            <div className="brand-name">ONETec</div>
            <div className="brand-sub">Plan de Mejora N3</div>
          </div>
        </div>

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
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Link to="/incidencias/nueva" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
            <Plus size={16} /> Nueva incidencia
          </Link>
          <button className="theme-toggle" onClick={toggleTheme}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} Tema {dark ? 'claro' : 'oscuro'}
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