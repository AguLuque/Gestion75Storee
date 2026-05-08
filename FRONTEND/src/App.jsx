import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Ventas from './pages/Ventas.jsx';
import Compras from './pages/Compras.jsx';
import Gastos from './pages/Gastos.jsx';
import Categorias from './pages/Categorias.jsx';
import Proveedores from './pages/Proveedores.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<Productos />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="compras" element={<Compras />} />
            <Route path="gastos" element={<Gastos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="proveedores" element={<Proveedores />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
