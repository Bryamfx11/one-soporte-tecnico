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