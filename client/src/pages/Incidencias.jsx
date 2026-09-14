import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, MapPin, Wifi } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Spinner, Empty } from '../components/ui.jsx';
import { ESTADOS, ESTADO_COLOR, PRIORIDADES, PRIORIDAD_COLOR, fmtFecha, fmtTiempo } from '../utils.js';

export default function Incidencias() {
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');

  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (tipo) params.set('tipo', tipo);
  if (q) params.set('q', q);

  const { data: incidencias, loading, error, reload } = useApi(
    () => api.get(`/incidents${params.toString() ? '?' + params.toString() : ''}`),
    [estado, tipo, q]
  );
  const { data: tipos } = useApi(() => api.get('/checklists'), []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Incidencias (PQR)</h1>
          <p>{loading ? 'Cargando…' : `${incidencias?.length ?? 0} registros`}</p>
        </div>
        <Link to="/incidencias/nueva" className="btn btn-primary"><Plus size={16} /> Nueva</Link>
      </header>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Buscar por cliente, ticket o barrio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Estado: todos</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo de falla: todos</option>
          {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        {estado && <button className="btn btn-ghost" onClick={() => setEstado('')}>Limpiar</button>}
      </div>

      {loading && <Spinner />}
      {error && <div className="alert-error">{error}</div>}
      {!loading && !error && (!incidencias || incidencias.length === 0) && <Empty message="No hay incidencias que coincidan con el filtro" />}

      {!loading && !error && incidencias && incidencias.length > 0 && (
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
              {incidencias.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => window.location.assign(`/incidencias/${i.id}`)}>
                  <td><Link to={`/incidencias/${i.id}`} className="ticket">{i.numero_ticket}</Link></td>
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