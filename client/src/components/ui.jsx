export function Badge({ children, color = '#64748b' }) {
  return (
    <span className="badge" style={{ backgroundColor: color + '1a', color }}>
      {children}
    </span>
  );
}

export function EstadoBadge({ estado, labels, colors }) {
  return <Badge color={(colors ?? {})[estado] ?? '#64748b'}>{labels[estado] ?? estado}</Badge>;
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
  return <div className="spinner" />;
}

export function Empty({ message }) {
  return <div className="empty">{message}</div>;
}