import { useEffect, useState } from 'react';
import { History, Ticket, Download, Search } from 'lucide-react';
import { api, useApi } from '../api.js';
import { SkeletonTable, Empty } from '../components/ui.jsx';
import { fmtFecha, downloadCSV } from '../utils.js';
import { useToast } from '../components/Toast.jsx';

export const ACCIONES_AUDITORIA = {
  creada: 'Incidencia creada',
  actualizada: 'Incidencia actualizada',
  diagnostico: 'Diagnóstico',
  cierre: 'Cierre',
  eliminada: 'Incidencia eliminada',
  usuario_creado: 'Usuario creado',
  usuario_actualizado: 'Usuario actualizado',
  usuario_desactivado: 'Usuario desactivado',
  usuario_activado: 'Usuario activado',
  config_notificaciones: 'Config. notificaciones',
  config_operacion: 'Config. operativa (SLA/escalamiento)',
  login_exitoso: 'Inicio de sesión',
  login_fallido: 'Intento de acceso fallido',
  tecnico_asignado: 'Técnico asignado',
  nota_creada: 'Nota interna creada',
  solucion_guardada: 'Solución guardada en la base',
  escalamiento_automatico: 'Escalamiento automático',
  twofa_activada: '2FA activada',
  twofa_desactivada: '2FA desactivada'
};

export default function Auditoria() {
  const showToast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [debounced, setDebounced] = useState('');
  const [accion, setAccion] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: eventos, loading, error } = useApi(
    () => api.get(`/auditoria?q=${encodeURIComponent(debounced)}${accion ? `&accion=${encodeURIComponent(accion)}` : ''}`),
    [debounced, accion]
  );

  function exportCSV() {
    const filas = (eventos ?? []).map((e) => [
      fmtFecha(e.creada_en),
      ACCIONES_AUDITORIA[e.accion] ?? e.accion,
      e.usuario,
      e.numero_ticket ?? '',
      e.detalle ?? ''
    ]);
    downloadCSV(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Fecha', 'Acción', 'Usuario', 'Ticket', 'Detalle'], filas);
    showToast('success', 'Auditoría CSV descargada.');
  }

  if (loading && !eventos) return <div className="page"><SkeletonTable rows={6} cols={5} /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1><History size={20} /> Auditoría</h1>
          <p>Historial de movimientos de incidencias, cuentas, accesos y configuración (solo administradores).</p>
        </div>
      </header>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Buscar por usuario, acción, ticket o detalle…"
            aria-label="Buscar en auditoría"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select aria-label="Filtrar por acción" value={accion} onChange={(e) => setAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES_AUDITORIA).map(([valor, label]) => (
            <option key={valor} value={valor}>{label}</option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={exportCSV} disabled={!eventos || eventos.length === 0}>
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {!eventos || eventos.length === 0 ? (
        <Empty message={busqueda || accion ? 'Sin resultados para el filtro' : 'No hay eventos registrados'} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Ticket</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td>{fmtFecha(e.creada_en)}</td>
                  <td>{ACCIONES_AUDITORIA[e.accion] ?? e.accion}</td>
                  <td>{e.usuario}</td>
                  <td>{e.numero_ticket ? <span className="badge"><Ticket size={12} /> {e.numero_ticket}</span> : '—'}</td>
                  <td className="soft">{e.detalle || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}