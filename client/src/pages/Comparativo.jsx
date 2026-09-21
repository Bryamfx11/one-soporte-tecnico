import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { api, useApi } from '../api.js';
import { Skeleton, SkeletonText, Empty } from '../components/ui.jsx';
import { fmtTiempo } from '../utils.js';

const GRID = 'var(--border)';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function mesLocalActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nombreMes(mes) {
  const [anio, mesNum] = mes.split('-').map(Number);
  return `${MESES[mesNum - 1]} ${anio}`;
}

function pctCambio(actual, anterior) {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}

function Delta({ valor, mejor }) {
  if (valor == null) return <span className="delta neutral">sin datos previos</span>;
  const abs = Math.abs(valor);
  const bueno = mejor === true ? valor < 0 : mejor === false ? valor > 0 : true;
  return (
    <span className={`delta ${mejor == null ? 'neutral' : bueno ? 'good' : 'bad'}`}>
      {valor >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {valor >= 0 ? '+' : ''}{abs.toFixed(0)}%
    </span>
  );
}

function Kpi({ titulo, sub, actual, anterior, fmt, mejor }) {
  const d = pctCambio(actual, anterior);
  return (
    <div className="ind-card">
      <div className="ind-num">{fmt(actual)}</div>
      <div className="ind-label">{titulo}</div>
      <div className="ind-sub">{sub}: {fmt(anterior)}</div>
      <Delta valor={d} mejor={mejor} />
    </div>
  );
}

export default function Comparativo() {
  const [mes, setMes] = useState(mesLocalActual);
  const { data, loading, error } = useApi(() => api.get(`/metrics/comparativo?mes=${mes}`), [mes]);

  if (loading && !data) {
    return (
      <div className="page">
        <header className="page-head"><Skeleton style={{ width: 260, height: 30 }} /></header>
        <section className="grid three">
          {[1, 2, 3].map((i) => <div className="card" key={i}><SkeletonText lines={2} /></div>)}
        </section>
        <section className="card"><Skeleton style={{ height: 220 }} /></section>
      </div>
    );
  }
  if (error) return <div className="page alert-error" role="alert">{error}</div>;
  if (!data) return <div className="page"><Empty message="Sin datos" /></div>;

  const { actual, anterior, por_tipo, por_tecnico, causas } = data;
  const hasData = (actual.nuevas + actual.resueltas + actual.pendientes) > 0;

  const tecMap = new Map();
  for (const t of por_tecnico.anterior) tecMap.set(t.nombre, { nombre: t.nombre, anterior: t.total });
  for (const t of por_tecnico.actual) {
    const prev = tecMap.get(t.nombre);
    if (prev) { prev.actual = t.total; prev.resueltas = t.resueltas; }
    else tecMap.set(t.nombre, { nombre: t.nombre, actual: t.total, anterior: 0, resueltas: t.resueltas });
  }
  const tecnicos = [...tecMap.values()];

  if (!hasData) return (
    <div className="page">
      <PageHead mes={mes} setMes={setMes} data={data} />
      <Empty message={`No hay incidencias registradas en ${nombreMes(mes)}`} />
    </div>
  );

  return (
    <div className="page">
      <PageHead mes={mes} setMes={setMes} data={data} />

      <section className="grid four" aria-label="Comparativo de indicadores">
        <Kpi titulo="Incidencias nuevas" sub="Anterior" actual={actual.nuevas} anterior={anterior.nuevas} fmt={(v) => v} mejor={null} />
        <Kpi titulo="Casos resueltos" sub="Anterior" actual={actual.resueltas} anterior={anterior.resueltas} fmt={(v) => v} mejor={false} />
        <Kpi titulo="Pendientes al cierre" sub="Anterior" actual={actual.pendientes} anterior={anterior.pendientes} fmt={(v) => v} mejor={true} />
        <Kpi titulo="Tiempo promedio" sub="Anterior" actual={actual.tiempo_promedio_ms ?? null} anterior={anterior.tiempo_promedio_ms ?? null} fmt={(v) => (v == null ? '—' : fmtTiempo(v))} mejor={true} />
      </section>

      <section className="card">
        <h3>Incidencias nuevas por tipo de falla · {nombreMes(mes)} vs {nombreMes(data.mes_anterior)}</h3>
        {por_tipo.length === 0 ? (
          <Empty message="Aún no hay datos por tipo de falla" />
        ) : (
          <div className="chart" role="img" aria-label="Comparativa de incidencias por tipo de falla">
            <ResponsiveContainer>
              <BarChart data={por_tipo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="actual" name={nombreMes(mes)} fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="anterior" name={nombreMes(data.mes_anterior)} fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Carga de trabajo por técnico</h3>
          <p className="soft">Casos creados en el mes seleccionado y en el anterior.</p>
          {tecnicos.length === 0 ? (
            <Empty message="Sin casos asignados a técnicos en el período" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Técnico</th><th>{nombreMes(mes)}</th><th>{nombreMes(data.mes_anterior)}</th></tr></thead>
                <tbody>
                  {tecnicos.map((t) => (
                    <tr key={t.nombre}>
                      <td><strong>{t.nombre}</strong></td>
                      <td>{t.actual ?? 0}</td>
                      <td>{t.anterior ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Causas raíz · {nombreMes(mes)}</h3>
          <p className="soft">Las causas más recurrentes entre los casos del mes.</p>
          {causas.length === 0 ? (
            <Empty message="Aún no hay causas raíz registradas en el mes" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Causa</th><th>Casos</th></tr></thead>
                <tbody>
                  {causas.map((c) => (
                    <tr key={c.categoria}><td>{c.categoria}</td><td>{c.c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PageHead({ mes, setMes, data }) {
  return (
    <header className="page-head">
      <div>
        <h1>Comparativo mensual</h1>
        <p>Mes seleccionado: <strong>{nombreMes(mes)}</strong> · anterior: {nombreMes(data.mes_anterior)}</p>
      </div>
      <div className="head-right">
        <label className="month-picker">
          <Calendar size={16} />
          <input type="month" value={mes} max={mesLocalActual()} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes a comparar" />
        </label>
      </div>
    </header>
  );
}