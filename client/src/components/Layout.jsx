import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ListTodo, BookOpen, BarChart3, Plus, Wifi, LogOut, Menu, X, User, Sun, Moon, Settings, Users, HardHat, CalendarRange, History, Bell, CheckCheck } from 'lucide-react';
import { api, getUser, setToken, setUser, useApi } from '../api.js';
import { useLiveData } from '../sse.js';
import { useTheme } from '../hooks/useTheme.js';
import { fmtFecha } from '../utils.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidencias', label: 'Incidencias', icon: ListTodo },
  { to: '/conocimiento', label: 'Base de conocimiento', icon: BookOpen },
  { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
  { to: '/comparativo', label: 'Comparativo', icon: CalendarRange },
  { to: '/ajustes', label: 'Ajustes', icon: Settings }
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const user = getUser();
  const { data: metrica, reload: reloadMetrica } = useApi(() => api.get('/metrics/pendientes'), []);
  const [campanaAbierta, setCampanaAbierta] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [notificaciones, setNotificaciones] = useState([]);
  useLiveData(reloadMetrica, {
    onNotificacion: (n) => {
      setNoLeidas((c) => c + 1);
      setNotificaciones((prev) => [n, ...prev].slice(0, 50));
    }
  });
  const pendientes = metrica?.pendientes ?? 0;

  useEffect(() => {
    api.get('/notificaciones-app')
      .then((d) => {
        setNotificaciones(d.items ?? []);
        setNoLeidas(d.no_leidas ?? 0);
      })
      .catch(() => void 0);
  }, []);

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

  useEffect(() => {
    if (!campanaAbierta) return;
    function onClickFuera(e) {
      if (!e.target.closest('.campana-wrap')) setCampanaAbierta(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setCampanaAbierta(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      document.removeEventListener('keydown', onKey);
    };
  }, [campanaAbierta]);

  async function abrirNotificacion(n) {
    if (!n.leida) {
      setNoLeidas((c) => Math.max(0, c - 1));
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: 1 } : x)));
      try {
        await api.patch(`/notificaciones-app/${n.id}/leer`);
      } catch {
        void 0;
      }
    }
    setCampanaAbierta(false);
    if (n.incidencia_id) navigate(`/incidencias/${n.incidencia_id}`);
  }

  async function leerTodas() {
    setNoLeidas(0);
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: 1 })));
    try {
      await api.post('/notificaciones-app/leer-todas');
    } catch {
      void 0;
    }
  }

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
          <div className="campana-wrap">
            <button className="icon-btn campana-toggle" onClick={() => setCampanaAbierta(!campanaAbierta)} aria-label="Notificaciones" aria-expanded={campanaAbierta}>
              <Bell size={18} />
              {noLeidas > 0 && <span className="campana-badge">{noLeidas > 99 ? '99+' : noLeidas}</span>}
            </button>
          </div>
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
            <>
              <NavLink to="/tecnicos" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>
                <HardHat size={18} />
                <span>Técnicos</span>
              </NavLink>
              <NavLink to="/usuarios" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>
                <Users size={18} />
                <span>Usuarios</span>
              </NavLink>
              <NavLink to="/auditoria" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} onClick={() => setOpen(false)}>
                <History size={18} />
                <span>Auditoría</span>
              </NavLink>
            </>
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
          <div className="sidebar-foot-acciones">
            <div className="campana-wrap">
              <button className="btn btn-ghost btn-block campana-toggle" onClick={() => setCampanaAbierta(!campanaAbierta)} aria-label="Notificaciones" aria-expanded={campanaAbierta}>
                <Bell size={16} /> Notificaciones {noLeidas > 0 && <span className="campana-badge">{noLeidas > 99 ? '99+' : noLeidas}</span>}
              </button>
            </div>
          </div>
          <div className="meta">
            <Wifi size={14} /> FTTH · Tunja / Bogotá
          </div>
        </div>
      </aside>

      {open && <div className="overlay-mobile" onClick={() => setOpen(false)} />}

      <div className="campana-wrap campana-float">
        {campanaAbierta && (
          <div className="campana" role="region" aria-label="Panel de notificaciones">
            <div className="campana-head">
              <strong>Notificaciones</strong>
              {noLeidas > 0 && (
                <button type="button" className="btn-link campana-todas" onClick={leerTodas}><CheckCheck size={14} /> Marcar todas como leídas</button>
              )}
            </div>
            {notificaciones.length === 0 ? (
              <p className="campana-vacia soft">Sin notificaciones por ahora.</p>
            ) : (
              <ul className="campana-lista">
                {notificaciones.map((n) => (
                  <li key={n.id} className={'campana-item' + (n.leida ? '' : ' no-leida')}>
                    <button type="button" className="campana-btn" onClick={() => abrirNotificacion(n)}>
                      <span className="campana-titulo">{n.titulo}</span>
                      {n.cuerpo && <span className="campana-cuerpo">{n.cuerpo}</span>}
                      <span className="soft campana-fecha">{fmtFecha(n.creada_en)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <main id="main-content" className="content">
        <Outlet />
      </main>
    </div>
  );
}