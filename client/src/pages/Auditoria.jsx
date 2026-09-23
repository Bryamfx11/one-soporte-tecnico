import { History, Ticket } from 'lucide-react';
import { api, useApi } from '../api.js';
import { SkeletonTable, Empty } from '../components/ui.jsx';
import { fmtFecha } from '../utils.js';

const ACCIONES = {
  creada: 'Incidencia creada',
  actualizada: 'Incidencia actualizada',
  diagnostico: 'Diagnóstico',
  cierre: 'Cierre',
  eliminada: 'Incidencia eliminada',
  usuario_creado: 'Usuario creado',
  usuario_actualizado: 'Usuario actualizado',
  usuario_desactivado: 'Usuario desactivado',
  usuario_activado: 'Usuario activado',
  config_notificaciones: 'Config. notificaciones'
};

export default function Auditoria() {
  const { data: eventos, loading, error } = useApi(() => api.get('/auditoria'), []);

  if (loading) return <div className="page"><SkeletonTable rows={6} cols={5} /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1><History size={20} /> Auditoría</h1>
          <p>Historial de movimientos de incidencias, cuentas y configuración (solo administradores).</p>
        </div>
      </header>

      {!eventos || eventos.length === 0 ? (
        <Empty message="No hay eventos registrados" />
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
                  <td>{ACCIONES[e.accion] ?? e.accion}</td>
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