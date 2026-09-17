import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Incidencias from './pages/Incidencias.jsx';
import IncidenciaDetail from './pages/IncidenciaDetail.jsx';
import NuevaIncidencia from './pages/NuevaIncidencia.jsx';
import Conocimiento from './pages/Conocimiento.jsx';
import Indicadores from './pages/Indicadores.jsx';
import NotFound from './pages/NotFound.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { getToken } from './api.js';

function LoginRoute() {
  if (getToken()) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidencias" element={<Incidencias />} />
        <Route path="/incidencias/nueva" element={<NuevaIncidencia />} />
        <Route path="/incidencias/:id" element={<IncidenciaDetail />} />
        <Route path="/conocimiento" element={<Conocimiento />} />
        <Route path="/indicadores" element={<Indicadores />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </ToastProvider>
  );
}