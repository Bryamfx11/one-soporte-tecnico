import { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

export function Badge({ children, color = '#64748b' }) {
  return (
    <span className="badge" style={{ backgroundColor: color + '1a', color }}>
      {children}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'primary' }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-icon"><Icon size={20} /></div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Cargando" />;
}

export function Empty({ message }) {
  return <div className="empty" role="note">{message}</div>;
}

export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 2 }) {
  return (
    <div className="skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} style={{ width: i % 2 ? '70%' : '100%' }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="card skeleton-table" aria-hidden="true">
      <div className="table">
        <div className="table-head">
          {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} style={{ width: '20%' }} />)}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div className="table-row" key={r}>
            {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} style={{ width: `${30 + ((r + c) % 3) * 15}%` }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, footer, children, role = 'dialog', className = '', focusables }) {
  const ref = useRef(null);
  useFocusTrap(ref, onClose, focusables);

  return (
    <div className="overlay" onClick={onClose}>
      <div ref={ref} className={`modal ${className}`.trim()} role={role} aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Eliminar', cancelLabel = 'Cancelar', onCancel, onConfirm, busy }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      role="alertdialog"
      className="modal-confirm"
      focusables="button:not([disabled])"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Eliminando…' : confirmLabel}</button>
        </>
      }
    >
      <div className="confirm-box">
        <div className="confirm-icon"><AlertTriangle size={28} /></div>
        <p>{message}</p>
      </div>
    </Modal>
  );
}