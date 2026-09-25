import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search, TicketCheck, Star, Send } from 'lucide-react';
import { api } from '../api.js';
import { ESTADOS, PRIORIDADES, ESTADO_COLOR, fmtFecha, fmtTiempo } from '../utils.js';

function Estrellas({ valor, onChange, disabled }) {
  return (
    <div className="calif-estrellas" role="radiogroup" aria-label="Valoración del servicio">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          className={`calif-estrella ${n <= valor ? 'on' : ''}`}
          disabled={disabled}
          onClick={() => onChange?.(n)}
        >
          <Star size={20} fill={n <= valor ? '#f59e0b' : 'none'} color="#f59e0b" />
        </button>
      ))}
    </div>
  );
}

export default function Reportar() {
  const [searchParams] = useSearchParams();
  const [tipos, setTipos] = useState([]);
  const [reporte, setReporte] = useState({ nombre: '', telefono: '', email: '', direccion: '', barrio: '', tipo_falla_id: '', sintomas: '', descripcion: '', empresa: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const [busca, setBusca] = useState({ ticket: '', clave: '' });
  const [buscando, setBuscando] = useState(false);
  const [errorBusca, setErrorBusca] = useState('');
  const [consulta, setConsulta] = useState(null);

  const [calif, setCalif] = useState({ valor: 0, comentario: '' });
  const [calificando, setCalificando] = useState(false);
  const [errorCalif, setErrorCalif] = useState('');
  const [calificada, setCalificada] = useState(false);

  // Enlace directo desde el correo de cierre: ?ticket=&clave= precarga la consulta.
  useEffect(() => {
    const ticket = searchParams.get('ticket') ?? '';
    const clave = searchParams.get('clave') ?? '';
    if (ticket && clave) setBusca({ ticket, clave });
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get('ticket') || !searchParams.get('clave')) return;
    setBuscando(true);
    api.get(`/portal/incidencias/${encodeURIComponent(searchParams.get('ticket'))}?clave=${encodeURIComponent(searchParams.get('clave'))}`)
      .then((res) => setConsulta(res))
      .catch((err) => setErrorBusca(err.message))
      .finally(() => setBuscando(false));
  }, [searchParams]);

  useEffect(() => {
    api.get('/portal/tipos').then(setTipos).catch(() => setTipos([]));
  }, []);

  function setCampo(campo, valor) {
    setReporte((r) => ({ ...r, [campo]: valor }));
    if (error) setError('');
  }

  async function submitReporte(e) {
    e.preventDefault();
    setError('');
    if (!reporte.nombre.trim() || !reporte.tipo_falla_id) {
      setError('Indique su nombre y el tipo de novedad para continuar.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.post('/portal/reportes', reporte);
      setResultado(res);
      setBusca({ ticket: res.numero_ticket, clave: res.clave_seguimiento });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function submitBusca(e) {
    e.preventDefault();
    setErrorBusca('');
    setConsulta(null);
    setCalificada(false);
    setCalif({ valor: 0, comentario: '' });
    const ticket = busca.ticket.trim().toUpperCase();
    const clave = busca.clave.trim();
    if (!ticket || !clave) {
      setErrorBusca('Ingrese el número de ticket y la clave de seguimiento.');
      return;
    }
    setBuscando(true);
    try {
      const res = await api.get(`/portal/incidencias/${encodeURIComponent(ticket)}?clave=${encodeURIComponent(clave)}`);
      setConsulta(res);
    } catch (err) {
      setErrorBusca(err.message);
    } finally {
      setBuscando(false);
    }
  }

  async function enviarCalificacion(e) {
    e.preventDefault();
    if (calif.valor < 1) {
      setErrorCalif('Seleccione una valoración de 1 a 5 estrellas.');
      return;
    }
    setCalificando(true);
    setErrorCalif('');
    try {
      const res = await api.post('/portal/calificar', {
        ticket: busca.ticket.trim().toUpperCase(),
        clave: busca.clave.trim(),
        valor: calif.valor,
        comentario: calif.comentario.trim()
      });
      setCalificada(true);
      setConsulta((c) => ({ ...c, calificacion: { valor: res.valor, comentario: res.comentario } }));
    } catch (err) {
      setErrorCalif(err.message);
    } finally {
      setCalificando(false);
    }
  }

  return (
    <div className="portal-wrap">
      <div className="portal-brand">
        <img className="login-logo-img" src="/logo-one.png" alt="Logo ONE Telecomunicaciones" />
        <h1>ONETec</h1>
        <p>Portal del cliente · ONE Telecomunicaciones</p>
      </div>

      <div className="grid two portal-grid">
        <section className="card">
          <h3><ClipboardList size={16} /> Reporte de novedad</h3>
          <form className="form" onSubmit={submitReporte}>
            <label>
              <span>Nombre del cliente *</span>
              <input value={reporte.nombre} onChange={(e) => setCampo('nombre', e.target.value)} placeholder="Su nombre" autoComplete="name" />
            </label>
            <label>
              <span>Teléfono</span>
              <input value={reporte.telefono} onChange={(e) => setCampo('telefono', e.target.value)} placeholder="Ej: 300 000 0000" autoComplete="tel" />
            </label>
            <label>
              <span>Correo (para recibir avisos de estado)</span>
              <input type="email" value={reporte.email} onChange={(e) => setCampo('email', e.target.value)} placeholder="cliente@correo.com" autoComplete="email" />
            </label>
            <label>
              <span>Barrio</span>
              <input value={reporte.barrio} onChange={(e) => setCampo('barrio', e.target.value)} placeholder="Barrio del servicio" />
            </label>
            <label>
              <span>Dirección</span>
              <input value={reporte.direccion} onChange={(e) => setCampo('direccion', e.target.value)} placeholder="Dirección del servicio" autoComplete="street-address" />
            </label>
            <label>
              <span>Tipo de novedad *</span>
              <select value={reporte.tipo_falla_id} onChange={(e) => { setReporte((r) => ({ ...r, tipo_falla_id: e.target.value })); if (error) setError(''); }}>
                <option value="">Seleccione…</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <label>
              <span>Síntomas</span>
              <textarea rows={2} value={reporte.sintomas} onChange={(e) => setCampo('sintomas', e.target.value)} placeholder="Qué está fallando (ej: se cae el internet cada hora)" />
            </label>
            <label>
              <span>Descripción</span>
              <textarea rows={2} value={reporte.descripcion} onChange={(e) => setCampo('descripcion', e.target.value)} placeholder="Detalles adicionales" />
            </label>
            <input
              type="text"
              value={reporte.empresa}
              onChange={(e) => setCampo('empresa', e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="portal-honeypot"
              aria-hidden="true"
            />

            {error && <div className="alert-error" role="alert">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar reporte'}
            </button>

            {resultado && (
              <div className="portal-result" role="status">
                <p className="soft"><strong>Su novedad fue registrada.</strong> Guarde estos datos para consultar el estado:</p>
                <div className="portal-dato"><span>Ticket</span><strong>{resultado.numero_ticket}</strong></div>
                <div className="portal-dato"><span>Clave de seguimiento</span><strong>{resultado.clave_seguimiento}</strong></div>
                <TicketCheck size={16} className="portal-result-icon" role="presentation" />
              </div>
            )}
          </form>
        </section>

        <section className="card">
          <h3><Search size={16} /> Consultar estado</h3>
          <p className="soft">Ingrese el ticket y la clave que recibió al reportar su novedad.</p>
          <form className="form" onSubmit={submitBusca}>
            <label>
              <span>Número de ticket</span>
              <input value={busca.ticket} onChange={(e) => { setBusca((b) => ({ ...b, ticket: e.target.value })); if (errorBusca) setErrorBusca(''); }} placeholder="Ej: ONE-0025" />
            </label>
            <label>
              <span>Clave de seguimiento</span>
              <input value={busca.clave} onChange={(e) => { setBusca((b) => ({ ...b, clave: e.target.value })); if (errorBusca) setErrorBusca(''); }} placeholder="6 dígitos" inputMode="numeric" autoComplete="one-time-code" />
            </label>

            {errorBusca && <div className="alert-error" role="alert">{errorBusca}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={buscando}>
              {buscando ? 'Consultando…' : 'Consultar estado'}
            </button>

            {consulta && (
              <div className="portal-consulta" role="status">
                <div className="portal-consulta-head">
                  <strong>{consulta.numero_ticket}</strong>
                  <span className="badge" style={{ backgroundColor: ESTADO_COLOR[consulta.estado] ?? '#64748b' }}>
                    {ESTADOS[consulta.estado] ?? consulta.estado}
                  </span>
                </div>
                <dl className="portal-fila">
                  <dt>Tipo de novedad</dt><dd>{consulta.tipo_falla}</dd>
                  <dt>Prioridad</dt><dd>{PRIORIDADES[consulta.prioridad] ?? consulta.prioridad}</dd>
                  <dt>Registrada</dt><dd>{fmtFecha(consulta.creada_en)}</dd>
                  <dt>Técnico asignado</dt><dd>{consulta.tecnico ?? 'Pendiente de asignación'}</dd>
                  {consulta.estado === 'resuelta' && (
                    <>
                      <dt>Resuelta</dt><dd>{fmtFecha(consulta.resuelta_en)} ({fmtTiempo(consulta.tiempo_ms)})</dd>
                      <dt>Solución aplicada</dt><dd>{consulta.solucion_aplicada || '—'}</dd>
                    </>
                  )}
                </dl>

                {consulta.estado === 'resuelta' && (
                  consulta.calificacion ? (
                    <div className="calif-box" role="status">
                      <h4>Gracias por su valoración</h4>
                      <Estrellas valor={consulta.calificacion.valor} disabled />
                      {consulta.calificacion.comentario && <p className="soft">{consulta.calificacion.comentario}</p>}
                    </div>
                  ) : (
                    <form className="calif-box" onSubmit={enviarCalificacion}>
                      <h4>¿Cómo fue la atención recibida?</h4>
                      <Estrellas valor={calif.valor} onChange={(v) => { setCalif((c) => ({ ...c, valor: v })); setErrorCalif(''); }} />
                      <label>
                        <span>Comentario (opcional)</span>
                        <textarea rows={2} maxLength={500} value={calif.comentario} onChange={(e) => setCalif((c) => ({ ...c, comentario: e.target.value }))} placeholder="Cuéntenos su experiencia…" />
                      </label>
                      {errorCalif && <div className="alert-error" role="alert">{errorCalif}</div>}
                      {calificada && <div className="alert-ok" role="status">Valoración enviada. ¡Gracias por ayudarnos a mejorar!</div>}
                      <button type="submit" className="btn btn-primary btn-block" disabled={calificando}>
                        <Send size={14} /> {calificando ? 'Enviando…' : 'Enviar valoración'}
                      </button>
                    </form>
                  )
                )}
              </div>
            )}
          </form>
        </section>
      </div>

      <p className="portal-foot">
        ¿Pertenece al equipo de soporte? <Link to="/login">Ingrese al sistema</Link>
      </p>
    </div>
  );
}