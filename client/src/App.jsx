import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Incidencias from './pages/Incidencias.jsx';
import IncidenciaDetail from './pages/IncidenciaDetail.jsx';
import NuevaIncidencia from './pages/NuevaIncidencia.jsx';
import Conocimiento from './pages/Conocimiento.jsx';
import Indicadores from './pages/Indicadores.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidencias" element={<Incidencias />} />
        <Route path="/incidencias/nueva" element={<NuevaIncidencia />} />
        <Route path="/incidencias/:id" element={<IncidenciaDetail />} />
        <Route path="/conocimiento" element={<Conocimiento />} />
        <Route path="/indicadores" element={<Indicadores />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}