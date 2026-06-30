import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  Tag, Truck, DollarSign, Users, X, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '../utils.js';

const items = [
  { a: '/', icono: LayoutDashboard, etiqueta: 'Principal' },
  { a: '/productos', icono: Package, etiqueta: 'Productos' },
  { a: '/ventas', icono: TrendingUp, etiqueta: 'Ventas' },
  { a: '/compras', icono: ShoppingCart, etiqueta: 'Compras' },
  { a: '/gastos', icono: DollarSign, etiqueta: 'Gastos' },
  { a: '/categorias', icono: Tag, etiqueta: 'Categorías' },
  { a: '/proveedores', icono: Truck, etiqueta: 'Proveedores' },
  { a: '/deudores', icono: Users, etiqueta: 'Deudores' },
];

export default function Sidebar({ cerrar, cerrarMenu }) {
  const { cerrarSesion } = useAuth();

  return (
    <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
        <div className="flex items-center justify-center p-0">
          <img
            src="/Logo.png"
            alt="FluxoGest"
            className="h-30 w-auto object-contain"
          />
        </div>
        {cerrar && (
          <button onClick={cerrar} className="text-slate-400 hover:text-slate-600 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ a, icono: Icono, etiqueta }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            onClick={cerrarMenu}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )
            }
          >
            <Icono size={16} />
            {etiqueta}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}