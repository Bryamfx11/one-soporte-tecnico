import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, MapPin, Wifi, X } from 'lucide-react';
import { api, useApi } from '../api.js';
import { SkeletonTable, Empty } from '../components/ui.jsx';
import { ESTADOS, ESTADO_COLOR, PRIORIDADES, PRIORIDAD_COLOR, fmtFecha, fmtTiempo } from '../utils.js';

export default function Incidencias() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (tipo) params.set('tipo', tipo);
  if (debouncedQ) params.set('q', debouncedQ);

  const { data: incidencias, loading, error, reload } = useApi(
    () => api.get(`/incidents${params.toString() ? '?' + params.toString() : ''}`),
    [estado, tipo, debouncedQ]
  );
  const { data: tipos } = useApi(() => api.get('/checklists/tipos'), []);

  const items = incidencias?.items ?? [];
  const total = incidencias?.total ?? 0;

  function limpiarFiltros() {
    setEstado('');
    setTipo('');
    setQ('');
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Incidencias (PQR)</h1>
          <p>{loading ? 'Cargando…' : `${total} registros`}</p>
        </div>
        <Link to="/incidencias/nueva" className="btn btn-primary"><Plus size={16} /> Nueva</Link>
      </header>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Buscar por cliente, ticket o barrio"
            placeholder="Buscar por cliente, ticket o barrio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Estado: todos</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Filtrar por tipo de falla" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo de falla: todos</option>
          {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        {(estado || tipo || q) && (
          <button className="btn btn-ghost" onClick={limpiarFiltros}><X size={14} /> Limpiar</button>
        )}
      </div>

      {loading && <SkeletonTable rows={5} cols={7} />}
      {error && <div className="alert-error" role="alert">{error}</div>}
      {!loading && !error && items.length === 0 && <Empty message="No hay incidencias que coincidan con el filtro" />}

      {!loading && !error && items.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Cliente</th>
                <th>Tipo de falla</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Técnico</th>
                <th>Creada</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => navigate(`/incidencias/${i.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/incidencias/${i.id}`);
                    }
                  }}
                >
                  <td><Link to={`/incidencias/${i.id}`} className="ticket" onClick={(e) => e.stopPropagation()}>{i.numero_ticket}</Link></td>
                  <td>
                    <strong>{i.cliente}</strong>
                    <div className="sub"><MapPin size={12} /> {i.barrio || '—'}</div>
                  </td>
                  <td><span className="tipo-cell"><Wifi size={14} /> {i.tipo_falla}</span></td>
                  <td><span className="badge" style={{ color: PRIORIDAD_COLOR[i.prioridad], background: PRIORIDAD_COLOR[i.prioridad] + '1a' }}>{PRIORIDADES[i.prioridad]}</span></td>
                  <td><span className="badge" style={{ color: ESTADO_COLOR[i.estado], background: ESTADO_COLOR[i.estado] + '1a' }}>{ESTADOS[i.estado]}</span></td>
                  <td>{i.tecnico || '—'}</td>
                  <td>{fmtFecha(i.creada_en)}</td>
                  <td>{fmtTiempo(i.tiempo_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}