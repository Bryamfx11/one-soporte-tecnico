import { useState } from 'react';
import { BookOpen, CheckCircle2, XCircle, Gauge, Pencil, Plus, Trash2, Settings2, Search, Wrench } from 'lucide-react';
import { api, getUser, useApi } from '../api.js';
import { Skeleton, SkeletonText, Empty, Modal, ConfirmDialog } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtFecha } from '../utils.js';

const ICONOS = {
  'wifi-off': '📡',
  gauge: '⚡',
  tv: '📺',
  activity: '📉',
  network: '📶'
};
const ICONOS_OPCIONES = ['wifi-off', 'gauge', 'tv', 'activity', 'network'];
const VACIO_TIPO = { modo: 'nuevo', nombre: '', descripcion: '', icono: 'wifi-off' };
const VACIO_CONSULTA = { modo: 'nuevo', orden: '', titulo: '', pregunta: '', instruccion: '', tipo_respuesta: 'si_no', unidad: '', etiqueta_valor: '', referencia: '' };
const VACIO_CAUSA = { modo: 'nuevo', categoria: '', descripcion: '' };

function FormTipo({ inicial, onSubmit, onClose, busy }) {
  const creando = inicial.modo === 'nuevo';
  const [form, setForm] = useState(creando
    ? { nombre: '', descripcion: '', icono: 'wifi-off' }
    : { nombre: inicial.nombre, descripcion: inicial.descripcion, icono: inicial.icono ?? 'wifi-off' });

  return (
    <Modal
      title={creando ? 'Nuevo tipo de falla' : `Editar: ${inicial.nombre}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="form-tipo" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="form-tipo" className="form" onSubmit={(e) => onSubmit(e, form)}>
        <div className="grid form-grid">
          <label>Nombre *<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Sin servicio de internet" autoFocus /></label>
          <label>Ícono<select value={form.icono} onChange={(e) => setForm({ ...form, icono: e.target.value })}>{ICONOS_OPCIONES.map((i) => <option key={i} value={i}>{ICONOS[i]} {i}</option>)}</select></label>
        </div>
        <label>Descripción *<textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Qué reporta el usuario" /></label>
      </form>
    </Modal>
  );
}

function FormConsulta({ inicial, onSubmit, onClose, busy }) {
  const creando = inicial.modo === 'nuevo';
  const [form, setForm] = useState(creando
    ? { orden: '', titulo: '', pregunta: '', instruccion: '', tipo_respuesta: 'si_no', unidad: '', etiqueta_valor: '', referencia: '' }
    : { orden: inicial.orden, titulo: inicial.titulo, pregunta: inicial.pregunta, instruccion: inicial.instruccion, tipo_respuesta: inicial.tipo_respuesta, unidad: inicial.unidad ?? '', etiqueta_valor: inicial.etiqueta_valor ?? '', referencia: inicial.referencia ?? '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      title={creando ? 'Nuevo paso de diagnóstico' : 'Editar paso de diagnóstico'}
      onClose={onClose}
      className="modal-wide"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="form-consulta" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="form-consulta" className="form" onSubmit={(e) => onSubmit(e, form)}>
        <div className="grid form-grid">
          <label>Orden<input type="number" min="0" value={form.orden} onChange={set('orden')} placeholder="Ej: 1" /></label>
          <label>Tipo de respuesta<select value={form.tipo_respuesta} onChange={set('tipo_respuesta')}><option value="si_no">Sí / No</option><option value="si_no_valor">Sí / No + valor medido</option></select></label>
        </div>
        <label>Título *<input value={form.titulo} onChange={set('titulo')} placeholder="Ej: Estado de la ONT" /></label>
        <label>Pregunta *<input value={form.pregunta} onChange={set('pregunta')} placeholder="¿Qué se debe verificar?" /></label>
        <label>Instrucción *<textarea rows={2} value={form.instruccion} onChange={set('instruccion')} placeholder="Pasos concretos de la verificación en campo" /></label>
        <div className="grid form-grid">
          <label>Unidad de medida<input value={form.unidad} onChange={set('unidad')} placeholder="Ej: dBm, Mbps" /></label>
          <label>Etiqueta del valor<input value={form.etiqueta_valor} onChange={set('etiqueta_valor')} placeholder="Ej: Nivel óptico" /></label>
        </div>
        <label>Referencia<textarea rows={2} value={form.referencia} onChange={set('referencia')} placeholder="Valores de referencia esperados" /></label>
      </form>
    </Modal>
  );
}

function FormCausa({ inicial, onSubmit, onClose, busy }) {
  const creando = inicial.modo === 'nuevo';
  const [form, setForm] = useState(creando
    ? { categoria: '', descripcion: '' }
    : { categoria: inicial.categoria, descripcion: inicial.descripcion });

  return (
    <Modal
      title={creando ? 'Nueva causa raíz' : 'Editar causa raíz'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" form="form-causa" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="form-causa" className="form" onSubmit={(e) => onSubmit(e, form)}>
        <label>Categoría *<input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ej: Red externa - Fibra" autoFocus /></label>
        <label>Descripción *<textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Cuándo se aplica esta causa" /></label>
      </form>
    </Modal>
  );
}

function Soluciones({ esAdmin, showToast }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useApi(
    () => api.get(`/checklists/soluciones${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ''}`),
    [debouncedQ]
  );
  const [borrar, setBorrar] = useState(null);

  function onQ(value) {
    setQ(value);
    clearTimeout(window.__solucionesDelay);
    window.__solucionesDelay = setTimeout(() => setDebouncedQ(value.trim()), 350);
  }

  async function eliminar() {
    setBusy(true);
    try {
      await api.del(`/checklists/soluciones/${borrar.id}`);
      showToast('success', 'Solución eliminada.');
      setBorrar(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
      setBorrar(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="kb-header">
        <div>
          <h3><Wrench size={16} /> Soluciones de casos resueltos</h3>
          <p>Procedimientos reales guardados al cerrar incidencias</p>
        </div>
        <div className="search" style={{ minWidth: 260 }}>
          <Search size={16} />
          <input
            aria-label="Buscar soluciones"
            placeholder="Buscar por título, procedimiento o tipo…"
            value={q}
            onChange={(e) => onQ(e.target.value)}
          />
        </div>
      </div>
      {loading ? <SkeletonText lines={3} /> : !data || data.items.length === 0 ? (
        <p className="soft" style={{ marginTop: 12 }}>Sin soluciones registradas todavía. Guárdelas desde el detalle de una incidencia resuelta.</p>
      ) : (
        <ul className="info-list" style={{ marginTop: 12 }}>
          {data.items.map((s) => (
            <li key={s.id}>
              <details className="sol-detalle">
                <summary>
                  <div className="sol-titulo">
                    <strong>{s.titulo}</strong>
                    <span className="mini-badge" style={{ color: '#2563eb', background: '#2563eb1a' }}>{s.tipo_falla}</span>
                  </div>
                  <span className="soft">{s.usuario} · {fmtFecha(s.creada_en)}</span>
                </summary>
                <p className="sol-contenido">{s.contenido}</p>
              </details>
              {esAdmin && (
                <button className="icon-btn" title="Eliminar" onClick={() => setBorrar(s)}><Trash2 size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {borrar && (
        <ConfirmDialog
          title="Eliminar solución"
          message={`¿Eliminar "${borrar.titulo}" de la base de conocimiento?`}
          onCancel={() => setBorrar(null)}
          onConfirm={eliminar}
          busy={busy}
        />
      )}
    </section>
  );
}

function CausasAdmin({ showToast }) {
  const { data: causas, loading, reload } = useApi(() => api.get('/checklists/causas-raiz'), []);
  const [modal, setModal] = useState(null);
  const [borrar, setBorrar] = useState(null);
  const [busy, setBusy] = useState(false);

  async function guardar(e, form) {
    e.preventDefault();
    setBusy(true);
    try {
      if (modal.modo === 'nuevo') {
        await api.post('/checklists/causas-raiz', { categoria: form.categoria.trim(), descripcion: form.descripcion.trim() });
        showToast('success', 'Causa raíz creada.');
      } else {
        await api.patch(`/checklists/causas-raiz/${modal.id}`, { categoria: form.categoria.trim(), descripcion: form.descripcion.trim() });
        showToast('success', 'Causa raíz actualizada.');
      }
      setModal(null);
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
      await api.del(`/checklists/causas-raiz/${borrar.id}`);
      showToast('success', 'Causa raíz eliminada.');
      setBorrar(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
      setBorrar(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="kb-header">
        <div>
          <h3>Causas de cierre</h3>
          <p>Opciones disponibles al finalizar una incidencia</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ ...VACIO_CAUSA })}><Plus size={16} /> Nueva causa</button>
      </div>
      {loading ? <SkeletonText lines={3} /> : (
        <ul className="info-list" style={{ marginTop: 12 }}>
          {(causas ?? []).map((c) => (
            <li key={c.id}>
              <div style={{ flex: 1 }}>
                <strong>{c.categoria}</strong>
                <div className="soft" style={{ fontSize: 13 }}>{c.descripcion}</div>
              </div>
              <button className="icon-btn" title="Editar" onClick={() => setModal(c)}><Pencil size={16} /></button>
              <button className="icon-btn" title="Eliminar" onClick={() => setBorrar(c)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {modal && <FormCausa inicial={modal} onSubmit={guardar} onClose={() => setModal(null)} busy={busy} />}
      {borrar && (
        <ConfirmDialog
          title="Eliminar causa raíz"
          message={`¿Eliminar "${borrar.categoria}"? Solo es posible si no se ha usado en ninguna incidencia.`}
          onCancel={() => setBorrar(null)}
          onConfirm={eliminar}
          busy={busy}
        />
      )}
    </section>
  );
}

export default function Conocimiento() {
  const user = getUser();
  const esAdmin = user?.rol === 'admin';
  const showToast = useToast();
  const { data: checklists, loading, error, reload } = useApi(() => api.get('/checklists'), []);
  const [sel, setSel] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [tipoModal, setTipoModal] = useState(null);
  const [consultaModal, setConsultaModal] = useState(null);
  const [borrar, setBorrar] = useState(null);
  const [busy, setBusy] = useState(false);

  function renderCard(c) {
    return (
      <>
        <div className="kb-icon">{ICONOS[c.icono] ?? <BookOpen size={22} />}</div>
        <h3>{c.nombre}</h3>
        <p>{c.descripcion}</p>
        <span className="kb-count"><Gauge size={14} /> {(c.consultas ?? []).length} pasos de diagnóstico</span>
      </>
    );
  }

  async function guardarTipo(e, form) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tipoModal.modo === 'nuevo') {
        await api.post('/checklists/tipos', { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), icono: form.icono });
        showToast('success', 'Tipo de falla creado.');
      } else {
        await api.patch(`/checklists/tipos/${tipoModal.id}`, { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), icono: form.icono });
        showToast('success', 'Tipo de falla actualizado.');
      }
      setTipoModal(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function guardarConsulta(e, form) {
    e.preventDefault();
    setBusy(true);
    const body = {
      titulo: form.titulo.trim(),
      pregunta: form.pregunta.trim(),
      instruccion: form.instruccion.trim(),
      tipo_respuesta: form.tipo_respuesta,
      unidad: form.unidad.trim() || null,
      etiqueta_valor: form.etiqueta_valor.trim() || null,
      referencia: form.referencia.trim() || null
    };
    if (consultaModal.modo === 'nuevo') {
      if (form.orden !== '' && form.orden !== null) body.orden = Number(form.orden);
    } else {
      body.orden = form.orden === '' ? undefined : Number(form.orden);
    }
    try {
      if (consultaModal.modo === 'nuevo') {
        await api.post(`/checklists/tipos/${sel}/consultas`, body);
        showToast('success', 'Paso de diagnóstico agregado.');
      } else {
        await api.patch(`/checklists/consultas/${consultaModal.id}`, body);
        showToast('success', 'Paso de diagnóstico actualizado.');
      }
      setConsultaModal(null);
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
      if (borrar.modo === 'tipo') {
        await api.del(`/checklists/tipos/${borrar.item.id}`);
        if (sel === borrar.item.id) setSel(null);
        showToast('success', 'Tipo de falla eliminado.');
      } else {
        await api.del(`/checklists/consultas/${borrar.item.id}`);
        showToast('success', 'Paso de diagnóstico eliminado.');
      }
      setBorrar(null);
      reload();
    } catch (err) {
      showToast('error', err.message);
      setBorrar(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <header className="page-head"><Skeleton style={{ width: 240, height: 28 }} /></header>
        <section className="grid three kb-grid">
          {[1, 2, 3].map((i) => (
            <div className="card" key={i}><SkeletonText lines={3} /></div>
          ))}
        </section>
      </div>
    );
  }
  if (error) return <div className="page alert-error">{error}</div>;
  if (!checklists) return <div className="page"><Empty message="Sin datos" /></div>;

  const activo = checklists.find((c) => c.id === sel);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Base de conocimiento</h1>
          <p>Protocolos estandarizados de diagnóstico y atención por tipo de falla</p>
        </div>
        {esAdmin && (
          <button className="btn btn-ghost" onClick={() => setAdmin(!admin)}>
            <Settings2 size={16} /> {admin ? 'Salir de administración' : 'Administrar base'}
          </button>
        )}
      </header>

      {!activo ? (
        <>
          <section className="grid three kb-grid">
            {checklists.map((c) => (
              admin ? (
                <div className="kb-card-wrap" key={c.id}>
                  <button className="card kb-card" onClick={() => setSel(c.id)}>{renderCard(c)}</button>
                  <div className="kb-actions">
                    <button className="btn btn-ghost" onClick={() => setTipoModal(c)}><Pencil size={14} /> Editar</button>
                    <button className="btn btn-danger" onClick={() => setBorrar({ modo: 'tipo', item: c })}><Trash2 size={14} /> Eliminar</button>
                  </div>
                </div>
              ) : (
                <button key={c.id} className="card kb-card" onClick={() => setSel(c.id)}>{renderCard(c)}</button>
              )
            ))}
            {admin && (
              <button className="card kb-card kb-add" onClick={() => setTipoModal({ ...VACIO_TIPO })}>
                <Plus size={22} /> Agregar tipo de falla
              </button>
            )}
          </section>
          <div style={{ marginTop: 16 }}><Soluciones esAdmin={esAdmin} showToast={showToast} /></div>
          {admin && <div style={{ marginTop: 16 }}><CausasAdmin showToast={showToast} /></div>}
        </>
      ) : (
        <section className="card">
          <div className="kb-header">
            <div>
              <h3>{ICONOS[activo.icono] ?? ''} {activo.nombre}</h3>
              <p>{activo.descripcion}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {admin && (
                <button className="btn btn-primary" onClick={() => setConsultaModal({ ...VACIO_CONSULTA })}><Plus size={16} /> Agregar paso</button>
              )}
              <button className="btn btn-ghost" onClick={() => setSel(null)}>← Volver al listado</button>
            </div>
          </div>
          <ol className="kb-steps">
            {(activo.consultas ?? []).map((q, i) => (
              <li key={q.id} className="kb-step">
                <div className="kb-step-num">{i + 1}</div>
                <div className="kb-step-body">
                  <h4>{q.titulo}</h4>
                  <p><strong>Verificar:</strong> {q.pregunta}</p>
                  <p className="soft">{q.instruccion}</p>
                  {q.referencia && (
                    <div className="kb-ref">Referencia: <strong>{q.referencia}</strong></div>
                  )}
                  <div className="kb-icons">
                    <span className="mini-badge" style={{ color: '#10b981' }}><CheckCircle2 size={13} /> Cumple</span>
                    <span className="mini-badge" style={{ color: '#ef4444' }}><XCircle size={13} /> No cumple</span>
                    <span className="mini-badge" style={{ color: '#3b82f6' }}><Gauge size={13} /> Medición en campo</span>
                  </div>
                </div>
                {admin && (
                  <div className="kb-step-actions">
                    <button className="icon-btn" title="Editar" onClick={() => setConsultaModal(q)}><Pencil size={16} /></button>
                    <button className="icon-btn" title="Eliminar" onClick={() => setBorrar({ modo: 'consulta', item: q })}><Trash2 size={16} /></button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {tipoModal && <FormTipo inicial={tipoModal} onSubmit={guardarTipo} onClose={() => setTipoModal(null)} busy={busy} />}
      {consultaModal && <FormConsulta inicial={consultaModal} onSubmit={guardarConsulta} onClose={() => setConsultaModal(null)} busy={busy} />}
      {borrar && (
        <ConfirmDialog
          title={borrar.modo === 'tipo' ? 'Eliminar tipo de falla' : 'Eliminar paso de diagnóstico'}
          message={borrar.modo === 'tipo'
            ? `¿Eliminar "${borrar.item.nombre}" y sus ${(borrar.item.consultas ?? []).length} pasos? Solo es posible si no hay incidencias de ese tipo.`
            : `¿Eliminar el paso "${borrar.item.titulo}"? Solo es posible si no se ha usado en diagnósticos.`}
          onCancel={() => setBorrar(null)}
          onConfirm={eliminar}
          busy={busy}
        />
      )}
    </div>
  );
}