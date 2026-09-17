import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error capturado por el boundary:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login-wrap">
          <div className="card login-card" role="alert">
            <h1>Ocurrió un error inesperado</h1>
            <p className="soft">Recargue la página para continuar. Si el problema persiste, contacte al administrador.</p>
            <button className="btn btn-primary btn-block" onClick={() => window.location.assign('/')}>
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);