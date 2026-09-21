import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api, apiGetEstatico, useApi } from '../api.js';
import { Skeleton, SkeletonText } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useDirtyGuard } from '../hooks/useDirtyGuard.js';
import { PRIORIDADES } from '../utils.js';

export default function NuevaIncidencia() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: tipos, loading: loadingTipos, error: errorTipos } = useApi(() => apiGetEstatico('/checklists/tipos'), []);
  const { data: tecnicos } = useApi(() => apiGetEstatico('/tecnicos'), []);

  const [form, setForm] = useState({ cliente: '', telefono: '', email: '', direccion: '', barrio: '', tipo_falla_id: '', prioridad: 'media', tecnico_id: '', sintomas: '', descripcion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = Object.values(form).some((v) => String(v).trim() !== '');
  useDirtyGuard(dirty);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.cliente.trim() || !form.tipo_falla_id) {
      setError('El cliente y el tipo de falla son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/incidents', {
        ...form,
        tipo_falla_id: Number(form.tipo_falla_id),
        tecnico_id: form.tecnico_id ? Number(form.tecnico_id) : null
      });
      showToast('success', `Incidencia ${created.numero_ticket} creada.`);
      navigate(`/incidencias/${created.id}`);
    } catch (err) {
      setError(err.message);
      showToast('error', err.message);
      setSaving(false);
    }
  }

  if (loadingTipos) {
    return (
      <div className="page">
        <header className="page-head"><Skeleton style={{ width: 220, height: 28 }} /></header>
        <div className="card"><SkeletonText lines={6} /></div>
      </div>
    );
  }
  if (errorTipos) return <div className="page alert-error" role="alert">{errorTipos}</div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Nueva incidencia</h1>
          <p>Registro de PQR para atención de soporte técnico</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Volver</button>
      </header>

      <form className="card form" onSubmit={submit}>
        <h3 className="form-title">Datos del cliente</h3>
        <div className="grid form-grid">
          <label>Cliente *<input value={form.cliente} onChange={set('cliente')} placeholder="Nombre completo" autoFocus /></label>
          <label>Teléfono<input value={form.telefono} onChange={set('telefono')} placeholder="3xx xxx xxxx" /></label>
          <label>Dirección<input value={form.direccion} onChange={set('direccion')} placeholder="Calle / Carrera, #" /></label>
          <label>Barrio<input value={form.barrio} onChange={set('barrio')} placeholder="Barrio" /></label>
          <label>Correo del cliente<input type="email" value={form.email} onChange={set('email')} placeholder="cliente@correo.com (recibe avisos de estado)" /></label>
        </div>

        <h3 className="form-title">Datos de la incidencia</h3>
        <div className="grid form-grid">
          <label>Tipo de falla *<select value={form.tipo_falla_id} onChange={set('tipo_falla_id')}><option value="">Seleccione…</option>{tipos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
          <label>Prioridad<select value={form.prioridad} onChange={set('prioridad')}>{Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Técnico asignado<select value={form.tecnico_id} onChange={set('tecnico_id')}><option value="">Sin asignar</option>{tecnicos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
          <label>Síntomas reportados<input value={form.sintomas} onChange={set('sintomas')} placeholder="Resumen breve de lo reportado" /></label>
        </div>
        <label>Descripción<textarea value={form.descripcion} onChange={set('descripcion')} rows={3} placeholder="Descripción completa de la solicitud…" /></label>

        {error && <div className="alert-error">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Crear incidencia'}</button>
        </div>
      </form>
    </div>
  );
}