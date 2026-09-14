import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="card not-found">
        <h1>404</h1>
        <p>La página que buscas no existe.</p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </div>
  );
}