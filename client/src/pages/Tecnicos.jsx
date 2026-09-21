import { useState } from 'react';
import { HardHat, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Modal, ConfirmDialog, SkeletonTable, Empty } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const NUEVO = { modo: 'nuevo', nombre: '', rol: 'Técnico de Campo' };

function FormTecnico({ inicial, onSubmit, onClose, busy }) {
  const creando = inicial.modo === 'nuevo';
  const [form, setForm] = useState(creando ? { nombre: '', rol: inicial.rol } : { nombre: inicial.nombre, rol: inicial.rol });

  return (
    <Modal
      title={creando ? 'Nuevo técnico' : `Editar a ${inicial.nombre}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="form-tecnico" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="form-tecnico" className="form" onSubmit={(e) => onSubmit(e, form)}>
        <div className="grid form-grid">
          <label>Nombre <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del técnico" autoFocus /></label>
          <label>Rol / cargo <input value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} placeholder="Ej: Técnico de Campo" /></label>
        </div>
      </form>
    </Modal>
  );
}

export default function Tecnicos() {
  const showToast = useToast();
  const { data: tecnicos, loading, error, reload } = useApi(() => api.get('/tecnicos'), []);
  const [editando, setEditando] = useState(null);
  const [borrar, setBorrar] = useState(null);
  const [busy, setBusy] = useState(false);

  async function guardar(e, form) {
    e.preventDefault();
    if (!form.nombre.trim() || form.nombre.trim().length < 2) {
      showToast('error', 'El nombre debe tener al menos 2 caracteres.');
      return;
    }
    setBusy(true);
    try {
      if (editando.modo === 'nuevo') {
        await api.post('/tecnicos', { nombre: form.nombre.trim(), rol: form.rol.trim() });
        showToast('success', 'Técnico creado.');
      } else {
        await api.patch(`/tecnicos/${editando.id}`, { nombre: form.nombre.trim(), rol: form.rol.trim() });
        showToast('success', 'Técnico actualizado.');
      }
      setEditando(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    setBusy(true);
    try {
      await api.del(`/tecnicos/${borrar.id}`);
      showToast('success', `${borrar.nombre} eliminado.`);
      setBorrar(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
      setBorrar(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><SkeletonTable rows={4} cols={3} /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1><HardHat size={20} /> Técnicos</h1>
          <p>Personal de soporte asignable a incidencias (solo administradores).</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditando({ ...NUEVO })}><Plus size={16} /> Nuevo técnico</button>
      </header>

      {!tecnicos || tecnicos.length === 0 ? (
        <Empty message="No hay técnicos registrados" />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Rol / cargo</th>
                <th className="td-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tecnicos.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.nombre}</strong></td>
                  <td>{t.rol}</td>
                  <td className="td-actions">
                    <button className="icon-btn" title="Editar" onClick={() => setEditando(t)}><Pencil size={16} /></button>
                    <button className="icon-btn" title="Eliminar" onClick={() => setBorrar(t)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormTecnico inicial={editando} onSubmit={guardar} onClose={() => setEditando(null)} busy={busy} />
      )}

      {borrar && (
        <ConfirmDialog
          title="Eliminar técnico"
          message={`¿Eliminar a ${borrar.nombre}? Solo es posible si no tiene incidencias asignadas.`}
          onCancel={() => setBorrar(null)}
          onConfirm={eliminar}
          busy={busy}
        />
      )}
    </div>
  );
}