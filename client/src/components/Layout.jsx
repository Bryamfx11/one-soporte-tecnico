import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, ListTodo, BookOpen, BarChart3, Plus, Wifi, Workflow } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidencias', label: 'Incidencias', icon: ListTodo },
  { to: '/conocimiento', label: 'Base de conocimiento', icon: BookOpen },
  { to: '/indicadores', label: 'Indicadores', icon: BarChart3 }
];

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><Workflow size={22} /></div>
          <div>
            <div className="brand-name">ONE Soporte</div>
            <div className="brand-sub">Plan de Mejora N3</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link to="/incidencias/nueva" className="btn btn-primary btn-block">
            <Plus size={16} /> Nueva incidencia
          </Link>
          <div className="meta">
            <Wifi size={14} /> FTTH · Tunja / Bogotá
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}