import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Clock, CheckCircle2, ArrowUpCircle, ListTodo, Download, Printer
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, Line, LineChart
} from 'recharts';
import { api, useApi } from '../api.js';
import { StatCard, Skeleton, SkeletonText, Empty } from '../components/ui.jsx';
import { fmtTiempo, downloadCSV, pctResolucion, estadoPieData } from '../utils.js';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];
const GRID = 'var(--border)';

export default function Dashboard() {
  const { data, loading, error, reload } = useApi(() => api.get('/metrics/dashboard'), []);

  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  if (loading && !data) {
    return (
      <div className="page">
        <header className="page-head"><Skeleton style={{ width: 280, height: 30 }} /></header>
        <section className="grid stats">
          {[1, 2, 3, 4, 5].map((i) => <div className="card" key={i}><SkeletonText lines={2} /></div>)}
        </section>
        <section className="grid two">
          <div className="card"><SkeletonText lines={3} /></div>
          <div className="card"><SkeletonText lines={3} /></div>
        </section>
        <section className="card"><Skeleton style={{ height: 120 }} /></section>
      </div>
    );
  }
  if (error) return <div className="page alert-error" role="alert">{error}</div>;
  if (!data) return <div className="page"><Empty message="Sin datos" /></div>;

  const tiempoPorTipo = data.tiempo_por_tipo ?? [];
  const topCausas = data.top_causas ?? [];
  const porTecnico = data.por_tecnico ?? [];
  const porDia = data.por_dia ?? [];
  const maxCausa = topCausas[0]?.c ?? 0;

  const pieData = estadoPieData(data);

  function exportCSV() {
    const rows = [
      ...tiempoPorTipo.map((t) => ['Tiempo promedio', t.nombre, fmtTiempo(t.ms)]),
      ...topCausas.map((c) => ['Causa raíz', c.categoria, String(c.c)]),
      ...porTecnico.map((t) => ['Técnico', t.nombre, `${t.resueltas}/${t.total}`]),
      ...porDia.map((d) => ['Día', d.dia, String(d.c)])
    ];
    downloadCSV(`dashboard-hoy-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Dimensión', 'Etiqueta', 'Valor'], rows);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Dashboard de Soporte Técnico</h1>
          <p>ONE Telecomunicaciones S.A.S. · Área de Soporte Técnico y Redes</p>
        </div>
        <div className="head-right">
          <button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Exportar CSV</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          <Link to="/incidencias/nueva" className="btn btn-primary">+ Nueva incidencia</Link>
        </div>
      </header>

      <section className="grid stats" aria-label="Indicadores principales">
        <StatCard icon={ListTodo} label="Total incidencias" value={data.total ?? 0} tone="slate" />
        <StatCard icon={Clock} label="Tiempo promedio de respuesta" value={fmtTiempo(data.tiempo_promedio_ms)} sub={`Min ${fmtTiempo(data.tiempo_min_ms)} · Max ${fmtTiempo(data.tiempo_max_ms)}`} tone="blue" />
        <StatCard icon={CheckCircle2} label="Resueltas" value={data.resueltas ?? 0} tone="green" />
        <StatCard icon={ArrowUpCircle} label="Escaladas" value={data.escaladas ?? 0} tone="red" />
        <StatCard icon={Activity} label="En diagnóstico / Nuevas" value={(data.en_diagnostico ?? 0) + (data.nueva ?? 0)} tone="amber" />
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Tiempo promedio de atención por tipo de falla</h3>
          <div className="chart tall" role="img" aria-label="Gráfica de tiempo promedio de atención por tipo de falla">
            <ResponsiveContainer>
              <BarChart data={tiempoPorTipo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtTiempo(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmtTiempo(v), 'Tiempo promedio']} />
                <Bar dataKey="ms" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Tiempo promedio de atención por tipo de falla</caption>
            <thead><tr><th>Tipo de falla</th><th>Tiempo promedio</th></tr></thead>
            <tbody>
              {tiempoPorTipo.map((t) => (
                <tr key={t.nombre}><td>{t.nombre}</td><td>{fmtTiempo(t.ms)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Estado de las incidencias</h3>
          <div className="chart tall" role="img" aria-label="Gráfica circular del estado de las incidencias">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="sr-only">
            {pieData.map((d) => `${d.name}: ${d.value}`).join('. ')}
          </p>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Incidencias registradas (últimos 30 días)</h3>
          <div className="chart" role="img" aria-label="Gráfica de tendencia de incidencias en los últimos 30 días">
            <ResponsiveContainer>
              <LineChart data={porDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="c" name="Incidencias" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Incidencias registradas por día en los últimos 30 días</caption>
            <thead><tr><th>Día</th><th>Incidencias</th></tr></thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.dia}><td>{d.dia}</td><td>{d.c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Top causas raíz recurrentes</h3>
          {topCausas.length === 0
            ? <Empty message="Aún no se han registrado causas raíz" />
            : (
              <div className="causa-list">
                {topCausas.map((c, i) => (
                  <div key={c.categoria} className="causa-row">
                    <span className="causa-rank">{i + 1}</span>
                    <span className="causa-name">{c.categoria}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${maxCausa ? (c.c / maxCausa) * 100 : 0}%` }} /></div>
                    <span className="causa-count">{c.c}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </section>

      <section className="card">
        <h3>Desempeño por técnico</h3>
        {porTecnico.length === 0 ? (
          <Empty message="Aún no hay información por técnico" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th>Total atendidas</th>
                  <th>Resueltas</th>
                  <th>% Resolución</th>
                  <th>Tiempo promedio</th>
                </tr>
              </thead>
              <tbody>
                {porTecnico.map((t) => {
                  const pct = pctResolucion(t.total, t.resueltas);
                  return (
                    <tr key={t.nombre}>
                      <td><strong>{t.nombre}</strong></td>
                      <td>{t.total}</td>
                      <td>{t.resueltas}</td>
                      <td>
                        <span className="badge" style={{ color: pct >= 70 ? '#10b981' : '#f59e0b', background: (pct >= 70 ? '#10b981' : '#f59e0b') + '1a' }}>{pct}%</span>
                      </td>
                      <td>{fmtTiempo(t.ms)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}