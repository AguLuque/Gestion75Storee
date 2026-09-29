import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import CuentasDinero from './pages/CuentasDinero.jsx';
import CuentasPorCobrar from './pages/CuentasPorCobrar.jsx';
import CuentasPorPagar from './pages/CuentasPorPagar.jsx';
import Reportes from './pages/Reportes.jsx';

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
              {/* Deudores se unificó en Cuentas por cobrar (deudas manuales): el link viejo redirige */}
              <Route path="deudores" element={<Navigate to="/cuentas-por-cobrar" replace />} />
              <Route path="cuentas-dinero" element={<CuentasDinero />} />
              <Route path="cuentas-por-cobrar" element={<CuentasPorCobrar />} />
              <Route path="cuentas-por-pagar" element={<CuentasPorPagar />} />
              <Route path="reportes" element={<Reportes />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}