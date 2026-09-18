import { useState } from 'react';
import { Users, ShieldCheck, ShieldX } from 'lucide-react';
import { api, getUser, useApi } from '../api.js';
import { SkeletonTable, Empty } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtFecha } from '../utils.js';

export default function Usuarios() {
  const user = getUser();
  const showToast = useToast();
  const { data: usuarios, loading, error, reload } = useApi(() => api.get('/usuarios'), []);
  const [trabajando, setTrabajando] = useState(0);

  if (loading) return <div className="page"><SkeletonTable rows={4} cols={4} /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;

  async function toggleActivo(u) {
    setTrabajando(u.id);
    try {
      const actualizado = await api.patch(`/usuarios/${u.id}`, { activo: u.activo ? 0 : 1 });
      reload();
      showToast('success', `${actualizado.nombre} ${actualizado.activo ? 'activado' : 'desactivado'}.`);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setTrabajando(0);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1><Users size={20} /> Gestión de usuarios</h1>
          <p>Cuentas con acceso a la plataforma (solo administradores).</p>
        </div>
      </header>

      {!usuarios || usuarios.length === 0 ? (
        <Empty message="No hay usuarios registrados" />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creado</th>
                <th>Acceso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.rol === 'admin' ? 'Administrador' : 'Técnico'}</td>
                  <td>{fmtFecha(u.creado_en)}</td>
                  <td>
                    <button
                      className={`btn ${u.activo ? 'btn-danger' : 'btn-primary'}`}
                      disabled={trabajando === u.id || u.email === user?.email}
                      title={u.email === user?.email ? 'No puedes modificar tu propia cuenta' : (u.activo ? 'Desactivar acceso' : 'Reactivar acceso')}
                      onClick={() => toggleActivo(u)}
                    >
                      {u.activo ? <ShieldX size={16} /> : <ShieldCheck size={16} />}
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}