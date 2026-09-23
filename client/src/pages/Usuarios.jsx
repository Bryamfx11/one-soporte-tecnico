import { useState } from 'react';
import { Users, ShieldCheck, ShieldX, Plus } from 'lucide-react';
import { api, getUser, useApi } from '../api.js';
import { SkeletonTable, Empty, Modal } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtFecha } from '../utils.js';

const VACIO_FORM = { nombre: '', email: '', password: '', rol: 'tecnico' };

function FormNuevoUsuario({ onSubmit, onClose, busy }) {
  const [form, setForm] = useState(VACIO_FORM);
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    if (form.nombre.trim().length < 2) return setError('Indique el nombre (mínimo 2 caracteres).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setError('Indique un email válido.');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    onSubmit(form);
  }

  return (
    <Modal
      title="Nuevo usuario"
      subtitle="Cuenta con acceso a la plataforma y su rol"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="form-nuevo-usuario" className="btn btn-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button>
        </>
      }
    >
      <form id="form-nuevo-usuario" className="form" onSubmit={submit}>
        <label>Nombre *<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Laura Gómez" autoFocus /></label>
        <label>Correo *<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@one.com" autoComplete="off" /></label>
        <label>Contraseña *<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></label>
        <label>Rol *<select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
          <option value="tecnico">Técnico</option>
          <option value="admin">Administrador</option>
        </select></label>
        {error && <div className="alert-error" role="alert">{error}</div>}
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const user = getUser();
  const showToast = useToast();
  const { data: usuarios, loading, error, reload } = useApi(() => api.get('/usuarios'), []);
  const [trabajando, setTrabajando] = useState(0);
  const [creando, setCreando] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function crearUsuario(form) {
    setBusy(true);
    try {
      const res = await api.post('/auth/register', {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
        rol: form.rol
      });
      setCreando(false);
      reload();
      showToast('success', `Usuario ${res.user.nombre} creado (${res.user.rol === 'admin' ? 'Administrador' : 'Técnico'}).`);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1><Users size={20} /> Gestión de usuarios</h1>
          <p>Cuentas con acceso a la plataforma (solo administradores).</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreando(true)}>
          <Plus size={16} /> Nuevo usuario
        </button>
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
      {creando && <FormNuevoUsuario onSubmit={crearUsuario} onClose={() => setCreando(false)} busy={busy} />}
    </div>
  );
}