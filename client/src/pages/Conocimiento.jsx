import { useState } from 'react';
import { BookOpen, CheckCircle2, XCircle, Gauge } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Skeleton, SkeletonText, Empty } from '../components/ui.jsx';

const ICONOS = {
  'wifi-off': '📡',
  gauge: '⚡',
  tv: '📺',
  activity: '📉',
  network: '📶'
};

export default function Conocimiento() {
  const { data: checklists, loading, error } = useApi(() => api.get('/checklists'), []);
  const [sel, setSel] = useState(null);

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
      </header>

      {!activo ? (
        <section className="grid three kb-grid">
          {checklists.map((c) => (
            <button key={c.id} className="card kb-card" onClick={() => setSel(c.id)}>
              <div className="kb-icon">{ICONOS[c.icono] ?? <BookOpen size={22} />}</div>
              <h3>{c.nombre}</h3>
              <p>{c.descripcion}</p>
              <span className="kb-count"><Gauge size={14} /> {(c.consultas ?? []).length} pasos de diagnóstico</span>
            </button>
          ))}
        </section>
      ) : (
        <section className="card">
          <div className="kb-header">
            <div>
              <h3>{ICONOS[activo.icono] ?? ''} {activo.nombre}</h3>
              <p>{activo.descripcion}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setSel(null)}>← Volver al listado</button>
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
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}