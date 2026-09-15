import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, BookOpen, BarChart3, Plus, Wifi, Workflow, LogOut, Menu, X, User } from 'lucide-react';
import { getUser, setToken, setUser } from '../api.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidencias', label: 'Incidencias', icon: ListTodo },
  { to: '/conocimiento', label: 'Base de conocimiento', icon: BookOpen },
  { to: '/indicadores', label: 'Indicadores', icon: BarChart3 }
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  return (
    <div className="layout">
      <div className="topbar">
        <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="topbar-brand">
          <Wifi size={16} /> ONE Soporte
        </div>
        <button className="icon-btn logout-btn" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo"><Workflow size={22} /></div>
          <div>
            <div className="brand-name">ONE Soporte</div>
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

        <nav className="nav">
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
          <div className="meta">
            <Wifi size={14} /> FTTH · Tunja / Bogotá
          </div>
        </div>
      </aside>

      {open && <div className="overlay-mobile" onClick={() => setOpen(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}