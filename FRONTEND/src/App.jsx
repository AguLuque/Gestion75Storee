import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext.jsx';
import { DatosProvider } from './context/DatosContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Ventas from './pages/Ventas.jsx';
import Compras from './pages/Compras.jsx';
import Gastos from './pages/Gastos.jsx';
import Categorias from './pages/Categorias.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Deudores from './pages/Deudores.jsx';
import Estadisticas from './pages/Estadisticas.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RutaProtegida>
                  <DatosProvider>
                    <Layout />
                  </DatosProvider>
                </RutaProtegida>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="productos" element={<Productos />} />
              <Route path="ventas" element={<Ventas />} />
              <Route path="compras" element={<Compras />} />
              <Route path="gastos" element={<Gastos />} />
              <Route path="categorias" element={<Categorias />} />
              <Route path="proveedores" element={<Proveedores />} />
              <Route path="deudores" element={<Deudores />} />
              <Route path="estadisticas" element={<Estadisticas />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}