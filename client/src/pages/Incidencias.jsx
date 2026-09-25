import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, MapPin, Wifi, X } from 'lucide-react';
import { api, apiGetEstatico, useApi } from '../api.js';
import { SkeletonTable, Empty } from '../components/ui.jsx';
import { ESTADOS, ESTADO_COLOR, PRIORIDADES, PRIORIDAD_COLOR, fmtFecha, fmtTiempo } from '../utils.js';

const SLA_LABEL = { ok: 'A tiempo', proximo: 'Por vencer', vencido: 'Vencido' };
const SLA_COLOR = { ok: '#10b981', proximo: '#f59e0b', vencido: '#ef4444' };

export default function Incidencias() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const estado = searchParams.get('estado') ?? '';
  const tipo = searchParams.get('tipo') ?? '';
  const desde = searchParams.get('desde') ?? '';
  const hasta = searchParams.get('hasta') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const [pageSize, setPageSize] = useState(10);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedQ) next.set('q', debouncedQ);
    else next.delete('q');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function changeFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function changePage(p) {
    const next = new URLSearchParams(searchParams);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function limpiarFiltros() {
    setQ('');
    setDebouncedQ('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (tipo) params.set('tipo', tipo);
  if (debouncedQ) params.set('q', debouncedQ);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);
  params.set('limit', pageSize);
  params.set('offset', (page - 1) * pageSize);

  const { data: incidencias, loading, error } = useApi(
    () => api.get(`/incidents?${params.toString()}`),
    [estado, tipo, desde, hasta, debouncedQ, page, pageSize]
  );
  const { data: tipos } = useApi(() => apiGetEstatico('/checklists/tipos'), []);

  const items = incidencias?.items ?? [];
  const total = incidencias?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        <select aria-label="Filtrar por estado" value={estado} onChange={(e) => changeFilter('estado', e.target.value)}>
          <option value="">Estado: todos</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Filtrar por tipo de falla" value={tipo} onChange={(e) => changeFilter('tipo', e.target.value)}>
          <option value="">Tipo de falla: todos</option>
          {tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <label className="fecha-rango">Desde<input type="date" aria-label="Desde" value={desde} onChange={(e) => changeFilter('desde', e.target.value)} /></label>
        <label className="fecha-rango">Hasta<input type="date" aria-label="Hasta" value={hasta} onChange={(e) => changeFilter('hasta', e.target.value)} /></label>
        {(estado || tipo || q || desde || hasta) && (
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
                <th>SLA</th>
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
                  <td>
                    {i.sla ? (
                      <span
                        className="badge"
                        style={{ color: SLA_COLOR[i.sla.estado], background: SLA_COLOR[i.sla.estado] + '1a' }}
                        title={`Meta ${i.sla.meta_horas} h`}
                      >
                        {SLA_LABEL[i.sla.estado]}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{i.tecnico || '—'}</td>
                  <td>{fmtFecha(i.creada_en)}</td>
                  <td>{fmtTiempo(i.tiempo_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="pagination" role="navigation" aria-label="Paginación">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => changePage(page - 1)}>‹ Anterior</button>
          <span className="pagination-info">Página {page} de {totalPages} · {total} registros</span>
          <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Siguiente ›</button>
          <select className="pagination-size" aria-label="Registros por página" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} por página</option>)}
          </select>
        </div>
      )}
    </div>
  );
}