import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Spinner } from './components/ui.jsx';
import { getToken, getUser } from './api.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Incidencias = lazy(() => import('./pages/Incidencias.jsx'));
const IncidenciaDetail = lazy(() => import('./pages/IncidenciaDetail.jsx'));
const NuevaIncidencia = lazy(() => import('./pages/NuevaIncidencia.jsx'));
const Conocimiento = lazy(() => import('./pages/Conocimiento.jsx'));
const Indicadores = lazy(() => import('./pages/Indicadores.jsx'));
const Ajustes = lazy(() => import('./pages/Ajustes.jsx'));
const Usuarios = lazy(() => import('./pages/Usuarios.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function Fallback() {
  return <div className="page"><Spinner /></div>;
}

function LoginRoute() {
  if (getToken()) return <Navigate to="/" replace />;
  return <Login />;
}

function AdminRoute({ children }) {
  const user = getUser();
  if (user?.rol !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidencias" element={<Incidencias />} />
            <Route path="/incidencias/nueva" element={<NuevaIncidencia />} />
            <Route path="/incidencias/:id" element={<IncidenciaDetail />} />
            <Route path="/conocimiento" element={<Conocimiento />} />
            <Route path="/indicadores" element={<Indicadores />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}