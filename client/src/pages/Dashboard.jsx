import { Link } from 'react-router-dom';
import {
  Activity, Clock, CheckCircle2, ArrowUpCircle, ListTodo
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, Line, LineChart
} from 'recharts';
import { api, useApi } from '../api.js';
import { StatCard, Spinner, Empty } from '../components/ui.jsx';
import { fmtTiempo } from '../utils.js';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.get('/metrics/dashboard'), []);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;
  if (!data) return <div className="page"><Empty message="Sin datos" /></div>;

  const tiempoPorTipo = data.tiempo_por_tipo ?? [];
  const topCausas = data.top_causas ?? [];
  const porTecnico = data.por_tecnico ?? [];
  const porDia = data.por_dia ?? [];
  const maxCausa = topCausas[0]?.c ?? 0;

  const pieData = [
    { name: 'Resueltas', value: data.resueltas ?? 0 },
    { name: 'En diagnóstico', value: data.en_diagnostico ?? 0 },
    { name: 'Escaladas', value: data.escaladas ?? 0 },
    { name: 'Nuevas', value: data.nueva ?? 0 }
  ].filter((d) => d.value > 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Dashboard de Soporte Técnico</h1>
          <p>ONE Telecomunicaciones S.A.S. · Área de Soporte Técnico y Redes</p>
        </div>
        <Link to="/incidencias/nueva" className="btn btn-primary">+ Nueva incidencia</Link>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtTiempo(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmtTiempo(v), 'Tiempo promedio']} />
                <Bar dataKey="ms" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Incidencias registradas (últimos 30 días)</h3>
          <div className="chart" role="img" aria-label="Gráfica de tendencia de incidencias en los últimos 30 días">
            <ResponsiveContainer>
              <LineChart data={porDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="c" name="Incidencias" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
                  const pct = t.total ? Math.round((t.resueltas / t.total) * 100) : 0;
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