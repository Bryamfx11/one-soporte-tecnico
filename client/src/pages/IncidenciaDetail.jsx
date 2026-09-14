import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, User, MapPin, Phone, ClipboardList, Play, Save, X,
  ChevronLeft, ChevronRight, CheckCircle2, ArrowRightCircle, Wrench
} from 'lucide-react';
import { api, useApi } from '../api.js';
import { Spinner, Badge } from '../components/ui.jsx';
import { ESTADOS, ESTADO_COLOR, PRIORIDADES, PRIORIDAD_COLOR, fmtFecha, fmtTiempo } from '../utils.js';

export default function IncidenciaDetail() {
  const { id } = useParams();
  const { data: inc, loading, error, reload } = useApi(() => api.get(`/incidents/${id}`), [id]);
  const { data: causas } = useApi(() => api.get('/checklists/causas-raiz'), []);
  const { data: tecnicos } = useApi(() => api.get('/tecnicos'), []);

  const { data: checklist, loading: loadingChecklist } = useApi(
    () => (inc ? api.get(`/checklists/${inc.tipo_falla_id}`) : Promise.resolve(null)),
    [inc?.tipo_falla_id]
  );

  const [wizardOpen, setWizardOpen] = useState(false);
  const [tecnicoSel, setTecnicoSel] = useState('');
  const [savingTec, setSavingTec] = useState(false);

  useEffect(() => {
    if (inc && (inc.tecnico_id ?? '') !== '') setTecnicoSel(inc.tecnico_id);
  }, [inc?.tecnico_id]);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page alert-error">{error}</div>;
  if (!inc) return <div className="page">Incidencia no encontrada</div>;

  const puedeDiagnosticar = inc.estado === 'nueva' || inc.estado === 'en_diagnostico';

  async function asignaTecnico(e) {
    e.preventDefault();
    setSavingTec(true);
    await api.patch(`/incidents/${inc.id}`, { tecnico_id: tecnicoSel ? Number(tecnicoSel) : null });
    setSavingTec(false);
    reload();
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="breadcrumbs">
            <Link to="/incidencias">Incidencias</Link> / {inc.numero_ticket}
          </div>
          <h1>{inc.numero_ticket} · <span className="muted">{inc.tipo_falla}</span></h1>
          <p>Cliente: <strong>{inc.cliente}</strong></p>
        </div>
        <div className="head-right">
          <Badge color={ESTADO_COLOR[inc.estado]}>{ESTADOS[inc.estado]}</Badge>
          <Badge color={PRIORIDAD_COLOR[inc.prioridad]}>Prioridad {PRIORIDADES[inc.prioridad]}</Badge>
        </div>
      </header>

      <section className="grid two">
        <div className="card">
          <h3>Información del cliente</h3>
          <ul className="info-list">
            <li><User size={16} /> {inc.cliente}</li>
            <li><Phone size={16} /> {inc.telefono || '—'}</li>
            <li><MapPin size={16} /> {inc.direccion || '—'}, {inc.barrio || '—'}</li>
          </ul>
          <h3 className="mt">Síntomas reportados</h3>
          <p className="soft">{inc.sintomas || '—'}</p>
          <h3 className="mt">Descripción</h3>
          <p className="soft">{inc.descripcion || '—'}</p>
        </div>

        <div className="card">
          <h3>Gestión del caso</h3>
          <form className="inline-form" onSubmit={asignaTecnico}>
            <select value={tecnicoSel} onChange={(e) => setTecnicoSel(e.target.value)}>
              <option value="">Sin técnico asignado</option>
              {tecnicos?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button className="btn btn-secondary" disabled={savingTec}>{savingTec ? '…' : 'Asignar'}</button>
          </form>

          <div className="info-grid">
            <div><span className="label">Creada</span>{fmtFecha(inc.creada_en)}</div>
            <div><span className="label">Resuelta</span>{fmtFecha(inc.resuelta_en)}</div>
            <div><span className="label">Tiempo de atención</span>{fmtTiempo(inc.tiempo_ms)}</div>
            <div><span className="label">Técnico</span>{inc.tecnico || '—'}</div>
          </div>

          {inc.estado === 'resuelta' || inc.estado === 'escalada' ? (
            <div className="result-box">
              <h4>Resultado</h4>
              <p><strong>Causa raíz:</strong> {inc.causa_raiz_cat || '—'}</p>
              <p><strong>Solución aplicada:</strong> {inc.solucion_aplicada || '—'}</p>
              <p><strong>Conclusión:</strong> {inc.estado === 'resuelta' ? 'Caso resuelto con el protocolo estandarizado' : 'Caso escalado a nivel superior por no resolverse en sitio'}</p>
            </div>
          ) : (
            <button className="btn btn-primary btn-block mt" onClick={() => setWizardOpen(true)}>
              <Play size={16} /> Iniciar diagnóstico guiado
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h3>Historial de diagnóstico</h3>
        {(!inc.respuestas || inc.respuestas.length === 0) ? (
          <p className="soft">Aún no se han registrado respuestas del checklist de diagnóstico.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Consulta</th><th>Respuesta</th><th>Resultado</th></tr></thead>
              <tbody>
                {inc.respuestas.map((r, i) => {
                  const ok = r.cumple == null ? null : r.cumple === 1;
                  return (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{r.consulta_id && checklist ? checklist.consultas.find((c) => c.id === r.consulta_id)?.titulo ?? `Consulta ${r.consulta_id}` : r.consulta_id}</td>
                      <td>{r.respuesta || '—'}</td>
                      <td>{ok == null ? '—' : ok ? <span className="badge" style={{ color: '#10b981', background: '#10b9811a' }}>OK</span> : <span className="badge" style={{ color: '#ef4444', background: '#ef44441a' }}>Falla</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {wizardOpen && (
        <DiagnosticoWizard
          inc={inc}
          checklist={checklist}
          causas={causas}
          onClose={() => setWizardOpen(false)}
          onSaved={() => { setWizardOpen(false); reload(); }}
        />
      )}
    </div>
  );
}

function DiagnosticoWizard({ inc, checklist, causas, onClose, onSaved }) {
  const existing = useMemo(() => {
    const m = {};
    for (const r of inc.respuestas ?? []) m[r.consulta_id] = { respuesta: r.respuesta || 'si', cumple: r.cumple };
    return m;
  }, [inc.respuestas]);

  const consultas = checklist?.consultas ?? [];
  const [paso, setPaso] = useState(0);
  const [resp, setResp] = useState(existing);
  const [causaId, setCausaId] = useState('');
  const [solucion, setSolucion] = useState('');
  const [resultado, setResultado] = useState('resuelta');
  const [guardado, setGuardado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = consultas.length;
  const actual = consultas[paso];

  function setActual(part) {
    setResp((r) => ({ ...r, [actual.id]: { ...r[actual.id], ...part } }));
  }

  async function guardar(finalizar) {
    setSaving(true);
    setError('');
    try {
      const payload = consultas.map((c) => {
        const v = resp[c.id] ?? {};
        return { consulta_id: c.id, respuesta: v.respuesta ?? '', cumple: v.cumple ?? null };
      });
      await api.post(`/incidents/${inc.id}/diagnostico`, { respuestas: payload });
      if (finalizar) {
        if (!causaId) {
          setError('Debe seleccionar la causa raíz para finalizar el caso.');
          setSaving(false);
          return;
        }
        await api.post(`/incidents/${inc.id}/finalizar`, {
          estado: resultado,
          causa_raiz_id: Number(causaId),
          solucion_aplicada: solucion
        });
      }
      setGuardado(true);
      setTimeout(onSaved, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (guardado) {
    return (
      <Modal title={`Diagnóstico ${resultado === 'resuelta' ? 'finalizado' : 'escAlado'}`} onClose={onClose}>
        <div className="done-box">
          <CheckCircle2 size={42} color="#10b981" />
          <p>Respuestas guardadas y caso {resultado === 'resuelta' ? 'resuelto' : 'escalado'} con éxito.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Diagnóstico guiado · ${inc.numero_ticket}`}
      subtitle={checklist?.nombre ?? ''}
      onClose={onClose}
      footer={
        <>
          {paso > 0 && <button className="btn btn-ghost" onClick={() => setPaso(paso - 1)}><ChevronLeft size={16} /> Anterior</button>}
          {paso < total - 1
            ? <button className="btn btn-primary" onClick={() => setPaso(paso + 1)}>Siguiente <ChevronRight size={16} /></button>
            : <button className="btn btn-secondary" onClick={() => guardar(false)} disabled={saving}><Save size={16} /> Guardar avance</button>}
        </>
      }
    >
      {total === 0 ? (
        <p>El tipo de falla no tiene consultas configuradas.</p>
      ) : (
        <div className="wizard">
          <div className="progress">
            <div className="progress-fill" style={{ width: `${((paso + 1) / total) * 100}%` }} />
          </div>
          <div className="wizard-step-info">Paso {paso + 1} de {total} · {actual.titulo}</div>
          <h4 className="wizard-q">{actual.pregunta}</h4>
          <div className="wizard-inst">📋 {actual.instruccion}</div>
          {actual.referencia && <div className="wizard-ref">Referencia esperada: <strong>{actual.referencia}</strong></div>}

          {actual.tipo_respuesta === 'si_no' ? (
            <div className="choice-row">
              {[['si', 'Sí / OK'], ['no', 'No / Falla']].map(([val, label]) => (
                <button
                  key={val}
                  className={`choice ${(resp[actual.id]?.respuesta ?? '') === val ? 'selected' : ''}`}
                  onClick={() => setResp((r) => ({ ...r, [actual.id]: { cumple: val === 'si' ? 1 : 0, respuesta: val } }))}
                >
                  {val === 'si' ? <CheckCircle2 size={18} /> : <X size={18} />}
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="value-box">
              <label>{actual.etiqueta_valor ?? 'Valor medido'}{actual.unidad ? ` (${actual.unidad})` : ''}</label>
              <input
                value={resp[actual.id]?.respuesta ?? ''}
                onChange={(e) => setResp((r) => ({ ...r, [actual.id]: { ...r[actual.id], respuesta: e.target.value } }))}
                placeholder={`Ingrese el valor (${actual.unidad ?? 'medida'})`}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={(resp[actual.id]?.cumple ?? 0) === 1}
                  onChange={(e) => setResp((r) => ({ ...r, [actual.id]: { ...r[actual.id], cumple: e.target.checked ? 1 : 0 } }))}
                />
                El valor cumple la referencia esperada (OK)
              </label>
            </div>
          )}

          {paso === total - 1 && (
            <div className="final-box">
              <h4><Wrench size={16} /> Cierre del caso</h4>
              <label>Resultado*
                <div className="choice-row small">
                  <button className={`choice ${resultado === 'resuelta' ? 'selected' : ''}`} onClick={() => setResultado('resuelta')}>Resuelta</button>
                  <button className={`choice ${resultado === 'escalada' ? 'selected' : ''}`} onClick={() => setResultado('escalada')}>Escalada</button>
                </div>
              </label>
              <label>Causa raíz identificada*
                <select value={causaId} onChange={(e) => setCausaId(e.target.value)}>
                  <option value="">Seleccione la categoría…</option>
                  {causas?.map((c) => <option key={c.id} value={c.id}>{c.categoria}: {c.descripcion}</option>)}
                </select>
              </label>
              <label>Solución aplicada
                <textarea rows={2} value={solucion} onChange={(e) => setSolucion(e.target.value)} placeholder="Describa la solución aplicada…" />
              </label>
              {error && <div className="alert-error">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={() => guardar(true)} disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? 'Guardando…' : 'Finalizar caso'}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, footer, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}