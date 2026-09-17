import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, Line, LineChart
} from 'recharts';
import { api, useApi } from '../api.js';
import { Spinner, Empty } from '../components/ui.jsx';
import { fmtTiempo } from '../utils.js';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Indicadores() {
  const { data, loading, error } = useApi(() => api.get('/metrics/dashboard'), []);

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) return <div className="page alert-error" role="alert">{error}</div>;
  if (!data) return <div className="page"><Empty message="Sin datos" /></div>;

  const total = data.total ?? 0;
  const resueltas = data.resueltas ?? 0;
  const pendientes = (data.en_diagnostico ?? 0) + (data.nueva ?? 0);
  const topCausas = data.top_causas ?? [];
  const tiempoPorTipo = data.tiempo_por_tipo ?? [];
  const porTecnico = data.por_tecnico ?? [];
  const porDia = data.por_dia ?? [];

  const tasa = total ? Math.round((resueltas / total) * 100) : 0;
  const pieData = [
    { name: 'Resueltas', value: resueltas },
    { name: 'En diagnóstico', value: data.en_diagnostico ?? 0 },
    { name: 'Escaladas', value: data.escaladas ?? 0 },
    { name: 'Nuevas', value: data.nueva ?? 0 }
  ].filter((d) => d.value > 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Indicadores del Plan de Mejora</h1>
          <p>Indicadores alineados con los objetivos específicos (diagnosticar, analizar, proponer)</p>
        </div>
      </header>

      <section className="grid three" aria-label="Indicadores del plan de mejora">
        <div className="ind-card">
          <div className="ind-num">{tasa}%</div>
          <div className="ind-label">Tasa de resolución</div>
          <div className="ind-sub">{resueltas} de {total} incidencias</div>
        </div>
        <div className="ind-card">
          <div className="ind-num">{fmtTiempo(data.tiempo_promedio_ms)}</div>
          <div className="ind-label">Tiempo promedio de respuesta</div>
          <div className="ind-sub">Min {fmtTiempo(data.tiempo_min_ms)} · Max {fmtTiempo(data.tiempo_max_ms)}</div>
        </div>
        <div className="ind-card">
          <div className="ind-num">{pendientes}</div>
          <div className="ind-label">Casos sin cerrar</div>
          <div className="ind-sub">En diagnóstico + nuevas</div>
        </div>
      </section>

      <section className="card">
        <h3>Objetivo 1 · Diagnosticar: causas más recurrentes</h3>
        <p className="soft">Distribución de causas raíz registradas al cerrar cada caso.</p>
        <div className="chart" role="img" aria-label="Gráfica de causas más recurrentes">
          <ResponsiveContainer>
            <BarChart data={topCausas} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="categoria" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="c" name="Casos" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Objetivo 2 · Analizar: tiempo por tipo de falla</h3>
          <p className="soft">Cuellos de botella detectados en el proceso actual (as-is).</p>
          <div className="chart tall" role="img" aria-label="Gráfica de tiempo promedio por tipo de falla">
            <ResponsiveContainer>
              <BarChart data={tiempoPorTipo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmtTiempo(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmtTiempo(v), 'Tiempo promedio']} />
                <Bar dataKey="ms" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Objetivo 2 · Analizar: carga por técnico</h3>
          <p className="soft">Volumen atendido y capacidad de resolución del equipo.</p>
          {porTecnico.length === 0 ? (
            <Empty message="Aún no hay información por técnico" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Técnico</th><th>Casos</th><th>Resueltos</th><th>%</th><th>Tiempo prom.</th></tr></thead>
                <tbody>
                  {porTecnico.map((t) => {
                    const pct = t.total ? Math.round((t.resueltas / t.total) * 100) : 0;
                    return (
                      <tr key={t.nombre}>
                        <td><strong>{t.nombre}</strong></td>
                        <td>{t.total}</td>
                        <td>{t.resueltas}</td>
                        <td>{pct}%</td>
                        <td>{fmtTiempo(t.ms)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Objetivo 3 · Proponer: volumen de protocolo aplicado</h3>
          <p className="soft">Respuestas del checklist de diagnóstico registradas por los técnicos.</p>
          <div className="chart" role="img" aria-label="Gráfica circular del estado de las incidencias">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Tendencia de registro (30 días)</h3>
          <p className="soft">Incidencias reportadas diariamente; evidencia del aumento de demanda por la expansión a Bogotá.</p>
          <div className="chart" role="img" aria-label="Gráfica de tendencia de registro en 30 días">
            <ResponsiveContainer>
              <LineChart data={porDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="c" name="Incidencias" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}