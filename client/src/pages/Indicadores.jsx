import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, Line, LineChart
} from 'recharts';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { api, useApi } from '../api.js';
import { useLiveData } from '../sse.js';
import { Skeleton, SkeletonText, Empty } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtTiempo, downloadCSV, pctResolucion, estadoPieData } from '../utils.js';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];
const GRID = 'var(--border)';

export default function Indicadores() {
  const { data, loading, error, reload } = useApi(() => api.get('/metrics/dashboard'), []);
  const showToast = useToast();
  const [actualizado, setActualizado] = useState(null);

  useLiveData(reload, { onChange: () => setActualizado(new Date()) });

  useEffect(() => {
    if (data && !actualizado) setActualizado(new Date());
  }, [data, actualizado]);

  if (loading && !data) {
    return (
      <div className="page">
        <header className="page-head"><Skeleton style={{ width: 260, height: 30 }} /></header>
        <section className="grid three">
          {[1, 2, 3].map((i) => <div className="card" key={i}><SkeletonText lines={2} /></div>)}
        </section>
        <section className="card"><Skeleton style={{ height: 200 }} /></section>
      </div>
    );
  }
  if (error) return <div className="page alert-error" role="alert">{error}</div>;
  if (!data) return <div className="page"><Empty message="Sin datos" /></div>;

  const total = data.total ?? 0;
  const resueltas = data.resueltas ?? 0;
  const pendientes = (data.en_diagnostico ?? 0) + (data.nueva ?? 0);
  const topCausas = data.top_causas ?? [];
  const tiempoPorTipo = data.tiempo_por_tipo ?? [];
  const porTecnico = data.por_tecnico ?? [];
  const porDia = data.por_dia ?? [];

  const tasa = pctResolucion(total, resueltas);
  const pieData = estadoPieData(data);

  function exportCSV() {
    const rows = [
      ['Total', '', String(total)],
      ['Resueltas', '', String(resueltas)],
      ['Tasa resolución', '', `${tasa}%`],
      ['Tiempo promedio', '', fmtTiempo(data.tiempo_promedio_ms)],
      ...topCausas.map((c) => ['Causa raíz', c.categoria, String(c.c)]),
      ...tiempoPorTipo.map((t) => ['Tiempo por tipo', t.nombre, fmtTiempo(t.ms)]),
      ...porTecnico.map((t) => ['Técnico', t.nombre, `${t.resueltas}/${t.total}`])
    ];
    downloadCSV(`indicadores-hoy-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Dimensión', 'Etiqueta', 'Valor'], rows);
    showToast('success', 'Reporte CSV descargado.');
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Indicadores de Operación</h1>
          <p>Desempeño del servicio de soporte técnico y gestión de incidentes</p>
        </div>
        <div className="head-right">
          <span className="badge live-pill" style={{ color: '#10b981', background: '#10b9811a' }}>
            <RefreshCw size={13} /> {actualizado ? `Actualizado ${actualizado.toLocaleTimeString('es-CO')}` : 'Conectando…'}
          </span>
          <button className="btn btn-ghost" onClick={exportCSV}><Download size={16} /> Exportar CSV</button>
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
        </div>
      </header>

      <section className="grid three" aria-label="Indicadores de operación">
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
        <h3>Análisis de causa raíz</h3>
        <p className="soft">Distribución de causas raíz registradas al cerrar cada caso.</p>
        {topCausas.length === 0 ? (
          <Empty message="Aún no hay causas raíz registradas" />
        ) : (
          <>
            <div className="chart" role="img" aria-label="Gráfica de causas más recurrentes">
              <ResponsiveContainer>
                <BarChart data={topCausas} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="categoria" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="c" name="Casos" fill="#ef4444" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Causas más recurrentes</caption>
              <thead><tr><th>Causa</th><th>Casos</th></tr></thead>
              <tbody>
                {topCausas.map((c) => (
                  <tr key={c.categoria}><td>{c.categoria}</td><td>{c.c}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="grid two">
        <div className="card">
          <h3>Tiempos de atención por tipo de falla</h3>
          <p className="soft">Cuellos de botella en el proceso de diagnóstico y resolución (as-is).</p>
          {tiempoPorTipo.length === 0 ? (
            <Empty message="Aún no hay datos de tiempos por tipo de falla" />
          ) : (
            <>
              <div className="chart tall" role="img" aria-label="Gráfica de tiempo promedio por tipo de falla">
                <ResponsiveContainer>
                  <BarChart data={tiempoPorTipo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => fmtTiempo(v)} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [fmtTiempo(v), 'Tiempo promedio']} />
                    <Bar dataKey="ms" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Tiempo promedio por tipo de falla</caption>
                <thead><tr><th>Tipo de falla</th><th>Tiempo promedio</th></tr></thead>
                <tbody>
                  {tiempoPorTipo.map((t) => (
                    <tr key={t.nombre}><td>{t.nombre}</td><td>{fmtTiempo(t.ms)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="card">
          <h3>Carga de trabajo por técnico</h3>
          <p className="soft">Volumen atendido y capacidad de resolución del equipo.</p>
          {porTecnico.length === 0 ? (
            <Empty message="Aún no hay información por técnico" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Técnico</th><th>Casos</th><th>Resueltos</th><th>%</th><th>Tiempo prom.</th></tr></thead>
                <tbody>
                  {porTecnico.map((t) => {
                    const pct = pctResolucion(t.total, t.resueltas);
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
          <h3>Estado de las incidencias</h3>
          <p className="soft">Respuestas del protocolo de diagnóstico registradas por los técnicos.</p>
          {pieData.reduce((s, d) => s + d.value, 0) === 0 ? (
            <Empty message="Aún no hay incidencias registradas" />
          ) : (
            <>
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
              <p className="sr-only">
                {pieData.map((d) => `${d.name}: ${d.value}`).join('. ')}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <h3>Tendencia de registro (30 días)</h3>
          <p className="soft">Incidencias reportadas diariamente; evidencia del aumento de demanda por la expansión a Bogotá.</p>
          {porDia.length === 0 ? (
            <Empty message="Aún no hay registros en los últimos 30 días" />
          ) : (
            <>
              <div className="chart" role="img" aria-label="Gráfica de tendencia de registro en 30 días">
                <ResponsiveContainer>
                  <LineChart data={porDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="c" name="Incidencias" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Tendencia de registro por día</caption>
                <thead><tr><th>Día</th><th>Incidencias</th></tr></thead>
                <tbody>
                  {porDia.map((d) => (
                    <tr key={d.dia}><td>{d.dia}</td><td>{d.c}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </div>
  );
}